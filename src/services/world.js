// Le Monde : l'île du joueur, sur une carte commune (worldMap.js) : la Grève ouverte d'office, onze quartiers à acheter
// (écus + chapitre du Livre). Les chantiers se construisent puis évoluent avec un plan découvert dans le Livre et des
// ressources tirées de la Récolte. Les bâtiments de production rapportent ressources et écus, avec leurs annexes
// (annexes.js : champs, filons, viviers… posés autour d'eux) ; les décorations s'achètent et embellissent, sans rien
// produire.
// Tout ce qui compte (stock, quartiers, parties, gains, écus, coffres) est décidé ici, dans des transactions verrouillées.
const crypto = require('crypto');
const db = require('../config/db');
const ledger = require('./ledger');
const harvest = require('./harvest');
const map = require('./worldMap');
const legacy = require('./worldMapV2');
const shop = require('./worldShop');
const quests = require('./quests');
const loot = require('./loot');
const annexes = require('./annexes');

const SIZE = map.SIZE;
const CAP_HOURS = 8;
const REGEN_MS = 30 * 60 * 1000; // une partie de Récolte revient toutes les 30 minutes
const RUN_TTL_MS = 24 * 3600 * 1000; // une partie non rendue après 24 h est perdue
const MOVES = 15;
const RESOURCES = ['stone', 'wood', 'water', 'food'];
// 1 : île 14 × 14 ; 2 : île 20 × 20 (worldMapV2.js) ; 3 : la grande île 48 × 48 (worldMap.js)
const MAP_VERSION = 3;
// Ancienne règle (v1) : une décoration rapportait 1 écu par heure ; payée une dernière fois à la migration
const OLD_DECO_RATE = 1;
// Prix d'une décoration selon le chapitre de l'élément posé
const DECO_PRICES = { I: 10, II: 15, III: 25, IV: 40, V: 60, VI: 90, VII: 140 };
// Récolte : 1 écu par tranche de 10 ressources gagnées
const HARVEST_COIN_EVERY = 10;
// Un achat de la boutique s'annule dans les secondes qui suivent (le front montre « Annuler » 4 s ; marge réseau)
const UNDO_SECONDS = 6;
// Hasard des coffres (loot.js) : rand() dans [0, 1), tiré par le serveur
const random = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;

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
            tier('Feu de camp', null, {}),
            tier('Abri', 'Bois', { wood: 20, stone: 10 }),
            tier('Cabane', 'Cabane', { stone: 40, wood: 30, water: 20 }, 150),
            tier('Maison de l’alchimiste', 'Potion', { stone: 60, wood: 50, water: 30, food: 20 }, 300),
            tier('Tour d’étude', 'Livre', { stone: 100, wood: 90, water: 50, food: 40 }, 600),
            tier('Grande tour', 'Télescope', { stone: 170, wood: 150, water: 90, food: 70 }, 1000),
            tier('Phare de Brume', 'Feu follet', { stone: 300, wood: 240, water: 140, food: 120 }, 1800)
        ]
    },
    carriere: {
        produce: 'stone',
        levels: [
            tier('Fissure', 'Pierre', { wood: 5 }),
            tier('Carrière', 'Marteau', { stone: 30, wood: 20 }),
            tier('Mine', 'Poulie', { wood: 45, stone: 30, food: 15 }, 150),
            tier('Galerie', 'Rails', { wood: 70, stone: 50, water: 20, food: 20 }, 300),
            tier('Puits de mine', 'Fer', { wood: 110, stone: 90, water: 40, food: 40 }, 600),
            tier('Mine de cristal', 'Cristal', { wood: 180, stone: 150, water: 90, food: 60 }, 1000),
            tier('Cité minière', 'Ville', { wood: 300, stone: 250, water: 130, food: 120 }, 1800)
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

// Case où l'on peut poser une décoration : sol constructible (herbe, sable, prairie), hors emprise d'un chantier
// (selon son niveau) et des annexes (blocked : clés y * SIZE + x), dans un quartier possédé
const isFree = (x, y, zones, levels, blocked = null) => Number.isInteger(x) && Number.isInteger(y) && map.buildable(x, y)
    && !map.inFootprint(x, y, levels) && zones.has(map.zoneAt(x, y)) && !blocked?.has(y * SIZE + x);
const keyOf = cell => cell.y * SIZE + cell.x;

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

// Effets des bâtiments construits : réserve, coups, tuiles, multiplicateurs de Récolte (BOOST_BY_LEVEL), avec les
// bonus de la boutique (bonuses) et des annexes (extra)
const NO_BONUS = shop.bonusesOf([]);
const NO_ANNEX = annexes.bonusesOf([]);
function effectsOf(levels, bonuses = NO_BONUS, extra = NO_ANNEX) {
    const boosts = {};
    for (const [site, resource] of Object.entries(BOOSTED)) if (levels[site]) boosts[resource] = BOOST_BY_LEVEL[levels[site]];
    const foyer = levels.foyer || 1;
    const atelier = levels.atelier || 0;
    const ponton = levels.ponton || 0;
    return {
        maxCharges: 2 + foyer + bonuses.charges + extra.charges,
        maxMoves: MOVES + ATELIER_MOVES[atelier] + (ponton >= 2 ? 2 : 0) + bonuses.moves + extra.moves,
        kinds: [...harvest.BASE_KINDS, ...(ponton ? ['fish'] : [])],
        boosts,
        regenMs: annexes.regenWith(bonuses.regenMs || REGEN_MS, extra.regenCut)
    };
}

// Production d'un bâtiment et de ses annexes depuis leur pose ou la dernière récolte (plafonnée à CAP_HOURS, plus les
// heures des réserves) : { resource, amount, coins }.
// bonus = { prod: part en plus, coins: écus par heure en plus (boutique de l'atelier), cap: heures en plus (réserve) } ;
// annexList = [{ rate, earn, at }] (annexes.bonusesOf) : ressources et écus par heure en plus, comptés depuis at,
// avec la même part de production en plus que le bâtiment
function productionOf(siteId, level, builtAt, collectedAt, now = Date.now(), bonus = { prod: 0, coins: 0 }, annexList = []) {
    const site = SITES[siteId];
    if (!site.produce || !level) return null;
    const cap = CAP_HOURS + (bonus.cap || 0);
    const collected = collectedAt ? new Date(collectedAt).getTime() : 0;
    const hoursSince = at => Math.min(cap, Math.max(0, (now - Math.max(collected, new Date(at).getTime())) / 3600000));
    const hours = hoursSince(builtAt);
    let amount = hours * PRODUCE_PER_LEVEL * level;
    let coins = hours * COINS_PER_LEVEL * level;
    for (const a of annexList) {
        const h = hoursSince(a.at);
        amount += h * a.rate;
        coins += h * a.earn;
    }
    const boost = 1 + (bonus.prod || 0);
    return {
        resource: site.produce,
        amount: Math.floor(amount * boost + 1e-9),
        coins: Math.floor(coins * boost + hours * (bonus.coins || 0) + 1e-9)
    };
}
// Rendement par heure d'un bâtiment producteur et de ses annexes : { amount, coins }, arrondis au dixième
function perHourOf(level, prod = 0, coins = 0, annexList = []) {
    const boost = 1 + prod;
    const round = n => Math.round(n * 10) / 10;
    const rate = annexList.reduce((sum, a) => sum + a.rate, 0);
    const earn = annexList.reduce((sum, a) => sum + a.earn, 0);
    return { amount: round((PRODUCE_PER_LEVEL * level + rate) * boost), coins: round((COINS_PER_LEVEL * level + earn) * boost + coins) };
}
function productionAll(levels, builtAt, collectedAt, now = Date.now(), bonuses = NO_BONUS, extra = NO_ANNEX) {
    return Object.keys(SITES)
        .map(id => ({
            site: id,
            ...productionOf(id, levels[id] || 0, builtAt[id], collectedAt, now,
                { prod: bonuses.prod[id] || 0, coins: bonuses.coins[id] || 0, cap: extra.cap[id] || 0 }, extra.site[id] || [])
        }))
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
// Annexes posées : [{ x, y, annex, built_at }]
async function annexesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, annex, built_at FROM world_annexes WHERE user_id = $1 ORDER BY built_at, y, x', [userId]);
    return rows;
}
// Bonus de la boutique et des annexes : { bonuses, extra } (ce que lisent effectsOf et productionAll)
async function bonusesFor(userId, conn = db) {
    return { bonuses: shop.bonusesOf(await itemsOf(userId, conn)), extra: annexes.bonusesOf(await annexesOf(userId, conn)) };
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

// Quêtes de Brume réclamées, et récoltes terminées (objectifs des quêtes)
async function claimedOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT quest FROM world_quests WHERE user_id = $1', [userId]);
    return new Set(rows.map(r => r.quest));
}
async function runsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT COUNT(*)::int AS n FROM world_runs WHERE user_id = $1 AND finished_at IS NOT NULL', [userId]);
    return rows[0].n;
}
// Ce que lisent les objectifs des quêtes (stars : découvertes du Livre)
async function factsOf(userId, stars, conn = db) {
    return {
        tiles: (await tilesOf(userId, conn)).length, runs: await runsOf(userId, conn), stars,
        zones: await zonesOf(userId, conn), levels: (await levelsOf(userId, conn)).levels
    };
}

// Brume seule (quête active), sans le reste de l'île : le Livre la consulte après une découverte
async function board(userId, stars) {
    return quests.boardOf(await claimedOf(userId), await factsOf(userId, stars));
}

// Passage aux cartes suivantes, une fois par joueur, au premier passage, verrouillé (deux requêtes ne migrent pas
// deux fois) et d'un seul tenant (tout ou rien) : v1 → v2 puis v2 → v3 selon l'île du joueur.
function migrate(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (stock.map_version >= MAP_VERSION) return false;
        if (stock.map_version < 2) await toV2(userId, stock, conn);
        await toV3(userId, conn);
        await conn.query('UPDATE world_stock SET map_version = $2 WHERE user_id = $1', [userId, MAP_VERSION]);
        return true;
    });
}

