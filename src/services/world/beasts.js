// Les bêtes de ferme, avec la base (v6, § 6.16 ; règles pures : services/beasts.js). Une ligne world_beasts par bête
// libérée ou nourrie au moins une fois : l'heure du dernier repas et jusqu'où sa bulle a été ramassée. Ce qu'elles
// donnent va à la nourriture du stock. Les poules de Cannelle sortent de leur cage (au camp, dès que Cannelle est là) :
// l'ouvrir leur donne leur ligne, affamées ; une poule qui a sa ligne dit que la cage est ouverte (sans autre mémoire)
const db = require('../../config/db');
const beasts = require('../beasts');
const map = require('../worldMap');
const { stockOf, levelsOf, zonesOf } = require('./reads');
const { migrate } = require('./migrate');
const { payWith } = require('./produce');
const { metOf, presenceOf } = require('./people');

const iso = ms => new Date(ms).toISOString();
async function rowsOf(userId, conn) {
    const { rows } = await conn.query('SELECT beast, fed_at, collected_at FROM world_beasts WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.beast, r]));
}
const freedOf = rows => beasts.HENS.some(id => rows[id]);
// Les bêtes de l'île : les poules de Cannelle, la cage ouverte (freed) ; celles du Potager bâti, dans un quartier à soi.
// rows : leurs lignes ({ bête: ligne })
async function herdOf(userId, conn) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const level = zones.has(map.siteZone('potager')) ? levels.potager || 0 : 0;
    const rows = await rowsOf(userId, conn);
    const freed = freedOf(rows);
    return { level, freed, rows, herd: beasts.beastsOf(level, freed) };
}
// La cage des poules, au camp : 'ouverte', 'coincee' (sous les rochers, dès que Cannelle est là), ou null (pas encore)
async function cageOf(userId, conn = db) {
    if (freedOf(await rowsOf(userId, conn))) return 'ouverte';
    const { levels } = await levelsOf(userId, conn);
    return metOf('foyer', levels, await zonesOf(userId, conn), await presenceOf(userId, conn)) ? 'coincee' : null;
}

// Ouvrir la cage (un toucher, une fois) : Paprika, Brioche et Madame sortent, affamées (on les nourrit depuis leur
// fiche). { hens: [leurs noms] } ou { status, message }
async function openCage(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const cage = await cageOf(userId, conn);
        if (cage === 'ouverte') return db.rollback({ status: 409, message: 'La cage est déjà ouverte.' });
        if (!cage) return db.rollback({ status: 403, message: 'Pas encore de cage : Cannelle n’est pas arrivée.' });
        await conn.query(
            `INSERT INTO world_beasts (user_id, beast, fed_at, collected_at) SELECT $1, hen, $2, $3 FROM unnest($4::text[]) AS hen
             ON CONFLICT (user_id, beast) DO NOTHING`,
            [userId, iso(now - beasts.DAY_MS), iso(now), beasts.HENS]);
        return { hens: beasts.HENS.map(id => beasts.BEAST_BY_ID[id].name) };
    });
}

// Nourrir une bête depuis sa fiche (2 vivres, une fois la moitié du jour écoulée) ; sa bulle est ramassée d'abord.
// { beast, collected } ou { status, message }
async function feedBeast(userId, id, now = Date.now()) {
    const beast = Object.hasOwn(beasts.BEAST_BY_ID, id) ? beasts.BEAST_BY_ID[id] : null;
    if (!beast) return { status: 404, message: 'Bête inconnue.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { level, freed, rows } = await herdOf(userId, conn);
        if (beast.camp && !freed) return db.rollback({ status: 403, message: 'Ouvre d’abord la cage des poules, au camp.' });
        if (!beast.camp && !level) return db.rollback({ status: 403, message: 'Bâtis d’abord le Potager : les bêtes vivent autour.' });
        if (!beast.camp && level < beast.level) return db.rollback({ status: 403, message: `${beast.name} viendra quand le Potager aura grandi.` });
        const row = rows[id];
        if (!beasts.stateOf(beast, row, now).refill) return db.rollback({ status: 409, message: `${beast.name} n’a pas encore faim.` });
        const { food } = beasts.FEED_COST;
        // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour payer
        const { stock: paid, balance } = await payWith(userId, conn, stock);
        if (paid.food < food) return db.rollback({ status: 400, message: `Il te faut ${food} vivres pour la nourrir.` });
        const fed = beasts.feedOf(beast, row, now);
        await conn.query('UPDATE world_stock SET food = food - $2 + $3 WHERE user_id = $1', [userId, food, fed.amount]);
        await conn.query(
            `INSERT INTO world_beasts (user_id, beast, fed_at, collected_at) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, beast) DO UPDATE SET fed_at = EXCLUDED.fed_at, collected_at = EXCLUDED.collected_at`,
            [userId, id, iso(fed.row.fed_at), iso(fed.row.collected_at)]);
        return { beast: id, collected: fed.amount, ...(balance !== undefined ? { coins: balance } : {}) };
    });
}

// Ramasser les bulles de toutes les bêtes (comme la production des bâtiments) : { food } (0 : rien à ramasser)
async function collectBeasts(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { herd, rows } = await herdOf(userId, conn);
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
    const { herd, rows } = await herdOf(userId, conn);
    return {
        cost: beasts.FEED_COST, hours: beasts.CONTENT_HOURS,
        list: herd.map(b => ({ id: b.id, species: b.species, name: b.name, daily: b.daily, ...beasts.stateOf(b, rows[b.id], now) }))
    };
}

module.exports = { feedBeast, collectBeasts, beastsView, cageOf, openCage };
