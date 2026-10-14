// Les chemins de l'île : ceux de la carte, et ceux que le joueur trace (choix de l'auteur, 8 oct.). Une île neuve
// (créée ou recommencée depuis : une ligne de world_items « ile:sentiers ») ne garde de la carte que le sentier du Feu
// au rivage, les gués et les vieilles marches (les cases de chemin où la hauteur change : sans elles, les habitants ne
// monteraient nulle part) ; le reste redevient de l'herbe. Les autres îles gardent toutes leurs routes. Chacun trace
// les siens, au doigt : une pierre la case, les FREE premières offertes ; une ligne de world_items « chemin:x:y » par
// case (source 'chemin' payée, 'offert' offerte), sans donnée nouvelle. Effacer une case tracée rend sa pierre (pas
// celle d'une case offerte).
const crypto = require('crypto');
const map = require('../worldMap');
const landmarks = require('../landmarks');
const finds = require('../finds');
const { SIZE } = require('./rules');
const { STATIC, inFootprintAt, footprintAt, placesOf, PLAGE } = require('./places');
const T = require('../../texts/paths');

const MARK = 'ile:sentiers';
const PREFIX = 'chemin:';
const FREE = 12;
// Ce qu'un tracé peut faire d'un coup (cases posées, cases effacées)
const MAX_CELLS = 80;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const isPath = g => g === 'p' || g === 'k';

// Le sentier d'une île neuve : de la porte du Feu (sous son emprise) jusqu'au sable de l'épave. Sur une île à la
// plage (world/places.js : le Feu contre l'épave, la cuisine de Marcelle à son ancienne place), il part de la cuisine
// et finit d'une case de plus, devant la porte du Feu (le bas de son emprise : world/places.js, BEACH)
const SENTIER = [89, 90, 91, 92, 93, 94, 95].map(y => ({ x: 95, y }));
const SENTIER_BEACH = [...SENTIER, { x: 96, y: 95 }, { x: 97, y: 95 }, { x: 98, y: 95 }];
const keysOf = cells => new Set(cells.map(c => c.y * SIZE + c.x));
// Les vieilles marches : cases de chemin de la carte à côté d'une autre de hauteur différente
const MARCHES = new Set();
for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
        if (!isPath(map.groundAt(x, y))) continue;
        if (DIRS.some(([dx, dy]) => isPath(map.groundAt(x + dx, y + dy)) && map.heightAt(x + dx, y + dy) !== map.heightAt(x, y))) MARCHES.add(y * SIZE + x);
    }
}
// Le sol d'une case de chemin effacée : celui qui domine autour (herbe, sable, prairie), de l'herbe à défaut
function regrown(x, y) {
    const count = { g: 0, s: 0, m: 0 };
    for (const [dx, dy] of DIRS) {
        const g = map.groundAt(x + dx, y + dy);
        if (g in count) count[g] += 1;
    }
    return ['g', 's', 'm'].reduce((best, g) => (count[g] > count[best] ? g : best), 'g');
}
// Le sol d'une île neuve : la carte, sans ses routes (gués, marches et sentier gardés)
const freshOf = sentier => {
    const keys = keysOf(sentier);
    return map.GROUND.map((row, y) => [...row].map((g, x) => {
        const key = y * SIZE + x;
        if (keys.has(key)) return 'p';
        if (g !== 'p' || MARCHES.has(key)) return g;
        return regrown(x, y);
    }).join(''));
};
const FRESH = freshOf(SENTIER);
const FRESH_BEACH = freshOf(SENTIER_BEACH);

