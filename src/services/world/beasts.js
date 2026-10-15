// Les bêtes de ferme, avec la base (v6, § 6.16 ; règles pures : services/beasts.js). Une ligne world_beasts par bête
// libérée ou nourrie au moins une fois : l'heure du dernier repas et jusqu'où sa bulle a été ramassée. Ce qu'elles
// donnent va à la nourriture du stock. Les poules d’Agathe sortent de leur cage (au camp, dès qu’Agathe est là) :
// l'ouvrir leur donne leur ligne, affamées ; une poule qui a sa ligne dit que la cage est ouverte (sans autre mémoire).
// Le coq (choix de l'auteur, 14 oct.) : une ligne de world_items « coq » dit qu'il est là et depuis quand (la couvée
// se compte de son arrivée : services/beasts.js) ; elle s'écrit au premier passage où le Foyer est à l'Abri, la cage
// ouverte
const db = require('../../config/db');
const beasts = require('../beasts');
const map = require('../worldMap');
const { stockOf, levelsOf, zonesOf, addStock } = require('./reads');
const { migrate } = require('./migrate');
const T = require('../../texts/beasts');
const { payWith } = require('./produce');
const { metOf, presenceOf } = require('./people');

const iso = ms => new Date(ms).toISOString();
async function rowsOf(userId, conn) {
    const { rows } = await conn.query('SELECT beast, fed_at, collected_at FROM world_beasts WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.beast, r]));
}
const freedOf = rows => beasts.HENS.some(id => rows[id]);
const COQ_ITEM = 'coq';
// L'arrivée du coq (instant), ou null
async function coqSinceOf(userId, conn = db) {
    const { rows: [row] } = await conn.query('SELECT bought_at FROM world_items WHERE user_id = $1 AND item = $2', [userId, COQ_ITEM]);
    return row ? new Date(row.bought_at).getTime() : null;
}
// Les bêtes de l'île : les poules d’Agathe, la cage ouverte (freed), le coq et sa couvée ; celles du Potager bâti,
// dans un quartier à soi. rows : leurs lignes ({ bête: ligne }) ; coqSince : l'arrivée du coq, ou null
async function herdOf(userId, conn, now = Date.now()) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const level = zones.has(map.siteZone('potager')) ? levels.potager || 0 : 0;
    const rows = await rowsOf(userId, conn);
    const freed = freedOf(rows);
    let coqSince = await coqSinceOf(userId, conn);
    if (coqSince === null && freed && (levels.foyer || 0) >= beasts.COOP_LEVEL) {
        await conn.query(`INSERT INTO world_items (user_id, item, bought_at, source) VALUES ($1, $2, $3, 'ile') ON CONFLICT DO NOTHING`, [userId, COQ_ITEM, iso(now)]);
        coqSince = await coqSinceOf(userId, conn);
    }
    return { level, freed, rows, coqSince, herd: beasts.beastsOf(level, freed, coqSince, now) };
}
// La cage démontée (choix de l'auteur, 15 oct.) : le poulailler posé, les poules n'en ont plus besoin ; la démonter (un
// toucher, une fois) rend son bois et l'ôte du camp. Une ligne de world_items « cage:demontee »
const CAGE_GONE = 'cage:demontee';
const CAGE_GIVES = { wood: 6 };
const gone = async (userId, conn) => (await conn.query('SELECT 1 FROM world_items WHERE user_id = $1 AND item = $2', [userId, CAGE_GONE])).rows.length > 0;
const coopBuilt = async (userId, conn) => (await conn.query('SELECT 1 FROM world_annexes WHERE user_id = $1 AND annex = $2 LIMIT 1', [userId, 'poulailler'])).rows.length > 0;

// La cage des poules, au camp : 'ouverte', 'coincee' (dès qu’Agathe est là ; sur une île neuve, échouée par la mer
// au bout de la plage une fois sa soupe faite : le jour d’Agathe, choix de l'auteur, 11 oct.), ou null (pas encore,
// ou plus : démontée)
async function cageOf(userId, conn = db) {
    if (freedOf(await rowsOf(userId, conn))) return (await gone(userId, conn)) ? null : 'ouverte';
    const { levels } = await levelsOf(userId, conn);
    const presence = await presenceOf(userId, conn);
    if (!presence.done.has('soupe')) return null;
    return metOf('foyer', levels, await zonesOf(userId, conn), presence) ? 'coincee' : null;
}

