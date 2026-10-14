// Les créations d'île : règles et cases de pose, vue de l'établi, assemblage, pose, déplacement, réserve. Extrait de
// services/world.js (lot santé), sans changement.
const crypto = require('crypto');
const db = require('../../config/db');
const map = require('../worldMap');
const crafts = require('../crafts');
const quests = require('../quests');
const landmarks = require('../landmarks');
const finds = require('../finds');
const { SIZE, CRAFT_TTL_MS, keyOf } = require('./rules');
const { annexesOf, levelsOf, stockOf, zonesOf, findsOf, spendFinds, craftsOf, placedOf, madeOf } = require('./reads');
const { migrate } = require('./migrate');
const { livesHere, presenceOf } = require('./people');
const { STATIC, footprintAt, inFootprintAt, placesOf } = require('./places');
const { campOfUser, cellsOfCamp } = require('./camp');
const { gatherBefore, payWith } = require('./produce');
const { roadsOf } = require('./paths');
const T = require('../../texts/crafts');

// Contexte des règles de pose (crafts.spotBlock) : sol, case libre (sur l'île, hors chantier, quartier à soi, ni annexe,
// ni autre création, ni lieu remarquable, ni gisement), emprise d'un bâtiment bâti, créations posées (sauf skip : celle qu'on déplace)
// (cells : les cases libres, calculées une fois pour toutes les créations)
// (blocked : cases réservées en plus, celles du camp des naufragés ; ground : le sol du joueur, ses chemins compris ;
// places : où sont ses bâtiments, world/places.js)
function craftCtx({ levels, zones, annexRows, rows, skip = null, blocked = new Set(), ground = map.groundAt, places = STATIC }) {
    const others = placedOf(rows).filter(r => r.id !== skip);
    const busy = new Set([...annexRows.map(keyOf), ...others.map(keyOf), ...blocked]);
    const open = new Uint8Array(SIZE * SIZE);
    const cells = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (!map.isLand(x, y) || !zones.has(map.zoneAt(x, y)) || busy.has(y * SIZE + x) || inFootprintAt(places, x, y, levels) || landmarks.isLandmark(x, y) || finds.isDeposit(x, y)) continue;
            open[y * SIZE + x] = 1;
            cells.push({ x, y });
        }
    }
    return {
        ground,
        climate: (x, y) => map.ZONE_BY_ID[map.zoneAt(x, y)]?.climate,
        free: (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE && open[y * SIZE + x] === 1,
        site: id => (livesHere(id, levels, zones) ? footprintAt(places, id, levels[id]) : null),
        placed: others,
        cells
    };
}
// Cases où cette création peut se poser maintenant (parmi les cases libres)
function craftSpots(c, ctx) {
    return ctx.cells.filter(({ x, y }) => !crafts.spotBlock(c, x, y, ctx)).map(({ x, y }) => ({ x, y }));
}
// Créations posées sur une case qui n'est plus libre (chantier agrandi) : rangées dans la réserve
async function stowCrafts(userId, rows, levels, zones, annexRows, places = STATIC) {
    const ctx = craftCtx({ levels, zones, annexRows, rows: [], places });
    const out = placedOf(rows).filter(r => !ctx.free(r.x, r.y));
    if (!out.length) return rows;
    // Seulement si elle est toujours sur cette case : déplacée entre-temps (/craft/move), elle reste où elle est
    await db.query(
        `UPDATE world_crafts c SET x = NULL, y = NULL FROM unnest($2::int[], $3::int[], $4::int[]) AS seen(id, x, y)
         WHERE c.user_id = $1 AND c.id = seen.id AND c.x = seen.x AND c.y = seen.y`,
        [userId, out.map(r => r.id), out.map(r => r.x), out.map(r => r.y)]);
    return craftsOf(userId);
}
// Ce que le tutoriel fait fabriquer sans palier ni éléments (crafts.TUTORIAL_CRAFTS), pendant sa leçon seulement (la
// lanterne de Jovin : la quête « deco » en cours). presence : people.presenceOf
const LESSON = 'deco';
const questNow = presence => quests.QUESTS.find(q => !presence.done.has(q.id))?.id;
const tutorialOf = presence => (questNow(presence) === LESSON ? crafts.TUTORIAL_CRAFTS : new Set());
// L'enclos de Marcelle (choix de l'auteur, 13 oct.) : sa clôture se trace même sans en avoir jamais assemblé une (un
// compte d'avant les clôtures d'Hermine y arrive sans piquet : il n'est jamais lâché)
const FENCE_LESSON = 'enclos-cannelle';
const freeTraceOf = presence => (questNow(presence) === FENCE_LESSON ? new Set(['cloture']) : new Set());
// Une création en ligne se trace-t-elle ? (la première assemblée à la main, ou la leçon de l'enclos de Marcelle)
const traceable = (id, made, free) => Boolean(made[id] || free.has(id));

