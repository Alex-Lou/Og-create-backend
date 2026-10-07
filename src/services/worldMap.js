// La carte de l'île, la même pour tous : la très grande île (96 × 96, lot 9), dessinée case par case — relief, sol et
// quartiers. Le cœur est la grande île 48 × 48 (islandData.js), posée telle quelle en OFFSET ; autour, les terres
// nouvelles (islandOuter.js) et leurs six climats. La Grève est ouverte d'office ; les autres quartiers s'achètent
// (écus + chapitre du Livre), et ceux des terres nouvelles se découvrent d'abord par une expédition.
// Fonctions pures, sans base de données.
const heart = require('./islandData');
const outer = require('./islandOuter');

const SIZE = 96;
// Place du cœur (l'île v3) dans la carte : ses coordonnées v3 + OFFSET
const OFFSET = { x: outer.OX, y: outer.OY };
// Calques assemblés : '?' dans islandOuter.js = case de terre du cœur
const compose = (outerLayer, heartLayer) => outerLayer.map((row, y) => [...row].map((c, x) => (c === '?' ? heartLayer[y - OFFSET.y][x - OFFSET.x] : c)).join(''));
const data = {
    HEIGHT: compose(outer.HEIGHT, heart.HEIGHT),
    GROUND: compose(outer.GROUND, heart.GROUND),
    REGION: compose(outer.REGION, heart.REGION),
    SITES: Object.fromEntries(Object.entries(heart.SITES).map(([id, p]) => [id, { x: p.x + OFFSET.x, y: p.y + OFFSET.y }]))
};

// Climats : le cœur est tempéré ; chacun des six autres a sa météo, sa lumière (front) et, plus tard, ses règles
const CLIMATES = {
    tempere: 'Tempéré', cimes: 'Les Cimes', landes: 'Les Landes', marais: 'Le Marais', dunes: 'Les Dunes', jungle: 'La Jungle', volcan: 'Le Volcan'
};

// Quartiers : prix en écus, chapitre du Livre qui doit être ouvert, lettre du calque REGION, climat. Les douze premiers
// sont ceux du cœur (mêmes identifiants : les achats des joueurs restent valables) ; les douze des terres nouvelles ont
// en plus trip : la durée (heures) de l'expédition qui les découvre
const ZONES = [
    { id: 'coeur', name: 'La Grève', price: 0, chapter: null, code: 'a' },
    { id: 'source', name: 'La Source', price: 100, chapter: 'I', code: 'b' },
    { id: 'lisiere', name: 'La Lisière', price: 150, chapter: 'I', code: 'c' },
    { id: 'colline', name: 'La Colline', price: 250, chapter: 'II', code: 'd' },
    { id: 'jardins', name: 'Les Jardins', price: 400, chapter: 'III', code: 'e' },
    { id: 'est', name: 'Le Faubourg', price: 600, chapter: 'III', code: 'f' },
    { id: 'hauteurs', name: 'Les Hauteurs', price: 700, chapter: 'III', code: 'g' },
    { id: 'crique', name: 'La Crique', price: 900, chapter: 'IV', code: 'h' },
    { id: 'foret', name: 'La Grande Forêt', price: 1200, chapter: 'IV', code: 'i' },
    { id: 'hameau', name: 'Le Hameau', price: 1800, chapter: 'V', code: 'j' },
    { id: 'phare', name: 'L’Îlot aux Mouettes', price: 2800, chapter: 'VI', code: 'k' },
    { id: 'legendes', name: 'L’Île des Légendes', price: 4500, chapter: 'VII', code: 'l' },
    { id: 'menhirs', name: 'La Lande aux Menhirs', price: 350, chapter: 'II', code: 'o', climate: 'landes', trip: 2 },
    { id: 'roselieres', name: 'Les Roselières', price: 400, chapter: 'II', code: 'q', climate: 'marais', trip: 2 },
    { id: 'falaises', name: 'Les Falaises du Couchant', price: 500, chapter: 'II', code: 'p', climate: 'landes', trip: 3 },
    { id: 'bayou', name: 'Le Bayou des Lucioles', price: 550, chapter: 'II', code: 'r', climate: 'marais', trip: 3 },
    { id: 'contreforts', name: 'Les Contreforts', price: 1000, chapter: 'IV', code: 'm', climate: 'cimes', trip: 3 },
    { id: 'oasis', name: 'L’Oasis cachée', price: 1100, chapter: 'IV', code: 's', climate: 'dunes', trip: 4 },
    { id: 'neiges', name: 'Les Neiges éternelles', price: 1500, chapter: 'IV', code: 'n', climate: 'cimes', trip: 5 },
    { id: 'dunes', name: 'Les Dunes d’Or', price: 1600, chapter: 'IV', code: 't', climate: 'dunes', trip: 5 },
    { id: 'canopee', name: 'La Canopée', price: 2000, chapter: 'V', code: 'u', climate: 'jungle', trip: 6 },
    { id: 'cascade', name: 'La Cascade des Brumes', price: 2600, chapter: 'V', code: 'v', climate: 'jungle', trip: 7 },
    { id: 'coulees', name: 'Les Coulées noires', price: 3200, chapter: 'VI', code: 'w', climate: 'volcan', trip: 8 },
    { id: 'cratere', name: 'Le Cratère', price: 5000, chapter: 'VI', code: 'x', climate: 'volcan', trip: 9 }
].map(z => ({ climate: 'tempere', trip: 0, ...z }));
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
// Le cœur de l'île : ses quartiers des chapitres I à III (Cœur, Source, Lisière, Colline, Jardins, Faubourg, Hauteurs).
// Les terres alentour (à expédition) restent fermées tant qu'ils ne sont pas tous à soi (décision de l'auteur, 7 oct.)
const CORE = ZONES.filter(z => !z.trip && (!z.chapter || ['I', 'II', 'III'].includes(z.chapter))).map(z => z.id);
const ZONE_BY_CODE = Object.fromEntries(ZONES.map(z => [z.code, z.id]));

