// Les bêtes de ferme, avec la base (v6, § 6.16 ; règles pures : services/beasts.js). Une ligne world_beasts par bête
// nourrie au moins une fois : l'heure du dernier repas et jusqu'où sa bulle a été ramassée. Ce qu'elles donnent va à
// la nourriture du stock
const db = require('../../config/db');
const beasts = require('../beasts');
const map = require('../worldMap');
const { stockOf, levelsOf, zonesOf } = require('./reads');
const { migrate } = require('./migrate');

const iso = ms => new Date(ms).toISOString();
// Les bêtes de l'île : celles du Potager bâti, dans un quartier à soi
async function herdOf(userId, conn) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const level = zones.has(map.siteZone('potager')) ? levels.potager || 0 : 0;
    return { level, herd: beasts.beastsOf(level) };
}
async function rowsOf(userId, conn) {
    const { rows } = await conn.query('SELECT beast, fed_at, collected_at FROM world_beasts WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.beast, r]));
}

// Nourrir une bête depuis sa fiche (2 vivres, une fois la moitié du jour écoulée) ; sa bulle est ramassée d'abord.
// { beast, collected } ou { status, message }
async function feedBeast(userId, id, now = Date.now()) {
    const beast = Object.hasOwn(beasts.BEAST_BY_ID, id) ? beasts.BEAST_BY_ID[id] : null;
    if (!beast) return { status: 404, message: 'Bête inconnue.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { level } = await herdOf(userId, conn);
        if (!level) return db.rollback({ status: 403, message: 'Bâtis d’abord le Potager : les bêtes vivent autour.' });
        if (level < beast.level) return db.rollback({ status: 403, message: `${beast.name} viendra quand le Potager aura grandi.` });
        const row = (await rowsOf(userId, conn))[id];
        if (!beasts.stateOf(beast, row, now).refill) return db.rollback({ status: 409, message: `${beast.name} n’a pas encore faim.` });
        const { food } = beasts.FEED_COST;
        if (stock.food < food) return db.rollback({ status: 400, message: `Il te faut ${food} vivres pour la nourrir.` });
        const fed = beasts.feedOf(beast, row, now);
        await conn.query('UPDATE world_stock SET food = food - $2 + $3 WHERE user_id = $1', [userId, food, fed.amount]);
        await conn.query(
            `INSERT INTO world_beasts (user_id, beast, fed_at, collected_at) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, beast) DO UPDATE SET fed_at = EXCLUDED.fed_at, collected_at = EXCLUDED.collected_at`,
            [userId, id, iso(fed.row.fed_at), iso(fed.row.collected_at)]);
        return { beast: id, collected: fed.amount };
    });
}

// Ramasser les bulles de toutes les bêtes (comme la production des bâtiments) : { food } (0 : rien à ramasser)
async function collectBeasts(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { herd } = await herdOf(userId, conn);
        const rows = await rowsOf(userId, conn);
        let food = 0;
        for (const beast of herd.filter(b => rows[b.id])) {
            const { amount, collectedAt } = beasts.readyOf(beast, rows[beast.id], now);
            if (!amount) continue;
            food += amount;
            await conn.query('UPDATE world_beasts SET collected_at = $3 WHERE user_id = $1 AND beast = $2', [userId, beast.id, iso(collectedAt)]);
        }
        if (!food) return db.rollback({ food: 0 });
        await conn.query('UPDATE world_stock SET food = food + $2 WHERE user_id = $1', [userId, food]);
        return { food };
    });
}

// Ce que montrent leurs fiches : { cost, hours, list: [{ id, species, name, daily, fed, left, refill, ready }] }
async function beastsView(userId, conn = db, now = Date.now()) {
    const { herd } = await herdOf(userId, conn);
    const rows = herd.length ? await rowsOf(userId, conn) : {};
    return {
        cost: beasts.FEED_COST, hours: beasts.CONTENT_HOURS,
        list: herd.map(b => ({ id: b.id, species: b.species, name: b.name, daily: b.daily, ...beasts.stateOf(b, rows[b.id], now) }))
    };
}

module.exports = { feedBeast, collectBeasts, beastsView };
