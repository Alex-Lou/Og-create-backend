// Les créations d'île : règles et cases de pose, vue de l'établi, assemblage, pose, déplacement, réserve. Extrait de
// services/world.js (lot santé), sans changement.
const crypto = require('crypto');
const db = require('../../config/db');
const map = require('../worldMap');
const crafts = require('../crafts');
const landmarks = require('../landmarks');
const finds = require('../finds');
const { SIZE, CRAFT_TTL_MS, keyOf } = require('./rules');
const { annexesOf, levelsOf, stockOf, zonesOf, findsOf, spendFinds, craftsOf, placedOf, madeOf } = require('./reads');
const { migrate } = require('./migrate');
const { livesHere } = require('./people');
const { gatherBefore } = require('./produce');

// Contexte des règles de pose (crafts.spotBlock) : sol, case libre (sur l'île, hors chantier, quartier à soi, ni annexe,
// ni autre création, ni lieu remarquable, ni gisement), emprise d'un bâtiment bâti, créations posées (sauf skip : celle qu'on déplace)
// (cells : les cases libres, calculées une fois pour toutes les créations)
function craftCtx(levels, zones, annexRows, rows, skip = null) {
    const others = placedOf(rows).filter(r => r.id !== skip);
    const busy = new Set([...annexRows.map(keyOf), ...others.map(keyOf)]);
    const open = new Uint8Array(SIZE * SIZE);
    const cells = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (!map.isLand(x, y) || !zones.has(map.zoneAt(x, y)) || busy.has(y * SIZE + x) || map.inFootprint(x, y, levels) || landmarks.isLandmark(x, y) || finds.isDeposit(x, y)) continue;
            open[y * SIZE + x] = 1;
            cells.push({ x, y });
        }
    }
    return {
        ground: map.groundAt,
        climate: (x, y) => map.ZONE_BY_ID[map.zoneAt(x, y)]?.climate,
        free: (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE && open[y * SIZE + x] === 1,
        site: id => (livesHere(id, levels, zones) ? map.footprintOf(id, levels[id]) : null),
        placed: others,
        cells
    };
}
// Cases où cette création peut se poser maintenant (parmi les cases libres)
function craftSpots(c, ctx) {
    return ctx.cells.filter(({ x, y }) => !crafts.spotBlock(c, x, y, ctx)).map(({ x, y }) => ({ x, y }));
}
// Créations posées sur une case qui n'est plus libre (chantier agrandi) : rangées dans la réserve
async function stowCrafts(userId, rows, levels, zones, annexRows) {
    const ctx = craftCtx(levels, zones, annexRows, []);
    const out = placedOf(rows).filter(r => !ctx.free(r.x, r.y));
    if (!out.length) return rows;
    // Seulement si elle est toujours sur cette case : déplacée entre-temps (/craft/move), elle reste où elle est
    await db.query(
        `UPDATE world_crafts c SET x = NULL, y = NULL FROM unnest($2::int[], $3::int[], $4::int[]) AS seen(id, x, y)
         WHERE c.user_id = $1 AND c.id = seen.id AND c.x = seen.x AND c.y = seen.y`,
        [userId, out.map(r => r.id), out.map(r => r.x), out.map(r => r.y)]);
    return craftsOf(userId);
}
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
function craftsView(rows, ctx, { owned, stock, open, epreuves, stars = 0, have }, siteName) {
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
        catalog: crafts.CRAFTS.map(c => {
            const reserve = rows.filter(r => r.craft === c.id && r.x === null).length;
            return {
                id: c.id, name: c.name, tier: c.tier, cost: c.cost, finds: c.finds, elements: c.elements.map(name => ({ name, have: owned.has(name) })),
                after: c.after, open: open.has(c.tier), made: made[c.id] || 0, reserve, climate: c.place.climate || null,
                block: crafts.blockOf(c, { made, owned, stock, open, have }), place: crafts.placeText(c, siteName),
                spots: made[c.id] ? craftSpots(c, ctx) : []
            };
        }),
        placed: placed.map(r => ({ x: r.x, y: r.y, craft: r.craft, ...keepsOf(r) }))
    };
}

