// Anya (éveil, Révélation, errance, Souffle) et le Savoir de Brume après le Phare
const db = require('../../config/db');
const quests = require('../quests');
const loot = require('../loot');
const anya = require('../anya');
const map = require('../worldMap');
const finds = require('../finds');
const landmarks = require('../landmarks');
const { stockOf, zonesOf, claimedOf, exploredOf, levelsOf, foundOf } = require('./reads');
const { migrate } = require('./migrate');

// Les endroits où Anya peut passer (v6 : n'importe où sur l'île à soi) : quelques cases libres près du panneau de
// chaque quartier à soi (ni création, ni annexe, ni gisement, ni lieu remarquable), et le Cercle de menhirs une fois
// trouvé (elle y revient parfois)
const NEAR_PANEL = 12;
async function placesOf(userId, conn, owned) {
    const { levels } = await levelsOf(userId, conn);
    const crafts = (await conn.query('SELECT x, y FROM world_crafts WHERE user_id = $1 AND x IS NOT NULL', [userId])).rows;
    const annexes = (await conn.query('SELECT x, y FROM world_annexes WHERE user_id = $1', [userId])).rows;
    const taken = new Set([...crafts, ...annexes, ...landmarks.LANDMARKS].map(c => c.y * map.SIZE + c.x));
    const places = map.ZONES.filter(zone => owned.has(zone.id)).map(zone => ({
        // La première case libre est celle du panneau du quartier
        cells: map.freeSpots(zone.id, levels).filter(c => !taken.has(c.y * map.SIZE + c.x) && !finds.isDeposit(c.x, c.y)).slice(1, 1 + NEAR_PANEL)
    }));
    if ((await foundOf(userId, conn)).has('menhirs')) {
        const cercle = landmarks.LANDMARK_BY_ID.menhirs;
        places.push({ cells: [{ x: cercle.x, y: cercle.y }] });
    }
    return places;
}

// Anya (services/anya.js) : traces, éveil, Révélation vue ; une fois révélée, son passage du jour (visit : { slot, x, y }
// ou null) et le Souffle de ce passage (breathed)
async function anyaOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query(`SELECT to_char(talked_on, 'YYYY-MM-DD') AS talked FROM world_friends WHERE user_id = $1 AND villager = $2`, [userId, anya.TARGET]);
    const owned = await zonesOf(userId, conn);
    const state = anya.stateOf(owned, await exploredOf(userId, conn, now), rows.length > 0);
    const { day } = loot.parisOf(now);
    const visit = state.revealed && anya.visitsOn(userId, day) ? anya.visitOn(userId, day, await placesOf(userId, conn, owned)) : null;
    return { ...state, visit, breathed: Boolean(visit) && rows[0]?.talked === day };
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
        if (!(await anyaOf(userId, conn, now)).awake) return db.rollback({ status: 403, message: 'Anya dort encore : libère d’abord le cœur de l’île.' });
        await conn.query('INSERT INTO world_friends (user_id, villager, points) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING', [userId, anya.TARGET]);
        return { anya: await anyaOf(userId, conn, now) };
    });
}
// Le Souffle d'Anya : un par passage (elle passe au plus une fois par jour, heure de Paris), la Révélation vue. {} ou
// { status, message } (l'indice est calculé par la route, qui ne compte le Souffle que s'il y a une page)
const BREATH_REFUSED = {
    asleep: { status: 403, message: 'Anya dort encore.' },
    away: { status: 409, message: 'Anya n’est pas là : elle passe à l’aube ou au crépuscule, certains jours.' },
    breathed: { status: 409, message: 'Anya t’a déjà soufflé un Savoir : elle repassera.' }
};
const breathRefused = state => (!state.revealed ? BREATH_REFUSED.asleep : !state.visit ? BREATH_REFUSED.away : state.breathed ? BREATH_REFUSED.breathed : null);
async function breatheAnya(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        // Le verrou du stock (comme pour un maître) : deux Souffles simultanés ne passent pas tous les deux
        await stockOf(userId, conn, true);
        const refused = breathRefused(await anyaOf(userId, conn, now));
        if (refused) return db.rollback(refused);
        await conn.query(
            `INSERT INTO world_friends (user_id, villager, points, talked_on) VALUES ($1, $2, 0, $3::date)
             ON CONFLICT (user_id, villager) DO UPDATE SET talked_on = EXCLUDED.talked_on`, [userId, anya.TARGET, loot.parisOf(now).day]);
        return {};
    });
}

module.exports = { anyaOf, breathRefused, BRUME, brumeSavoirOf, talkBrume, revealAnya, breatheAnya };
