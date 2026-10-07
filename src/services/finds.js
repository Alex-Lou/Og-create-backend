// Trouvailles de climat (lot 9d) : six ressources propres aux climats des terres nouvelles (glace, laine, roseau, sel,
// fruits, obsidienne), gardées dans une réserve à part. Elles se ramassent sur les gisements des quartiers de climat :
// trois par quartier, à des cases fixes, choisies une fois pour toutes sur le sol qui leur va. Un toucher en rend
// quelques-unes, puis le gisement repousse. Fonctions pures.
const map = require('./worldMap');

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

const PER_ZONE = 3;
const REGROW_MS = 6 * 3600 * 1000; // un gisement ramassé repousse en 6 h
const GATHER = { min: 2, max: 4 }; // trouvailles rendues par un ramassage
const SPREAD = 4; // écart minimal (en cases v4, en tous sens) entre deux gisements, et avec un lieu remarquable (6 en v5)
const CRAFT_BONUS_MAX = 3; // trouvailles de plus par ramassage, au plus, grâce aux créations de climat du quartier

// Gisements : trois par quartier de climat, à des cases fixes (choisies une fois pour toutes sur la carte v4, au sol qui
// leur va, écartés d'au moins SPREAD cases les uns des autres et des lieux, hors du panneau), passées à la carte v5
// (× 1,5 : worldMap.fromV4). Leurs identifiants restent ceux des ramassages des joueurs (world_deposits)
const DEPOSITS = [
    ['menhirs-1', 'laine', 23, 23], ['menhirs-2', 'laine', 45, 45], ['menhirs-3', 'laine', 24, 47],
    ['roselieres-1', 'roseau', 29, 93], ['roselieres-2', 'roseau', 41, 93], ['roselieres-3', 'roseau', 36, 78],
    ['falaises-1', 'laine', 32, 9], ['falaises-2', 'laine', 14, 21], ['falaises-3', 'laine', 30, 21],
    ['bayou-1', 'roseau', 24, 78], ['bayou-2', 'roseau', 23, 57], ['bayou-3', 'roseau', 3, 62],
    ['contreforts-1', 'glace', 66, 26], ['contreforts-2', 'glace', 107, 24], ['contreforts-3', 'glace', 99, 24],
    ['oasis-1', 'sel', 12, 122], ['oasis-2', 'sel', 17, 102], ['oasis-3', 'sel', 45, 114],
    ['neiges-1', 'glace', 80, 9], ['neiges-2', 'glace', 92, 8], ['neiges-3', 'glace', 65, 18],
    ['dunes-1', 'sel', 51, 140], ['dunes-2', 'sel', 8, 125], ['dunes-3', 'sel', 36, 125],
    ['canopee-1', 'fruits', 69, 134], ['canopee-2', 'fruits', 59, 117], ['canopee-3', 'fruits', 72, 119],
    ['cascade-1', 'fruits', 77, 126], ['cascade-2', 'fruits', 84, 134], ['cascade-3', 'fruits', 95, 137],
    ['coulees-1', 'obsidienne', 132, 131], ['coulees-2', 'obsidienne', 138, 134], ['coulees-3', 'obsidienne', 126, 134],
    ['cratere-1', 'obsidienne', 134, 119], ['cratere-2', 'obsidienne', 128, 111], ['cratere-3', 'obsidienne', 120, 119]
].map(([id, find, x, y]) => ({ id, zone: id.replace(/-\d+$/, ''), find, x, y }));
const DEPOSIT_BY_ID = Object.fromEntries(DEPOSITS.map(d => [d.id, d]));
const CELLS = new Set(DEPOSITS.map(d => d.y * map.SIZE + d.x));
const isDeposit = (x, y) => CELLS.has(y * map.SIZE + x);

// Temps avant qu'un gisement ramassé à gatheredAt (date ou null) soit de nouveau prêt (ms, 0 : prêt)
const readyIn = (gatheredAt, now = Date.now(), regrowMs = REGROW_MS) => (gatheredAt ? Math.max(0, new Date(gatheredAt).getTime() + regrowMs - now) : 0);

module.exports = { FINDS, FIND_BY_ID, DEPOSITS, DEPOSIT_BY_ID, PER_ZONE, REGROW_MS, GATHER, SPREAD, CRAFT_BONUS_MAX, isDeposit, readyIn };