// Assemblage d'une création : palier ouvert, celles d'avant déjà fabriquées, savoir-faire du Livre, ressources. Une
// graine, les pièces à poser (rien n'est payé avant la réussite). owned : éléments du Livre ; finished : chapitres
// finis. { run: { id, craft, shape, pieces, turned } } ou { status, message }
async function startCraft(userId, craftId, owned, finished, stars = 0) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: 'Création inconnue.' };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const open = crafts.tiersOpen(finished, await epreuvesOf(userId, conn), stars);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock, open, have: await findsOf(userId, conn) });
        if (block) return db.rollback({ status: 403, message: block });
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_craft_runs (user_id, craft, seed) VALUES ($1, $2, $3) RETURNING id', [userId, craftId, seed]);
        return { run: { id: Number(rows[0].id), craft: c.id, shape: c.shape, pieces: crafts.piecesOf(c.shape, seed, c.tier), turned: crafts.TURNED[c.tier] } };
    });
}

// Fin d'un assemblage : le serveur vérifie que les pièces couvrent le gabarit, puis prend les ressources et met la
// création en réserve. L'assemblage ne se rend qu'une fois, même refusé. { made, craft } ou { status, message }
function finishCraft(userId, runId, layout, owned, finished, stars = 0) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query(
            'SELECT craft, seed, created_at FROM world_craft_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cet assemblage est déjà rendu.' });
        await conn.query('UPDATE world_craft_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { craft: craftId, seed, created_at: createdAt } = rows[0];
        const c = crafts.CRAFT_BY_ID[craftId];
        if (Date.now() - new Date(createdAt).getTime() > CRAFT_TTL_MS) return { status: 400, message: 'Assemblage refusé : temps écoulé.' };
        const done = crafts.check(c.shape, crafts.piecesOf(c.shape, seed, c.tier), layout);
        if (!done.ok) return { status: 400, message: `Assemblage refusé : ${done.error}.` };
        // Entre le début et la fin, le stock ou le Livre ont pu changer
        const open = crafts.tiersOpen(finished, await epreuvesOf(userId, conn), stars);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock, open, have: await findsOf(userId, conn) });
        if (block) return { status: 409, message: block };
        const n = r => c.cost[r] || 0;
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, n('stone'), n('wood'), n('water'), n('food')]);
        await spendFinds(userId, c.finds, conn);
        await conn.query('INSERT INTO world_crafts (user_id, craft) VALUES ($1, $2)', [userId, craftId]);
        return { made: c.name, craft: c.id };
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

// Pose une création de la réserve sur une case permise par sa règle. { coins? } ou { status, message }
async function placeCraft(userId, craftId, x, y) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: 'Création inconnue.' };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.craft === craftId && r.x === null);
        if (!row) return db.rollback({ status: 409, message: `Pas de « ${c.name} » en réserve : fabrique d’abord cette création.` });
        const { levels } = await levelsOf(userId, conn);
        const block = crafts.spotBlock(c, x, y, craftCtx(levels, await zonesOf(userId, conn), await annexesOf(userId, conn), rows));
        if (block) return db.rollback({ status: 400, message: block });
        return setSpot(userId, conn, stock, row, x, y);
    });
}

// Déplace une création posée vers une autre case permise (gratuit). { coins? } ou { status, message }
async function moveCraft(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.x === x && r.y === y);
        if (!row) return db.rollback({ status: 404, message: 'Aucune création sur cette case.' });
        const { levels } = await levelsOf(userId, conn);
        const block = crafts.spotBlock(crafts.CRAFT_BY_ID[row.craft], toX, toY, craftCtx(levels, await zonesOf(userId, conn), await annexesOf(userId, conn), rows, row.id));
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
        if (!row) return db.rollback({ status: 404, message: 'Aucune création sur cette case.' });
        const needed = crafts.leaveBlock(row, null, null, placed);
        if (needed) return db.rollback({ status: 409, message: needed });
        return setSpot(userId, conn, stock, row, null, null);
    });
}

module.exports = {
    craftCtx, craftSpots, stowCrafts, epreuvesOf, craftsView, startCraft, finishCraft, placeCraft, moveCraft,
    storeCraft
};
