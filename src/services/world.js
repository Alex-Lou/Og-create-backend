// Le Monde : l'île du joueur. Des chantiers à des places fixes (le Foyer au centre, le Ponton sur la rive)
// se construisent avec un plan découvert dans le Livre et des ressources tirées de la Récolte (mini-jeu).
// Les découvertes se posent aussi en décoration sur les cases libres et produisent quelques écus.
// Tout ce qui compte (stock, parties, gains, écus) est décidé ici, dans des transactions verrouillées.
const crypto = require('crypto');
const db = require('../config/db');
const ledger = require('./ledger');
const harvest = require('./harvest');

const SIZE = 14; // île de 14 × 14 cases
const RATE = 1; // écus par heure et par décoration
const CAP_HOURS = 8;
const REGEN_MS = 30 * 60 * 1000; // une partie de Récolte revient toutes les 30 minutes
const RUN_TTL_MS = 24 * 3600 * 1000; // une partie non rendue après 24 h est perdue
const MOVES = 15;
const RESOURCES = ['stone', 'wood', 'water', 'food'];

// Chantiers : place (2 × 2 cases), niveaux successifs avec leur plan (élément du Livre) et leur coût
const SITES = {
    foyer: {
        x: 6, y: 6,
        levels: [
            { name: 'Foyer', plan: null, cost: {}, effect: '3 parties de Récolte en réserve.' },
            { name: 'Cabane', plan: 'Cabane', cost: { wood: 20, stone: 10 }, effect: '4 parties en réserve, 2 écus par heure.' },
            { name: 'Maison', plan: 'Maison', cost: { stone: 40, wood: 30, water: 20 }, effect: '5 parties en réserve, 4 écus par heure.' }
        ]
    },
    carriere: { x: 6, y: 2, levels: [{ name: 'Carrière', plan: 'Pierre', cost: { wood: 5 }, effect: 'La pierre rapporte double à la Récolte.' }] },
    bosquet: { x: 2, y: 3, levels: [{ name: 'Bosquet', plan: 'Arbre', cost: { stone: 5 }, effect: 'Le bois rapporte double à la Récolte.' }] },
    puits: { x: 6, y: 10, levels: [{ name: 'Puits', plan: 'Puits', cost: { stone: 10 }, effect: 'L’eau rapporte double à la Récolte.' }] },
    potager: { x: 2, y: 9, levels: [{ name: 'Potager', plan: 'Plante', cost: { water: 8 }, effect: 'La nourriture rapporte double à la Récolte.' }] },
    atelier: { x: 10, y: 6, levels: [{ name: 'Atelier', plan: 'Four', cost: { stone: 15, wood: 10 }, effect: '3 coups de plus par Récolte.' }] },
    ponton: { x: 12, y: 11, levels: [{ name: 'Ponton', plan: 'Bateau', cost: { wood: 25 }, effect: 'Des poissons (nourriture × 3) à la Récolte.' }] }
};
const BOOSTED = { carriere: 'stone', bosquet: 'wood', puits: 'water', potager: 'food' };

// Cases prises par les chantiers (bâtis ou non) : pas de décoration dessus
const blocked = new Set(Object.values(SITES).flatMap(s => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => (s.y + dy) * SIZE + s.x + dx)));
const isFree = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !blocked.has(y * SIZE + x);

// Écus en attente : chaque source compte depuis sa pose ou la dernière récolte, réservoir plafonné
function pendingOf(sources, collectedAt, now = Date.now()) {
    const since = collectedAt ? new Date(collectedAt).getTime() : 0;
    let total = 0;
    for (const source of sources) {
        const start = Math.max(since, new Date(source.placed_at).getTime());
        total += Math.min(CAP_HOURS, Math.max(0, (now - start) / 3600000)) * (source.rate ?? RATE);
    }
    return Math.floor(total);
}

// Parties disponibles à l'instant : réserve + parties revenues depuis charges_at, plafonnées
function chargesAt(stock, max, now = Date.now()) {
    const since = new Date(stock.charges_at).getTime();
    const ticks = Math.max(0, Math.floor((now - since) / REGEN_MS));
    if (stock.charges + ticks >= max) return { count: max, since: now };
    return { count: stock.charges + ticks, since: since + ticks * REGEN_MS };
}

// Effets des bâtiments construits : réserve, coups, tuiles, multiplicateurs, écus du Foyer
function effectsOf(levels) {
    const boosts = {};
    for (const [site, resource] of Object.entries(BOOSTED)) if (levels[site]) boosts[resource] = 2;
    const foyer = levels.foyer || 1;
    return {
        maxCharges: 2 + foyer,
        maxMoves: MOVES + (levels.atelier ? 3 : 0),
        kinds: [...harvest.BASE_KINDS, ...(levels.ponton ? ['fish'] : [])],
        boosts,
        foyerRate: (foyer - 1) * 2
    };
}

