// Anya (éveil, Révélation, Souffle du jour) et le Savoir de Brume après le Phare. Extrait de services/world.js (lot
// santé), sans changement.
const db = require('../../config/db');
const quests = require('../quests');
const loot = require('../loot');
const anya = require('../anya');
const { stockOf, zonesOf, claimedOf, exploredOf } = require('./reads');
const { migrate } = require('./migrate');

// Anya (services/anya.js) : traces, éveil, Révélation vue, Souffle du jour (breathed)
async function anyaOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query(`SELECT to_char(talked_on, 'YYYY-MM-DD') AS talked FROM world_friends WHERE user_id = $1 AND villager = $2`, [userId, anya.TARGET]);
    const state = anya.stateOf(await zonesOf(userId, conn), await exploredOf(userId, conn, now), rows.length > 0);
    return { ...state, breathed: state.awake && rows[0]?.talked === loot.parisOf(now).day };
}
// Le Savoir de Brume (bible, § 4.2, § 6.4 et § 13) : maîtresse du sceau ☉, qu'elle ne révèle qu'à la fin (le Phare
// allumé : l'acte VII fini). Un indice par jour sur les Légendes, gardé comme celui d'Anya (world_friends, cible
// BRUME, sans points). { open, talked }
const BRUME = 'brume';
async function brumeSavoirOf(userId, conn = db, now = Date.now()) {
    const open = quests.actsDoneOf(quests.doneOf(await claimedOf(userId, conn))).includes('VII');
    const { rows } = await conn.query(`SELECT to_char(talked_on, 'YYYY-MM-DD') AS talked FROM world_friends WHERE user_id = $1 AND villager = $2`, [userId, BRUME]);
    return { open, talked: open && rows[0]?.talked === loot.parisOf(now).day };
}
// Brume souffle son Savoir du jour : {} ou { status, message } (l'indice est calculé par la route)
async function talkBrume(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        // Le verrou du stock (comme pour un maître) : deux bavardages simultanés ne soufflent pas deux Savoirs
        await stockOf(userId, conn, true);
        const state = await brumeSavoirOf(userId, conn, now);
        if (!state.open) return db.rollback({ status: 403, message: 'Brume garde son Savoir pour la fin : allume d’abord le Phare.' });
        if (state.talked) return db.rollback({ status: 409, message: 'Brume t’a déjà soufflé un Savoir aujourd’hui.' });
        await conn.query(
            `INSERT INTO world_friends (user_id, villager, points, talked_on) VALUES ($1, $2, 0, $3::date)
             ON CONFLICT (user_id, villager) DO UPDATE SET talked_on = EXCLUDED.talked_on`, [userId, BRUME, loot.parisOf(now).day]);
        return {};
    });
}
// La Révélation vue (une seule fois, d'un appareil à l'autre) : la ligne d'Anya, sans points. { anya } ou { status, message }
async function revealAnya(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        if (!(await anyaOf(userId, conn, now)).awake) return db.rollback({ status: 403, message: 'Anya dort encore : découvre d’abord toute l’île.' });
        await conn.query('INSERT INTO world_friends (user_id, villager, points) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING', [userId, anya.TARGET]);
        return { anya: await anyaOf(userId, conn, now) };
    });
}
// Le Souffle d'Anya : une fois par jour (heure de Paris), une fois éveillée et la Révélation vue. {} ou
// { status, message } (l'indice est calculé par la route, qui ne compte le Souffle que s'il y a une page)
async function breatheAnya(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        // Le verrou du stock (comme pour un maître) : deux Souffles simultanés ne passent pas tous les deux
        await stockOf(userId, conn, true);
        const state = await anyaOf(userId, conn, now);
        if (!state.revealed) return db.rollback({ status: 403, message: 'Anya dort encore.' });
        if (state.breathed) return db.rollback({ status: 409, message: 'Anya t’a déjà soufflé un Savoir aujourd’hui : reviens à l’aube ou au crépuscule de demain.' });
        await conn.query(
            `INSERT INTO world_friends (user_id, villager, points, talked_on) VALUES ($1, $2, 0, $3::date)
             ON CONFLICT (user_id, villager) DO UPDATE SET talked_on = EXCLUDED.talked_on`, [userId, anya.TARGET, loot.parisOf(now).day]);
        return {};
    });
}

module.exports = { anyaOf, BRUME, brumeSavoirOf, talkBrume, revealAnya, breatheAnya };
