// L'Épreuve tenue par le serveur : il connaît les réponses, juge chaque mélange, tient le chrono et le score.
// Le navigateur ne reçoit que la consigne ; les points et le bonus de record sont versés ici.
const db = require('../config/db');
const ledger = require('./ledger');
const { BASE_ELEMENTS } = require('./recipeBook');

// Tolérance sur la fin du sablier (latence du réseau, horloges)
const GRACE_SECONDS = 5;
const FREE_JOKERS = 2;
// Bonus de record : 5 écus par réussite, versé quand le record du niveau monte
const RECORD_BONUS = 5;

const asList = value => (Array.isArray(value) ? value : []);

async function question(id) {
    const { rows } = await db.query(
        'SELECT id, level, category, timer, points, valid_answers, initial_elements FROM timer_questions WHERE id = $1', [id]);
    return rows[0] || null;
}

// Éléments en main au début d'une question
function startingElements(q) {
    const initial = q.initial_elements || {};
    return [...new Set([...BASE_ELEMENTS, ...asList(initial.required), ...asList(initial.additional)])];
}

// Nombre de bonnes réponses à réunir
function required(q) {
    const answers = asList(q.valid_answers);
    const mode = q.initial_elements?.validationMode || 'any';
    if (mode === 'multiple') return Math.min(answers.length, Number(q.initial_elements.requiredCount) || 1);
    if (mode === 'all') return answers.length;
    return 1;
}

// Nouvelle question. Le sablier repart au lancement et à chaque nouveau chapitre (comme à l'écran) ;
// sinon il reprend là où la réussite précédente l'avait mis en pause.
async function start(owner, q, launch) {
    const { rows } = await db.query(
        `SELECT level, category, deadline, paused_at, solved_ids FROM play_runs WHERE owner = $1 AND mode = 'timer'`, [owner.key]);
    const previous = rows[0];
    const fresh = launch || !previous || !previous.deadline || previous.level !== q.level || previous.category !== q.category;
    const solvedIds = launch || !previous || previous.level !== q.level ? [] : asList(previous.solved_ids);
    const inventory = startingElements(q);
    const result = await db.query(
        `INSERT INTO play_runs (owner, mode, context, inventory, free_jokers, level, category, deadline, paused_at, solved, solved_ids)
         VALUES ($1, 'timer', $2, $3, $4, $5, $6,
                 CASE WHEN $7 THEN NOW() + make_interval(secs => $8)
                      ELSE $9::timestamptz + (NOW() - COALESCE($10::timestamptz, NOW())) END,
                 NULL, FALSE, $11)
         ON CONFLICT (owner, mode) DO UPDATE SET
           context = EXCLUDED.context, inventory = EXCLUDED.inventory, level = EXCLUDED.level,
           category = EXCLUDED.category, deadline = EXCLUDED.deadline, paused_at = NULL, solved = FALSE,
           solved_ids = EXCLUDED.solved_ids, updated_at = NOW(),
           free_jokers = CASE WHEN $12 THEN EXCLUDED.free_jokers ELSE play_runs.free_jokers END
         RETURNING free_jokers, deadline`,
        [owner.key, String(q.id), JSON.stringify(inventory), FREE_JOKERS, q.level, q.category,
            fresh, q.timer, previous?.deadline || null, previous?.paused_at || null, JSON.stringify(solvedIds), !!launch]
    );
    return { inventory, freeJokers: result.rows[0].free_jokers, required: required(q) };
}

// Joker de temps : le sablier du serveur s'allonge aussi
async function addTime(owner, seconds) {
    await db.query(
        `UPDATE play_runs SET deadline = deadline + make_interval(secs => $2) WHERE owner = $1 AND mode = 'timer'`,
        [owner.key, seconds]);
}

// Après un mélange réussi : la question est-elle résolue ? Paie ses points la première fois (compte).
async function judge(owner, inventory) {
    const { rows } = await db.query(
        `SELECT context, solved, deadline + make_interval(secs => $2) < NOW() AS late
         FROM play_runs WHERE owner = $1 AND mode = 'timer'`, [owner.key, GRACE_SECONDS]);
    const run = rows[0];
    if (!run || run.solved) return null;
    const q = await question(Number(run.context));
    if (!q) return null;
    const have = new Set(inventory);
    const need = required(q);
    const found = Math.min(need, asList(q.valid_answers).filter(a => have.has(a)).length);
    if (found < need) return { found, required: need };
    if (run.late) return { found, required: need, late: true };

    const marked = await db.query(
        `UPDATE play_runs SET solved = TRUE, paused_at = NOW(),
           solved_ids = CASE WHEN solved_ids @> to_jsonb($2::int) THEN solved_ids ELSE solved_ids || to_jsonb($2::int) END
         WHERE owner = $1 AND mode = 'timer' AND solved = FALSE AND context = $3 RETURNING 1`,
        [owner.key, q.id, String(q.id)]);
    if (!marked.rowCount) return null;
    const verdict = { solved: true, found, required: need, points: q.points };
    if (owner.kind === 'user') Object.assign(verdict, await ledger.credit(owner.id, q.points, 'timer-question', q.id));
    return verdict;
}

// Fin du sablier : score compté par le serveur ; bonus si le record du niveau monte (compte)
async function finish(owner) {
    const { rows } = await db.query(
        `DELETE FROM play_runs WHERE owner = $1 AND mode = 'timer' RETURNING level, solved_ids`, [owner.key]);
    const score = asList(rows[0]?.solved_ids).length;
    const level = rows[0]?.level;
    if (owner.kind !== 'user' || !score || !level) return { score, credited: false };
    const { rows: [{ best }] } = await db.query(
        `SELECT COALESCE(MAX(split_part(ref, ':', 2)::int), 0) AS best
         FROM coin_ledger WHERE user_id = $1 AND reason = 'timer-record' AND split_part(ref, ':', 1) = $2`,
        [owner.id, level]);
    if (score <= best) return { score, credited: false, coins: await ledger.balance(owner.id) };
    return { score, ...(await ledger.credit(owner.id, score * RECORD_BONUS, 'timer-record', `${level}:${score}`)) };
}

module.exports = { question, start, addTime, judge, finish, FREE_JOKERS };
