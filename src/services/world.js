// Le Monde : l'île du joueur, sur une carte commune (worldMap.js) : un cœur ouvert d'office, six quartiers à acheter
// (écus + chapitre du Livre). Les chantiers se construisent puis évoluent avec un plan découvert dans le Livre et des
// ressources tirées de la Récolte. Les bâtiments de production rapportent ressources et écus ; les décorations
// s'achètent et embellissent, sans rien produire.
// Tout ce qui compte (stock, quartiers, parties, gains, écus) est décidé ici, dans des transactions verrouillées.
const crypto = require('crypto');
const db = require('../config/db');
const ledger = require('./ledger');
const harvest = require('./harvest');
const map = require('./worldMap');

const SIZE = map.SIZE;
const CAP_HOURS = 8;
const REGEN_MS = 30 * 60 * 1000; // une partie de Récolte revient toutes les 30 minutes
const RUN_TTL_MS = 24 * 3600 * 1000; // une partie non rendue après 24 h est perdue
const MOVES = 15;
const RESOURCES = ['stone', 'wood', 'water', 'food'];
const MAP_VERSION = 2;
// Ancienne règle (v1) : une décoration rapportait 1 écu par heure ; payée une dernière fois à la migration
const OLD_DECO_RATE = 1;
// Prix d'une décoration selon le chapitre de l'élément posé
const DECO_PRICES = { I: 10, II: 15, III: 25, IV: 40, V: 60, VI: 90, VII: 140 };
// Récolte : 1 écu par tranche de 10 ressources gagnées
const HARVEST_COIN_EVERY = 10;

// Chantiers : place (worldMap), niveaux successifs avec leur plan (élément du Livre), leur coût et leur effet.
// produce : ressource produite en continu par heure et par niveau, avec des écus par heure et par niveau.
const SITES = {
    foyer: {
        levels: [
            { name: 'Foyer', plan: null, cost: {}, effect: '3 parties de Récolte en réserve.' },
            { name: 'Cabane', plan: 'Cabane', cost: { wood: 20, stone: 10 }, effect: '4 parties de Récolte en réserve.' },
            { name: 'Maison', plan: 'Maison', cost: { stone: 40, wood: 30, water: 20 }, effect: '5 parties de Récolte en réserve.' }
        ]
    },
    carriere: {
        produce: 'stone',
        levels: [
            { name: 'Carrière', plan: 'Pierre', cost: { wood: 5 }, effect: 'Produit de la pierre et des écus ; la pierre rapporte double à la Récolte.' },
            { name: 'Mine', plan: 'Marteau', cost: { stone: 30, wood: 20 }, effect: 'Produit deux fois plus ; la pierre rapporte triple à la Récolte.' }
        ]
    },
    bosquet: {
        produce: 'wood',
        levels: [
            { name: 'Bosquet', plan: 'Arbre', cost: { stone: 5 }, effect: 'Produit du bois et des écus ; le bois rapporte double à la Récolte.' },
            { name: 'Grand bosquet', plan: 'Forêt', cost: { wood: 25, water: 15 }, effect: 'Produit deux fois plus ; le bois rapporte triple à la Récolte.' }
        ]
    },
    puits: {
        produce: 'water',
        levels: [
            { name: 'Puits', plan: 'Puits', cost: { stone: 10 }, effect: 'Produit de l’eau et des écus ; l’eau rapporte double à la Récolte.' },
            { name: 'Fontaine', plan: 'Fontaine', cost: { stone: 30, water: 15 }, effect: 'Produit deux fois plus ; l’eau rapporte triple à la Récolte.' }
        ]
    },
    potager: {
        produce: 'food',
        levels: [
            { name: 'Potager', plan: 'Plante', cost: { water: 8 }, effect: 'Produit des vivres et des écus ; la nourriture rapporte double à la Récolte.' },
            { name: 'Serre', plan: 'Serre', cost: { wood: 20, water: 25, food: 10 }, effect: 'Produit deux fois plus ; la nourriture rapporte triple à la Récolte.' }
        ]
    },
    atelier: {
        levels: [
            { name: 'Atelier', plan: 'Four', cost: { stone: 15, wood: 10 }, effect: '3 coups de plus par Récolte.' },
            { name: 'Forge', plan: 'Forge', cost: { stone: 35, wood: 25 }, effect: '5 coups de plus par Récolte.' }
        ]
    },
    ponton: {
        produce: 'food',
        levels: [
            { name: 'Ponton', plan: 'Bateau', cost: { wood: 25 }, effect: 'Pêche des vivres et des écus ; des poissons à la Récolte.' },
            { name: 'Port de pêche', plan: 'Port', cost: { wood: 40, stone: 15 }, effect: 'Pêche deux fois plus ; 2 coups de plus à la Récolte.' }
        ]
    }
};
const BOOSTED = { carriere: 'stone', bosquet: 'wood', puits: 'water', potager: 'food' };
const PRODUCE_PER_LEVEL = 3; // ressources par heure et par niveau
const COINS_PER_LEVEL = 2; // écus par heure et par niveau

