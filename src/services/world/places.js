// Où sont les bâtiments d'un joueur (choix de l'auteur, 9 oct. : « je veux pouvoir déplacer les bâtiments, les disposer
// où je veux »). Chaque bâtiment a sa grande emprise (3 × 3 cases, palier IV et plus) ; avant, il n'en occupe que le coin
// avant (2 × 2). Sa place : celle de la carte (worldMap.SITE_BIG), sauf
//  - sur une île à la plage (créée ou recommencée depuis le 9 oct. : la marque PLAGE) : le Feu de camp brûle près de
//    l'épave, au bout du sentier (là où était le coin de la cuisine de Cannelle, qui prend l'ancienne place du Feu :
//    world/camp.js) ;
//  - là où le joueur l'a déplacé (world_site_places).
// Le quartier d'un bâtiment reste celui de la carte (map.siteZone : l'acheter permet de le bâtir), où qu'il soit posé.
const map = require('../worldMap');
const db = require('../../config/db');
const { SIZE } = require('./rules');

const PLAGE = 'ile:plage';
// La marque d'une île neuve (world/paths.js : MARK)
const NEW_ISLAND = 'ile:sentiers';
const BIG = 3;
const SMALL = 2;
// Le Feu sur la plage, au-dessus de l'épave et du sable : sa porte (le bas de son emprise, y = 95) touche le bout du
// sentier (world/paths.js : SENTIER_BEACH), à tous ses paliers
const BEACH = { foyer: { x: 98, y: 92 } };

// Les places d'un joueur : { bâtiment : { x, y } } (coin haut-gauche de la grande emprise). beach : île à la plage ;
// rows : ses déplacements [{ site, x, y }]
function placesFrom({ beach = false, rows = [] } = {}) {
    const out = {};
    for (const [id, p] of Object.entries(map.SITE_BIG)) out[id] = { ...((beach && BEACH[id]) || p) };
    for (const row of rows) if (out[row.site]) out[row.site] = { x: row.x, y: row.y };
    return out;
}
// Les places de la carte, pour ce qui n'a pas de joueur (et les tests)
const STATIC = placesFrom();

// Emprise d'un bâtiment à son palier : la grande à partir de map.BIG_FROM, sinon son coin avant
function footprintAt(places, id, level = 0) {
    const p = places[id];
    if (level >= map.BIG_FROM) return { x: p.x, y: p.y, w: BIG, h: BIG };
    return { x: p.x + 1, y: p.y + 1, w: SMALL, h: SMALL };
}
const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
// Case couverte par un bâtiment, selon ses paliers ({ site: niveau })
const inFootprintAt = (places, x, y, levels = {}) => Object.keys(places).some(id => inRect(x, y, footprintAt(places, id, levels[id] || 0)));
// Case de la grande emprise d'un bâtiment (réservée, quel que soit son palier : il grandira là). skip : un bâtiment à
// ne pas compter (celui qu'on déplace)
const inSiteAt = (places, x, y, skip = null) => Object.entries(places).some(([id, p]) => id !== skip && inRect(x, y, { x: p.x, y: p.y, w: BIG, h: BIG }));

// Cases constructibles d'un quartier, hors des emprises, des plus proches de son panneau aux plus lointaines
function freeSpotsAt(places, zoneId, levels = {}) {
    const anchor = map.ANCHORS[zoneId];
    if (!anchor) return [];
    const spots = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (map.zoneAt(x, y) === zoneId && map.buildable(x, y) && !inFootprintAt(places, x, y, levels)) spots.push({ x, y, d: Math.hypot(x - anchor.x, y - anchor.y) });
        }
    }
    return spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y }));
}

// Les places d'un joueur, d'après la base : { places, beach }
// (une île à la plage est une île neuve : ses deux marques, comme world/paths.js)
async function placesOf(userId, conn = db) {
    const [flags, rows] = await Promise.all([
        conn.query('SELECT COUNT(*)::int AS n FROM world_items WHERE user_id = $1 AND item = ANY($2)', [userId, [PLAGE, NEW_ISLAND]]),
        conn.query('SELECT site, x, y FROM world_site_places WHERE user_id = $1', [userId])
    ]);
    const beach = flags.rows[0].n === 2;
    return { places: placesFrom({ beach, rows: rows.rows }), beach };
}

module.exports = { PLAGE, BEACH, BIG, placesFrom, STATIC, footprintAt, inFootprintAt, inSiteAt, freeSpotsAt, placesOf };