// Questions de l'Épreuve réussies (progress.timer_progress : niveau → catégorie → identifiants)
async function epreuvesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT timer_progress FROM progress WHERE user_id = $1', [userId]);
    const done = rows[0]?.timer_progress?.completedQuestions || {};
    return Object.values(done).flatMap(cats => Object.values(cats || {})).reduce((n, ids) => n + (Array.isArray(ids) ? ids.length : 0), 0);
}
// Ce que la vue montre des créations d'île : paliers ouverts, catalogue (ce qui manque pour fabriquer, réserve, cases
// où poser ou déplacer une création déjà fabriquée), créations posées. Une création posée dont d'autres ont besoin
// (règle « près de ») dit lesquelles : keeps = leurs cases et leur portée (elle ne se déplace qu'à portée de chacune),
// keepText = pourquoi elle ne se range pas (crafts.leaveBlock)
// pagesTo(nom) : pages jusqu'à un savoir-faire pas encore écrit (le verrou parlant, comme pour un bâtiment), ou rien
function craftsView(rows, ctx, { owned, stock, open, epreuves, stars = 0, have, presence = null, pagesTo = null }, siteName) {
    const tutorial = presence ? tutorialOf(presence) : new Set();
    const free = presence ? freeTraceOf(presence) : new Set();
    const made = madeOf(rows);
    const placed = placedOf(rows);
    const keepsOf = r => {
        const kept = crafts.strandedBy(r, null, null, placed);
        if (!kept.length) return {};
        const keeps = kept.map(d => ({ x: d.x, y: d.y, reach: crafts.CRAFT_BY_ID[d.craft].place.nearCraft.reach }));
        return { keeps, keepText: crafts.leaveBlock(r, null, null, placed) };
    };
    return {
        epreuves: { have: epreuves, need: crafts.EPREUVES },
        // Découvertes du Grimoire qui ouvrent le palier I (l'autre clé : les questions de l'Épreuve)
        stars: { have: stars, need: crafts.STARS },
        open: crafts.TIERS.filter(t => open.has(t)),
        // Ce qui ouvre chaque palier fermé (crafts.tierLock : le palier d'avant, ou les découvertes qui manquent au chapitre)
        locks: Object.fromEntries(crafts.TIERS.map(t => [t, crafts.tierLock(t, open, stars)]).filter(([, text]) => text)),
        catalog: crafts.CRAFTS.map(c => {
            const reserve = rows.filter(r => r.craft === c.id && r.x === null).length;
            return {
                id: c.id, name: c.name, tier: c.tier, cost: c.cost, finds: c.finds, elements: c.elements.map(name => ({ name, have: owned.has(name), ...(!owned.has(name) && pagesTo ? { pages: pagesTo(name) } : {}) })),
                // (tutorial : la leçon du tutoriel la fait fabriquer avant son palier ; le front ouvre l'établi sur elle)
                after: c.after, open: open.has(c.tier) || tutorial.has(c.id), tutorial: tutorial.has(c.id), made: made[c.id] || 0, reserve, climate: c.place.climate || null,
                ...(crafts.LINE_CRAFTS.has(c.id) ? { line: true, traceable: traceable(c.id, made, free) } : {}),
                block: crafts.blockOf(c, { made, owned, stock, open, have, tutorial: tutorial.has(c.id), stars }), place: crafts.placeText(c, siteName),
                spots: made[c.id] || free.has(c.id) ? craftSpots(c, ctx) : []
            };
        }),
        placed: placed.map(r => ({ x: r.x, y: r.y, craft: r.craft, flip: r.flip, ...keepsOf(r) }))
    };
}

