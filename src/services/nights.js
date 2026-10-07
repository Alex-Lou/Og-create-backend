// Les nuits de créatures (HISTOIRE.md du dépôt front, § 6.15, v6 ; décisions du 6 octobre 2026) : règles pures, sans
// base. Chaque nuit (21 h à 6 h, heure de Paris), des égarés sortent de la brume voisine, au bord de l'île à soi, et
// marchent vers le bâtiment le plus proche :
// - une lumière (le feu du Foyer, une lanterne, un brasero) change en luciole celui qui passe à 2 cases ou moins ;
// - une clôture ou un muret barre sa case ;
// - un camarade content repousse celui qui vise son bâtiment, une fois par nuit ;
// - un toucher du joueur en repousse un.
// Au plus une panne par nuit (le premier égaré arrivé embrume son bâtiment). Tout se tire d'une graine (le joueur, la
// nuit) : le serveur seul décide, le front montre.
const crypto = require('node:crypto');
const map = require('./worldMap');

const START_HOUR = 21;
const END_HOUR = 6;
const LIGHT_REACH = 3;
const LIGHTS = new Set(['lanterne', 'brasero']);
const FENCES = new Set(['cloture', 'muret']);
// Un égaré marche une case toutes les 2 minutes (3 avant la grande carte : les chemins y sont 1,5 fois plus longs)
const MS_PER_CELL = 2 * 60 * 1000;
// Une nuit à la fois : de 2 égarés (avant l'acte I fini) à 6
const countOf = acts => Math.min(6, 2 + Math.floor(acts / 2));

// Heure de Paris → instant : midi d'un jour 'AAAA-MM-JJ' + heures (changements d'heure compris)
const PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function wallOf(ms) {
    const p = Object.fromEntries(PARIS.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}
function parisAt(day, hour) {
    const [y, m, d] = day.split('-').map(Number);
    const wall = Date.UTC(y, m - 1, d, hour);
    const first = wall - (wallOf(wall) - wall);
    return wall - (wallOf(first) - first);
}
const dayOf = ms => new Date(wallOf(ms)).toISOString().slice(0, 10);
const nextDay = day => new Date(Date.parse(`${day}T12:00:00Z`) + 24 * 3600 * 1000).toISOString().slice(0, 10);
const previousDay = day => new Date(Date.parse(`${day}T12:00:00Z`) - 24 * 3600 * 1000).toISOString().slice(0, 10);

// Une nuit se nomme par le jour où elle commence : { start, end } (instants)
const boundsOf = night => ({ start: parisAt(night, START_HOUR), end: parisAt(nextDay(night), END_HOUR) });
// La nuit en cours à un instant, ou null (le jour)
function nightAt(ms) {
    const hour = new Date(wallOf(ms)).getUTCHours();
    if (hour >= START_HOUR) return dayOf(ms);
    if (hour < END_HOUR) return previousDay(dayOf(ms));
    return null;
}
// La nuit en cours, ou la prochaine (le soir, on voit déjà par où ils viendront)
const nightNear = ms => nightAt(ms) || (new Date(wallOf(ms)).getUTCHours() < START_HOUR ? dayOf(ms) : nextDay(dayOf(ms)));
// Les nuits finies dans ]from, to], dans l'ordre (14 au plus : au-delà, rien ne change, un seul bâtiment s'embrume)
function endedBetween(from, to) {
    const out = [];
    for (let night = previousDay(dayOf(to)); out.length < 14; night = previousDay(night)) {
        const { end } = boundsOf(night);
        if (end <= from) break;
        if (end <= to) out.unshift(night);
    }
    return out;
}

// Graine : octets tirés du joueur et de la nuit, puis des nombres dans [0, 1)
function randomOf(...parts) {
    let counter = 0;
    let pool = [];
    return () => {
        if (pool.length < 4) pool = [...crypto.createHash('sha256').update([...parts, counter++].join(':')).digest()];
        return pool.splice(0, 4).reduce((v, b) => v * 256 + b, 0) / 2 ** 32;
    };
}

const key = c => c.y * map.SIZE + c.x;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Le bord de la brume : les cases de terre à soi qui touchent une case de terre pas encore à soi (owned : Set des
// quartiers). Ordre stable
function borderOf(owned) {
    const out = [];
    for (let y = 0; y < map.SIZE; y++) {
        for (let x = 0; x < map.SIZE; x++) {
            if (!map.isLand(x, y) || !owned.has(map.zoneAt(x, y))) continue;
            if (DIRS.some(([dx, dy]) => map.isLand(x + dx, y + dy) && map.zoneAt(x + dx, y + dy) && !owned.has(map.zoneAt(x + dx, y + dy)))) out.push({ x, y });
        }
    }
    return out;
}
// Les cases d'un trait de a à b (Bresenham), a et b compris
function lineOf(a, b) {
    const out = [];
    let { x, y } = a;
    const dx = Math.abs(b.x - x);
    const dy = -Math.abs(b.y - y);
    const sx = x < b.x ? 1 : -1;
    const sy = y < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        out.push({ x, y });
        if (x === b.x && y === b.y) return out;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
}
// Les cases d'un bâtiment (son emprise, selon son palier)
function cellsOf(site, level) {
    const f = map.footprintOf(site, level);
    const out = [];
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) out.push({ x, y });
    return out;
}
const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Les égarés d'une nuit. island = { owned (Set des quartiers à soi), sites ([{ id, level }] : bâtiments bâtis),
// acts (actes finis) }. [{ id, site, path: [{ x, y }], at (instant d'apparition), arrives (instant d'arrivée) }]
function planOf(userId, night, island) {
    const sites = island.sites.map(s => ({ id: s.id, cells: cellsOf(s.id, s.level) }));
    const border = borderOf(island.owned);
    if (!sites.length || !border.length) return [];
    const random = randomOf('nuit', userId, night);
    const { start, end } = boundsOf(night);
    const count = countOf(island.acts);
    return Array.from({ length: count }, (_, k) => {
        const from = border[Math.floor(random() * border.length)];
        // Le bâtiment le plus proche, et sa case la plus proche
        const goal = sites.map(s => {
            const cell = s.cells.reduce((best, c) => (distance(c, from) < distance(best, from) ? c : best));
            return { id: s.id, cell, d: distance(cell, from) };
        }).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))[0];
        const path = lineOf(from, goal.cell);
        // Ils sortent l'un après l'autre, dans la première moitié de la nuit
        const at = Math.round(start + ((k + random()) / count) * (end - start) / 2);
        return { id: `${night}:${k}`, site: goal.id, path, at, arrives: at + (path.length - 1) * MS_PER_CELL };
    });
}

