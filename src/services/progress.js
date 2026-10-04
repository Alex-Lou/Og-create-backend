// Progression d'un compte : écus, carnet de l'Infini (lecture seule) et progression de l'Épreuve.
// Le carnet ne s'écrit que par un mélange réussi (routes/play) et le solde que par le grand livre (ledger.js).
const db = require('../config/db');
const players = require('./players');
const timerProgress = require('./timerProgress');

async function load(userId) {
    const discoveredElements = await players.elements({ kind: 'user', id: userId });
    const { rows } = await db.query('SELECT coins, timer_progress, last_saved FROM progress WHERE user_id = $1', [userId]);
    return {
        discoveredElements,
        coins: rows[0].coins,
        timerProgress: rows[0].timer_progress,
        lastSaved: rows[0].last_saved
    };
}

// Seule la progression de l'Épreuve est encore acceptée ici ; le reste de l'ancien format est ignoré
async function save(userId, data) {
    await db.query('INSERT INTO progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    if (data.timerProgress && typeof data.timerProgress === 'object') await timerProgress.update(userId, data.timerProgress);
    return { message: 'Progression sauvegardée avec succès', lastSaved: new Date().toISOString() };
}

module.exports = { load, save };
