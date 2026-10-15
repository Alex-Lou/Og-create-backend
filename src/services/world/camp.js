// Le camp des naufragés sur la plage de Brumelune (dessins : design/bibliotheque/svg/decor/camp/camp.json) : l'épave de
// l'Hirondelle, la cuisine d’Agathe, les coins de Lorena et de Nathan (débris, abri, cabanon), quelques objets ; les
// voyageurs de l'acte IV y plantent leur tente et leur hamac, et le panneau SOS s'en va. La cage aux poules d’Agathe
// (decor/camp/poules) y paraît avec elle, coincée sous les rochers ; ouverte, elle reste près du feu.
// Chaque élément a sa place prévue (PLACES) ; si un objet du joueur l'occupe déjà, l'élément se pose sur la case libre
// la plus proche : rien du joueur ne bouge, et le camp est toujours complet. Ses cases sont ensuite réservées (on n'y
// pose ni annexe ni création). Fonctions pures, et campOfUser qui lit dans la base ce qui le décide.
// Sur une île qui suit l'histoire (choix de l'auteur, 9 oct.), rien n'est là avant son personnage : l'épave seule tant
// que Brume est seule avec le joueur ; le camp de Lorena (son coin, le SOS, les caisses, le filet, les rondins) avec
// Lorena ; la cuisine avec Agathe ; le coin de Nathan avec Nathan. Sur une île à la plage (world/places.js : une zone par
// personnage), le camp de Lorena et ce que la mer a laissé autour sont dans sa zone, au sud-ouest, le coin de Nathan dans
// la sienne, au nord du Feu ; la cuisine d’Agathe reste sur la plage, sa zone, près de son Feu.
const map = require('../worldMap');
const landmarks = require('../landmarks');
const finds = require('../finds');
const quests = require('../quests');
const { SIZE } = require('./rules');
const { annexesOf, levelsOf, claimedOf, craftsOf, zonesOf } = require('./reads');
const { cageOf } = require('./beasts');
const { roadsOf } = require('./paths');
const { STATIC, inSiteAt, placesOf } = require('./places');
const { presenceOf, metOf } = require('./people');
const { sheltersOf } = require('./shelters');

const ZONE = 'coeur';
// Le Foyer à l'Abri (palier II) : la cuisine d’Agathe devient son cabanon, les cabanons peuvent venir
const ABRI = 2;
// Les places du camp sur une île à la plage (world/places.js) : dans la zone de chacun
const BEACH_PLACES = {
    // (le camp de Lorena serré autour de son Ponton, contre l'épave : sa zone est petite)
    aster: { x: 90, y: 96 }, sos: { x: 90, y: 94 }, caisses: { x: 91, y: 95 }, filet: { x: 90, y: 98 }, rondins: { x: 92, y: 94 },
    rivet: { x: 93, y: 86 },
    // (la cage des poules, échouée par la mer au bout de la plage, dans le coin d’Agathe : choix de l'auteur, 11 oct.)
    cage: { x: 101, y: 98 }
};

// Place prévue (coin haut-gauche), taille (2 : 2 × 2 cases, sinon 1), dessin selon l'avancée (null : pas encore, ou
// plus). at : { acts (actes finis), levels (paliers des bâtiments), cage ('coincee', 'ouverte' ou null), here (le
// personnage est là ? id de son bâtiment : ponton Lorena, foyer Agathe, atelier Nathan) }. Un camp sobre, qui libère la plage : l'épave et
// trois objets restent ; le coin de Lorena s'en va quand son Ponton est bâti, celui de Nathan avec son Atelier, la cuisine
// d’Agathe devient son cabanon à l'Abri (elle le garde) ; le SOS, quand les voyageurs arrivent (acte IV) avec leur tente et leur hamac
const has = (at, act) => at.acts.includes(act);
const foyer = at => at.levels.foyer || 0;
// Le camp de Lorena (et ce que la mer a laissé autour) arrive avec elle
const aster = at => at.here('ponton');
// Un coin de maître, une fois arrivé et tant que son bâtiment n'est pas bâti : débris, abri (acte I), cabanon (acte II,
// et le Foyer à l'Abri)
const corner = (who, site) => at => {
    if (at.levels[site] || !at.here(site)) return null;
    return `${who}_${has(at, 'II') && foyer(at) >= ABRI ? 'cabanon' : has(at, 'I') ? 'abri' : 'debris'}`;
};
const PLACES = [
    { id: 'hirondelle', x: 96, y: 96, size: 2, art: () => 'hirondelle' },
    // (sa cuisine de l'épave, puis son abri, bâti par le joueur : world/shelters.js ; le Foyer à l'Abri, son cabanon :
    // choix de l'auteur, 14 oct.)
    { id: 'cannelle', x: 99, y: 96, size: 2, art: at => (!at.here('foyer') ? null : foyer(at) >= ABRI ? 'cannelle_cabanon' : at.shelters.has('cannelle') ? 'cannelle_abri' : 'cannelle_debris') },
    // (son coin, à côté de son Ponton : elle y plante son camp en débarquant, choix de l'auteur, 11 oct.)
    { id: 'aster', x: 87, y: 96, size: 2, art: corner('aster', 'ponton') },
    { id: 'rivet', x: 91, y: 94, size: 2, art: corner('rivet', 'atelier') },
    { id: 'tente', x: 93, y: 96, size: 2, art: at => (has(at, 'IV') ? 'tente' : null) },
    { id: 'hamac', x: 102, y: 96, size: 2, art: at => (has(at, 'IV') ? 'hamac' : null) },
    { id: 'sos', x: 104, y: 93, art: at => (has(at, 'IV') || !aster(at) ? null : 'sos') },
    { id: 'caisses', x: 99, y: 93, art: at => (aster(at) ? 'caisses' : null) },
    { id: 'filet', x: 104, y: 95, art: at => (aster(at) ? 'filet' : null) },
    { id: 'rondins', x: 95, y: 92, art: at => (aster(at) ? 'rondins' : null) },
    { id: 'cage', x: 98, y: 94, art: at => (at.cage ? `cage_${at.cage}` : null) }
];