// v1 → v2 : les écus encore dus par les décorations (ancienne règle) sont versés, tout ce qui était posé glisse de
// OFFSET cases, et les quartiers où le joueur avait déjà un bâtiment ou une décoration lui sont offerts
async function toV2(userId, stock, conn) {
    const tiles = await tilesOf(userId, conn);
    const { levels, builtAt } = await levelsOf(userId, conn);
    const oldFoyerRate = ((levels.foyer || 1) - 1) * 2;
    const owed = pendingOf([...tiles.map(t => ({ ...t, rate: OLD_DECO_RATE })), ...(oldFoyerRate ? [{ placed_at: builtAt.foyer, rate: oldFoyerRate }] : [])], stock.collected_at);
    if (owed > 0) await ledger.credit(userId, owed, 'monde', 'carte-v2', conn);
    // Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à elle-même pendant la mise à jour
    await conn.query('UPDATE world_tiles SET x = x + 1000, y = y + 1000 WHERE user_id = $1', [userId]);
    await conn.query('UPDATE world_tiles SET x = x - 1000 + $2, y = y - 1000 + $2 WHERE user_id = $1', [userId, legacy.OFFSET]);
    const gifts = new Set();
    Object.keys(levels).forEach(id => { if (SITES[id] && levels[id] && id !== 'foyer') gifts.add(legacy.siteZone(id)); });
    tiles.forEach(t => { const zone = legacy.zoneAt(t.x + legacy.OFFSET, t.y + legacy.OFFSET); if (zone) gifts.add(zone); });
    gifts.delete('coeur');
    for (const zone of gifts) {
        await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, zone]);
    }
    await conn.query('UPDATE world_stock SET collected_at = NOW() WHERE user_id = $1', [userId]);
}