// Case où l'on peut poser une décoration : terre, hors chantier, dans un quartier possédé
const isFree = (x, y, zones) => Number.isInteger(x) && Number.isInteger(y) && map.isLand(x, y) && !map.inSite(x, y) && zones.has(map.zoneAt(x, y));

// Écus dus selon l'ancienne règle (décorations) : chaque source compte depuis sa pose ou la dernière récolte, plafonnée
function pendingOf(sources, collectedAt, now = Date.now()) {
    const since = collectedAt ? new Date(collectedAt).getTime() : 0;
    let total = 0;
    for (const source of sources) {
        const start = Math.max(since, new Date(source.placed_at).getTime());
        total += Math.min(CAP_HOURS, Math.max(0, (now - start) / 3600000)) * (source.rate ?? OLD_DECO_RATE);
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

// Effets des bâtiments construits : réserve, coups, tuiles, multiplicateurs (×2 au niveau 1, ×3 au niveau 2)
function effectsOf(levels) {
    const boosts = {};
    for (const [site, resource] of Object.entries(BOOSTED)) if (levels[site]) boosts[resource] = 1 + levels[site];
    const foyer = levels.foyer || 1;
    const atelier = levels.atelier || 0;
    const ponton = levels.ponton || 0;
    return {
        maxCharges: 2 + foyer,
        maxMoves: MOVES + (atelier >= 2 ? 5 : atelier ? 3 : 0) + (ponton >= 2 ? 2 : 0),
        kinds: [...harvest.BASE_KINDS, ...(ponton ? ['fish'] : [])],
        boosts
    };
}

// Production d'un bâtiment depuis sa construction ou la dernière récolte (plafonnée à CAP_HOURS) : { coins, amount }
function productionOf(siteId, level, builtAt, collectedAt, now = Date.now()) {
    const site = SITES[siteId];
    if (!site.produce || !level) return null;
    const since = Math.max(collectedAt ? new Date(collectedAt).getTime() : 0, new Date(builtAt).getTime());
    const hours = Math.min(CAP_HOURS, Math.max(0, (now - since) / 3600000));
    return { resource: site.produce, amount: Math.floor(hours * PRODUCE_PER_LEVEL * level), coins: Math.floor(hours * COINS_PER_LEVEL * level) };
}
function productionAll(levels, builtAt, collectedAt, now = Date.now()) {
    return Object.keys(SITES).map(id => ({ site: id, ...productionOf(id, levels[id] || 0, builtAt[id], collectedAt, now) })).filter(p => p.resource);
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

async function zonesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT zone FROM world_zones WHERE user_id = $1', [userId]);
    return new Set(['coeur', ...rows.map(r => r.zone)]);
}

// Passage à la carte v2, une fois par joueur, au premier passage : les écus encore dus par les décorations
// (ancienne règle) sont versés, tout ce qui était posé glisse de OFFSET cases, et les quartiers où le joueur
// avait déjà un bâtiment ou une décoration lui sont offerts. Verrouillé : deux requêtes ne migrent pas deux fois.
function migrate(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (stock.map_version >= MAP_VERSION) return false;
        const tiles = await tilesOf(userId, conn);
        const { levels, builtAt } = await levelsOf(userId, conn);
        const oldFoyerRate = ((levels.foyer || 1) - 1) * 2;
        const owed = pendingOf([...tiles.map(t => ({ ...t, rate: OLD_DECO_RATE })), ...(oldFoyerRate ? [{ placed_at: builtAt.foyer, rate: oldFoyerRate }] : [])], stock.collected_at);
        if (owed > 0) await ledger.credit(userId, owed, 'monde', 'carte-v2', conn);
        // Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à elle-même pendant la mise à jour
        await conn.query('UPDATE world_tiles SET x = x + 1000, y = y + 1000 WHERE user_id = $1', [userId]);
        await conn.query('UPDATE world_tiles SET x = x - 1000 + $2, y = y - 1000 + $2 WHERE user_id = $1', [userId, map.OFFSET]);
        const gifts = new Set();
        Object.keys(levels).forEach(id => { if (SITES[id] && levels[id] && id !== 'foyer') gifts.add(map.siteZone(id)); });
        tiles.forEach(t => { const zone = map.zoneAt(t.x + map.OFFSET, t.y + map.OFFSET); if (zone) gifts.add(zone); });
        gifts.delete('coeur');
        for (const zone of gifts) {
            await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, zone]);
        }
        await conn.query('UPDATE world_stock SET map_version = $2, collected_at = NOW() WHERE user_id = $1', [userId, MAP_VERSION]);
        return true;
    });
}

