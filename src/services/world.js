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
const shop = require('./worldShop');

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

// Chantiers : 7 paliers, un par chapitre du Livre (le palier N demande le chapitre N ouvert), chacun avec son plan
// (élément découvert), son coût en ressources et en écus (dès le palier III) ; l'emprise passe à 3 × 3 au palier IV.
// produce : ressource produite en continu, PRODUCE_PER_LEVEL par heure et par niveau, avec COINS_PER_LEVEL écus.
const CHAPTER_OF_LEVEL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const BOOST_BY_LEVEL = [1, 2, 3, 4, 4, 5, 5, 6]; // multiplicateur de Récolte de la ressource du bâtiment (entier)
const ATELIER_MOVES = [0, 3, 5, 6, 7, 8, 9, 10]; // coups de Récolte en plus selon le niveau de l'Atelier
const PRODUCE_PER_LEVEL = 3; // ressources par heure et par niveau
const COINS_PER_LEVEL = 2; // écus par heure et par niveau
// Noms des ressources dans les textes d'effet : production, Récolte
const WORDS = { stone: ['pierres', 'la pierre'], wood: ['bûches', 'le bois'], water: ['seaux d’eau', 'l’eau'], food: ['vivres', 'la nourriture'] };
const tier = (name, plan, cost, coins = 0) => ({ name, plan, cost, coins });
const SITES = {
    foyer: {
        levels: [
            tier('Foyer', null, {}),
            tier('Cabane', 'Cabane', { wood: 20, stone: 10 }),
            tier('Maison', 'Maison', { stone: 40, wood: 30, water: 20 }, 150),
            tier('Maison à étage', 'Fenêtre', { stone: 60, wood: 50, water: 30, food: 20 }, 300),
            tier('Manoir', 'Horloge', { stone: 100, wood: 90, water: 50, food: 40 }, 600),
            tier('Demeure', 'Bibliothèque', { stone: 170, wood: 150, water: 90, food: 70 }, 1000),
            tier('Château', 'Château', { stone: 300, wood: 240, water: 140, food: 120 }, 1800)
        ]
    },
    carriere: {
        produce: 'stone',
        levels: [
            tier('Carrière', 'Pierre', { wood: 5 }),
            tier('Mine', 'Marteau', { stone: 30, wood: 20 }),
            tier('Galerie', 'Rails', { wood: 45, stone: 30, food: 15 }, 150),
            tier('Puits de mine', 'Poulie', { wood: 70, stone: 50, water: 20, food: 20 }, 300),
            tier('Mine de cristal', 'Cristal', { wood: 110, stone: 90, water: 40, food: 40 }, 600),
            tier('Mine à vapeur', 'Machine à vapeur', { wood: 180, stone: 150, water: 90, food: 60 }, 1000),
            tier('Mine des Géants', 'Géant', { wood: 300, stone: 250, water: 130, food: 120 }, 1800)
        ]
    },
    bosquet: {
        produce: 'wood',
        levels: [
            tier('Bosquet', 'Arbre', { stone: 5 }),
            tier('Grand bosquet', 'Forêt', { wood: 25, water: 15 }),
            tier('Clairière du bûcheron', 'Bûcheron', { stone: 35, water: 35, food: 20 }, 150),
            tier('Chênaie', 'Chêne', { stone: 60, water: 50, wood: 30, food: 20 }, 300),
            tier('Scierie', 'Menuisier', { stone: 100, wood: 70, water: 70, food: 40 }, 600),
            tier('Exploitation forestière', 'Grue', { stone: 170, wood: 120, water: 110, food: 80 }, 1000),
            tier('Forêt enchantée', 'Fée', { stone: 280, wood: 200, water: 180, food: 140 }, 1800)
        ]
    },
    puits: {
        produce: 'water',
        levels: [
            tier('Puits', 'Puits', { stone: 10 }),
            tier('Fontaine', 'Fontaine', { stone: 30, water: 15 }),
            tier('Lavoir', 'Savon', { stone: 45, wood: 30, food: 15 }, 150),
            tier('Bassin', 'Source', { stone: 70, wood: 50, water: 20, food: 20 }, 300),
            tier('Aqueduc', 'Arche', { stone: 110, wood: 80, water: 50, food: 40 }, 600),
            tier('Moulin à eau', 'Moulin à eau', { stone: 180, wood: 130, water: 90, food: 80 }, 1000),
            tier('Fontaine de jouvence', 'Élixir', { stone: 300, wood: 220, water: 150, food: 130 }, 1800)
        ]
    },
    potager: {
        produce: 'food',
        levels: [
            tier('Potager', 'Plante', { water: 8 }),
            tier('Serre', 'Serre', { wood: 20, water: 25, food: 10 }),
            tier('Verger', 'Pomme', { wood: 35, water: 35, stone: 20 }, 150),
            tier('Ferme', 'Ferme', { wood: 55, water: 55, stone: 30, food: 20 }, 300),
            tier('Moulin', 'Moulin', { wood: 95, water: 90, stone: 55, food: 40 }, 600),
            tier('Domaine', 'Tracteur', { wood: 160, water: 150, stone: 100, food: 70 }, 1000),
            tier('Jardin de la Licorne', 'Licorne', { wood: 270, water: 250, stone: 160, food: 120 }, 1800)
        ]
    },
    atelier: {
        levels: [
            tier('Atelier', 'Four', { stone: 15, wood: 10 }),
            tier('Forge', 'Forge', { stone: 35, wood: 25 }),
            tier('Fonderie', 'Bronze', { stone: 45, wood: 35, water: 10 }, 150),
            tier('Grande forge', 'Acier', { stone: 70, wood: 55, water: 20, food: 15 }, 300),
            tier('Manufacture', 'Forgeron', { stone: 120, wood: 90, water: 40, food: 30 }, 600),
            tier('Usine', 'Usine', { stone: 200, wood: 150, water: 70, food: 60 }, 1000),
            tier('Atelier de l’Alchimiste', 'Alchimie', { stone: 330, wood: 250, water: 120, food: 100 }, 1800)
        ]
    },
    ponton: {
        produce: 'food',
        levels: [
            tier('Ponton', 'Bateau', { wood: 25 }),
            tier('Port de pêche', 'Port', { wood: 40, stone: 15 }),
            tier('Chantier naval', 'Voile', { wood: 50, stone: 25, water: 15 }, 150),
            tier('Grand port', 'Phare', { wood: 80, stone: 45, water: 20, food: 15 }, 300),
            tier('Criée', 'Pêcheur', { wood: 130, stone: 80, water: 40, food: 30 }, 600),
            tier('Port à vapeur', 'Bateau à vapeur', { wood: 220, stone: 130, water: 70, food: 60 }, 1000),
            tier('Port du Kraken', 'Kraken', { wood: 360, stone: 220, water: 120, food: 100 }, 1800)
        ]
    }
};
const BOOSTED = { carriere: 'stone', bosquet: 'wood', puits: 'water', potager: 'food' };

