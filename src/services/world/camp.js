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
// la sienne, au nord du Feu ; la cuisine d’Agathe reste dans la plage, sa zone, à l'est de son Feu.
const map = require('../worldMap');
const landmarks = require('../landmarks');
const finds = require('../finds');
const quests = require('../quests');
const { SIZE } = require('./rules');
const { annexesOf, levelsOf, claimedOf, craftsOf, zonesOf } = require('./reads');
const { cageOf } = require('./beasts');
const { roadsOf } = require('./paths');
const { PLAGE, STATIC, inSiteAt, placesOf } = require('./places');
const { presenceOf, metOf } = require('./people');
const { sheltersOf } = require('./shelters');

const ZONE = 'coeur';
// Le Foyer à l'Abri (palier II) : la cuisine d’Agathe devient son cabanon, les cabanons peuvent venir
const ABRI = 2;
// Les places du camp sur une île à la plage (world/places.js) : dans la zone de chacun
const BEACH_PLACES = {
    // (le camp de Lorena serré autour de son Ponton, contre l'épave : sa zone est petite)
    aster: { x: 90, y: 95 }, sos: { x: 90, y: 94 }, caisses: { x: 91, y: 94 }, filet: { x: 90, y: 100 }, rondins: { x: 92, y: 94 },
    // (la grande Hirondelle, couchée en travers de l'anse à l'ouest du camp, entre le bout sud des rochers et le Ponton ;
    // le camp de Lorena se serre derrière elle, son filet devant. Sa poupe arrachée, qui restait à l'ancienne place, n'y
    // est plus : choix de l'auteur, 16 oct. ; deux pièces de clôture ferment à sa place le coin de l'enclos du Feu,
    // PLACES : coin-1, coin-2)
    hirondelle: { x: 86, y: 97, w: 6, h: 3 },
    rivet: { x: 93, y: 86 },
    // (la cage des poules, échouée par la mer au bout de la plage, dans le coin d’Agathe : choix de l'auteur, 11 oct.)
    cage: { x: 101, y: 98 },
    // (sa cuisine, à l'est du camp, entre le Feu et les palmiers, dans l'herbe : choix de l'auteur, 18 oct. ; son enclos
    // l'entoure sans toucher aux palmiers ; sur le sable du rivage, sous l'enclos du Feu, s'échoue la planche de Léo)
    cannelle: { x: 102, y: 94 }
};

// Place prévue (coin haut-gauche), taille (2 : 2 × 2 cases, sinon 1), fixe (à sa place, ou pas du tout), dessin selon l'avancée (null : pas encore, ou
// plus). at : { acts (actes finis), levels (paliers des bâtiments), cage ('coincee', 'ouverte' ou null), here (le
// personnage est là ? id de son bâtiment : ponton Lorena, foyer Agathe, atelier Nathan) }. Un camp sobre, qui libère la plage : l'épave et
// trois objets restent ; le coin de Lorena s'en va quand son Ponton est bâti, celui de Nathan avec son Atelier, la cuisine
// d’Agathe devient son cabanon à l'Abri (elle le garde) ; le SOS, quand les voyageurs arrivent (acte IV) avec leur tente et leur hamac
const has = (at, act) => at.acts.includes(act);
const foyer = at => at.levels.foyer || 0;
// Le camp de Lorena (et ce que la mer a laissé autour) arrive avec elle
const aster = at => at.here('ponton');
// Un coin de maître, une fois arrivé et tant que son bâtiment n'est pas bâti : débris, abri (acte I, ou bâti par le
// joueur : world/shelters.js, celui de Nathan), cabanon (acte II, et le Foyer à l'Abri)
const corner = (who, site) => at => {
    if (at.levels[site] || !at.here(site)) return null;
    return `${who}_${has(at, 'II') && foyer(at) >= ABRI ? 'cabanon' : has(at, 'I') || at.shelters.has(who) ? 'abri' : 'debris'}`;
};
// La végétation qui gagne la grande Hirondelle (choix de l'auteur, 15 oct.) : un stade par seuil de jours depuis le
// début de l'île (herbes et mousse, lianes et fleurs, jeunes palmiers sur le pont)
const OVERGROWTH_DAYS = [3, 10, 30];
const overgrowthOf = days => OVERGROWTH_DAYS.filter(d => days >= d).length;
// Le sillon que la grande Hirondelle a ouvert derrière sa poupe jusqu'à la mer (le dessin : design/atelier/camp.mjs),
// ses cases de sable (dx, dy depuis son coin) : de l'eau, rien n'y tient (ni trouvaille, ni annexe, ni création)
const SILLON = [[6, 1], [7, 1]];
const PLACES = [
    // (l'épave : sur une île à la plage, la grande Hirondelle (6 × 3, BEACH_PLACES) ; sur une île d'avant, la petite épave
    // d'origine. extra : ce que le jeu dessine en plus, la végétation et la lanterne de Lorena)
    { id: 'hirondelle', x: 96, y: 96, size: 2, art: at => (at.beach ? 'hirondelle' : 'hirondelle_petite'), extra: at => (at.beach ? { stade: overgrowthOf(at.days), lanterne: at.here('ponton'), sillon: SILLON } : {}) },
    // (le coin de l'enclos du Feu que fermait la poupe de l'Hirondelle, à deux cases de la grande emprise du Feu : deux
    // pièces de clôture, une fois le Feu bâti, sur l'île à la plage ; le jeu les dessine comme une clôture, raccordée aux
    // piquets du joueur. fixe : à leur place ou pas du tout ; choix de l'auteur, 16 oct.)
    { id: 'coin-1', x: 96, y: 96, fixe: true, art: at => (at.beach && foyer(at) ? 'cloture' : null) },
    { id: 'coin-2', x: 97, y: 96, fixe: true, art: at => (at.beach && foyer(at) ? 'cloture' : null) },
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
    { id: 'cage', x: 98, y: 94, art: at => (at.cage ? `cage_${at.cage}` : null) },
    // (sur l'ancienne butte devant le Feu, aplatie : deux palmiers, deux étoiles de mer ; choix de l'auteur, 15 oct. ;
    // hors de l'anneau de l'enclos du Feu, et de celui de la cuisine d’Agathe : en rang sur le sable, sous lui, 18 oct.)
    { id: 'palmier-1', x: 103, y: 97, art: at => (at.beach ? 'palmier' : null) },
    { id: 'palmier-2', x: 104, y: 97, art: at => (at.beach ? 'palmier' : null) },
    { id: 'etoile-1', x: 102, y: 97, art: at => (at.beach ? 'etoile_de_mer' : null) },
    { id: 'etoile-2', x: 101, y: 97, art: at => (at.beach ? 'etoile_de_mer' : null) }
];