async function levelsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT site, level, built_at FROM world_buildings WHERE user_id = $1', [userId]);
    const levels = { foyer: 1 };
    const builtAt = {};
    for (const row of rows) {
        levels[row.site] = row.level;
        builtAt[row.site] = row.built_at;
    }
    return { levels, builtAt };
}

// Ligne de stock du joueur (créée à la première visite, avec une réserve pleine ;
// la dernière récolte d'écus de la v1 est reprise pour ne pas la payer deux fois)
async function stockOf(userId, conn = db, lock = false) {
    await conn.query(
        `INSERT INTO world_stock (user_id, charges, collected_at)
         SELECT $1, 3, (SELECT world_collected_at FROM progress WHERE user_id = $1)
         ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const { rows } = await conn.query(`SELECT * FROM world_stock WHERE user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId]);
    return rows[0];
}

async function tilesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, element, placed_at FROM world_tiles WHERE user_id = $1 ORDER BY y, x', [userId]);
    return rows;
}

// Sources d'écus : les décorations, et le Foyer à partir de la Cabane
function sourcesOf(tiles, levels, builtAt) {
    const rate = effectsOf(levels).foyerRate;
    return rate ? [...tiles, { placed_at: builtAt.foyer, rate }] : tiles;
}

// Décorations posées avant la v2 sur une place de chantier : déplacées une fois vers la case libre la plus proche
async function settle(userId, tiles) {
    const taken = new Set(tiles.map(t => t.y * SIZE + t.x));
    let moved = false;
    for (const tile of tiles.filter(t => !isFree(t.x, t.y))) {
        let best = null;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (!isFree(x, y) || taken.has(y * SIZE + x)) continue;
                const d = Math.abs(x - tile.x) + Math.abs(y - tile.y);
                if (!best || d < best.d) best = { x, y, d };
            }
        }
        if (!best) continue;
        await db.query('UPDATE world_tiles SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, tile.x, tile.y, best.x, best.y]).catch(() => {});
        taken.add(best.y * SIZE + best.x);
        moved = true;
    }
    return moved ? tilesOf(userId) : tiles;
}

// Vue de l'île pour le navigateur (describe ajoute glyphe et famille de chaque élément)
async function view(userId, owned, describe) {
    const { levels, builtAt } = await levelsOf(userId);
    const effects = effectsOf(levels);
    const stock = await stockOf(userId);
    const charges = chargesAt(stock, effects.maxCharges);
    const tiles = await settle(userId, await tilesOf(userId));
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = describe([...tiles.map(t => t.element), ...plans]);
    const sites = Object.entries(SITES).map(([id, site]) => {
        const level = levels[id] || 0;
        const next = site.levels[level];
        return {
            id, x: site.x, y: site.y, w: 2, h: 2, level, maxLevel: site.levels.length,
            name: level ? site.levels[level - 1].name : site.levels[0].name,
            effect: level ? site.levels[level - 1].effect : null,
            emoji: level && site.levels[level - 1].plan ? known[site.levels[level - 1].plan]?.emoji || null : null,
            next: next ? { name: next.name, plan: next.plan, planOwned: !next.plan || have.has(next.plan), planEmoji: next.plan ? known[next.plan]?.emoji || null : null, cost: next.cost, effect: next.effect } : null
        };
    });
    return {
        size: SIZE,
        sites,
        stock: Object.fromEntries(RESOURCES.map(r => [r, stock[r]])),
        charges: { count: charges.count, max: effects.maxCharges, nextIn: charges.count < effects.maxCharges ? Math.max(0, charges.since + REGEN_MS - Date.now()) : null },
        harvest: { maxMoves: effects.maxMoves, kinds: effects.kinds, boosts: effects.boosts },
        rate: RATE,
        capHours: CAP_HOURS,
        pending: pendingOf(sourcesOf(tiles, levels, builtAt), stock.collected_at),
        tiles: tiles.map(t => ({ x: t.x, y: t.y, element: t.element, ...(known[t.element] || {}) }))
    };
}

