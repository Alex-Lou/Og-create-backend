// Passage d'une île aux cartes suivantes (v1 → v5), une fois par joueur. Les cartes d'avant restent figées dans leurs
// modules (worldMapV2.js, worldMapV4.js) : chaque passage lit celle qu'il quitte, jamais la carte du moment.
const db = require('../../config/db');
const ledger = require('../ledger');
const quests = require('../quests');
const v4 = require('../worldMapV4');
const legacy = require('../worldMapV2');
const { MAP_VERSION, OLD_DECO_RATE, SITES, pendingOf } = require('./rules');
const { levelsOf, stockOf, tilesOf } = require('./reads');

// Les nuits de créatures (world/nights.js, qui passe lui-même par migrate) : chargé à l'appel
const settleNights = (...args) => require('./nights').settleNights(...args);

// Passage aux cartes suivantes, une fois par joueur, au premier passage, verrouillé (deux requêtes ne migrent pas
// deux fois) et d'un seul tenant (tout ou rien) : v1 → v2 → v3 → v4 → v5 selon l'île du joueur. Chaque passage règle
// aussi les nuits finies depuis le précédent (v6), avant tout changement de l'île
function migrate(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        await settleNights(userId, conn, stock);
        // Marque versionnée et idempotente : elle permet d'auditer les comptes qui ont réellement dépassé la première
        // nuit. Les comptes déjà avancés, y compris ceux des anciennes chaînes, sont reconnus par doneOf.
        const tutorial = await conn.query(
            `SELECT EXISTS (SELECT 1 FROM world_items WHERE user_id = $1 AND item = $2) AS marked,
                    ARRAY(SELECT quest FROM world_quests WHERE user_id = $1) AS claimed`,
            [userId, quests.SHORE_TUTORIAL_MARK]);
        if (!tutorial.rows[0].marked && quests.firstNightDoneOf(new Set(tutorial.rows[0].claimed))) {
            await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'tutoriel') ON CONFLICT DO NOTHING`,
                [userId, quests.SHORE_TUTORIAL_MARK]);
        }
        if (stock.map_version >= MAP_VERSION) return false;
        if (stock.map_version < 2) await toV2(userId, stock, conn);
        if (stock.map_version < 3) await toV3(userId, conn);
        if (stock.map_version < 4) await toV4(userId, conn);
        await toV5(userId, conn);
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
    // Cases de la carte v3 : celles du cœur de la carte v4, moins son décalage (toV4 les replace ensuite)
    const v3Spots = zone => v4.freeSpots(zone, levels).map(sp => ({ x: sp.x - v4.OFFSET.x, y: sp.y - v4.OFFSET.y }));
    const spare = v3Spots('coeur');
    for (const [zone, list] of byZone) {
        const spots = [...v3Spots(zone), ...spare];
        for (const tile of list) {
            const spot = spots.find(s => !taken.has(s.y * v4.SIZE + s.x));
            if (!spot) break;
            taken.add(spot.y * v4.SIZE + spot.x);
            await conn.query('UPDATE world_tiles SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, tile.x + 1000, tile.y + 1000, spot.x, spot.y]);
        }
    }
    // Chaque ancien quartier tient dans le nouveau (test/play.test.js) ; les décorations sont ensuite remboursées
    // (refundDecorations, lot 8)
}

// v3 → v4 (la très grande île) : la grande île devient le cœur, posée en OFFSET ; tout ce que le joueur y a posé
// (annexes, créations, anciennes décorations) glisse d'autant. Les bâtiments n'ont rien à faire : leur place vient
// de la carte. Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à une case encore occupée
async function toV4(userId, conn) {
    const { x, y } = v4.OFFSET;
    for (const table of ['world_annexes', 'world_crafts', 'world_tiles']) {
        await conn.query(`UPDATE ${table} SET x = x + 1000, y = y + 1000 WHERE user_id = $1 AND x IS NOT NULL`, [userId]);
        await conn.query(`UPDATE ${table} SET x = x - 1000 + $2, y = y - 1000 + $3 WHERE user_id = $1 AND x IS NOT NULL`, [userId, x, y]);
    }
}

// v4 → v5 (la grande carte, × 1,5) : chaque annexe, création ou ancienne décoration passe sur la case v5 qui reprend
// sa case v4 (worldMap.fromV4 : round(1,5 x + 0,25)) : même sol, même quartier, deux voisines restent deux cases
// distinctes (rien ne se heurte). Les bâtiments, les lieux et les gisements viennent de la carte. Une nuit en cours
// garde ses égarés, mais ceux déjà repoussés le sont sur l'ancienne carte : la nuit repart de zéro repoussé
async function toV5(userId, conn) {
    for (const table of ['world_annexes', 'world_crafts', 'world_tiles']) {
        await conn.query(`UPDATE ${table} SET x = x + 1000, y = y + 1000 WHERE user_id = $1 AND x IS NOT NULL`, [userId]);
        await conn.query(`UPDATE ${table} SET x = ROUND(1.5 * (x - 1000) + 0.25), y = ROUND(1.5 * (y - 1000) + 0.25) WHERE user_id = $1 AND x IS NOT NULL`, [userId]);
    }
    await conn.query(`UPDATE world_nights SET repelled = '{}'::jsonb WHERE user_id = $1`, [userId]);
}

module.exports = { migrate, toV2, toV3, toV4, toV5 };
