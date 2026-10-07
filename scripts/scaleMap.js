// Génère la carte v5 (src/services/islandV5.js) : la carte v4 (worldMapV4.js, 96 × 96) à l'échelle × 1,5 (144 × 144).
// Lancé une fois (décision de l'auteur, 7 oct. 2026 : « tout à plus grande échelle », × 1,5 de côté) ; la carte v5 est
// ensuite figée comme les précédentes. Usage : node scripts/scaleMap.js
//
// - Chaque case v5 (X, Y) reprend la case v4 (⌊2X/3⌋, ⌊2Y/3⌋) : formes, quartiers, ponts, chemins et rivières gardent
//   leurs liens (une case v4 devient un bloc de 2 ou 1 cases de côté, en alternance).
// - Lissage des côtes, en gagnant seulement sur la mer : une case de mer dont deux voisines en équerre et la diagonale
//   entre elles sont de la même terre (herbe, sable, prairie, même quartier) devient cette terre. Jamais au prix d'un
//   nouveau voisinage entre quartiers.
// - Bâtiments : leur emprise 3 × 3 reste de 3 × 3, dans l'agrandissement de l'ancienne, mêmes contacts (voir SITES).
// - Une position de joueur (annexe, création) v4 x devient round(1,5 x + 0,25) (world/migrate.js, toV5) : la case v5
//   qui reprend la case v4, sans collision.
const fs = require('fs');
const path = require('path');
const v4 = require('../src/services/worldMapV4');

const N = v4.SIZE;
const M = (N * 3) / 2;
const src = X => Math.floor((2 * X) / 3);
const up = layer => Array.from({ length: M }, (_, Y) => Array.from({ length: M }, (_, X) => layer[src(Y)][src(X)]));

const H = up(v4.HEIGHT), G = up(v4.GROUND), R = up(v4.REGION);
const sea = (x, y) => x < 0 || y < 0 || x >= M || y >= M || G[y][x] === '~';
const zoneOf = (x, y) => (x < 0 || y < 0 || x >= M || y >= M ? null : R[y][x]);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// (décidé sur la carte agrandie telle quelle, puis appliqué : une case lissée n'en entraîne pas d'autres)
const changes = [];
for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
        if (!sea(x, y)) continue;
        for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = [x + dx, y], b = [x, y + dy], c = [x + dx, y + dy];
            if ([a, b, c].some(([u, v]) => sea(u, v))) continue;
            const g = G[a[1]][a[0]], r = R[a[1]][a[0]];
            if (!'sgm'.includes(g) || G[b[1]][b[0]] !== g || R[b[1]][b[0]] !== r || R[c[1]][c[0]] !== r) continue;
            // Pas de nouveau voisinage : les terres autour de la case sont toutes de ce quartier (ou la mer)
            if (DIRS.some(([u, v]) => { const z = zoneOf(x + u, y + v); return z && z !== '.' && z !== r; })) continue;
            changes.push({ x, y, g, r, h: String(Math.min(Number(H[a[1]][a[0]]), Number(H[b[1]][b[0]]))) });
            break;
        }
    }
}

for (const { x, y, g, r, h } of changes) {
    G[y][x] = g;
    R[y][x] = r;
    H[y][x] = h;
}
const smoothed = changes.length;

// Bâtiments : leur emprise 3 × 3 reste de 3 × 3, posée dans l'agrandissement de l'ancienne (sur sol plat, constructible,
// d'un seul quartier), là où elle retrouve les mêmes contacts qu'en v4 : sa petite emprise (2 × 2, au coin avant) et sa
// grande au bord d'un chemin, et de chaque côté la mer ou un relief plus haut (la falaise de la Mine, la mer du
// Ponton). À égalité, au plus près du centre.
const groundAt = (L, x, y) => L[y]?.[x];
const heightOf = (L, x, y) => { const c = L[y]?.[x]; return c === undefined || c === ' ' ? -1 : Number(c); };
const layersV5 = { G: G.map(r => r.join('')), H: H.map(r => r.join('')), R: R.map(r => r.join('')) };
const layersV4 = { G: v4.GROUND, H: v4.HEIGHT, R: v4.REGION };
// Ce qui touche un rectangle (sans les coins) : chemin ; par côté (haut, bas, gauche, droite) : mer, relief plus haut
function contacts(L, f) {
    const h = heightOf(L.H, f.x, f.y);
    const sides = {
        haut: Array.from({ length: f.w }, (_, i) => [f.x + i, f.y - 1]), bas: Array.from({ length: f.w }, (_, i) => [f.x + i, f.y + f.h]),
        gauche: Array.from({ length: f.h }, (_, i) => [f.x - 1, f.y + i]), droite: Array.from({ length: f.h }, (_, i) => [f.x + f.w, f.y + i])
    };
    const all = Object.values(sides).flat();
    return {
        path: all.some(([x, y]) => groundAt(L.G, x, y) === 'p'),
        ...Object.fromEntries(Object.entries(sides).flatMap(([side, cells]) => [
            [`mer-${side}`, cells.some(([x, y]) => groundAt(L.G, x, y) === '~')],
            [`haut-${side}`, cells.some(([x, y]) => heightOf(L.H, x, y) > h)]
        ]))
    };
}
const fits = (x, y) => {
    const cells = Array.from({ length: 9 }, (_, i) => [x + (i % 3), y + Math.floor(i / 3)]);
    return cells.every(([a, b]) => 'gsm'.includes(groundAt(layersV5.G, a, b))) && new Set(cells.map(([a, b]) => layersV5.H[b][a])).size === 1
        && new Set(cells.map(([a, b]) => layersV5.R[b][a])).size === 1;
};
const span = v => [Math.ceil((3 * v) / 2), Math.floor((3 * (v + 3) - 1) / 2) - 2];
const SITES = Object.fromEntries(Object.entries(v4.SITE_BIG).map(([id, p]) => {
    const want = { small: contacts(layersV4, { x: p.x + 1, y: p.y + 1, w: 2, h: 2 }), big: contacts(layersV4, { ...p, w: 3, h: 3 }) };
    const [x0, x1] = span(p.x), [y0, y1] = span(p.y);
    const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    let best = null;
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (!fits(x, y)) continue;
            const got = { small: contacts(layersV5, { x: x + 1, y: y + 1, w: 2, h: 2 }), big: contacts(layersV5, { x, y, w: 3, h: 3 }) };
            // Les contacts de relief et de mer d'abord (le chemin se raccorde ensuite, voir plus bas)
            const score = ['small', 'big'].reduce((n, k) => n + Object.keys(want[k]).filter(c => c !== 'path' && want[k][c] === got[k][c]).length, 0);
            const d = Math.hypot(x - center.x, y - center.y);
            if (!best || score > best.score || (score === best.score && d < best.d)) best = { x, y, score, d };
        }
    }
    if (!best) throw new Error(`Pas de place pour ${id}`);
    return [id, { x: best.x, y: best.y }];
}));