// Assemblage d'une création : palier ouvert, celles d'avant déjà fabriquées, savoir-faire du Livre, ressources. Une
// graine, les pièces à poser (rien n'est payé avant la réussite). owned : éléments du Livre ; chapters : chapitres
// ouverts. { run: { id, craft, shape, pieces, turned } } ou { status, message }
async function startCraft(userId, craftId, owned, chapters, stars = 0) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: T.CRAFT_UNKNOWN };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour les matériaux
        const { stock, balance } = await payWith(userId, conn, await stockOf(userId, conn, true));
        const open = crafts.tiersOpen(chapters, await epreuvesOf(userId, conn), stars);
        const tutorial = tutorialOf(await presenceOf(userId, conn)).has(c.id);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock, open, have: await findsOf(userId, conn), tutorial, stars });
        if (block) return db.rollback({ status: 403, message: block });
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_craft_runs (user_id, craft, seed) VALUES ($1, $2, $3) RETURNING id', [userId, craftId, seed]);
        return {
            run: { id: Number(rows[0].id), craft: c.id, shape: c.shape, pieces: crafts.piecesOf(c.shape, seed, c.tier), turned: crafts.TURNED[c.tier] },
            ...(balance !== undefined ? { coins: balance } : {})
        };
    });
}

// Fin d'un assemblage : le serveur vérifie que les pièces couvrent le gabarit, puis prend les ressources et met la
// création en réserve. L'assemblage ne se rend qu'une fois, même refusé. { made, craft } ou { status, message }
function finishCraft(userId, runId, layout, owned, chapters, stars = 0) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query(
            'SELECT craft, seed, created_at FROM world_craft_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: T.ASSEMBLY_RETURNED });
        await conn.query('UPDATE world_craft_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { craft: craftId, seed, created_at: createdAt } = rows[0];
        const c = crafts.CRAFT_BY_ID[craftId];
        if (Date.now() - new Date(createdAt).getTime() > CRAFT_TTL_MS) return { status: 400, message: T.ASSEMBLY_LATE };
        const done = crafts.check(c.shape, crafts.piecesOf(c.shape, seed, c.tier), layout);
        if (!done.ok) return { status: 400, message: T.ASSEMBLY_REFUSED(done.error) };
        // Entre le début et la fin, le stock ou le Livre ont pu changer ; ce qui attend dans les bâtiments compte encore
        const { stock: paid, balance } = await payWith(userId, conn, stock);
        const open = crafts.tiersOpen(chapters, await epreuvesOf(userId, conn), stars);
        const tutorial = tutorialOf(await presenceOf(userId, conn)).has(c.id);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock: paid, open, have: await findsOf(userId, conn), tutorial, stars });
        if (block) return { status: 409, message: block };
        const n = r => c.cost[r] || 0;
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, n('stone'), n('wood'), n('water'), n('food')]);
        await spendFinds(userId, c.finds, conn);
        await conn.query('INSERT INTO world_crafts (user_id, craft) VALUES ($1, $2)', [userId, craftId]);
        return { made: c.name, craft: c.id, ...(balance !== undefined ? { coins: balance } : {}) };
    });
}

// Une création posée, déplacée ou rangée change ce qui distrait les habitants (leur humeur) : ce qui a été produit
// avant est encaissé d'abord quand leur production en change (produce.gatherBefore). { coins } (solde) si des écus
// ont été encaissés, sinon { }
async function setSpot(userId, conn, stock, row, x, y) {
    const decor = island => [...island.decor.filter(r => r.id !== row.id), ...(x === null ? [] : [{ ...row, x, y }])];
    const coins = await gatherBefore(userId, conn, stock, island => ({ ...island, decor: decor(island) }));
    await conn.query('UPDATE world_crafts SET x = $2, y = $3 WHERE id = $1', [row.id, x, y]);
    return coins !== undefined ? { coins } : {};
}

