// Les annexes posées : cases permises, vue, pose et déplacement. Extrait de services/world.js (lot santé), sans
// changement.
const crypto = require('crypto');
const db = require('../../config/db');
const ledger = require('../ledger');
const map = require('../worldMap');
const annexes = require('../annexes');
const crafts = require('../crafts');
const landmarks = require('../landmarks');
const finds = require('../finds');
const { SIZE, CAP_HOURS, RESOURCES, CHAPTER_OF_LEVEL, WORDS, SITES, CRAFT_TTL_MS } = require('./rules');
const { annexesOf, levelsOf, stockOf, zonesOf, findsOf, spendFinds, balanceOf } = require('./reads');
const { migrate } = require('./migrate');
const { payWith } = require('./produce');
const { campOfUser, cellsOfCamp } = require('./camp');
const { STATIC, inSiteAt, placesOf } = require('./places');
const { roadsOf } = require('./paths');
const T = require('../../texts/annexes');
const { SPOT_MESSAGE, LOOK_MESSAGE, CAMP_MESSAGE } = T;
const { BUILD_FIRST, NEED_TIER } = require('../../texts/world');
const { NEED_COINS, MISSING_RESOURCES } = require('../../texts/errors');
const { ANNEX_UNKNOWN } = T;
const { ASSEMBLY_ERRORS, ASSEMBLY_RETURNED, ASSEMBLY_LATE, ASSEMBLY_REFUSED } = require('../../texts/crafts');

// Case où une annexe de ce bâtiment peut se poser (sans compter ce qui l'occupe) : sol constructible du quartier du
// bâtiment, n'importe où dans ce quartier, hors des grandes emprises des bâtiments (où qu'ils soient : places) et des
// lieux remarquables ; sur son sol à elle si elle en demande un (ground : le poulailler, sur l'herbe)
function annexSpotOk(siteId, x, y, places = STATIC, ground = null) {
    return Boolean(places[siteId]) && Number.isInteger(x) && Number.isInteger(y) && map.buildable(x, y) && !inSiteAt(places, x, y)
        && !landmarks.isLandmark(x, y) && map.zoneAt(x, y) === map.siteZone(siteId) && (!ground || ground.includes(map.groundAt(x, y)));
}
// Cases où une annexe de chaque bâtiment peut se poser, des plus proches de lui aux plus lointaines (gardées par
// disposition des bâtiments : elles ne changent qu'avec elle)
const SPOTS = new Map();
const MAX_KEPT = 64;
function spotsOf(siteId, places) {
    const key = `${siteId}|${Object.values(places).map(p => `${p.x},${p.y}`).join(';')}`;
    if (!SPOTS.has(key)) {
        if (SPOTS.size >= MAX_KEPT) SPOTS.clear();
        const at = places[siteId];
        const spots = [];
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (annexSpotOk(siteId, x, y, places)) spots.push({ x, y, d: annexes.reachOf(x, y, at) });
        SPOTS.set(key, spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y })));
    }
    return SPOTS.get(key);
}
// Cases libres où poser une annexe de ce bâtiment (taken : clés des cases occupées), des plus proches aux plus lointaines ;
// ground : seulement sur ce sol
function annexSpots(siteId, taken, places = STATIC, ground = null) {
    return spotsOf(siteId, places).filter(({ x, y }) => !taken.has(y * SIZE + x) && (!ground || ground.includes(map.groundAt(x, y))));
}
// Ce que la fiche d'un bâtiment montre de ses annexes : posées, prochain exemplaire (palier, prix), effet
function annexesView(siteId, rows) {
    const words = WORDS[SITES[siteId].produce] || [];
    return annexes.ANNEXES.filter(a => a.site === siteId).map(a => {
        const built = rows.filter(r => r.annex === a.id).length;
        const max = annexes.maxOf(a);
        return {
            id: a.id, name: a.name, kind: a.kind, max, built, looks: annexes.looksOf(a), effect: annexes.effectText(a, words, CAP_HOURS), gain: a.effect,
            // (elle s'assemble avant de se poser : son casse-tête, startAnnexAssembly)
            ...(a.assembly ? { assembly: true } : {}),
            levels: Array.from({ length: max }, (_, k) => annexes.levelFor(a, k)),
            next: built < max ? { level: annexes.levelFor(a, built), ...annexes.priceOf(a, built) } : null
        };
    });
}

// Annexe posée sur cette case (ligne verrouillée : { annex, flip, look }), ou null
async function annexAt(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT annex, flip, look FROM world_annexes WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
    return rows[0] || null;
}
// Case déjà prise par une création d'île ou une annexe
// (une création, une autre annexe, ou un chemin en plus de la carte : world/paths.js)
async function cellTaken(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT 1 FROM world_crafts WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
    if (rows.length > 0 || (await roadsOf(userId, conn)).added.has(y * SIZE + x)) return true;
    return Boolean(await annexAt(userId, x, y, conn));
}
// Couleur demandée (look : n° de variante, ou null : celle de son rang) : une de celles dessinées pour cette annexe
const lookOk = (a, look) => look === null || (Number.isInteger(look) && look >= 0 && look < annexes.looksOf(a));

