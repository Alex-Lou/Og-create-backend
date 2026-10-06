// La production des bâtiments : bonus (boutique, annexes, humeurs, lieux), récolte de ce qui a été produit. Extrait de
// services/world.js (lot santé), sans changement.
const db = require('../../config/db');
const ledger = require('../ledger');
const shop = require('../worldShop');
const annexes = require('../annexes');
const landmarks = require('../landmarks');
const { RESOURCES, productionAll } = require('./rules');
const {
    itemsOf, needRowsOf, settlersOf, annexesOf, levelsOf, stockOf, zonesOf, foundOf, craftsOf, placedOf, blightsOf
} = require('./reads');
const { migrate } = require('./migrate');
const { presenceOf, withMoods, withLandmarks, withBlights, residentsOf, moodsOf, prodSteps, sameSteps } = require('./people');

// Ce dont dépend la production : bâtiments, île (quartiers, habitants, créations posées, besoins), bonus de la
// boutique et des annexes, lieux découverts
async function sourcesOf(userId, conn) {
    const { levels, builtAt } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const island = {
        levels, zones, settlers: await settlersOf(userId, conn), presence: await presenceOf(userId, conn),
        decor: placedOf(await craftsOf(userId, conn)), filled: await needRowsOf(userId, conn), blights: await blightsOf(userId, conn)
    };
    const base = { bonuses: shop.bonusesOf(await itemsOf(userId, conn)), extra: annexes.bonusesOf(await annexesOf(userId, conn)) };
    return { builtAt, island, base, lm: landmarks.bonusesOf((await foundOf(userId, conn)).keys()) };
}

// Bonus avec l'humeur des habitants à l'instant at, et les bâtiments embrumés (sources : sourcesOf) : { bonuses, extra }
function bonusesAt({ island, base, lm }, at) {
    const { levels, zones, settlers, presence, decor, filled, blights } = island;
    const moods = moodsOf(residentsOf(levels, zones, settlers, presence), levels, zones, decor, filled, presence, at);
    const { bonuses, extra } = withLandmarks(withMoods(base.bonuses, base.extra, moods), lm);
    return { bonuses: withBlights(bonuses, blights, at), extra };
}

// Bonus de la boutique, des annexes, de l'humeur des habitants et des lieux découverts : { bonuses, extra } (ce que
// lisent effectsOf et productionAll)
async function bonusesFor(userId, conn = db) {
    return bonusesAt(await sourcesOf(userId, conn), Date.now());
}

// Encaisse la production des bâtiments (écus au grand livre, ressources au stock) dans la transaction de l'appelant ;
// chaque heure produite compte avec l'humeur de son moment (prodSteps)
async function gather(userId, conn, stock) {
    const now = new Date();
    const sources = await sourcesOf(userId, conn);
    const { builtAt, island, base, lm } = sources;
    const { bonuses, extra } = bonusesAt(sources, now.getTime());
    const steps = prodSteps(island, base, lm, stock.collected_at, now.getTime());
    const made = productionAll(island.levels, builtAt, stock.collected_at, now.getTime(), bonuses, extra, steps);
    const coins = made.reduce((sum, p) => sum + p.coins, 0);
    const got = Object.fromEntries(RESOURCES.map(r => [r, made.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    if (!coins && RESOURCES.every(r => !got[r])) return { gained: 0, stock: got, balance: null };
    await conn.query('UPDATE world_stock SET collected_at = $2, stone = stone + $3, wood = wood + $4, water = water + $5, food = food + $6 WHERE user_id = $1',
        [userId, now, got.stone, got.wood, got.water, got.food]);
    const { coins: balance } = await ledger.credit(userId, coins, 'monde', now.toISOString(), conn);
    return { gained: coins, stock: got, balance };
}

// Avant un changement qui touche l'humeur des habitants (besoin comblé, création posée, déplacée ou rangée, visiteur
// installé) : si la part de production en plus d'un bâtiment en aurait changé depuis la dernière récolte, on encaisse
// d'abord, pour que ce qui a été produit compte avec l'humeur d'alors. change(island) : l'île après le changement.
// Le solde d'écus quand des écus sont encaissés, sinon undefined
async function gatherBefore(userId, conn, stock, change) {
    const now = Date.now();
    const { island, base, lm } = await sourcesOf(userId, conn);
    const steps = isl => prodSteps(isl, base, lm, stock.collected_at, now);
    if (sameSteps(steps(island), steps(change(island)))) return undefined;
    const { balance } = await gather(userId, conn, stock);
    return balance ?? undefined;
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

module.exports = { bonusesFor, gather, gatherBefore, collect };