// Pose une création de la réserve sur une case permise par sa règle, en miroir ou non (flip). { coins? } ou
// { status, message }
async function placeCraft(userId, craftId, x, y, flip = false) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: T.CRAFT_UNKNOWN };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.craft === craftId && r.x === null);
        if (!row) return db.rollback({ status: 409, message: T.NONE_IN_RESERVE(c.name) });
        const { levels } = await levelsOf(userId, conn);
        const annexRows = await annexesOf(userId, conn);
        const campCells = cellsOfCamp(await campOfUser(userId, conn, { levels, annexRows, craftRows: rows }));
        const { ground } = await roadsOf(userId, conn);
        const { places } = await placesOf(userId, conn);
        const block = crafts.spotBlock(c, x, y, craftCtx({ levels, zones: await zonesOf(userId, conn), annexRows, rows, blocked: campCells, ground, places }));
        if (block) return db.rollback({ status: 400, message: block });
        await conn.query('UPDATE world_crafts SET flip = $2 WHERE id = $1', [row.id, flip]);
        return setSpot(userId, conn, stock, row, x, y);
    });
}

// Pose en ligne (un glisser, choix de l'auteur, 13 oct.) : une création « en ligne » (clôture, muret) sur chaque case de
// cells, dans l'ordre. La réserve d'abord, puis chaque pièce fabriquée et payée en passant, sans assemblage (la première
// l'a été à la main). S'arrête à la première case refusée, ou quand il manque de quoi la payer : ce qui est posé reste.
// owned, chapters, stars : comme startCraft. { placed, stopped?, coins? } ou { status, message }
async function placeLine(userId, craftId, cells, owned, chapters, stars = 0) {
    if (!crafts.LINE_CRAFTS.has(craftId)) return { status: 400, message: T.NOT_A_LINE };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        // (ce qui attend dans les bâtiments compte pour payer ; le stock relu ensuite, à jour)
        const { balance } = await payWith(userId, conn, await stockOf(userId, conn, true));
        let stock = await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const made = madeOf(rows);
        const presence = await presenceOf(userId, conn);
        if (!traceable(craftId, made, freeTraceOf(presence))) return db.rollback({ status: 409, message: T.WORKBENCH_FIRST(c.name) });
        const { levels } = await levelsOf(userId, conn);
        const annexRows = await annexesOf(userId, conn);
        const campCells = cellsOfCamp(await campOfUser(userId, conn, { levels, annexRows, craftRows: rows }));
        const { ground } = await roadsOf(userId, conn);
        const { places } = await placesOf(userId, conn);
        const ctx = craftCtx({ levels, zones: await zonesOf(userId, conn), annexRows, rows, blocked: campCells, ground, places });
        const open = crafts.tiersOpen(chapters, await epreuvesOf(userId, conn), stars);
        const tutorial = tutorialOf(presence).has(c.id);
        const known = new Set(owned);
        const reserve = rows.filter(r => r.craft === craftId && r.x === null);
        const taken = new Set();
        let placed = 0;
        let stopped = null;
        let coins = balance;
        for (const [x, y] of cells) {
            const block = taken.has(y * SIZE + x) ? T.CELL_TAKEN : crafts.spotBlock(c, x, y, ctx);
            if (block) {
                stopped = block;
                break;
            }
            let row = reserve.shift();
            if (!row) {
                const lack = crafts.blockOf(c, { made, owned: known, stock, open, have: await findsOf(userId, conn), tutorial, stars });
                if (lack) {
                    stopped = lack;
                    break;
                }
                const n = r => c.cost[r] || 0;
                await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
                    [userId, n('stone'), n('wood'), n('water'), n('food')]);
                await spendFinds(userId, c.finds, conn);
                const { rows: added } = await conn.query('INSERT INTO world_crafts (user_id, craft) VALUES ($1, $2) RETURNING id', [userId, craftId]);
                row = { id: added[0].id, craft: craftId, x: null, y: null, flip: false };
                stock = await stockOf(userId, conn, true);
            }
            const done = await setSpot(userId, conn, stock, row, x, y);
            if (done.coins !== undefined) coins = done.coins;
            // (une récolte a pu passer : le stock relu, à jour)
            stock = await stockOf(userId, conn, true);
            taken.add(y * SIZE + x);
            placed++;
        }
        if (!placed) return db.rollback({ status: 400, message: stopped || T.NOTHING_TO_PLACE });
        return { placed, ...(stopped ? { stopped } : {}), ...(coins !== undefined ? { coins } : {}) };
    });
}

