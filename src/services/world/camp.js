// Le camp des naufragés sur la Grève (dessins : design/bibliotheque/svg/decor/camp/camp.json) : l'épave de
// l'Hirondelle, la cuisine de Cannelle, les coins d'Aster et de Rivet (débris, abri, cabanon), quelques objets ; les
// voyageurs de l'acte IV y plantent leur tente et leur hamac, et le panneau SOS s'en va.
// Chaque élément a sa place prévue (PLACES) ; si un objet du joueur l'occupe déjà, l'élément se pose sur la case libre
// la plus proche : rien du joueur ne bouge, et le camp est toujours complet. Ses cases sont ensuite réservées (on n'y
// pose ni annexe ni création). Fonctions pures, et campOfUser qui lit dans la base ce qui le décide.
const map = require('../worldMap');
const landmarks = require('../landmarks');
const finds = require('../finds');
const quests = require('../quests');
const { SIZE } = require('./rules');
const { annexesOf, levelsOf, claimedOf, craftsOf } = require('./reads');

const ZONE = 'coeur';
// Le Foyer à l'Abri (palier II) : Cannelle quitte la cuisine de l'épave, les cabanons peuvent venir
const ABRI = 2;
// Les grandes emprises (palier IV) de tous les chantiers restent libres, quel que soit le palier du joueur
const BIG = Object.fromEntries(Object.keys(map.SITE_BIG).map(id => [id, map.BIG_FROM]));

// Place prévue (coin haut-gauche), taille (2 : 2 × 2 cases, sinon 1), dessin selon l'avancée (null : pas encore, ou
// plus). at : { acts (actes finis), levels (paliers des bâtiments) }. Un camp sobre, qui libère la Grève : l'épave et
// trois objets restent ; le coin d'Aster s'en va quand son Ponton est bâti, celui de Rivet avec son Atelier, la cuisine
// de Cannelle avec l'Abri ; le SOS, quand les voyageurs arrivent (acte IV) avec leur tente et leur hamac
const has = (at, act) => at.acts.includes(act);
const foyer = at => at.levels.foyer || 0;
// Un coin de maître, tant que son bâtiment n'est pas bâti : débris, abri (acte I), cabanon (acte II, et le Foyer à l'Abri)
const corner = (who, site) => at => {
    if (at.levels[site]) return null;
    return `${who}_${has(at, 'II') && foyer(at) >= ABRI ? 'cabanon' : has(at, 'I') ? 'abri' : 'debris'}`;
};
const PLACES = [
    { id: 'hirondelle', x: 96, y: 96, size: 2, art: () => 'hirondelle' },
    { id: 'cannelle', x: 99, y: 96, size: 2, art: at => (foyer(at) < ABRI ? 'cannelle_debris' : null) },
    { id: 'aster', x: 101, y: 93, size: 2, art: corner('aster', 'ponton') },
    { id: 'rivet', x: 92, y: 92, size: 2, art: corner('rivet', 'atelier') },
    { id: 'tente', x: 93, y: 96, size: 2, art: at => (has(at, 'IV') ? 'tente' : null) },
    { id: 'hamac', x: 102, y: 96, size: 2, art: at => (has(at, 'IV') ? 'hamac' : null) },
    { id: 'sos', x: 104, y: 93, art: at => (has(at, 'IV') ? null : 'sos') },
    { id: 'caisses', x: 99, y: 93, art: () => 'caisses' },
    { id: 'filet', x: 104, y: 95, art: () => 'filet' },
    { id: 'rondins', x: 95, y: 92, art: () => 'rondins' }
];

// Case où le camp peut se poser : sol constructible de la Grève, hors des grandes emprises, des lieux remarquables et
// des gisements (taken : clés des cases occupées)
const open = (x, y, taken) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && map.zoneAt(x, y) === ZONE && map.buildable(x, y)
    && !map.inFootprint(x, y, BIG) && !landmarks.isLandmark(x, y) && !finds.isDeposit(x, y) && !taken.has(y * SIZE + x);
const cellsOf = (x, y, size) => Array.from({ length: size * size }, (_, i) => [x + (i % size), y + Math.floor(i / size)]);
const fits = (x, y, size, taken) => cellsOf(x, y, size).every(([a, b]) => open(a, b, taken));

// Où se pose un élément : sa place si elle est libre, sinon la plus proche qui l'est (à égalité : plus haut, puis plus
// à gauche), ou null s'il n'y en a aucune à RADIUS cases
const RADIUS = 8;
function spotOf(place, size, taken) {
    if (fits(place.x, place.y, size, taken)) return { x: place.x, y: place.y };
    let best = null;
    for (let y = place.y - RADIUS; y <= place.y + RADIUS; y++) {
        for (let x = place.x - RADIUS; x <= place.x + RADIUS; x++) {
            const d = (x - place.x) ** 2 + (y - place.y) ** 2;
            if (d > RADIUS * RADIUS || !fits(x, y, size, taken)) continue;
            if (!best || d < best.d || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, d };
        }
    }
    return best && { x: best.x, y: best.y };
}

// Le camp d'un joueur : [{ id, art, x, y, w, h }] (ce qui se voit maintenant). acts : actes finis ; levels : paliers
// des bâtiments ; taken : clés (y × SIZE + x) des cases occupées par ses annexes et ses créations posées
function campOf({ acts = [], levels = {}, taken = new Set() }) {
    const at = { acts, levels };
    const busy = new Set(taken);
    const out = [];
    for (const place of PLACES) {
        const art = place.art(at);
        if (!art) continue;
        const size = place.size || 1;
        const spot = spotOf(place, size, busy);
        if (!spot) continue;
        cellsOf(spot.x, spot.y, size).forEach(([x, y]) => busy.add(y * SIZE + x));
        out.push({ id: place.id, art, x: spot.x, y: spot.y, w: size, h: size });
    }
    return out;
}

// Les cases du camp (clés), pour les réserver
const cellsOfCamp = camp => new Set(camp.flatMap(c => cellsOf(c.x, c.y, c.w).map(([x, y]) => y * SIZE + x)));

// Le camp d'un joueur, d'après la base : ses actes finis, ses paliers, ce qu'il a posé (déjà lus : levels, annexRows,
// craftRows). conn : la transaction en cours
async function campOfUser(userId, conn, { levels, annexRows, craftRows } = {}) {
    const lv = levels || (await levelsOf(userId, conn)).levels;
    const annexList = annexRows || await annexesOf(userId, conn);
    const craftList = craftRows || await craftsOf(userId, conn);
    const acts = quests.actsDoneOf(quests.doneOf(await claimedOf(userId, conn)));
    const taken = new Set([...annexList, ...craftList.filter(r => r.x !== null && r.x !== undefined)].map(r => r.y * SIZE + r.x));
    return campOf({ acts, levels: lv, taken });
}

module.exports = { PLACES, campOf, cellsOfCamp, campOfUser };
