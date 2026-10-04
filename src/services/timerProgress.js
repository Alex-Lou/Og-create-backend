// Progression de l'Épreuve gardée dans progress.timer_progress : questions réussies, chapitres ouverts, records.
// Une écriture fusionne avec l'existant : une réussite, un chapitre ou un record ne se perdent jamais.
const db = require('../config/db');

const LEVELS = ['Facile', 'Moyen', 'Difficile'];
const empty = () => ({ completedQuestions: {}, unlockedCategories: {}, bestScores: { Facile: 0, Moyen: 0, Difficile: 0 } });

function merge(current, next) {
    return {
        completedQuestions: { ...(current.completedQuestions || {}), ...(next.completedQuestions || {}) },
        unlockedCategories: Object.fromEntries(LEVELS.map(level => [level, [...new Set([
            ...(current.unlockedCategories?.[level] || []),
            ...(next.unlockedCategories?.[level] || [])
        ])]])),
        bestScores: Object.fromEntries(LEVELS.map(level => [level,
            Math.max(current.bestScores?.[level] || 0, next.bestScores?.[level] || 0)]))
    };
}

async function load(userId) {
    const { rows } = await db.query('SELECT timer_progress FROM progress WHERE user_id = $1', [userId]);
    return rows.length ? rows[0].timer_progress || {} : empty();
}

// Fusionne `next` dans la progression du joueur (ligne verrouillée : deux envois simultanés s'additionnent)
async function update(userId, next) {
    await db.query('INSERT INTO progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    return db.transaction(async conn => {
        const { rows } = await conn.query('SELECT timer_progress FROM progress WHERE user_id = $1 FOR UPDATE', [userId]);
        const merged = merge(rows[0]?.timer_progress || empty(), next);
        await conn.query('UPDATE progress SET timer_progress = $1, last_saved = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(merged), userId]);
        return merged;
    });
}

module.exports = { load, update, merge };