// Les cases tracées d'un joueur : [{ x, y, free }]
async function laidOf(userId, conn) {
    const { rows } = await conn.query('SELECT item, source FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${PREFIX}%`]);
    return rows.map(r => {
        const [x, y] = r.item.slice(PREFIX.length).split(':').map(Number);
        return { x, y, free: r.source === 'offert' };
    }).sort((a, b) => a.y - b.y || a.x - b.x);
}
// L'île part-elle de ses seuls sentiers ?
// { fresh, beach } : l'île part de ses seuls sentiers ; son Feu brûle sur la plage
async function newRoadsOf(userId, conn) {
    const { rows } = await conn.query('SELECT item FROM world_items WHERE user_id = $1 AND item = ANY($2)', [userId, [MARK, PLAGE]]);
    const items = new Set(rows.map(r => r.item));
    return { fresh: items.has(MARK), beach: items.has(MARK) && items.has(PLAGE) };
}
// Le parvis de chaque bâtiment bâti (choix de l'auteur, 14 oct.) : la rangée de terre battue devant sa porte (le bas de
// son emprise, là où le sentier du Feu arrive), sur l'herbe, le sable ou la prairie, hors des emprises, des lieux et des
// gisements. Il compte comme un chemin : un chemin tracé jusqu'à lui relie le bâtiment (linked). Sauf le Feu : son sentier
// arrive déjà à sa porte, et l'enclos du tutoriel y plante deux de ses piquets. places, levels : où sont les bâtiments
// et leurs paliers ; base(x, y) : le sol sans parvis. [{ x, y }]
const NO_PARVIS = new Set(['foyer']);
function parvisOf(places, levels, base) {
    const out = [];
    for (const [id, level] of Object.entries(levels)) {
        if (!level || !places[id] || NO_PARVIS.has(id)) continue;
        const f = footprintAt(places, id, level);
        for (let x = f.x; x < f.x + f.w; x++) {
            const y = f.y + f.h;
            if (!['g', 's', 'm'].includes(base(x, y)) || inFootprintAt(places, x, y, levels) || landmarks.isLandmark(x, y) || finds.isDeposit(x, y)) continue;
            out.push({ x, y });
        }
    }
    return out;
}
// Le sol vu par un joueur (lignes, comme map.GROUND) : la carte (sans ses routes pour une île neuve), plus ses chemins et
// les parvis de ses bâtiments
function groundRows(fresh, laid, beach = false, parvis = []) {
    const rows = (fresh ? (beach ? FRESH_BEACH : FRESH) : map.GROUND).map(row => [...row]);
    for (const c of laid) rows[c.y][c.x] = 'p';
    for (const c of parvis) rows[c.y][c.x] = 'p';
    return rows.map(row => row.join(''));
}
// Les chemins d'un joueur, lus une fois : { fresh, laid, rows, added, ground(x, y), key } (key : ce qui décide du sol)
async function roadsOf(userId, conn) {
    const { fresh, beach } = await newRoadsOf(userId, conn);
    const [laid, { places }, built] = await Promise.all([
        laidOf(userId, conn), placesOf(userId, conn),
        conn.query('SELECT site, level FROM world_buildings WHERE user_id = $1 AND level > 0', [userId])
    ]);
    const levels = Object.fromEntries(built.rows.map(r => [r.site, r.level]));
    const bare = groundRows(fresh, laid, beach);
    const parvis = parvisOf(places, levels, (x, y) => bare[y]?.[x]);
    const rows = groundRows(fresh, laid, beach, parvis);
    const drawn = [...laid, ...parvis];
    const sum = drawn.length ? crypto.createHash('sha1').update(drawn.map(c => `${c.x},${c.y}`).join(';')).digest('hex').slice(0, 10) : '';
    // Les cases de chemin en plus de la carte (le sentier d'une île neuve, les cases tracées, les parvis) : ni annexe ni
    // camp dessus
    const added = new Set();
    for (const c of fresh ? [...(beach ? SENTIER_BEACH : SENTIER), ...drawn] : drawn) if (!isPath(map.groundAt(c.x, c.y))) added.add(c.y * SIZE + c.x);
    return {
        fresh, laid, rows, added,
        ground: (x, y) => (Number.isInteger(x) && Number.isInteger(y) ? rows[y]?.[x] : undefined),
        key: `${fresh ? (beach ? 'b' : 'n') : 'v'}${drawn.length}${sum}`
    };
}

// Deux bâtiments sont-ils reliés par un chemin ? (des cases de chemin qui touchent l'emprise de l'un jusqu'à l'autre).
// ground(x, y) : le sol du joueur ; a, b : emprises { x, y, w, h }
function linked(ground, a, b) {
    if (!a || !b) return false;
    const ring = f => {
        const out = [];
        for (let x = f.x - 1; x <= f.x + f.w; x++) out.push([x, f.y - 1], [x, f.y + f.h]);
        for (let y = f.y; y < f.y + f.h; y++) out.push([f.x - 1, y], [f.x + f.w, y]);
        return out.filter(([x, y]) => isPath(ground(x, y)));
    };
    const goal = new Set(ring(b).map(([x, y]) => y * SIZE + x));
    const seen = new Set();
    const queue = ring(a);
    for (const [x, y] of queue) seen.add(y * SIZE + x);
    for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i];
        if (goal.has(y * SIZE + x)) return true;
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, k = ny * SIZE + nx;
            if (!seen.has(k) && isPath(ground(nx, ny))) { seen.add(k); queue.push([nx, ny]); }
        }
    }
    return false;
}

