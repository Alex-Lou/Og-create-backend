// Les abris des coins du camp (choix de l'auteur, 13 oct.) : le coin d’Agathe, la cuisine de l'épave, devient un abri
// que le joueur bâtit et paie, une fois sa quête venue (après le poulailler). Une ligne de world_items « abri:<qui> » ;
// le camp le dessine (world/camp.js), la quête le compte (quests.js : shelter).
const db = require('../../config/db');
const quests = require('../quests');
const { stockOf, claimedOf } = require('./reads');
const { migrate } = require('./migrate');
const { payWith } = require('./produce');
const { SHELTER } = require('../../texts/world');
const { MISSING_RESOURCES } = require('../../texts/errors');

const PREFIX = 'abri:';
// Ce que coûte chaque abri, et la quête faite avant laquelle il ne se bâtit pas
const SHELTERS = {
    cannelle: { after: 'poulailler', cost: { wood: 20, stone: 10 } }
};

// Les abris bâtis : Set des « qui »
async function sheltersOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT item FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${PREFIX}%`]);
    return new Set(rows.map(r => r.item.slice(PREFIX.length)));
}

// Ce que la vue montre : { qui: { cost, open (sa quête est venue), built } }
function sheltersView(built, done) {
    return Object.fromEntries(Object.entries(SHELTERS).map(([who, s]) => [who, { cost: s.cost, open: done.has(s.after), built: built.has(who) }]));
}

// Bâtir l'abri d'un coin : sa quête venue, pas encore bâti, payé (la production en attente compte). { coins? } ou
// { status, message }
async function buildShelter(userId, who) {
    if (!Object.hasOwn(SHELTERS, who)) return { status: 404, message: SHELTER.unknown };
    const shelter = SHELTERS[who];
    await migrate(userId);
    return db.transaction(async conn => {
        const { stock, balance } = await payWith(userId, conn, await stockOf(userId, conn, true));
        if (!quests.doneOf(await claimedOf(userId, conn)).has(shelter.after)) return db.rollback({ status: 403, message: SHELTER.notYet });
        if (Object.entries(shelter.cost).some(([r, n]) => (stock[r] || 0) < n)) return db.rollback({ status: 409, message: MISSING_RESOURCES });
        const added = await conn.query('INSERT INTO world_items (user_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item', [userId, `${PREFIX}${who}`]);
        if (!added.rows.length) return db.rollback({ status: 409, message: SHELTER.built });
        const n = r => shelter.cost[r] || 0;
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, n('stone'), n('wood'), n('water'), n('food')]);
        return balance !== undefined ? { coins: balance } : {};
    });
}

module.exports = { SHELTERS, sheltersOf, sheltersView, buildShelter };
