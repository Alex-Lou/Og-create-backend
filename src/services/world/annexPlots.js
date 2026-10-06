// Les annexes posées : cases permises, vue, pose et déplacement. Extrait de services/world.js (lot santé), sans
// changement.
const db = require('../../config/db');
const ledger = require('../ledger');
const map = require('../worldMap');
const annexes = require('../annexes');
const landmarks = require('../landmarks');
const finds = require('../finds');
const { SIZE, CAP_HOURS, RESOURCES, CHAPTER_OF_LEVEL, WORDS, SITES } = require('./rules');
const { annexesOf, levelsOf, stockOf, zonesOf, findsOf, spendFinds } = require('./reads');
const { migrate } = require('./migrate');
const { gather } = require('./produce');

// Case où une annexe de ce bâtiment peut se poser (sans compter ce qui l'occupe) : sol constructible du quartier du
// bâtiment, hors des grandes emprises des chantiers et des lieux remarquables, à annexes.REACH cases au plus de la sienne
function annexSpotOk(siteId, x, y) {
    const at = map.SITE_BIG[siteId];
    return Boolean(at) && Number.isInteger(x) && Number.isInteger(y) && map.buildable(x, y) && !map.inSite(x, y) && !landmarks.isLandmark(x, y)
        && map.zoneAt(x, y) === map.siteZone(siteId) && annexes.reachOf(x, y, at) <= annexes.REACH;
}
// Cases libres où poser une annexe de ce bâtiment (taken : clés des cases occupées), des plus proches aux plus lointaines
function annexSpots(siteId, taken) {
    const at = map.SITE_BIG[siteId];
    const spots = [];
    for (let y = at.y - annexes.REACH; y <= at.y + 2 + annexes.REACH; y++) {
        for (let x = at.x - annexes.REACH; x <= at.x + 2 + annexes.REACH; x++) {
            if (annexSpotOk(siteId, x, y) && !taken.has(y * SIZE + x)) spots.push({ x, y, d: annexes.reachOf(x, y, at) });
        }
    }
    return spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y }));
}
// Ce que la fiche d'un bâtiment montre de ses annexes : posées, prochain exemplaire (palier, prix), effet
function annexesView(siteId, rows) {
    const words = WORDS[SITES[siteId].produce] || [];
    return annexes.ANNEXES.filter(a => a.site === siteId).map(a => {
        const built = rows.filter(r => r.annex === a.id).length;
        const max = annexes.maxOf(a);
        return {
            id: a.id, name: a.name, kind: a.kind, max, built, effect: annexes.effectText(a, words, CAP_HOURS), gain: a.effect,
            levels: Array.from({ length: max }, (_, k) => annexes.levelFor(a, k)),
            next: built < max ? { level: annexes.levelFor(a, built), ...annexes.priceOf(a, built) } : null
        };
    });
}

// Annexe posée sur cette case (ligne verrouillée), ou null
async function annexAt(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT annex FROM world_annexes WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
    return rows[0] || null;
}
// Case déjà prise par une création d'île ou une annexe
async function cellTaken(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT 1 FROM world_crafts WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
    return rows.length > 0 || Boolean(await annexAt(userId, x, y, conn));
}
const SPOT_MESSAGE = 'Une annexe se pose sur une case libre du quartier, à deux cases au plus de son bâtiment.';

// Pose l'exemplaire suivant d'une annexe : bâtiment construit au palier voulu dans un quartier possédé, case libre
// autorisée, ressources et écus débités une seule fois (ligne de stock verrouillée : deux poses ne se croisent pas).
// La production en cours est encaissée d'abord (l'annexe produit à partir de sa pose). { status, message } si refus
async function placeAnnex(userId, annexId, x, y) {
    const a = annexes.ANNEX_BY_ID[annexId];
    if (!a) return { status: 404, message: 'Annexe inconnue.' };
    if (!annexSpotOk(a.site, x, y)) return { status: 400, message: SPOT_MESSAGE };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const level = levels[a.site] || 0;
        if (!level || !(await zonesOf(userId, conn)).has(map.siteZone(a.site))) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        const copy = (await annexesOf(userId, conn)).filter(r => r.annex === a.id).length;
        if (copy >= annexes.maxOf(a)) return db.rollback({ status: 409, message: annexes.maxOf(a) > 1 ? 'Tous les exemplaires de cette annexe sont posés.' : 'Cette annexe est déjà posée.' });
        const need = annexes.levelFor(a, copy);
        if (level < need) return db.rollback({ status: 403, message: `Il faut le palier ${CHAPTER_OF_LEVEL[need - 1]} de ce bâtiment.` });
        if (await cellTaken(userId, x, y, conn)) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        const { cost, coins: price, finds: spent } = annexes.priceOf(a, copy);
        if (Object.entries(cost).some(([r, n]) => stock[r] < n)) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const have = await findsOf(userId, conn);
        const short = Object.entries(spent).find(([f, n]) => have[f] < n);
        if (short) return db.rollback({ status: 400, message: `Il te faut ${short[1]} ${finds.FIND_BY_ID[short[0]].name.toLowerCase()} : ramasses-en sur les gisements de son climat.` });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, price, `annexe:${a.id}:${copy + 1}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${price} écus.` });
        await spendFinds(userId, spent, conn);
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, ...RESOURCES.map(r => cost[r] || 0)]);
        await conn.query('INSERT INTO world_annexes (user_id, x, y, annex) VALUES ($1, $2, $3, $4)', [userId, x, y, a.id]);
        return { built: a.name, coins };
    });
}

// Déplace gratuitement une annexe vers une autre case libre autorisée pour son bâtiment (sa production continue)
async function moveAnnex(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const found = await annexAt(userId, x, y, conn);
        if (!found) return db.rollback({ status: 404, message: 'Aucune annexe sur cette case.' });
        const a = annexes.ANNEX_BY_ID[found.annex];
        if (!a || !annexSpotOk(a.site, toX, toY)) return db.rollback({ status: 400, message: SPOT_MESSAGE });
        if (x === toX && y === toY) return {};
        if (await cellTaken(userId, toX, toY, conn)) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        await conn.query('UPDATE world_annexes SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y, toX, toY]);
        return {};
    });
}

module.exports = { annexSpotOk, annexSpots, annexesView, annexAt, cellTaken, SPOT_MESSAGE, placeAnnex, moveAnnex };