// Construit le niveau suivant d'un chantier ; { status, message } en cas de refus
async function build(userId, owned, siteId) {
    const site = SITES[siteId];
    if (!site) return { status: 404, message: 'Chantier inconnu.' };
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const level = levels[siteId] || 0;
        const next = site.levels[level];
        if (!next) return db.rollback({ status: 409, message: 'Ce chantier est déjà achevé.' });
        if (next.plan && !owned.includes(next.plan)) return db.rollback({ status: 403, message: `Il te faut le plan : découvre « ${next.plan} » dans le Livre.` });
        const missing = Object.entries(next.cost).filter(([r, n]) => stock[r] < n);
        if (missing.length) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const costs = RESOURCES.map(r => next.cost[r] || 0);
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1', [userId, ...costs]);
        await conn.query(
            `INSERT INTO world_buildings (user_id, site, level) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level, built_at = NOW()`, [userId, siteId, level + 1]);
        return { built: next.name };
    });
}

// Nouvelle partie de Récolte : une partie de la réserve, une graine, la configuration figée de l'île
function startRun(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const effects = effectsOf(levels);
        const charges = chargesAt(stock, effects.maxCharges);
        if (charges.count < 1) return db.rollback({ status: 409, message: 'Plus de partie en réserve : la prochaine revient bientôt.' });
        await conn.query('UPDATE world_stock SET charges = $2, charges_at = $3 WHERE user_id = $1', [userId, charges.count - 1, new Date(charges.since)]);
        const seed = crypto.randomInt(1, 2147483647);
        const { kinds, maxMoves, boosts } = effects;
        const { rows } = await conn.query(
            'INSERT INTO world_runs (user_id, seed, config) VALUES ($1, $2, $3) RETURNING id',
            [userId, seed, JSON.stringify({ kinds, maxMoves, boosts })]);
        return { run: { id: Number(rows[0].id), seed, kinds, maxMoves, boosts } };
    });
}

// Fin de partie : le serveur rejoue les coups ; la partie ne se rend qu'une fois, même refusée
function finishRun(userId, runId, moves) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'SELECT seed, config, created_at FROM world_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cette partie est déjà rendue.' });
        await conn.query('UPDATE world_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { seed, config, created_at: createdAt } = rows[0];
        const played = Date.now() - new Date(createdAt).getTime() > RUN_TTL_MS
            ? { ok: false, error: 'Partie expirée' }
            : harvest.replay(seed, config.kinds, moves, config.maxMoves, config.boosts);
        if (!played.ok) return { status: 400, message: `Partie refusée : ${played.error.toLowerCase()}.` };
        await stockOf(userId, conn, true);
        const g = played.gains;
        await conn.query('UPDATE world_stock SET stone = stone + $2, wood = wood + $3, water = water + $4, food = food + $5 WHERE user_id = $1',
            [userId, g.stone, g.wood, g.water, g.food]);
        return { gains: g };
    });
}

// Pose (ou déplace) un élément possédé en décoration sur une case libre ; { status, message } en cas de refus
async function place(userId, owned, element, x, y) {
    if (!owned.includes(element)) return { status: 403, message: 'Cet élément n’est pas dans ton carnet.' };
    if (![x, y].every(v => Number.isInteger(v))) return { status: 400, message: 'Case hors de l’île.' };
    if (!isFree(x, y)) return { status: 400, message: x >= 0 && y >= 0 && x < SIZE && y < SIZE ? 'Cette place est réservée à un chantier.' : 'Case hors de l’île.' };
    return db.transaction(async conn => {
        const occupied = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
        if (occupied.rows.length && occupied.rows[0].element !== element) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        // Déjà posé ailleurs : on le déplace (sa production continue), sinon on le pose
        const moved = await conn.query('UPDATE world_tiles SET x = $3, y = $4 WHERE user_id = $1 AND element = $2 RETURNING element', [userId, element, x, y]);
        if (!moved.rows.length) {
            await conn.query('INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, $2, $3, $4)', [userId, x, y, element]);
        }
        return {};
    });
}

async function remove(userId, x, y) {
    await db.query('DELETE FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
}

// Récolte des écus (décorations et Foyer) : { gained, coins }
function collect(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels, builtAt } = await levelsOf(userId, conn);
        const now = new Date();
        const gained = pendingOf(sourcesOf(await tilesOf(userId, conn), levels, builtAt), stock.collected_at, now.getTime());
        if (!gained) return db.rollback({ gained: 0, coins: await ledger.balance(userId) });
        await conn.query('UPDATE world_stock SET collected_at = $2 WHERE user_id = $1', [userId, now]);
        const { coins } = await ledger.credit(userId, gained, 'monde', now.toISOString(), conn);
        return { gained, coins };
    });
}

module.exports = { CAP_HOURS, REGEN_MS, isFree, pendingOf, chargesAt, effectsOf, view, build, startRun, finishRun, place, remove, collect };