// Ouvrir la cage (un toucher, une fois) : Caramel, Flocon et Réglisse sortent, affamées (on les nourrit depuis leur
// fiche). { hens: [leurs noms] } ou { status, message }
async function openCage(userId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const cage = await cageOf(userId, conn);
        if (cage === 'ouverte') return db.rollback({ status: 409, message: T.CAGE_OPEN });
        if (!cage) return db.rollback({ status: 403, message: T.NO_CAGE_YET });
        await conn.query(
            `INSERT INTO world_beasts (user_id, beast, fed_at, collected_at) SELECT $1, hen, $2, $3 FROM unnest($4::text[]) AS hen
             ON CONFLICT (user_id, beast) DO NOTHING`,
            [userId, iso(now - beasts.DAY_MS), iso(now), beasts.HENS]);
        return { hens: beasts.HENS.map(id => beasts.BEAST_BY_ID[id].name) };
    });
}

// Démonter la cage vide (le poulailler posé) : son bois va au stock, elle quitte le camp. { gives } ou { status, message }
async function breakCage(userId) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const cage = await cageOf(userId, conn);
        if (!cage) return db.rollback({ status: 409, message: T.CAGE_GONE });
        if (cage !== 'ouverte' || !(await coopBuilt(userId, conn))) return db.rollback({ status: 403, message: T.COOP_FIRST });
        await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'ile')`, [userId, CAGE_GONE]);
        await addStock(userId, CAGE_GIVES, conn);
        return { gives: CAGE_GIVES };
    });
}

// Nourrir une bête depuis sa fiche (2 vivres, une fois la moitié du jour écoulée) ; sa bulle est ramassée d'abord.
// { beast, collected } ou { status, message }
async function feedBeast(userId, id, now = Date.now()) {
    const beast = Object.hasOwn(beasts.BEAST_BY_ID, id) ? beasts.BEAST_BY_ID[id] : null;
    if (!beast) return { status: 404, message: T.BEAST_UNKNOWN };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { level, freed, rows, coqSince, herd } = await herdOf(userId, conn, now);
        if (beast.camp && !freed) return db.rollback({ status: 403, message: T.OPEN_CAGE_FIRST });
        if (beast.camp && !herd.some(b => b.id === id)) return db.rollback({ status: 404, message: T.BEAST_UNKNOWN });
        // (un poussin ne se nourrit pas : il suit les poules)
        if (beasts.isChick(beast, coqSince, now)) return db.rollback({ status: 409, message: T.NOT_HUNGRY(beast.name) });
        if (!beast.camp && !level) return db.rollback({ status: 403, message: T.GARDEN_FIRST });
        if (!beast.camp && level < beast.level) return db.rollback({ status: 403, message: T.GARDEN_GROWS(beast.name) });
        const row = rows[id];
        if (!beasts.stateOf(beast, row, now).refill) return db.rollback({ status: 409, message: T.NOT_HUNGRY(beast.name) });
        const { food } = beasts.FEED_COST;
        // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour payer
        const { stock: paid, balance } = await payWith(userId, conn, stock);
        if (paid.food < food) return db.rollback({ status: 400, message: T.FEED_COST(food) });
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
        const { herd, rows } = await herdOf(userId, conn, now);
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

// Ce que montrent leurs fiches : { cost, hours, list: [{ id, species, name, daily, fed, left, refill, ready }] } ; un
// poussin : species 'chick', chick, left (ms avant d'être poule), rien à nourrir ni à ramasser
async function beastsView(userId, conn = db, now = Date.now()) {
    const { herd, rows, coqSince } = await herdOf(userId, conn, now);
    const chickOf = b => ({
        id: b.id, species: 'chick', name: b.name, daily: 0, chick: true,
        fed: true, left: beasts.hatchedAt(b, coqSince) + beasts.GROW_DAYS * beasts.DAY_MS - now, refill: false, ready: 0
    });
    return {
        cost: beasts.FEED_COST, hours: beasts.CONTENT_HOURS,
        list: herd.map(b => (beasts.isChick(b, coqSince, now) ? chickOf(b)
            : { id: b.id, species: b.species, name: b.name, daily: b.daily, ...beasts.stateOf(b, rows[b.id], now) }))
    };
}

module.exports = { feedBeast, collectBeasts, beastsView, cageOf, openCage, breakCage, coqSinceOf };