// Pose l'exemplaire suivant d'une annexe : bâtiment construit au palier voulu dans un quartier possédé, case libre
// autorisée, ressources et écus débités une seule fois (ligne de stock verrouillée : deux poses ne se croisent pas).
// La production en cours est encaissée d'abord (l'annexe produit à partir de sa pose). pose : { flip, look } (miroir,
// couleur choisie). { status, message } si refus
// L'exemplaire suivant de l'annexe a, s'il est permis (son bâtiment bâti dans un quartier à soi, un exemplaire de plus,
// au palier qu'il demande) : { copy } (les exemplaires déjà posés), ou { status, message }
async function nextCopyOf(userId, a, conn) {
    const { levels } = await levelsOf(userId, conn);
    const level = levels[a.site] || 0;
    if (!level || !(await zonesOf(userId, conn)).has(map.siteZone(a.site))) return { status: 403, message: BUILD_FIRST };
    const copy = (await annexesOf(userId, conn)).filter(r => r.annex === a.id).length;
    if (copy >= annexes.maxOf(a)) return { status: 409, message: annexes.maxOf(a) > 1 ? T.ALL_COPIES_PLACED : T.ALREADY_PLACED };
    const need = annexes.levelFor(a, copy);
    if (level < need) return { status: 403, message: NEED_TIER(CHAPTER_OF_LEVEL[need - 1]) };
    return { copy, levels };
}

// Ce qui manque en ressources ou en trouvailles pour payer l'exemplaire copy de a (stock : les réserves, ce qui
// attendait dans les bâtiments compris), ou null (les écus : à part)
async function priceBlock(userId, a, copy, stock, conn) {
    const { cost, finds: spent } = annexes.priceOf(a, copy);
    if (Object.entries(cost).some(([r, n]) => stock[r] < n)) return { status: 400, message: MISSING_RESOURCES };
    const have = await findsOf(userId, conn);
    const short = Object.entries(spent).find(([f, n]) => have[f] < n);
    if (short) return { status: 400, message: T.NEED_FINDS(short[1], finds.FIND_BY_ID[short[0]].name.toLowerCase()) };
    return null;
}

// Le casse-tête d'une annexe qui s'assemble (le poulailler d’Agathe, choix de l'auteur, 15 oct. : comme une création
// de l'établi) : son exemplaire permis et de quoi la payer d'abord, puis une graine et ses pièces. Rien n'est payé : la
// pose rend l'assemblage (placeAnnex). { run: { id, annex, shape, pieces, turned } } ou { status, message }
async function startAnnexAssembly(userId, annexId) {
    const a = Object.hasOwn(annexes.ANNEX_BY_ID, annexId) ? annexes.ANNEX_BY_ID[annexId] : null;
    if (!a || !a.assembly) return { status: 404, message: ANNEX_UNKNOWN };
    await migrate(userId);
    return db.transaction(async conn => {
        // (ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour payer)
        const { stock } = await payWith(userId, conn, await stockOf(userId, conn, true));
        const next = await nextCopyOf(userId, a, conn);
        if (next.status) return db.rollback(next);
        const block = await priceBlock(userId, a, next.copy, stock, conn);
        if (block) return db.rollback(block);
        const { coins: price } = annexes.priceOf(a, next.copy);
        if ((await balanceOf(userId, conn)) < price) return db.rollback({ status: 400, message: NEED_COINS(price) });
        const { shape, tier } = a.assembly;
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_craft_runs (user_id, craft, seed) VALUES ($1, $2, $3) RETURNING id', [userId, `${RUN_PREFIX}${a.id}`, seed]);
        return { run: { id: Number(rows[0].id), annex: a.id, shape, pieces: crafts.piecesOf(shape, seed, tier), turned: crafts.TURNED[tier] } };
    });
}
// (un assemblage d'annexe, dans world_craft_runs : « annexe:<id> »)
const RUN_PREFIX = 'annexe:';

