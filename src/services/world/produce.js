// La production des bâtiments : bonus (boutique, annexes, humeurs, lieux), récolte de ce qui a été produit. Extrait de
// services/world.js (lot santé), sans changement.
const db = require('../../config/db');
const ledger = require('../ledger');
const shop = require('../worldShop');
const annexes = require('../annexes');
const landmarks = require('../landmarks');
const { RESOURCES, productionAll } = require('./rules');
const {
    itemsOf, needRowsOf, settlersOf, annexesOf, levelsOf, stockOf, zonesOf, foundOf, craftsOf, placedOf
} = require('./reads');
const { migrate } = require('./migrate');
const { presenceOf, residentsOf, moodsOf, withMoods, withLandmarks } = require('./people');

// Bonus de la boutique, des annexes, de l'humeur des habitants et des lieux découverts : { bonuses, extra } (ce que
// lisent effectsOf et productionAll)
async function bonusesFor(userId, conn = db) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const presence = await presenceOf(userId, conn);
    const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
    const moods = moodsOf(residents, levels, zones, placedOf(await craftsOf(userId, conn)), await needRowsOf(userId, conn), presence);
    const mooded = withMoods(shop.bonusesOf(await itemsOf(userId, conn)), annexes.bonusesOf(await annexesOf(userId, conn)), moods);
    return withLandmarks(mooded, landmarks.bonusesOf((await foundOf(userId, conn)).keys()));
}

// Encaisse la production des bâtiments (écus au grand livre, ressources au stock) dans la transaction de l'appelant
async function gather(userId, conn, stock) {
    const { levels, builtAt } = await levelsOf(userId, conn);
    const now = new Date();
    const { bonuses, extra } = await bonusesFor(userId, conn);
    const made = productionAll(levels, builtAt, stock.collected_at, now.getTime(), bonuses, extra);
    const coins = made.reduce((sum, p) => sum + p.coins, 0);
    const got = Object.fromEntries(RESOURCES.map(r => [r, made.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    if (!coins && RESOURCES.every(r => !got[r])) return { gained: 0, stock: got, balance: null };
    await conn.query('UPDATE world_stock SET collected_at = $2, stone = stone + $3, wood = wood + $4, water = water + $5, food = food + $6 WHERE user_id = $1',
        [userId, now, got.stone, got.wood, got.water, got.food]);
    const { coins: balance } = await ledger.credit(userId, coins, 'monde', now.toISOString(), conn);
    return { gained: coins, stock: got, balance };
}

// Récolte de la production des bâtiments : { gained, stock, coins }
async function collect(userId) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const done = await gather(userId, conn, stock);
        if (!done.gained && RESOURCES.every(r => !done.stock[r])) return db.rollback({ gained: 0, stock: done.stock, coins: await ledger.balance(userId) });
        return { gained: done.gained, stock: done.stock, coins: done.balance };
    });
}

module.exports = { bonusesFor, gather, collect };
