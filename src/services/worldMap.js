// La carte de l'île, la même pour tous : une côte organique sur une grille de 20 × 20, un cœur ouvert d'office
// et six quartiers à acheter autour (écus + chapitre du Livre). Fonctions pures, sans base de données.

const SIZE = 20;
// L'ancienne île (14 × 14) est recentrée sur la nouvelle carte : tout ce qui y était posé glisse de 3 cases
const OFFSET = 3;
const CENTER = 10; // centre du Foyer (coin commun de ses 4 cases)

// Chantiers : place de leur emprise (2 × 2 cases), celle de l'ancienne île décalée de OFFSET
const SITE_PLACES = {
    foyer: { x: 9, y: 9 },
    carriere: { x: 9, y: 5 },
    bosquet: { x: 5, y: 6 },
    puits: { x: 9, y: 13 },
    potager: { x: 5, y: 12 },
    atelier: { x: 13, y: 9 },
    ponton: { x: 15, y: 14 }
};

// Emprise agrandie (3 × 3 cases) à partir du palier BIG_FROM : coin haut-gauche choisi pour rester sur la terre,
// dans le quartier du bâtiment, sans toucher l'emprise d'un autre
const BIG_FROM = 4;
const SITE_BIG = {
    foyer: { x: 9, y: 9 },
    carriere: { x: 8, y: 4 },
    bosquet: { x: 4, y: 5 },
    puits: { x: 9, y: 13 },
    potager: { x: 4, y: 12 },
    atelier: { x: 13, y: 8 },
    ponton: { x: 14, y: 13 }
};
// Emprise d'un chantier à un niveau donné : { x, y, w, h }
function footprintOf(id, level = 0) {
    if (level >= BIG_FROM) return { ...SITE_BIG[id], w: 3, h: 3 };
    return { ...SITE_PLACES[id], w: 2, h: 2 };
}
// Case couverte par un chantier, selon les niveaux du joueur ({ site: niveau })
function inFootprint(x, y, levels = {}) {
    return Object.keys(SITE_PLACES).some(id => {
        const f = footprintOf(id, levels[id] || 0);
        return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h;
    });
}

// Quartiers : prix en écus, chapitre du Livre qui doit être ouvert, secteur d'angle autour du centre (degrés)
const ZONES = [
    { id: 'coeur', name: 'Le Cœur', price: 0, chapter: null },
    { id: 'source', name: 'La Source', price: 100, chapter: 'I', from: 65, to: 120 },
    { id: 'lisiere', name: 'La Lisière', price: 150, chapter: 'I', from: -165, to: -115 },
    { id: 'colline', name: 'La Colline', price: 250, chapter: 'II', from: -115, to: -60 },
    { id: 'jardins', name: 'Les Jardins', price: 400, chapter: 'III', from: 120, to: 195 },
    { id: 'est', name: 'La Côte est', price: 600, chapter: 'III', from: -60, to: 15 },
    { id: 'crique', name: 'La Crique', price: 900, chapter: 'IV', from: 15, to: 65 }
];
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));

const inSite = (x, y) => Object.values(SITE_PLACES).some(p => x >= p.x && x < p.x + 2 && y >= p.y && y < p.y + 2);
const inCore = (x, y) => Math.max(Math.abs(x + 0.5 - CENTER), Math.abs(y + 0.5 - CENTER)) <= 3;

// Rayon de la côte selon l'angle : anses et pointes (somme de sinusoïdes, fixe)
function coastRadius(angle) {
    return 8.2 + 0.9 * Math.sin(3 * angle + 0.6) + 0.5 * Math.sin(5 * angle + 1.9) + 0.3 * Math.sin(7 * angle + 0.3);
}

// Terre brute : dans la côte (bord de grille exclu), et toujours sous un chantier ou dans le cœur
function rawLand(x, y) {
    if (x < 1 || y < 1 || x > SIZE - 2 || y > SIZE - 2) return false;
    if (inSite(x, y) || inCore(x, y)) return true;
    const dx = x + 0.5 - CENTER;
    const dy = y + 0.5 - CENTER;
    return Math.hypot(dx, dy) <= coastRadius(Math.atan2(dy, dx));
}
// Côte lissée : une case de terre presque isolée (moins de 2 voisines) retourne à la mer, sauf chantier et cœur
const LAND = (() => {
    let mask = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => rawLand(x, y)));
    for (let pass = 0; pass < 2; pass++) {
        mask = mask.map((row, y) => row.map((land, x) => {
            if (!land || inSite(x, y) || inCore(x, y)) return land;
            const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => mask[y + dy]?.[x + dx]).length;
            return around >= 2;
        }));
    }
    return mask;
})();
const isLand = (x, y) => Boolean(LAND[y]?.[x]);

// Quartier d'une case de terre (null en mer)
function zoneAt(x, y) {
    if (!isLand(x, y)) return null;
    if (inCore(x, y)) return 'coeur';
    let angle = (Math.atan2(y + 0.5 - CENTER, x + 0.5 - CENTER) * 180) / Math.PI;
    if (angle < -165) angle += 360;
    const zone = ZONES.find(z => z.from !== undefined && angle >= z.from && angle < z.to);
    return zone ? zone.id : null;
}

// Grille calculée une fois : un caractère par case ('.' mer, sinon l'index du quartier)
const GRID = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    const zone = zoneAt(x, y);
    return zone ? String(ZONES.findIndex(z => z.id === zone)) : '.';
}).join(''));

const siteZone = id => zoneAt(SITE_PLACES[id].x, SITE_PLACES[id].y);

// Point d'ancrage d'un quartier (moyenne de ses cases) : son panneau s'y dresse
const ANCHORS = Object.fromEntries(ZONES.map((zone, k) => {
    let sx = 0, sy = 0, n = 0;
    GRID.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === String(k)) { sx += x; sy += y; n++; }
    }));
    return [zone.id, n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : null];
}));

module.exports = { SIZE, OFFSET, CENTER, SITE_PLACES, SITE_BIG, BIG_FROM, ZONES, ZONE_BY_ID, GRID, ANCHORS, isLand, zoneAt, siteZone, inSite, footprintOf, inFootprint };