// L'assemblage d'une annexe, rendu à sa pose (run : son numéro, layout : la disposition des pièces) : vérifié, puis
// rendu (une fois). null s'il tient, sinon { status, message }
async function returnAssembly(userId, a, run, layout, conn) {
    if (!Number.isSafeInteger(run) || run <= 0) return { status: 400, message: ASSEMBLY_REFUSED(ASSEMBLY_ERRORS.missing) };
    const { rows } = await conn.query(
        'SELECT seed, created_at FROM world_craft_runs WHERE id = $1 AND user_id = $2 AND craft = $3 AND finished_at IS NULL FOR UPDATE', [run, userId, `${RUN_PREFIX}${a.id}`]);
    if (!rows.length) return { status: 404, message: ASSEMBLY_RETURNED };
    if (Date.now() - new Date(rows[0].created_at).getTime() > CRAFT_TTL_MS) return { status: 400, message: ASSEMBLY_LATE };
    const { shape, tier } = a.assembly;
    const done = crafts.check(shape, crafts.piecesOf(shape, rows[0].seed, tier), layout);
    if (!done.ok) return { status: 400, message: ASSEMBLY_REFUSED(done.error) };
    await conn.query('UPDATE world_craft_runs SET finished_at = NOW() WHERE id = $1', [run]);
    return null;
}

// assembly : { run, layout }, pour une annexe qui s'assemble (son casse-tête, rendu à la pose : startAnnexAssembly)
async function placeAnnex(userId, annexId, x, y, { flip = false, look = null } = {}, assembly = {}) {
    const a = annexes.ANNEX_BY_ID[annexId];
    if (!a) return { status: 404, message: T.ANNEX_UNKNOWN };
    if (!lookOk(a, look)) return { status: 400, message: LOOK_MESSAGE };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (!annexSpotOk(a.site, x, y, (await placesOf(userId, conn)).places, a.ground)) return db.rollback({ status: 400, message: SPOT_MESSAGE });
        const next = await nextCopyOf(userId, a, conn);
        if (next.status) return db.rollback(next);
        const { copy, levels } = next;
        if (await cellTaken(userId, x, y, conn)) return db.rollback({ status: 409, message: T.CELL_TAKEN });
        if (cellsOfCamp(await campOfUser(userId, conn, { levels })).has(y * SIZE + x)) return db.rollback({ status: 409, message: CAMP_MESSAGE });
        // (une annexe qui s'assemble : son casse-tête, vérifié et rendu avant de rien payer)
        if (a.assembly) {
            const refused = await returnAssembly(userId, a, assembly.run, assembly.layout, conn);
            if (refused) return db.rollback(refused);
        }
        const { cost, coins: price, finds: spent } = annexes.priceOf(a, copy);
        // La production en cours est encaissée d'abord : elle compte pour payer
        const { stock: paid } = await payWith(userId, conn, stock);
        const block = await priceBlock(userId, a, copy, paid, conn);
        if (block) return db.rollback(block);
        const coins = await ledger.debit(userId, price, `annexe:${a.id}:${copy + 1}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: NEED_COINS(price) });
        await spendFinds(userId, spent, conn);
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, ...RESOURCES.map(r => cost[r] || 0)]);
        await conn.query('INSERT INTO world_annexes (user_id, x, y, annex, flip, look) VALUES ($1, $2, $3, $4, $5, $6)', [userId, x, y, a.id, flip, look]);
        return { built: a.name, coins };
    });
}

// Déplace gratuitement une annexe vers une autre case libre autorisée pour son bâtiment (sa production continue)
async function moveAnnex(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const found = await annexAt(userId, x, y, conn);
        if (!found) return db.rollback({ status: 404, message: T.NO_ANNEX_HERE });
        const a = annexes.ANNEX_BY_ID[found.annex];
        if (!a || !annexSpotOk(a.site, toX, toY, (await placesOf(userId, conn)).places, a.ground)) return db.rollback({ status: 400, message: SPOT_MESSAGE });
        if (x === toX && y === toY) return {};
        if (await cellTaken(userId, toX, toY, conn)) return db.rollback({ status: 409, message: T.CELL_TAKEN });
        if (cellsOfCamp(await campOfUser(userId, conn)).has(toY * SIZE + toX)) return db.rollback({ status: 409, message: CAMP_MESSAGE });
        await conn.query('UPDATE world_annexes SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y, toX, toY]);
        return {};
    });
}

// Pivote une annexe posée (flip) ou change sa couleur (look) ; ce qui n'est pas donné reste. Sa production continue.
// {} ou { status, message }
async function poseAnnex(userId, x, y, { flip, look }) {
    await migrate(userId);
    return db.transaction(async conn => {
        const found = await annexAt(userId, x, y, conn);
        if (!found) return db.rollback({ status: 404, message: T.NO_ANNEX_HERE });
        const a = annexes.ANNEX_BY_ID[found.annex];
        if (look !== undefined && (!a || !lookOk(a, look))) return db.rollback({ status: 400, message: LOOK_MESSAGE });
        await conn.query('UPDATE world_annexes SET flip = $4, look = $5 WHERE user_id = $1 AND x = $2 AND y = $3',
            [userId, x, y, flip === undefined ? found.flip : flip, look === undefined ? found.look : look]);
        return {};
    });
}

module.exports = { annexSpotOk, annexSpots, annexesView, annexAt, cellTaken, SPOT_MESSAGE, placeAnnex, startAnnexAssembly, moveAnnex, poseAnnex };