// Chaque bâtiment au bout d'un chemin, comme en v4 : si sa petite emprise n'en touche plus, un court chemin la relie au
// plus proche (herbe, sable ou prairie de son quartier, hors des emprises ; 6 cases au plus). Seulement sur des cases
// qu'aucune position v4 ne reprend (colonne ou ligne 3k + 1) : aucune annexe ni création de joueur n'y arrive
const free = (x, y) => x % 3 === 1 || y % 3 === 1;
const inBig = (x, y) => Object.values(SITES).some(p => x >= p.x && x < p.x + 3 && y >= p.y && y < p.y + 3);
let stubs = 0;
for (const [id, p] of Object.entries(SITES)) {
    const small = { x: p.x + 1, y: p.y + 1, w: 2, h: 2 };
    const L = { G: G.map(r => r.join('')), H: layersV5.H };
    if (contacts(L, small).path) continue;
    const zone = R[p.y][p.x];
    const start = [];
    for (let i = 0; i < 2; i++) start.push([small.x + i, small.y - 1], [small.x + i, small.y + 2], [small.x - 1, small.y + i], [small.x + 2, small.y + i]);
    const from = new Map();
    const queue = start.filter(([x, y]) => free(x, y) && !inBig(x, y) && 'gsm'.includes(G[y]?.[x]) && R[y][x] === zone).map(c => [...c, 1]);
    queue.forEach(([x, y]) => from.set(y * M + x, null));
    let end = null;
    for (let i = 0; i < queue.length && !end; i++) {
        const [x, y, n] = queue[i];
        for (const [dx, dy] of DIRS) {
            const a = x + dx, b = y + dy;
            if (G[b]?.[a] === 'p') { end = [x, y]; break; }
            if (n >= 6 || from.has(b * M + a) || !free(a, b) || inBig(a, b) || !'gsm'.includes(G[b]?.[a]) || R[b][a] !== zone) continue;
            from.set(b * M + a, [x, y]);
            queue.push([a, b, n + 1]);
        }
    }
    if (!end) throw new Error(`Pas de chemin pour ${id}`);
    for (let c = end; c; c = from.get(c[1] * M + c[0])) { G[c[1]][c[0]] = 'p'; stubs++; }
}

const rows = layer => layer.map(r => `    '${r.join('')}'`).join(',\n');
const out = `// La carte v5 (144 × 144, la grande carte), figée : générée une fois par scripts/scaleMap.js depuis la carte v4
// (worldMapV4.js) à l'échelle × 1,5, côtes lissées. Ne plus la modifier à la main. Mêmes calques que la v4, d'une lettre
// par case (légende : islandData.js et islandOuter.js) ; SITES : coin haut-gauche de l'emprise 3 × 3 de chaque bâtiment.

const HEIGHT = [
${rows(H)}
];

const GROUND = [
${rows(G)}
];

const REGION = [
${rows(R)}
];

const SITES = ${JSON.stringify(SITES).replace(/"/g, '').replace(/,(\w)/g, ', $1').replace(/:/g, ': ').replace(/{/g, '{ ').replace(/}/g, ' }')};

module.exports = { HEIGHT, GROUND, REGION, SITES };
`;
fs.writeFileSync(path.join(__dirname, '../src/services/islandV5.js'), out);
console.log(`carte v5 : ${M} × ${M}, ${smoothed} cases de côte lissées, ${stubs} cases de chemin raccordées`);