// Ce que fait un palier (texte de la fiche), calculé depuis les règles : jamais en désaccord avec elles
function effectOf(siteId, n) {
    const site = SITES[siteId];
    const grows = n === map.BIG_FROM ? ' Le bâtiment s’agrandit (3 × 3 cases).' : '';
    if (siteId === 'foyer') return `${2 + n} parties de Récolte en réserve.${grows}`;
    if (siteId === 'atelier') return `${ATELIER_MOVES[n]} coups de plus par Récolte.${grows}`;
    const [many] = WORDS[site.produce];
    const made = `${PRODUCE_PER_LEVEL * n} ${many} et ${COINS_PER_LEVEL * n} écus par heure`;
    if (siteId === 'ponton') return `Pêche ${made} ; des poissons à la Récolte${n >= 2 ? ', 2 coups de plus' : ''}.${grows}`;
    return `Produit ${made} ; ${WORDS[site.produce][1]} rapporte ×${BOOST_BY_LEVEL[n]} à la Récolte.${grows}`;
}
for (const [id, site] of Object.entries(SITES)) {
    site.levels.forEach((l, i) => { l.effect = effectOf(id, i + 1); l.chapter = CHAPTER_OF_LEVEL[i]; });
}

// Case où l'on peut poser une décoration : terre, hors emprise d'un chantier (selon son niveau), dans un quartier possédé
const isFree = (x, y, zones, levels) => Number.isInteger(x) && Number.isInteger(y) && map.isLand(x, y) && !map.inFootprint(x, y, levels) && zones.has(map.zoneAt(x, y));

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
function chargesAt(stock, max, now = Date.now(), regen = REGEN_MS) {
    const since = new Date(stock.charges_at).getTime();
    const ticks = Math.max(0, Math.floor((now - since) / regen));
    if (stock.charges + ticks >= max) return { count: max, since: now };
    return { count: stock.charges + ticks, since: since + ticks * regen };
}

// Effets des bâtiments construits : réserve, coups, tuiles, multiplicateurs de Récolte (BOOST_BY_LEVEL)
const NO_BONUS = shop.bonusesOf([]);
function effectsOf(levels, bonuses = NO_BONUS) {
    const boosts = {};
    for (const [site, resource] of Object.entries(BOOSTED)) if (levels[site]) boosts[resource] = BOOST_BY_LEVEL[levels[site]];
    const foyer = levels.foyer || 1;
    const atelier = levels.atelier || 0;
    const ponton = levels.ponton || 0;
    return {
        maxCharges: 2 + foyer + bonuses.charges,
        maxMoves: MOVES + ATELIER_MOVES[atelier] + (ponton >= 2 ? 2 : 0) + bonuses.moves,
        kinds: [...harvest.BASE_KINDS, ...(ponton ? ['fish'] : [])],
        boosts,
        regenMs: bonuses.regenMs || REGEN_MS
    };
}