// v2 → v3 (la grande île) : les quartiers achetés restent (mêmes identifiants), les bâtiments gardent leur palier
// (leur place vient de la carte) ; chaque décoration rejoint son quartier, sur une case libre au plus près de son
// panneau, dans l'ordre où elles étaient rangées (de haut en bas, de gauche à droite). Un quartier trop petit
// déborde sur la Grève.
async function toV3(userId, conn) {
    const tiles = await tilesOf(userId, conn);
    if (!tiles.length) return;
    const { levels } = await levelsOf(userId, conn);
    const byZone = new Map();
    for (const tile of tiles) {
        const zone = legacy.zoneAt(tile.x, tile.y) || 'coeur';
        byZone.set(zone, [...(byZone.get(zone) || []), tile]);
    }
    // Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à une case encore occupée
    await conn.query('UPDATE world_tiles SET x = x + 1000, y = y + 1000 WHERE user_id = $1', [userId]);
    const taken = new Set();
    const spare = map.freeSpots('coeur', levels);
    for (const [zone, list] of byZone) {
        const spots = [...map.freeSpots(zone, levels), ...spare];
        for (const tile of list) {
            const spot = spots.find(s => !taken.has(s.y * SIZE + s.x));
            if (!spot) break;
            taken.add(spot.y * SIZE + spot.x);
            await conn.query('UPDATE world_tiles SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, tile.x + 1000, tile.y + 1000, spot.x, spot.y]);
        }
    }
    // Chaque ancien quartier tient dans le nouveau (test/play.test.js) ; une décoration restée sans place serait
    // replacée par settle() à la vue suivante, jamais supprimée
}

// Décorations hors d'une case libre (mer, chantier agrandi, quartier non possédé) : déplacées vers la case libre la plus
// proche (ni décoration ni annexe ; annexCells : clés des cases des annexes)
async function settle(userId, tiles, zones, levels, annexCells = new Set()) {
    const taken = new Set([...tiles.map(keyOf), ...annexCells]);
    let moved = false;
    for (const tile of tiles.filter(t => !isFree(t.x, t.y, zones, levels, annexCells))) {
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

// Coffres déjà ouverts parmi les sources à surveiller : chapitres, quêtes, jour (et veille), bouteille. Map source → ligne
const QUEST_CHESTS = quests.QUESTS.filter(q => q.chest);
async function openedOf(userId, now, conn = db) {
    const { day, slot } = loot.parisOf(now);
    const keys = [
        ...Object.keys(loot.CHAPTER_RARES).map(c => `chapitre:${c}`), ...QUEST_CHESTS.map(q => `quete:${q.id}`),
        `jour:${day}`, `jour:${loot.dayBefore(day)}`, `bouteille:${day}-${slot}`
    ];
    const { rows } = await conn.query('SELECT source, streak FROM world_chests WHERE user_id = $1 AND source = ANY($2)', [userId, keys]);
    return { day, slot, opened: new Map(rows.map(r => [r.source, r])) };
}

// Série du coffre du jour : celle d'hier plus un, sinon 1 (un jour manqué la remet à 1)
const streakOf = (opened, day) => (opened.get(`jour:${loot.dayBefore(day)}`)?.streak || 0) + 1;

// Ce que la vue montre des coffres : ceux qui attendent (chapitres ouverts, quêtes réclamées), le coffre du jour (série,
// rareté du jour et du lendemain s'il est ouvert, semaine en cours) et la bouteille de la tranche
function chestsView({ day, slot, opened }, openChapters, claimed) {
    const today = opened.get(`jour:${day}`);
    const streak = today ? today.streak : streakOf(opened, day);
    const first = streak - ((streak - 1) % 7);
    return {
        pending: [
            ...Object.entries(loot.CHAPTER_RARES).filter(([c]) => openChapters.has(c) && !opened.has(`chapitre:${c}`))
                .map(([c]) => ({ source: `chapitre:${c}`, rarity: 'legendaire', label: `Chapitre ${c} du Livre` })),
            ...QUEST_CHESTS.filter(q => claimed.has(q.id) && !opened.has(`quete:${q.id}`))
                .map(q => ({ source: `quete:${q.id}`, rarity: q.chest, label: `Quête : ${q.label}` }))
        ],
        daily: {
            available: !today, streak, rarity: loot.dailyRarity(streak), tomorrow: loot.dailyRarity(streak + 1),
            week: Array.from({ length: 7 }, (_, i) => loot.dailyRarity(first + i))
        },
        bottle: { key: `${day}-${slot}`, available: !opened.has(`bouteille:${day}-${slot}`) }
    };
}

// Case où une annexe de ce bâtiment peut se poser (sans compter ce qui l'occupe) : sol constructible du quartier du
// bâtiment, hors des grandes emprises des chantiers, à annexes.REACH cases au plus de la sienne
function annexSpotOk(siteId, x, y) {
    const at = map.SITE_BIG[siteId];
    return Boolean(at) && Number.isInteger(x) && Number.isInteger(y) && map.buildable(x, y) && !map.inSite(x, y)
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

// Vue de l'île pour le navigateur. book = { describe(noms), openChapters: Set des chapitres ouverts }
async function view(userId, owned, book) {
    await migrate(userId);
    const { levels, builtAt } = await levelsOf(userId);
    const items = await itemsOf(userId);
    const skins = await skinsOf(userId);
    const annexRows = await annexesOf(userId);
    const bonuses = shop.bonusesOf(items);
    const extra = annexes.bonusesOf(annexRows);
    const effects = effectsOf(levels, bonuses, extra);
    const stock = await stockOf(userId);
    const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
    const zones = await zonesOf(userId);
    const annexCells = new Set(annexRows.map(keyOf));
    const tiles = await settle(userId, await tilesOf(userId), zones, levels, annexCells);
    const taken = new Set([...annexCells, ...tiles.map(keyOf)]);
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = book.describe([...tiles.map(t => t.element), ...plans]);
    const production = productionAll(levels, builtAt, stock.collected_at, Date.now(), bonuses, extra);
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
                id: item.id, kind: item.kind, name: item.name, price: item.price, minLevel: item.minLevel, rare: Boolean(item.rare),
                ...(item.chapter ? { chapter: item.chapter } : {}),
                effect: shop.effectText(item), gain: item.effect || null, owned: items.has(item.id)
            })),
            skin: skins[id] || null,
            bonus: Math.round((bonuses.prod[id] || 0) * 100),
            // Tous les paliers, pour la fiche du bâtiment (atteints, suivant, à venir)
            levels: site.levels.map(step),
            pending: made ? { coins: made.coins, [made.resource]: made.amount } : null,
            // Rendement horaire avec les bonus de la boutique et les annexes (pour la fiche), heures de production gardées
            perHour: site.produce && level ? perHourOf(level, bonuses.prod[id] || 0, bonuses.coins[id] || 0, extra.site[id] || []) : null,
            capHours: CAP_HOURS + (extra.cap[id] || 0),
            // Annexes : catalogue du bâtiment et cases libres où en poser une (dès le palier II)
            annexes: annexesView(id, annexRows),
            spots: level >= 2 && zones.has(zone) ? annexSpots(id, taken) : [],
            next: next ? step(next) : null
        };
    });
    const pendingStock = Object.fromEntries(RESOURCES.map(r => [r, production.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    const claimed = await claimedOf(userId);
    return {
        size: SIZE,
        map: {
            // Calques de la grande île (relief, sol, quartiers : voir islandData.js) ; grid : index des quartiers
            grid: map.GRID,
            height: map.HEIGHT,
            ground: map.GROUND,
            region: map.REGION,
            zones: map.ZONES.map(z => ({
                id: z.id, name: z.name, price: z.price, chapter: z.chapter, code: z.code, anchor: map.ANCHORS[z.id],
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
        tiles: tiles.map(t => ({ x: t.x, y: t.y, element: t.element, ...(known[t.element] || {}) })),
        annexes: annexRows.filter(r => annexes.ANNEX_BY_ID[r.annex]).map(r => ({ x: r.x, y: r.y, annex: r.annex, site: annexes.ANNEX_BY_ID[r.annex].site })),
        // Brume, l'esprit de la brume : la quête active (ou son dernier mot)
        brume: quests.boardOf(claimed, { tiles: tiles.length, runs: await runsOf(userId), stars: book.stars ?? 0, zones, levels }),
        // Coffres : en attente, du jour, bouteille à la mer
        chests: chestsView(await openedOf(userId, Date.now()), book.openChapters, claimed)
    };
}

// Réclame la récompense de la quête active de Brume : c'est bien elle, son objectif est atteint, versée une seule
// fois (même en double clic). stars : découvertes du Livre. { status, message } si refus
async function claimQuest(userId, questId, stars) {
    await migrate(userId);
    return db.transaction(async conn => {
        const quest = quests.active(await claimedOf(userId, conn), await factsOf(userId, stars, conn));
        if (!quest || quest.id !== questId) return db.rollback({ status: 409, message: 'Ce n’est pas la quête en cours.' });
        if (!quest.done) return db.rollback({ status: 403, message: `Pas encore : ${quest.label.toLowerCase()} (${quest.have}/${quest.need}).` });
        const added = await conn.query('INSERT INTO world_quests (user_id, quest) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING quest', [userId, questId]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Récompense déjà reçue.' });
        const { coins } = await ledger.credit(userId, quest.coins, 'quete', questId, conn);
        return { gained: quest.coins, coins };
    });
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
        const { bonuses, extra } = await bonusesFor(userId, conn);
        const effects = effectsOf(levels, bonuses, extra);
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
        await addStock(userId, g, conn);
        // Et des écus : 1 par tranche de 10 ressources gagnées, versés une seule fois pour cette partie
        const earned = Math.floor((g.stone + g.wood + g.water + g.food) / HARVEST_COIN_EVERY);
        if (earned > 0) await ledger.credit(userId, earned, 'recolte', runId, conn);
        // Parfois un coffre (sûr avec une grande chaîne)
        const rarity = loot.harvestChest(moves.length, Math.max(0, ...moves.map(path => path.length)), random);
        const chest = rarity ? await grant(userId, `recolte:${runId}`, rarity, conn) : null;
        // coins : le solde (écus de la partie et du coffre compris)
        return { gains: g, earned, coins: await balanceOf(userId, conn), chest };
    });
}

// Ajoute des ressources au stock (ligne verrouillée par l'appelant)
function addStock(userId, add, conn) {
    const n = r => add[r] || 0;
    return conn.query('UPDATE world_stock SET stone = stone + $2, wood = wood + $3, water = water + $4, food = food + $5 WHERE user_id = $1',
        [userId, n('stone'), n('wood'), n('water'), n('food')]);
}
async function balanceOf(userId, conn) {
    const { rows } = await conn.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
    return rows[0]?.coins ?? 0;
}

// Donne un coffre, une seule fois par source (même en double clic) : tire son lot selon l'île, l'applique (écus au
// grand livre, ressources au stock, teinte ou pièce rare à la collection) et l'inscrit. Dans la transaction de
// l'appelant, ligne de stock verrouillée. { source, rarity, prize }, ou null si ce coffre est déjà ouvert
async function grant(userId, source, rarity, conn, { wanted = null, streak = null } = {}) {
    const prize = loot.prizeOf(rarity, { levels: (await levelsOf(userId, conn)).levels, owned: await itemsOf(userId, conn) }, random, wanted);
    const added = await conn.query(
        `INSERT INTO world_chests (user_id, source, rarity, prize, streak) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING source`, [userId, source, rarity, JSON.stringify(prize), streak]);
    if (!added.rows.length) return null;
    if (prize.kind === 'coins') await ledger.credit(userId, prize.amount, 'butin', source, conn);
    if (prize.kind === 'stock') await addStock(userId, prize.stock, conn);
    if (prize.item) await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'butin') ON CONFLICT DO NOTHING`, [userId, prize.item]);
    return { source, rarity, prize };
}

// Ouvre un coffre qui attend : 'jour' (série), 'bouteille' (tranche de 6 h), 'chapitre:<id>' (chapitre ouvert, sa
// pièce rare), 'quete:<id>' (quête réclamée qui en donne un). openChapters : Set des chapitres ouverts.
// { chest, coins } ou { status, message } si refus
async function openChest(userId, source, openChapters, now = Date.now()) {
    const [kind, id] = source.split(':');
    const chapter = kind === 'chapitre' ? loot.CHAPTER_RARES[id] : null;
    const quest = kind === 'quete' ? QUEST_CHESTS.find(q => q.id === id) : null;
    if (!['jour', 'bouteille'].includes(source) && !chapter && !quest) return { status: 404, message: 'Coffre inconnu.' };
    if (chapter && !openChapters.has(id)) return { status: 403, message: `Ouvre d’abord le chapitre ${id} du Livre.` };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { day, slot, opened } = await openedOf(userId, now, conn);
        if (quest && !(await claimedOf(userId, conn)).has(quest.id)) return db.rollback({ status: 403, message: 'Réclame d’abord cette quête de Brume.' });
        let chest;
        if (source === 'jour') {
            const streak = streakOf(opened, day);
            chest = await grant(userId, `jour:${day}`, loot.dailyRarity(streak), conn, { streak });
        } else if (source === 'bouteille') {
            chest = await grant(userId, `bouteille:${day}-${slot}`, loot.rarityOf(loot.BOTTLE.odds, random), conn);
        } else {
            chest = await grant(userId, source, chapter ? 'legendaire' : quest.chest, conn, { wanted: chapter });
        }
        if (!chest) return db.rollback({ status: 409, message: source === 'bouteille' ? 'La prochaine bouteille n’est pas encore arrivée.' : 'Ce coffre est déjà ouvert.' });
        return { chest, coins: await balanceOf(userId, conn) };
    });
}

// Pose (ou déplace) un élément possédé en décoration sur une case libre d'un quartier possédé.
// Une nouvelle décoration s'achète (prix selon le chapitre de l'élément) ; la déplacer est gratuit.
// price : prix de l'élément (calculé par la route avec le Livre). { status, message } en cas de refus
async function place(userId, owned, element, x, y, price) {
    if (!owned.includes(element)) return { status: 403, message: 'Cet élément n’est pas dans ton carnet.' };
    if (![x, y].every(v => Number.isInteger(v)) || !map.isLand(x, y)) return { status: 400, message: 'Case hors de l’île.' };
    if (!map.buildable(x, y)) return { status: 400, message: 'Rien ne se pose ici (chemin, eau, forêt ou rocher).' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (map.inFootprint(x, y, (await levelsOf(userId, conn)).levels)) return db.rollback({ status: 400, message: 'Cette place est réservée à un chantier.' });
        if (!(await zonesOf(userId, conn)).has(map.zoneAt(x, y))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const occupied = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
        if (occupied.rows.length && occupied.rows[0].element !== element) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        if (await annexAt(userId, x, y, conn)) return db.rollback({ status: 409, message: 'Une annexe occupe déjà cette case.' });
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

// Annexe posée sur cette case (ligne verrouillée), ou null
async function annexAt(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT annex FROM world_annexes WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
    return rows[0] || null;
}
// Case déjà prise par une décoration ou une annexe
async function cellTaken(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT 1 FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
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
        const { cost, coins: price } = annexes.priceOf(a, copy);
        if (Object.entries(cost).some(([r, n]) => stock[r] < n)) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, price, `annexe:${a.id}:${copy + 1}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${price} écus.` });
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

// Achat d'un article de la boutique d'un atelier : bâtiment construit (au niveau demandé) dans un quartier possédé,
// écus débités une seule fois. La production en cours est encaissée d'abord (le bonus ne vaut que pour la suite).
async function buyItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 403, message: 'Cette pièce rare ne s’achète pas : elle se trouve dans les butins.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(item.site)) || !(levels[item.site] || 0)) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        if (levels[item.site] < item.minLevel) return db.rollback({ status: 403, message: `Il faut le palier ${CHAPTER_OF_LEVEL[item.minLevel - 1]} de ce bâtiment.` });
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

// Annulation d'un achat de la boutique juste après (achat en un toucher) : l'article est rendu, ses écus remboursés
// une seule fois (même en double clic), son skin retiré s'il était porté. Un article gagné dans un coffre ne se rend
// pas. { status, message } si refus ou trop tard
async function undoItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 409, message: 'Une pièce rare ne se rend pas.' };
    return db.transaction(async conn => {
        // La production jusqu'ici compte encore avec l'article
        await gather(userId, conn, await stockOf(userId, conn, true));
        const removed = await conn.query(
            `DELETE FROM world_items WHERE user_id = $1 AND item = $2 AND source = 'boutique' AND bought_at > NOW() - make_interval(secs => $3) RETURNING bought_at`,
            [userId, item.id, UNDO_SECONDS]);
        if (!removed.rows.length) return db.rollback({ status: 409, message: 'Trop tard pour annuler cet achat.' });
        await conn.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2 AND skin = $3', [userId, item.site, item.id]);
        const { coins } = await ledger.credit(userId, item.price, 'boutique-annulee', `${item.id}:${removed.rows[0].bought_at.getTime()}`, conn);
        return { undone: item.name, coins };
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
    if (!(await itemsOf(userId)).has(skinId)) return { status: 403, message: item.rare ? 'Trouve d’abord cette pièce rare dans les butins.' : 'Achète d’abord ce skin.' };
    await db.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, siteId, skinId]);
    return {};
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

module.exports = {
    SIZE, CAP_HOURS, REGEN_MS, DECO_PRICES, SITES, effectOf, isFree, pendingOf, chargesAt, effectsOf, productionOf,
    view, build, buyZone, buyItem, undoItem, chooseSkin, startRun, finishRun, place, remove, collect, migrate, claimQuest, board, openChest,
    placeAnnex, moveAnnex, annexSpotOk
};