const cell = (layer, x, y) => (Number.isInteger(x) && Number.isInteger(y) ? layer[y]?.[x] : undefined);
// Sol de la case (voir islandData.js), undefined hors carte
const groundAt = (x, y) => cell(data.GROUND, x, y);
// Relief de la case (0 à 6), -1 en mer
const heightAt = (x, y) => {
    const c = cell(data.HEIGHT, x, y);
    return c === undefined || c === ' ' ? -1 : Number(c);
};
// Terre de l'île (chemins et ponts sur la rivière compris ; ni la mer ni les ponts sur la mer)
const isLand = (x, y) => {
    const g = groundAt(x, y);
    return g !== undefined && g !== '~' && g !== 'b';
};
// Sol où l'on peut poser une décoration : herbe, sable, prairie
const buildable = (x, y) => ['g', 's', 'm'].includes(groundAt(x, y));
// Quartier d'une case de terre (null en mer)
const zoneAt = (x, y) => ZONE_BY_CODE[cell(data.REGION, x, y)] || null;

// Emprise des chantiers : 3 × 3 dès le palier BIG_FROM (SITE_BIG, figée dans les données) ; avant, 2 × 2 au coin
// avant de cette emprise, au bout du chemin
const BIG_FROM = 4;
const SITE_BIG = data.SITES;
const SITE_PLACES = Object.fromEntries(Object.entries(SITE_BIG).map(([id, p]) => [id, { x: p.x + 1, y: p.y + 1 }]));
function footprintOf(id, level = 0) {
    if (level >= BIG_FROM) return { ...SITE_BIG[id], w: 3, h: 3 };
    return { ...SITE_PLACES[id], w: 2, h: 2 };
}
// Case couverte par un chantier, selon les niveaux du joueur ({ site: niveau })
function inFootprint(x, y, levels = {}) {
    return Object.keys(SITE_BIG).some(id => {
        const f = footprintOf(id, levels[id] || 0);
        return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h;
    });
}
// Case de la grande emprise d'un chantier (réservée, quel que soit son niveau)
const inSite = (x, y) => Object.values(SITE_BIG).some(p => x >= p.x && x < p.x + 3 && y >= p.y && y < p.y + 3);
const siteZone = id => zoneAt(SITE_BIG[id].x, SITE_BIG[id].y);

// Grille des quartiers : un caractère par case ('.' mer, sinon l'index du quartier en base 36)
const GRID = data.REGION.map(row => [...row].map(c => {
    const k = ZONES.findIndex(z => z.code === c);
    return k < 0 ? '.' : k.toString(36);
}).join(''));