// Décorations hors d'une case libre (mer, chantier, quartier non possédé) : déplacées vers la case libre la plus proche
async function settle(userId, tiles, zones) {
    const taken = new Set(tiles.map(t => t.y * SIZE + t.x));
    let moved = false;
    for (const tile of tiles.filter(t => !isFree(t.x, t.y, zones))) {
        let best = null;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (!isFree(x, y, zones) || taken.has(y * SIZE + x)) continue;
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

// Vue de l'île pour le navigateur. book = { describe(noms), openChapters: Set des chapitres ouverts }
async function view(userId, owned, book) {
    await migrate(userId);
    const { levels, builtAt } = await levelsOf(userId);
    const effects = effectsOf(levels);
    const stock = await stockOf(userId);
    const charges = chargesAt(stock, effects.maxCharges);
    const zones = await zonesOf(userId);
    const tiles = await settle(userId, await tilesOf(userId), zones);
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = book.describe([...tiles.map(t => t.element), ...plans]);
    const production = productionAll(levels, builtAt, stock.collected_at);
    const sites = Object.entries(SITES).map(([id, site]) => {
        const level = levels[id] || 0;
        const next = site.levels[level];
        const place = map.SITE_PLACES[id];
        const zone = map.siteZone(id);
        const made = production.find(p => p.site === id);
        return {
            id, x: place.x, y: place.y, w: 2, h: 2, level, maxLevel: site.levels.length, zone, locked: !zones.has(zone),
            name: level ? site.levels[level - 1].name : site.levels[0].name,
            effect: level ? site.levels[level - 1].effect : null,
            emoji: level && site.levels[level - 1].plan ? known[site.levels[level - 1].plan]?.emoji || null : null,
            produce: site.produce || null,
            // Tous les paliers, pour la fiche du bâtiment (atteints, suivant, à venir)
            levels: site.levels.map(l => ({ name: l.name, plan: l.plan, planOwned: !l.plan || have.has(l.plan), planEmoji: l.plan ? known[l.plan]?.emoji || null : null, cost: l.cost, effect: l.effect })),
            pending: made ? { coins: made.coins, [made.resource]: made.amount } : null,
            next: next ? { name: next.name, plan: next.plan, planOwned: !next.plan || have.has(next.plan), planEmoji: next.plan ? known[next.plan]?.emoji || null : null, cost: next.cost, effect: next.effect } : null
        };
    });
    const pendingStock = Object.fromEntries(RESOURCES.map(r => [r, production.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    return {
        size: SIZE,
        map: {
            grid: map.GRID,
            zones: map.ZONES.map(z => ({
                id: z.id, name: z.name, price: z.price, chapter: z.chapter, anchor: map.ANCHORS[z.id],
                owned: zones.has(z.id), open: !z.chapter || book.openChapters.has(z.chapter)
            }))
        },
        sites,
        stock: Object.fromEntries(RESOURCES.map(r => [r, stock[r]])),
        charges: { count: charges.count, max: effects.maxCharges, nextIn: charges.count < effects.maxCharges ? Math.max(0, charges.since + REGEN_MS - Date.now()) : null },
        harvest: { maxMoves: effects.maxMoves, kinds: effects.kinds, boosts: effects.boosts, coinEvery: HARVEST_COIN_EVERY },
        rates: { produce: PRODUCE_PER_LEVEL, coins: COINS_PER_LEVEL },
        capHours: CAP_HOURS,
        decoPrices: DECO_PRICES,
        pending: production.reduce((sum, p) => sum + p.coins, 0),
        pendingStock,
        tiles: tiles.map(t => ({ x: t.x, y: t.y, element: t.element, ...(known[t.element] || {}) }))
    };
}

// Achat d'un quartier : chapitre ouvert, écus débités une fois (même en double clic) ; { status, message } si refus
async function buyZone(userId, zoneId, openChapters) {
    const zone = map.ZONE_BY_ID[zoneId];
    if (!zone || zone.id === 'coeur') return { status: 404, message: 'Quartier inconnu.' };
    if (zone.chapter && !openChapters.has(zone.chapter)) return { status: 403, message: `Ouvre d’abord le chapitre ${zone.chapter} du Livre.` };
    await migrate(userId);
    return db.transaction(async conn => {
        const added = await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING zone', [userId, zone.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Ce quartier est déjà à toi.' });
        const coins = await ledger.debit(userId, zone.price, `quartier:${zone.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${zone.price} écus.` });
        return { bought: zone.name, coins };
    });
}

// Construit le niveau suivant d'un chantier ; { status, message } en cas de refus
async function build(userId, owned, siteId) {
    const site = SITES[siteId];
    if (!site) return { status: 404, message: 'Chantier inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(siteId))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const { levels } = await levelsOf(userId, conn);
        const level = levels[siteId] || 0;
        const next = site.levels[level];
        if (!next) return db.rollback({ status: 409, message: 'Ce chantier est déjà achevé.' });
        if (next.plan && !owned.includes(next.plan)) return db.rollback({ status: 403, message: `Il te faut le plan : découvre « ${next.plan} » dans le Livre.` });
        const missing = Object.entries(next.cost).filter(([r, n]) => stock[r] < n);
        if (missing.length) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const costs = RESOURCES.map(r => next.cost[r] || 0);
        // Ce que le bâtiment avait produit est encaissé avant l'évolution (sa production repart de zéro)
        await gather(userId, conn, stock);
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
        // Et des écus : 1 par tranche de 10 ressources gagnées, versés une seule fois pour cette partie
        const coins = Math.floor((g.stone + g.wood + g.water + g.food) / HARVEST_COIN_EVERY);
        if (coins > 0) await ledger.credit(userId, coins, 'recolte', runId, conn);
        return { gains: g, coins };
    });
}

// Pose (ou déplace) un élément possédé en décoration sur une case libre d'un quartier possédé.
// Une nouvelle décoration s'achète (prix selon le chapitre de l'élément) ; la déplacer est gratuit.
// price : prix de l'élément (calculé par la route avec le Livre). { status, message } en cas de refus
async function place(userId, owned, element, x, y, price) {
    if (!owned.includes(element)) return { status: 403, message: 'Cet élément n’est pas dans ton carnet.' };
    if (![x, y].every(v => Number.isInteger(v)) || !map.isLand(x, y)) return { status: 400, message: 'Case hors de l’île.' };
    if (map.inSite(x, y)) return { status: 400, message: 'Cette place est réservée à un chantier.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(map.zoneAt(x, y))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const occupied = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
        if (occupied.rows.length && occupied.rows[0].element !== element) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        // Déjà posé ailleurs : on le déplace gratuitement ; sinon on l'achète et on le pose
        const moved = await conn.query('UPDATE world_tiles SET x = $3, y = $4 WHERE user_id = $1 AND element = $2 RETURNING element', [userId, element, x, y]);
        if (moved.rows.length) return {};
        const coins = await ledger.debit(userId, price, 'deco', conn);
        if (coins === null) return db.rollback({ status: 400, message: `Cette décoration coûte ${price} écus.` });
        await conn.query('INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, $2, $3, $4)', [userId, x, y, element]);
        return { coins };
    });
}

async function remove(userId, x, y) {
    await migrate(userId);
    await db.query('DELETE FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
}

// Encaisse la production des bâtiments (écus au grand livre, ressources au stock) dans la transaction de l'appelant
async function gather(userId, conn, stock) {
    const { levels, builtAt } = await levelsOf(userId, conn);
    const now = new Date();
    const made = productionAll(levels, builtAt, stock.collected_at, now.getTime());
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

module.exports = { CAP_HOURS, REGEN_MS, DECO_PRICES, isFree, pendingOf, chargesAt, effectsOf, productionOf, view, build, buyZone, startRun, finishRun, place, remove, collect, migrate };