// L'anneau d'un coin du camp (l'enclos de Marcelle, choix de l'auteur, 13 oct.) : les cases à une case de son coin, sauf
// celles qui bordent le Feu (son enclos à lui, autour de sa grande emprise) ; have : celles qui ont déjà leur clôture,
// need : have et celles où une clôture peut encore se poser (rien d'impossible n'est demandé). { have, need }
async function fenceRingOf(userId, conn, who) {
    const rows = await craftsOf(userId, conn);
    const { levels } = await levelsOf(userId, conn);
    const annexRows = await annexesOf(userId, conn);
    const camp = await campOfUser(userId, conn, { levels, annexRows, craftRows: rows });
    const corner = camp.find(c => c.id === who);
    if (!corner) return { have: 0, need: 0 };
    const { places } = await placesOf(userId, conn);
    const feu = places.foyer;
    const gap = (v, a, w) => Math.max(a - v, 0, v - (a + w - 1));
    const ring = [];
    for (let y = corner.y - 1; y <= corner.y + corner.h; y++) {
        for (let x = corner.x - 1; x <= corner.x + corner.w; x++) {
            if (Math.max(gap(x, corner.x, corner.w), gap(y, corner.y, corner.h)) !== 1) continue;
            if (feu && Math.max(gap(x, feu.x, 3), gap(y, feu.y, 3)) <= 1) continue;
            ring.push({ x, y });
        }
    }
    const fenced = new Set(placedOf(rows).filter(r => r.craft === 'cloture').map(keyOf));
    const { ground } = await roadsOf(userId, conn);
    const ctx = craftCtx({ levels, zones: await zonesOf(userId, conn), annexRows, rows, blocked: cellsOfCamp(camp), ground, places });
    const fence = crafts.CRAFT_BY_ID.cloture;
    const have = ring.filter(c => fenced.has(keyOf(c))).length;
    const free = ring.filter(c => !fenced.has(keyOf(c)) && !crafts.spotBlock(fence, c.x, c.y, ctx)).length;
    return { have, need: have + free };
}

// Déplace une création posée vers une autre case permise (gratuit). { coins? } ou { status, message }
async function moveCraft(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.x === x && r.y === y);
        if (!row) return db.rollback({ status: 404, message: T.NO_CRAFT_HERE });
        const { levels } = await levelsOf(userId, conn);
        const annexRows = await annexesOf(userId, conn);
        const campCells = cellsOfCamp(await campOfUser(userId, conn, { levels, annexRows, craftRows: rows }));
        const { ground } = await roadsOf(userId, conn);
        const { places } = await placesOf(userId, conn);
        const block = crafts.spotBlock(crafts.CRAFT_BY_ID[row.craft], toX, toY, craftCtx({ levels, zones: await zonesOf(userId, conn), annexRows, rows, skip: row.id, blocked: campCells, ground, places }));
        if (block) return db.rollback({ status: 400, message: block });
        // Une création posée près d'elle (règle « près de ») doit la garder à portée
        const needed = crafts.leaveBlock(row, toX, toY, placedOf(rows));
        if (needed) return db.rollback({ status: 409, message: needed });
        return setSpot(userId, conn, stock, row, toX, toY);
    });
}

// Range une création posée dans la réserve (elle se repose plus tard, sans rien payer). { coins? } ou { status, message }
async function storeCraft(userId, x, y) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const placed = placedOf(await craftsOf(userId, conn));
        const row = placed.find(r => r.x === x && r.y === y);
        if (!row) return db.rollback({ status: 404, message: T.NO_CRAFT_HERE });
        const needed = crafts.leaveBlock(row, null, null, placed);
        if (needed) return db.rollback({ status: 409, message: needed });
        return setSpot(userId, conn, stock, row, null, null);
    });
}

// Pivote une création posée (miroir) : rien d'autre ne change. {} ou { status, message }
async function turnCraft(userId, x, y, flip) {
    await migrate(userId);
    const { rowCount } = await db.query('UPDATE world_crafts SET flip = $4 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y, flip]);
    return rowCount ? {} : { status: 404, message: T.NO_CRAFT_HERE };
}

module.exports = {
    craftCtx, craftSpots, stowCrafts, epreuvesOf, craftsView, startCraft, finishCraft, placeCraft, placeLine, fenceRingOf, moveCraft,
    storeCraft, turnCraft
};
