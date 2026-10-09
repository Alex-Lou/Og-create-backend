// Progression de l'Épreuve gardée dans progress.timer_progress : questions réussies, chapitres ouverts.
// Une écriture fusionne avec l'existant : une réussite ou un chapitre déjà gardés ne se perdent jamais.
// Le navigateur ne fait qu'annoncer : une question n'est ajoutée que si le serveur l'a jugée réussie et payée
// (coin_ledger, 'timer-question', services/trial.js), dans son niveau et son chapitre ; un chapitre n'est scellé que
// si toutes ses questions sont réussies. Les records ne viennent pas non plus du navigateur : ce sont les scores comptés
// par le serveur (coin_ledger, 'timer-record').
const db = require('../config/db');

const LEVELS = ['Facile', 'Moyen', 'Difficile'];
const empty = () => ({ completedQuestions: {}, unlockedCategories: {} });

const chapterKey = (level, category) => `${level}\u0000${category}`;
const asList = value => (Array.isArray(value) ? value : []);
const asObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

// Ce que le serveur sait des chapitres pour ce joueur : Map(niveau + chapitre → { total, solved: Set(id) }), avec
// total = questions du chapitre et solved = celles qu'il lui a payées
async function chaptersOf(userId, conn = db) {
    const { rows } = await conn.query(
        `SELECT q.level, q.category, COUNT(*)::int AS total,
                COALESCE(array_agg(q.id) FILTER (WHERE l.id IS NOT NULL), '{}') AS solved
         FROM timer_questions q
         LEFT JOIN coin_ledger l ON l.user_id = $1 AND l.reason = 'timer-question' AND l.ref = q.id::text
         GROUP BY q.level, q.category`, [userId]);
    return new Map(rows.map(row => [chapterKey(row.level, row.category), { total: row.total, solved: new Set(row.solved) }]));
}

// Fusionne l'annonce du navigateur (`next`) dans la progression gardée (`current`), d'après `chapters` (chaptersOf).
// Ce qui est gardé reste tel quel (un joueur ne recule jamais, même pour une entrée d'avant cette règle) ; de l'annonce,
// seules les questions prouvées et les chapitres complets sont ajoutés. Les autres champs (bestScores…) sont ignorés.
function merge(current, next, chapters) {
    const kept = asObject(current.completedQuestions);
    const sent = asObject(next.completedQuestions);
    const completedQuestions = {};
    for (const [level, categories] of Object.entries(kept)) {
        completedQuestions[level] = Object.fromEntries(Object.entries(asObject(categories)).map(([category, ids]) => [category, [...asList(ids)]]));
    }
    for (const level of LEVELS) {
        for (const [category, ids] of Object.entries(asObject(sent[level]))) {
            const proven = chapters.get(chapterKey(level, category))?.solved;
            if (!proven) continue;
            const done = completedQuestions[level]?.[category] || [];
            const fresh = [...new Set(asList(ids).filter(id => proven.has(id) && !done.includes(id)))];
            if (!fresh.length) continue;
            completedQuestions[level] = { ...completedQuestions[level], [category]: [...done, ...fresh] };
        }
    }

    const complete = (level, category) => {
        const chapter = chapters.get(chapterKey(level, category));
        return Boolean(chapter) && chapter.total > 0 && asList(completedQuestions[level]?.[category]).length >= chapter.total;
    };
    const unlockedCategories = Object.fromEntries(LEVELS.map(level => {
        const sealed = asList(current.unlockedCategories?.[level]);
        const asked = asList(next.unlockedCategories?.[level]).filter(category => typeof category === 'string' && complete(level, category));
        return [level, [...new Set([...sealed, ...asked])]];
    }));
    return { completedQuestions, unlockedCategories };
}

// Meilleur score par niveau, d'après les bonus de record versés par le serveur (trial.finish)
async function records(userId) {
    const { rows } = await db.query(
        `SELECT split_part(ref, ':', 1) AS level, MAX(split_part(ref, ':', 2)::int) AS best
         FROM coin_ledger WHERE user_id = $1 AND reason = 'timer-record' GROUP BY 1`, [userId]);
    const best = Object.fromEntries(rows.map(row => [row.level, row.best]));
    return Object.fromEntries(LEVELS.map(level => [level, best[level] || 0]));
}

async function load(userId) {
    const { rows } = await db.query('SELECT timer_progress FROM progress WHERE user_id = $1', [userId]);
    return { ...(rows[0]?.timer_progress || empty()), bestScores: await records(userId) };
}

// Fusionne `next` dans la progression du joueur (ligne verrouillée : deux envois simultanés s'additionnent)
async function update(userId, next) {
    await db.query('INSERT INTO progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const merged = await db.transaction(async conn => {
        const { rows } = await conn.query('SELECT timer_progress FROM progress WHERE user_id = $1 FOR UPDATE', [userId]);
        const saved = merge(rows[0]?.timer_progress || empty(), next, await chaptersOf(userId, conn));
        await conn.query('UPDATE progress SET timer_progress = $1, last_saved = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(saved), userId]);
        return saved;
    });
    return { ...merged, bestScores: await records(userId) };
}

module.exports = { load, update, merge };
