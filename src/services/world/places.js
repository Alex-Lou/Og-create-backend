// Où sont les bâtiments d'un joueur (choix de l'auteur, 9 oct. : « je veux pouvoir déplacer les bâtiments, les disposer
// où je veux »). Chaque bâtiment a sa grande emprise (3 × 3 cases, palier IV et plus) ; avant, il n'en occupe que le coin
// avant (2 × 2). Sa place : celle de la carte (worldMap.SITE_BIG), sauf
//  - sur une île à la plage (créée ou recommencée depuis le 9 oct. : la marque PLAGE) : le Feu de camp brûle près de
//    l'épave, au bout du sentier (là où était le coin de la cuisine d’Agathe, qui prend l'ancienne place du Feu :
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
// Une île à la plage (choix de l'auteur, 10 oct.) : une zone par personnage, qui ne se découvre qu'avec lui, et son
// bâtiment au milieu, avec la place autour pour ses annexes, ses objets et deux bâtiments à venir (le jeu dessine les
// zones : src/world/zones.js, mêmes cases). Le Feu, bâtiment d’Agathe, sur la plage (sa porte, le bas de son emprise,
// y = 95, touche le bout du sentier : world/paths.js, SENTIER_BEACH, à tous ses paliers) ; le Ponton de Lorena au
// sud-ouest, contre la mer ; l'Atelier de Jovin au nord du Feu ; le Puits de Léo à l'ouest, près du ruisseau ; ceux
// des actes suivants au bord de leur quartier (celui qu'il faut acheter pour les bâtir : map.siteZone)
const BEACH = {
    foyer: { x: 98, y: 92 },
    // (contre l'épave, sur le rivage, choix de l'auteur, 11 oct. : on se rapproche pour s'entraider, et l'île ne se
    // découvre que par petits morceaux)
    ponton: { x: 92, y: 96 },
    // (au nord du Feu, à deux pas du sentier, choix de l'auteur, 11 oct. : on le rapproche)
    atelier: { x: 95, y: 85 },
    // (contre le village, entre le ruisseau et le sentier, choix de l'auteur, 11 oct. : les bases ensemble)
    puits: { x: 88, y: 86 },
    carriere: { x: 86, y: 69 },
    potager: { x: 73, y: 70 },
    // (choix de l'auteur, 14 oct. : trop loin à la Lisière ; près du Puits, entre le ruisseau et la mare, à cinq cases de
    // lui ; son quartier reste la Lisière, qu'il faut toujours acheter)
    bosquet: { x: 81, y: 84 }
};
// Leurs places d'avant, pour qui les a déjà bâtis là (leurs annexes y sont) : ils ne bougent pas
const BEACH_BEFORE = { bosquet: { x: 72, y: 86 } };

// Les places d'un joueur : { bâtiment : { x, y } } (coin haut-gauche de la grande emprise). beach : île à la plage ;
// rows : ses déplacements [{ site, x, y }] ; built : ses bâtiments déjà bâtis (ceux d'avant un déplacement de la carte
// restent à leur place d'avant : BEACH_BEFORE)
function placesFrom({ beach = false, rows = [], built = [] } = {}) {
    const out = {};
    for (const [id, p] of Object.entries(map.SITE_BIG)) out[id] = { ...((beach && ((built.includes(id) && BEACH_BEFORE[id]) || BEACH[id])) || p) };
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
    const [flags, rows, built] = await Promise.all([
        conn.query('SELECT COUNT(*)::int AS n FROM world_items WHERE user_id = $1 AND item = ANY($2)', [userId, [PLAGE, NEW_ISLAND]]),
        conn.query('SELECT site, x, y FROM world_site_places WHERE user_id = $1', [userId]),
        conn.query('SELECT site FROM world_buildings WHERE user_id = $1 AND site = ANY($2) AND level > 0', [userId, Object.keys(BEACH_BEFORE)])
    ]);
    const beach = flags.rows[0].n === 2;
    return { places: placesFrom({ beach, rows: rows.rows, built: built.rows.map(r => r.site) }), beach };
}

module.exports = { PLAGE, BEACH, BEACH_BEFORE, BIG, placesFrom, STATIC, footprintAt, inFootprintAt, inSiteAt, freeSpotsAt, placesOf };
