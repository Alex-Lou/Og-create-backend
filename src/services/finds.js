// Trouvailles de climat (lot 9d) : six ressources propres aux climats des terres nouvelles (glace, laine, roseau, sel,
// fruits, obsidienne), gardées dans une réserve à part. Elles se ramassent sur les gisements des quartiers de climat :
// trois par quartier, à des cases fixes, choisies une fois pour toutes sur le sol qui leur va. Un toucher en rend
// quelques-unes, puis le gisement repousse. Fonctions pures.
const map = require('./worldMap');
const landmarks = require('./landmarks');

// grounds : sols où pousse son gisement
const FINDS = [
    { id: 'glace', name: 'Glace', climate: 'cimes', grounds: 'n' },
    { id: 'laine', name: 'Laine', climate: 'landes', grounds: 'l' },
    { id: 'roseau', name: 'Roseau', climate: 'marais', grounds: 'x' },
    { id: 'sel', name: 'Sel', climate: 'dunes', grounds: 's' },
    { id: 'fruits', name: 'Fruits', climate: 'jungle', grounds: 'j' },
    { id: 'obsidienne', name: 'Obsidienne', climate: 'volcan', grounds: 'ar' }
];
const FIND_BY_ID = Object.fromEntries(FINDS.map(f => [f.id, f]));
const FIND_BY_CLIMATE = Object.fromEntries(FINDS.map(f => [f.climate, f]));

const PER_ZONE = 3;
const REGROW_MS = 6 * 3600 * 1000; // un gisement ramassé repousse en 6 h
const GATHER = { min: 2, max: 4 }; // trouvailles rendues par un ramassage
const SPREAD = 4; // écart minimal (en cases, en tous sens) entre deux gisements, et avec un lieu remarquable

// Ordre fixe et bien mêlé des cases (pour le choix des gisements)
const scramble = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000003;
const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Gisements d'un quartier de climat : PER_ZONE cases de son sol, écartées les unes des autres et des lieux, hors du
// panneau du quartier
function pickFor(zone, find) {
    const anchor = map.ANCHORS[zone.id];
    const places = landmarks.LANDMARKS.filter(l => l.zone === zone.id);
    const cells = [];
    for (let y = 0; y < map.SIZE; y++) {
        for (let x = 0; x < map.SIZE; x++) {
            if (map.zoneAt(x, y) !== zone.id || !find.grounds.includes(map.groundAt(x, y))) continue;
            if (anchor && anchor.x === x && anchor.y === y) continue;
            if (places.some(l => gap(l, { x, y }) < SPREAD)) continue;
            cells.push({ x, y });
        }
    }
    cells.sort((a, b) => scramble(a.x, a.y) - scramble(b.x, b.y));
    const chosen = [];
    for (const cell of cells) {
        if (chosen.length === PER_ZONE) break;
        if (chosen.every(c => gap(c, cell) >= SPREAD)) chosen.push(cell);
    }
    return chosen.map((c, k) => ({ id: `${zone.id}-${k + 1}`, zone: zone.id, find: find.id, x: c.x, y: c.y }));
}
const DEPOSITS = map.ZONES.filter(z => FIND_BY_CLIMATE[z.climate]).flatMap(z => pickFor(z, FIND_BY_CLIMATE[z.climate]));
const DEPOSIT_BY_ID = Object.fromEntries(DEPOSITS.map(d => [d.id, d]));
const CELLS = new Set(DEPOSITS.map(d => d.y * map.SIZE + d.x));
const isDeposit = (x, y) => CELLS.has(y * map.SIZE + x);

// Temps avant qu'un gisement ramassé à gatheredAt (date ou null) soit de nouveau prêt (ms, 0 : prêt)
const readyIn = (gatheredAt, now = Date.now()) => (gatheredAt ? Math.max(0, new Date(gatheredAt).getTime() + REGROW_MS - now) : 0);

module.exports = { FINDS, FIND_BY_ID, DEPOSITS, DEPOSIT_BY_ID, PER_ZONE, REGROW_MS, GATHER, SPREAD, isDeposit, readyIn };