// Ce qui empêche de tracer un chemin sur (x, y) (texte), ou null. ctx : { ground(x, y), zones (à soi), taken (clés des
// cases prises : annexes, créations posées, camp), laid (clés déjà tracées), places (où sont les bâtiments), levels
// (leurs paliers) }. Un bâtiment ne prend que son emprise du moment (choix de l'auteur, 11 oct. : le chemin touche le
// bâtiment, sans case d'écart) : sa place réservée peut porter un chemin, effacé quand il grandit (world.js, build)
function layBlock(x, y, ctx) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return T.OUTSIDE;
    if (!ctx.zones.has(map.zoneAt(x, y))) return T.OWN_ZONES;
    const g = ctx.ground(x, y);
    if (isPath(g)) return T.ALREADY_PATH;
    if (!['g', 's', 'm'].includes(g)) return T.GROUND;
    if (inFootprintAt(ctx.places || STATIC, x, y, ctx.levels || {}) || landmarks.isLandmark(x, y) || finds.isDeposit(x, y) || ctx.taken.has(y * SIZE + x)) return T.CELL_TAKEN;
    return null;
}

// Trace et efface (lay, erase : [[x, y]]). stock : la réserve du joueur (déjà verrouillée, ce qui attend encaissé) ;
// ctx : layBlock, plus placedNeedingPath ([{ x, y, name }] : créations posées qui doivent rester au bord d'un chemin).
// { add: [{ x, y, free }], remove: [{ x, y }], stone (pierres prises, moins celles rendues) } ou { status, message }
function planOf(lay, erase, laid, stock, ctx) {
    const cells = list => (Array.isArray(list) ? list : []);
    if (cells(lay).length + cells(erase).length === 0) return { status: 400, message: T.NOTHING };
    if (cells(lay).length > MAX_CELLS || cells(erase).length > MAX_CELLS) return { status: 400, message: T.TOO_MANY(MAX_CELLS) };
    const ok = c => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger);
    if (![...cells(lay), ...cells(erase)].every(ok)) return { status: 400, message: T.CELL_INVALID };
    const mine = new Map(laid.map(c => [c.y * SIZE + c.x, c]));
    const remove = [];
    const gone = new Set();
    for (const [x, y] of cells(erase)) {
        const k = y * SIZE + x;
        if (gone.has(k)) continue;
        if (!mine.has(k)) return { status: 400, message: T.ONLY_YOURS };
        gone.add(k);
        remove.push(mine.get(k));
    }
    // Le sol après l'effacement : une case effacée redevient le sol d'en dessous
    const under = (x, y) => (gone.has(y * SIZE + x) ? (ctx.fresh ? FRESH : map.GROUND)[y][x] : ctx.ground(x, y));
    const seen = new Set();
    const add = [];
    for (const [x, y] of cells(lay)) {
        const k = y * SIZE + x;
        if (seen.has(k)) continue;
        seen.add(k);
        const block = layBlock(x, y, { ...ctx, ground: under });
        if (block) return { status: 400, message: block };
        add.push({ x, y });
    }
    // Une création qui doit rester au bord d'un chemin le garde
    const after = (x, y) => (seen.has(y * SIZE + x) ? 'p' : under(x, y));
    const stranded = (ctx.placedNeedingPath || []).find(c => !DIRS.some(([dx, dy]) => isPath(after(c.x + dx, c.y + dy))));
    if (stranded) return { status: 409, message: T.LEANS_ON(stranded.name) };
    const offered = Math.max(0, FREE - laid.filter(c => c.free && !gone.has(c.y * SIZE + c.x)).length);
    add.forEach((c, i) => { c.free = i < offered; });
    const pay = add.filter(c => !c.free).length;
    const back = remove.filter(c => !c.free).length;
    if (pay > stock.stone + back) return { status: 409, message: T.STONE_COST(pay, stock.stone) };
    return { add, remove, stone: pay - back };
}

module.exports = { MARK, PREFIX, FREE, MAX_CELLS, SENTIER, MARCHES, FRESH, isPath, laidOf, newRoadsOf, parvisOf, groundRows, roadsOf, linked, layBlock, planOf };
