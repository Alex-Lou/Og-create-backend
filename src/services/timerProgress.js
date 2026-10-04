// Progression de l'Épreuve gardée dans progress.timer_progress : questions réussies, chapitres ouverts.
// Une écriture fusionne avec l'existant : une réussite ou un chapitre ne se perdent jamais.
// Les records ne viennent pas du navigateur : ce sont les scores comptés par le serveur (coin_ledger, 'timer-record').
const db = require('../config/db');

const LEVELS = ['Facile', 'Moyen', 'Difficile'];
const empty = () => ({ completedQuestions: {}, unlockedCategories: {} });

function merge(current, next) {
    return {
        completedQuestions: { ...(current.completedQuestions || {}), ...(next.completedQuestions || {}) },
        unlockedCategories: Object.fromEntries(LEVELS.map(level => [level, [...new Set([
            ...(current.unlockedCategories?.[level] || []),
            ...(next.unlockedCategories?.[level] || [])
        ])]]))
    };
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
        const saved = merge(rows[0]?.timer_progress || empty(), next);
        await conn.query('UPDATE progress SET timer_progress = $1, last_saved = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(saved), userId]);
        return saved;
    });
    return { ...merged, bestScores: await records(userId) };
}

module.exports = { load, update, merge };