// Case où le camp peut se poser : sol constructible de la plage, hors des grandes emprises, des lieux remarquables et
// des gisements (taken : clés des cases occupées)
// (places : où sont les bâtiments ; leurs grandes emprises restent libres, quel que soit leur palier)
const open = (x, y, taken, places) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && map.zoneAt(x, y) === ZONE && map.buildable(x, y)
    && !inSiteAt(places, x, y) && !landmarks.isLandmark(x, y) && !finds.isDeposit(x, y) && !taken.has(y * SIZE + x);
// (w × h cases ; h : w par défaut, un carré)
const cellsOf = (x, y, w, h = w) => Array.from({ length: w * h }, (_, i) => [x + (i % w), y + Math.floor(i / w)]);
const fits = (x, y, w, h, taken, places) => cellsOf(x, y, w, h).every(([a, b]) => open(a, b, taken, places));

// Où se pose un élément : sa place si elle est libre, sinon la plus proche qui l'est (à égalité : plus haut, puis plus
// à gauche), ou null s'il n'y en a aucune à RADIUS cases
const RADIUS = 8;
function spotOf(place, w, h, taken, places) {
    if (fits(place.x, place.y, w, h, taken, places)) return { x: place.x, y: place.y };
    let best = null;
    for (let y = place.y - RADIUS; y <= place.y + RADIUS; y++) {
        for (let x = place.x - RADIUS; x <= place.x + RADIUS; x++) {
            const d = (x - place.x) ** 2 + (y - place.y) ** 2;
            if (d > RADIUS * RADIUS || !fits(x, y, w, h, taken, places)) continue;
            if (!best || d < best.d || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, d };
        }
    }
    return best && { x: best.x, y: best.y };
}

// Le camp d'un joueur : [{ id, art, x, y, w, h }] (ce qui se voit maintenant). acts : actes finis ; levels : paliers
// des bâtiments ; taken : clés (y × SIZE + x) des cases occupées par ses annexes et ses créations posées ; cage : la
// cage aux poules ; met : ids des bâtiments dont le personnage est là (null : tous) ;
// places, beach : où sont les bâtiments, île à la plage (world/places.js)
function campOf({ acts = [], levels = {}, taken = new Set(), cage = null, met = null, places = STATIC, beach = false, shelters = new Set(), days = 0 }) {
    const at = { acts, levels, cage, shelters, beach, days, here: site => !met || met.has(site) };
    const busy = new Set(taken);
    const out = [];
    for (const place of PLACES) {
        const art = place.art(at);
        if (!art) continue;
        const where = beach && BEACH_PLACES[place.id] ? { ...place, ...BEACH_PLACES[place.id] } : place;
        const w = where.w || where.size || 1, h = where.h || w;
        const spot = where.fixe ? (fits(where.x, where.y, w, h, busy, places) ? { x: where.x, y: where.y } : null) : spotOf(where, w, h, busy, places);
        if (!spot) continue;
        cellsOf(spot.x, spot.y, w, h).forEach(([x, y]) => busy.add(y * SIZE + x));
        out.push({ id: place.id, art, x: spot.x, y: spot.y, w, h, ...(place.extra ? place.extra(at) : {}) });
    }
    return out;
}

// Les cases du camp (clés), pour les réserver
// (et le sillon de l'épave)
const cellsOfCamp = camp => new Set(camp.flatMap(c => [...cellsOf(c.x, c.y, c.w, c.h), ...(c.sillon || []).map(([dx, dy]) => [c.x + dx, c.y + dy])].map(([x, y]) => y * SIZE + x)));

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
    // (les jours depuis la naissance de l'île à la plage, quand l'épave s'est échouée : sa végétation)
    const { rows: [born] } = await conn.query('SELECT bought_at FROM world_items WHERE user_id = $1 AND item = $2', [userId, PLAGE]);
    const days = born ? Math.max(0, Math.floor((Date.now() - new Date(born.bought_at).getTime()) / 86400000)) : 0;
    return campOf({ acts, levels: lv, taken, cage: await cageOf(userId, conn), met, places, beach, shelters: await sheltersOf(userId, conn), days });
}

module.exports = { PLACES, OVERGROWTH_DAYS, overgrowthOf, campOf, cellsOfCamp, campOfUser };