// Production d'un bâtiment depuis sa construction ou la dernière récolte (plafonnée à CAP_HOURS) : { coins, amount }
// bonus = { prod: part en plus, coins: écus par heure en plus } (boutique de l'atelier)
function productionOf(siteId, level, builtAt, collectedAt, now = Date.now(), bonus = { prod: 0, coins: 0 }) {
    const site = SITES[siteId];
    if (!site.produce || !level) return null;
    const since = Math.max(collectedAt ? new Date(collectedAt).getTime() : 0, new Date(builtAt).getTime());
    const hours = Math.min(CAP_HOURS, Math.max(0, (now - since) / 3600000));
    const boost = 1 + (bonus.prod || 0);
    return {
        resource: site.produce,
        amount: Math.floor(hours * PRODUCE_PER_LEVEL * level * boost + 1e-9),
        coins: Math.floor(hours * (COINS_PER_LEVEL * level * boost + (bonus.coins || 0)) + 1e-9)
    };
}
// Rendement par heure d'un bâtiment producteur : { amount, coins }, arrondis au dixième
function perHourOf(level, prod = 0, coins = 0) {
    const boost = 1 + prod;
    const round = n => Math.round(n * 10) / 10;
    return { amount: round(PRODUCE_PER_LEVEL * level * boost), coins: round(COINS_PER_LEVEL * level * boost + coins) };
}
function productionAll(levels, builtAt, collectedAt, now = Date.now(), bonuses = NO_BONUS) {
    return Object.keys(SITES)
        .map(id => ({ site: id, ...productionOf(id, levels[id] || 0, builtAt[id], collectedAt, now, { prod: bonuses.prod[id] || 0, coins: bonuses.coins[id] || 0 }) }))
        .filter(p => p.resource);
}

async function itemsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT item FROM world_items WHERE user_id = $1', [userId]);
    return new Set(rows.map(r => r.item));
}
async function skinsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT site, skin FROM world_skins WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.site, r.skin]));
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