// Case où le camp peut se poser : sol constructible de la plage, hors des grandes emprises, des lieux remarquables et
// des gisements (taken : clés des cases occupées)
// (places : où sont les bâtiments ; leurs grandes emprises restent libres, quel que soit leur palier)
const open = (x, y, taken, places) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && map.zoneAt(x, y) === ZONE && map.buildable(x, y)
    && !inSiteAt(places, x, y) && !landmarks.isLandmark(x, y) && !finds.isDeposit(x, y) && !taken.has(y * SIZE + x);
const cellsOf = (x, y, size) => Array.from({ length: size * size }, (_, i) => [x + (i % size), y + Math.floor(i / size)]);
const fits = (x, y, size, taken, places) => cellsOf(x, y, size).every(([a, b]) => open(a, b, taken, places));

// Où se pose un élément : sa place si elle est libre, sinon la plus proche qui l'est (à égalité : plus haut, puis plus
// à gauche), ou null s'il n'y en a aucune à RADIUS cases
const RADIUS = 8;
function spotOf(place, size, taken, places) {
    if (fits(place.x, place.y, size, taken, places)) return { x: place.x, y: place.y };
    let best = null;
    for (let y = place.y - RADIUS; y <= place.y + RADIUS; y++) {
        for (let x = place.x - RADIUS; x <= place.x + RADIUS; x++) {
            const d = (x - place.x) ** 2 + (y - place.y) ** 2;
            if (d > RADIUS * RADIUS || !fits(x, y, size, taken, places)) continue;
            if (!best || d < best.d || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, d };
        }
    }
    return best && { x: best.x, y: best.y };
}

// Le camp d'un joueur : [{ id, art, x, y, w, h }] (ce qui se voit maintenant). acts : actes finis ; levels : paliers
// des bâtiments ; taken : clés (y × SIZE + x) des cases occupées par ses annexes et ses créations posées ; cage : la
// cage aux poules ; met : ids des bâtiments dont le personnage est là (null : tous) ;
// places, beach : où sont les bâtiments, île à la plage (world/places.js)
function campOf({ acts = [], levels = {}, taken = new Set(), cage = null, met = null, places = STATIC, beach = false, shelters = new Set() }) {
    const at = { acts, levels, cage, shelters, here: site => !met || met.has(site) };
    const busy = new Set(taken);
    const out = [];
    for (const place of PLACES) {
        const art = place.art(at);
        if (!art) continue;
        const size = place.size || 1;
        const spot = spotOf(beach && BEACH_PLACES[place.id] ? { ...place, ...BEACH_PLACES[place.id] } : place, size, busy, places);
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
    // (les chemins tracés, et le sentier d'une île neuve)
    for (const k of (await roadsOf(userId, conn)).added) taken.add(k);
    const { places, beach } = await placesOf(userId, conn);
    // Qui est là
    const presence = await presenceOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const met = new Set(['ponton', 'foyer', 'atelier'].filter(id => metOf(id, lv, zones, presence)));
    return campOf({ acts, levels: lv, taken, cage: await cageOf(userId, conn), met, places, beach, shelters: await sheltersOf(userId, conn) });
}

module.exports = { PLACES, campOf, cellsOfCamp, campOfUser };