// Panneau d'un quartier : la case constructible la plus proche de son centre, hors des emprises, de préférence au
// bord d'un chemin (à défaut de case constructible : une case de terre ferme, ni eau, ni marais, ni lave, ni glace)
const firm = (x, y) => isLand(x, y) && !'wkxov'.includes(groundAt(x, y));
const ANCHORS = Object.fromEntries(ZONES.map(zone => {
    const cells = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (data.REGION[y][x] === zone.code) cells.push({ x, y });
    if (!cells.length) return [zone.id, null];
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const byPath = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => groundAt(c.x + dx, c.y + dy) === 'p');
    const near = list => list
        .filter(c => !inSite(c.x, c.y))
        .map(c => ({ ...c, d: Math.hypot(c.x - cx, c.y - cy) - (byPath(c) ? 2 : 0) }))
        .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x)[0];
    const best = near(cells.filter(c => buildable(c.x, c.y))) || near(cells.filter(c => firm(c.x, c.y)));
    return [zone.id, best ? { x: best.x, y: best.y } : null];
}));

// Quartiers voisins : une case de l'un touche une case de l'autre, ou un pont sur la mer les relie. { id: [ids] }
const NEIGHBORS = (() => {
    const pairs = new Map(ZONES.map(z => [z.id, new Set()]));
    const link = (a, b) => { if (a && b && a !== b) { pairs.get(a).add(b); pairs.get(b).add(a); } };
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const seen = new Set();
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const here = zoneAt(x, y);
            if (here) DIRS.forEach(([dx, dy]) => link(here, zoneAt(x + dx, y + dy)));
            // Un pont : toutes les cases du pont, et les quartiers qu'il touche à ses deux bouts
            if (groundAt(x, y) !== 'b' || seen.has(y * SIZE + x)) continue;
            const ends = new Set();
            const queue = [[x, y]];
            seen.add(y * SIZE + x);
            for (let i = 0; i < queue.length; i++) {
                const [a, b] = queue[i];
                for (const [dx, dy] of DIRS) {
                    const c = a + dx, d = b + dy;
                    if (groundAt(c, d) === 'b' && !seen.has(d * SIZE + c)) { seen.add(d * SIZE + c); queue.push([c, d]); }
                    const z = zoneAt(c, d);
                    if (z) ends.add(z);
                }
            }
            const list = [...ends];
            list.forEach(a => list.forEach(b => link(a, b)));
        }
    }
    return Object.fromEntries([...pairs].map(([id, set]) => [id, [...set].sort()]));
})();

// Calques vus par un joueur : les quartiers encore inconnus (hidden : lettres de leurs quartiers) gardent leur côte et
// leur relief, qu'on devine sous la brume, mais pas leur sol ('u' : inconnu ; ni climat, ni ce qu'il cache)
function veiled(hidden) {
    if (!hidden.size) return { height: data.HEIGHT, ground: data.GROUND };
    const mask = (layer, fill) => layer.map((row, y) => [...row].map((c, x) => (hidden.has(data.REGION[y][x]) ? fill : c)).join(''));
    return { height: data.HEIGHT, ground: mask(data.GROUND, 'u') };
}

// Cases libres d'un quartier pour y poser des décorations, de la plus proche de son panneau à la plus lointaine
// (ordre stable) : sol constructible, hors emprise des chantiers (selon leurs niveaux)
function freeSpots(zoneId, levels = {}) {
    const code = ZONE_BY_ID[zoneId]?.code;
    const anchor = ANCHORS[zoneId];
    if (!code || !anchor) return [];
    const spots = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (data.REGION[y][x] === code && buildable(x, y) && !inFootprint(x, y, levels)) spots.push({ x, y, d: Math.hypot(x - anchor.x, y - anchor.y) });
        }
    }
    return spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y }));
}

module.exports = {
    SIZE, OFFSET, CLIMATES, SITE_PLACES, SITE_BIG, BIG_FROM, ZONES, ZONE_BY_ID, CORE, GRID, ANCHORS, NEIGHBORS,
    HEIGHT: data.HEIGHT, GROUND: data.GROUND, REGION: data.REGION,
    isLand, buildable, groundAt, heightAt, zoneAt, siteZone, inSite, footprintOf, inFootprint, freeSpots, veiled
};