// Décorations hors d'une case libre (mer, chantier agrandi, quartier non possédé) : déplacées vers la case libre la plus proche
async function settle(userId, tiles, zones, levels) {
    const taken = new Set(tiles.map(t => t.y * SIZE + t.x));
    let moved = false;
    for (const tile of tiles.filter(t => !isFree(t.x, t.y, zones, levels))) {
        let best = null;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (!isFree(x, y, zones, levels) || taken.has(y * SIZE + x)) continue;
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
    const items = await itemsOf(userId);
    const skins = await skinsOf(userId);
    const bonuses = shop.bonusesOf(items);
    const effects = effectsOf(levels, bonuses);
    const stock = await stockOf(userId);
    const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
    const zones = await zonesOf(userId);
    const tiles = await settle(userId, await tilesOf(userId), zones, levels);
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = book.describe([...tiles.map(t => t.element), ...plans]);
    const production = productionAll(levels, builtAt, stock.collected_at, Date.now(), bonuses);
    const sites = Object.entries(SITES).map(([id, site]) => {
        const level = levels[id] || 0;
        const next = site.levels[level];
        const place = map.footprintOf(id, level);
        const zone = map.siteZone(id);
        const made = production.find(p => p.site === id);
        const step = l => ({
            name: l.name, plan: l.plan, planOwned: !l.plan || have.has(l.plan), planEmoji: l.plan ? known[l.plan]?.emoji || null : null,
            cost: l.cost, coins: l.coins, chapter: l.chapter, chapterOpen: book.openChapters.has(l.chapter), effect: l.effect
        });
        return {
            id, x: place.x, y: place.y, w: place.w, h: place.h, level, maxLevel: site.levels.length, zone, locked: !zones.has(zone),
            name: level ? site.levels[level - 1].name : site.levels[0].name,
            effect: level ? site.levels[level - 1].effect : null,
            emoji: level && site.levels[level - 1].plan ? known[site.levels[level - 1].plan]?.emoji || null : null,
            produce: site.produce || null,
            // Boutique de l'atelier : articles (possédés ou non), skin porté, bonus de production
            shop: shop.ITEMS.filter(item => item.site === id).map(item => ({
                id: item.id, kind: item.kind, name: item.name, price: item.price, minLevel: item.minLevel,
                effect: shop.effectText(item), owned: items.has(item.id)
            })),
            skin: skins[id] || null,
            bonus: Math.round((bonuses.prod[id] || 0) * 100),
            // Tous les paliers, pour la fiche du bâtiment (atteints, suivant, à venir)
            levels: site.levels.map(step),
            pending: made ? { coins: made.coins, [made.resource]: made.amount } : null,
            // Rendement horaire avec les bonus de la boutique (pour la fiche)
            perHour: site.produce && level ? perHourOf(level, bonuses.prod[id] || 0, bonuses.coins[id] || 0) : null,
            next: next ? step(next) : null
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
        charges: { count: charges.count, max: effects.maxCharges, nextIn: charges.count < effects.maxCharges ? Math.max(0, charges.since + effects.regenMs - Date.now()) : null },
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

// Construit le palier suivant d'un chantier : chapitre du palier ouvert dans le Livre, plan découvert, ressources,
// écus (débités une seule fois, même en double clic). openChapters : Set des chapitres ouverts.
// Les décorations prises dans une emprise agrandie sont déplacées au prochain affichage (settle). { status, message } si refus
async function build(userId, owned, siteId, openChapters = new Set()) {
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
        if (!openChapters.has(next.chapter)) return db.rollback({ status: 403, message: `Ouvre d’abord le chapitre ${next.chapter} du Livre.` });
        if (next.plan && !owned.includes(next.plan)) return db.rollback({ status: 403, message: `Il te faut le plan : découvre « ${next.plan} » dans le Livre.` });
        const missing = Object.entries(next.cost).filter(([r, n]) => stock[r] < n);
        if (missing.length) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const costs = RESOURCES.map(r => next.cost[r] || 0);
        // Ce que le bâtiment avait produit est encaissé avant l'évolution (sa production repart de zéro)
        await gather(userId, conn, stock);
        let coins;
        if (next.coins) {
            coins = await ledger.debit(userId, next.coins, `chantier:${siteId}:${level + 1}`, conn);
            if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${next.coins} écus.` });
        }
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1', [userId, ...costs]);
        await conn.query(
            `INSERT INTO world_buildings (user_id, site, level) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level, built_at = NOW()`, [userId, siteId, level + 1]);
        return { built: next.name, ...(coins !== undefined ? { coins } : {}) };
    });
}

// Nouvelle partie de Récolte : une partie de la réserve, une graine, la configuration figée de l'île
function startRun(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const effects = effectsOf(levels, shop.bonusesOf(await itemsOf(userId, conn)));
        const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
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
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (map.inFootprint(x, y, (await levelsOf(userId, conn)).levels)) return db.rollback({ status: 400, message: 'Cette place est réservée à un chantier.' });
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

// Achat d'un article de la boutique d'un atelier : bâtiment construit (au niveau demandé) dans un quartier possédé,
// écus débités une seule fois. La production en cours est encaissée d'abord (le bonus ne vaut que pour la suite).
async function buyItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(item.site)) || !(levels[item.site] || 0)) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        if (levels[item.site] < item.minLevel) return db.rollback({ status: 403, message: `Il faut le niveau ${item.minLevel} de ce bâtiment.` });
        const added = await conn.query('INSERT INTO world_items (user_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item', [userId, item.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Tu l’as déjà.' });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, item.price, `boutique:${item.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${item.price} écus.` });
        // Un skin acheté est porté tout de suite
        if (item.kind === 'skin') {
            await conn.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
                ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, item.site, item.id]);
        }
        return { bought: item.name, coins };
    });
}

// Skin porté par un bâtiment : un skin possédé de ce bâtiment, ou aucun (apparence d'origine)
async function chooseSkin(userId, siteId, skinId) {
    if (!SITES[siteId]) return { status: 404, message: 'Bâtiment inconnu.' };
    if (!skinId) {
        await db.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2', [userId, siteId]);
        return {};
    }
    const item = shop.ITEM_BY_ID[skinId];
    if (!item || item.kind !== 'skin' || item.site !== siteId) return { status: 400, message: 'Ce skin ne va pas sur ce bâtiment.' };
    if (!(await itemsOf(userId)).has(skinId)) return { status: 403, message: 'Achète d’abord ce skin.' };
    await db.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, siteId, skinId]);
    return {};
}

// Encaisse la production des bâtiments (écus au grand livre, ressources au stock) dans la transaction de l'appelant
async function gather(userId, conn, stock) {
    const { levels, builtAt } = await levelsOf(userId, conn);
    const now = new Date();
    const made = productionAll(levels, builtAt, stock.collected_at, now.getTime(), shop.bonusesOf(await itemsOf(userId, conn)));
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

module.exports = { CAP_HOURS, REGEN_MS, DECO_PRICES, SITES, effectOf, isFree, pendingOf, chargesAt, effectsOf, productionOf, view, build, buyZone, buyItem, chooseSkin, startRun, finishRun, place, remove, collect, migrate };