// Les défenses de l'île : lumières (le feu du Foyer, lanternes, braseros) et barrières (clôtures, murets).
// crafts : [{ craft, x, y }] posées ; levels : { site: palier }
function defenseOf(crafts, levels) {
    const lights = crafts.filter(c => LIGHTS.has(c.craft)).map(c => ({ x: c.x, y: c.y }));
    if (levels.foyer) lights.push(...cellsOf('foyer', levels.foyer));
    return { lights, fences: new Set(crafts.filter(c => FENCES.has(c.craft)).map(key)) };
}
// Le sort d'un égaré sur son chemin : { end: 'luciole' | 'barre' | 'arrive', step } (step : la case où il s'arrête)
function fateOf(creature, defense) {
    for (const [step, cell] of creature.path.entries()) {
        if (defense.lights.some(light => distance(light, cell) <= LIGHT_REACH)) return { end: 'luciole', step };
        if (defense.fences.has(key(cell))) return { end: 'barre', step };
    }
    return { end: 'arrive', step: creature.path.length - 1 };
}
// L'issue d'une nuit : le sort de chacun, et la panne (le premier arrivé embrume son bâtiment), ou null.
// helpers : Set des bâtiments dont le camarade est content (il repousse un égaré, une fois) ; repelled : Set des égarés
// repoussés d'un toucher. { fates: { id: { end, step } }, panne: { site, at } | null }
function outcomeOf(plan, defense, helpers = new Set(), repelled = new Set()) {
    const helping = new Set(helpers);
    const fates = {};
    let panne = null;
    for (const creature of [...plan].sort((a, b) => a.arrives - b.arrives || (a.id < b.id ? -1 : 1))) {
        if (repelled.has(creature.id)) {
            fates[creature.id] = { end: 'touche', step: null };
            continue;
        }
        const fate = fateOf(creature, defense);
        if (fate.end === 'arrive' && helping.has(creature.site)) {
            helping.delete(creature.site);
            fates[creature.id] = { end: 'camarade', step: fate.step };
            continue;
        }
        fates[creature.id] = fate;
        if (fate.end === 'arrive' && !panne) panne = { site: creature.site, at: creature.arrives };
    }
    return { fates, panne };
}

// Anya, le jour de son passage (services/anya.js, slotOn), guérit le bâtiment embrumé : l'heure de Paris où elle est
// passée, après le lever ou le coucher du soleil toute l'année (le front la montre autour, sky.js)
const ANYA_HOURS = { aube: 10, crepuscule: 23 };

// Réparer un bâtiment embrumé : de la pierre ou du bois selon le bâtiment, 3 au palier I, puis 2 de plus par palier
const STONE_SITES = new Set(['carriere', 'puits', 'atelier', 'foyer']);
const repairOf = (site, level) => ({ resource: STONE_SITES.has(site) ? 'stone' : 'wood', amount: 3 + 2 * (Math.max(1, level) - 1) });

module.exports = {
    START_HOUR, END_HOUR, LIGHT_REACH, MS_PER_CELL, LIGHTS, FENCES, ANYA_HOURS, countOf,
    parisAt, dayOf, nextDay, boundsOf, nightAt, nightNear, endedBetween, borderOf, lineOf, planOf, defenseOf, fateOf, outcomeOf, repairOf
};
