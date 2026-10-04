// La carte de l'île, la même pour tous : la grande île (48 × 48), dessinée case par case (islandData.js) — relief,
// sol et quartiers. La Grève est ouverte d'office ; onze quartiers s'achètent (écus + chapitre du Livre).
// Fonctions pures, sans base de données.
const data = require('./islandData');

const SIZE = 48;

// Quartiers : prix en écus, chapitre du Livre qui doit être ouvert, lettre du calque REGION. Les sept premiers
// reprennent ceux de l'ancienne carte (mêmes identifiants : les achats des joueurs restent valables)
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
    { id: 'phare', name: 'L’Îlot du Phare', price: 2800, chapter: 'VI', code: 'k' },
    { id: 'legendes', name: 'L’Île des Légendes', price: 4500, chapter: 'VII', code: 'l' }
];
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
const ZONE_BY_CODE = Object.fromEntries(ZONES.map(z => [z.code, z.id]));

const cell = (layer, x, y) => (Number.isInteger(x) && Number.isInteger(y) ? layer[y]?.[x] : undefined);
// Sol de la case (voir islandData.js), undefined hors carte
const groundAt = (x, y) => cell(data.GROUND, x, y);
// Relief de la case (0 à 3), -1 en mer
const heightAt = (x, y) => {
    const c = cell(data.HEIGHT, x, y);
    return c === undefined || c === ' ' ? -1 : Number(c);
};
// Terre de l'île (chemins et ponts sur la rivière compris ; ni la mer ni le pont de l'îlot du Phare)
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
// bord d'un chemin
const ANCHORS = Object.fromEntries(ZONES.map(zone => {
    const cells = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (data.REGION[y][x] === zone.code) cells.push({ x, y });
    if (!cells.length) return [zone.id, null];
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const byPath = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => groundAt(c.x + dx, c.y + dy) === 'p');
    const best = cells
        .filter(c => buildable(c.x, c.y) && !inSite(c.x, c.y))
        .map(c => ({ ...c, d: Math.hypot(c.x - cx, c.y - cy) - (byPath(c) ? 2 : 0) }))
        .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x)[0];
    return [zone.id, best ? { x: best.x, y: best.y } : null];
}));

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
    SIZE, SITE_PLACES, SITE_BIG, BIG_FROM, ZONES, ZONE_BY_ID, GRID, ANCHORS,
    HEIGHT: data.HEIGHT, GROUND: data.GROUND, REGION: data.REGION,
    isLand, buildable, groundAt, heightAt, zoneAt, siteZone, inSite, footprintOf, inFootprint, freeSpots
};
