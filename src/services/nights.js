// Les nuits de créatures (HISTOIRE.md du dépôt front, § 6.15, v6 ; décisions du 6 octobre 2026) : règles pures, sans
// base. Chaque nuit de l'horloge du jeu (choix de l'auteur, 15 oct. : 20 minutes par cycle d'1 h 30, la même pour tous ;
// services/gameClock.js), des égarés sortent de la brume voisine, au bord de l'île à soi, et marchent vers le bâtiment
// le plus proche :
// - une clôture ou un muret barre sa case, même dans la lumière (choix de l'auteur, 13 oct. : la barrière d'abord, l'enclos
//   du Feu sert vraiment) ;
// - une lumière (le feu du Foyer, une lanterne, un brasero : 3 cases ; une torche : 2) change en luciole celui qui passe
//   à sa portée ; sous la pluie (services/weather.js), le feu de camp ne porte qu'à RAIN_REACH case, sauf le Foyer à
//   l'Abri (palier II) qui le couvre (choix de l'auteur, 14 oct.) ;
// - le coq (choix de l'auteur, 14 oct.) voit à COQ_SIGHT cases de son poulailler : le premier qui passerait (ni barré, ni
//   luciole), il chante, le camp s'éveille et le chasse, une fois par nuit ;
// - un camarade content repousse celui qui vise son bâtiment, une fois par nuit ;
// - un toucher du joueur en repousse un.
// Chacun sa manière (choix de l'auteur, 14 oct. : HISTOIRE.md, § 6.15 ; KINDS) : le serveur décide qui sort.
// Au plus une panne par nuit (le premier égaré arrivé embrume son bâtiment). Tout se tire d'une graine (le joueur, la
// nuit) : le serveur seul décide, le front montre.
const crypto = require('node:crypto');
const map = require('./worldMap');
const { STATIC, footprintAt } = require('./world/places');
const clock = require('./gameClock');

const LIGHT_REACH = 3;
const LIGHTS = new Set(['lanterne', 'brasero', 'torche']);
// La portée d'une lumière, en cases (LIGHT_REACH, sinon)
const REACH = { torche: 2 };
const FENCES = new Set(['cloture', 'muret']);
// Le coq voit à tant de cases (de sa place : le poulailler, sinon la cage)
const COQ_SIGHT = 4;
// Sous la pluie, le feu de camp à découvert ne porte qu'à tant de cases ; le Foyer l'abrite dès ce palier
const RAIN_REACH = 1;
const SHELTER_LEVEL = 2;
// Un égaré marche une case toutes les 20 secondes : il traverse la nuit sous les yeux du joueur
const MS_PER_CELL = 20 * 1000;
// Une nuit à la fois : 3 égarés avant l'acte I fini, un de plus par acte, 8 au plus (choix de l'auteur, 13 oct.)
const countOf = acts => Math.min(8, 3 + acts);

// Les égarés, chacun sa manière (choix de l'auteur, 14 oct.) : ce que le Voile a effacé.
// - fantome, le Sans-Nom (un nom) : il voit une lumière à SIGHT cases et dévie vers elle ;
// - zombie, le Dormeur (des mots) : les yeux fermés, la lumière ne lui fait rien ; lent ; une clôture l'endort ('dort') ;
// - noye, le Noyé de l'Hirondelle (le naufrage) : il sort de la mer, dès l'arrivée de Pierrot ;
// - racine, la Racine errante (un chemin) : elle sort de la lisière, passe sous les clôtures, dès le Bosquet bâti ;
// - esprit, l'Esprit sylvestre revenant (la voix d'Anya) : repoussé, il revient une fois, par un autre chemin ;
// - bete, la bête de brume (celle du climat d'où il sort, côté front) : vive.
const KINDS = ['fantome', 'zombie', 'noye', 'racine', 'esprit', 'bete'];
const SIGHT = 5;
// Leur pas, relatif à MS_PER_CELL
const PACE = { zombie: 1.5, bete: 0.75 };
const paceOf = kind => Math.round(MS_PER_CELL * (PACE[kind] || 1));
// L'Esprit revient tant après l'instant où il serait arrivé ; ce qui le fait revenir
const RETURN_MS = 3 * 60 * 1000;
const RETURNS = new Set(['touche', 'barre', 'coq', 'camarade']);
// Les premières nuits, écrites (la n-ième nuit depuis la présentation) ; au-delà, des Sans-Nom
const SCRIPT = [['fantome', 'fantome', 'fantome'], ['fantome', 'zombie', 'fantome'], ['fantome', 'zombie', 'esprit']];
// Puis le rythme du long terme : un mélange pondéré par ce qui existe ; le Noyé, plus nombreux les nuits de pluie ; une
// nuit sur THEME_ODDS, une nuit à thème (la nuit des revenants, la marée des Noyés, la nuit des racines)
const WEIGHTS = { fantome: 3, zombie: 2, esprit: 1, bete: 2, noye: 2, racine: 2 };
const THEMES = ['esprit', 'noye', 'racine'];
const THEME_ODDS = 6;
const THEME_WEIGHT = 4;
const RAIN_WEIGHT = 2;

// Heure de Paris → instant : un jour 'AAAA-MM-JJ' + heures (changements d'heure compris). Les nuits suivent l'horloge du
// jeu ; les jours de Paris restent ceux des passages d'Anya (services/anya.js)
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

// Une nuit se nomme par le n° de son cycle (gameClock) : { start, end } (instants)
const boundsOf = night => clock.nightOf(Number(night));
// La nuit en cours à un instant, ou null (le jour)
function nightAt(ms) {
    const cycle = clock.cycleOf(ms);
    return ms >= boundsOf(cycle).start ? cycle : null;
}
// La nuit en cours, ou la prochaine (le jour, on voit déjà par où ils viendront) : celle du cycle
const nightNear = ms => clock.cycleOf(ms);
// Les nuits finies dans ]from, to], dans l'ordre (14 au plus : au-delà, rien ne change, un seul bâtiment s'embrume)
function endedBetween(from, to) {
    const last = clock.cycleOf(to) - 1;
    const out = [];
    for (let night = Math.max(clock.cycleOf(from), last - 13); night <= last; night++) out.push(night);
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
// Les cases d'un bâtiment (son emprise, selon son palier et sa place : world/places.js)
function cellsOf(site, level, places = STATIC) {
    const f = footprintAt(places, site, level);
    const out = [];
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) out.push({ x, y });
    return out;
}
const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Les cases de terre à soi qui touchent ce que dit near(x, y) (owned : Set des quartiers). Ordre stable
function edgeOf(owned, keep, near) {
    const out = [];
    for (let y = 0; y < map.SIZE; y++) {
        for (let x = 0; x < map.SIZE; x++) {
            if (map.isLand(x, y) && owned.has(map.zoneAt(x, y)) && keep(x, y) && DIRS.some(([dx, dy]) => near(x + dx, y + dy))) out.push({ x, y });
        }
    }
    return out;
}
const WOODS = new Set(['f', 't']);
const wooded = (x, y) => WOODS.has(map.groundAt(x, y));
// D'où sort chacun : le bord de la brume ; le Noyé, le rivage (la terre au bord de la mer) ; la Racine, la lisière (la
// forêt au bord d'une terre sans arbres). Le bord de la brume, à défaut
function originsOf(owned) {
    const border = borderOf(owned);
    const shore = edgeOf(owned, () => true, (x, y) => map.groundAt(x, y) === '~');
    const edge = edgeOf(owned, wooded, (x, y) => map.isLand(x, y) && !wooded(x, y));
    return { border, noye: shore.length ? shore : border, racine: edge.length ? edge : border };
}
// La n-ième nuit depuis first (l'instant de la première nuit possible), 0 pour la première
function indexOf(night, first) {
    const zero = boundsOf(clock.cycleOf(first)).start < first ? clock.cycleOf(first) + 1 : clock.cycleOf(first);
    return Number(night) - zero;
}
// Qui sort cette nuit : count espèces. island.first : l'instant de la première nuit possible (absent : le long terme) ;
// island.unlocks : { noye, racine } (l'instant d'où ils peuvent sortir : le premier sort à coup sûr la première nuit
// après ; 0 : depuis toujours ; absent : jamais) ; island.rainAt (weather.js)
function kindsOf(userId, night, island, count) {
    const { start } = boundsOf(night);
    const unlocks = island.unlocks || {};
    const open = kind => unlocks[kind] !== undefined && unlocks[kind] <= start;
    const index = island.first === undefined ? SCRIPT.length : indexOf(night, island.first);
    const random = randomOf('egares', userId, night);
    let kinds;
    if (index < SCRIPT.length) {
        kinds = Array.from({ length: count }, (_, k) => SCRIPT[index][k] || 'fantome');
    } else {
        const weights = { ...WEIGHTS };
        for (const kind of ['noye', 'racine']) if (!open(kind)) weights[kind] = 0;
        if (island.rainAt && island.rainAt(start)) weights.noye *= RAIN_WEIGHT;
        const themes = THEMES.filter(kind => weights[kind]);
        if (random() * THEME_ODDS < 1) weights[themes[Math.floor(random() * themes.length)]] *= THEME_WEIGHT;
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        kinds = Array.from({ length: count }, () => {
            let roll = random() * total;
            return KINDS.find(kind => (roll -= weights[kind]) < 0) || 'fantome';
        });
    }
    // (le premier Noyé, la première Racine : la première nuit où ils peuvent sortir)
    const firsts = ['noye', 'racine'].filter(kind => open(kind) && unlocks[kind] > boundsOf(Number(night) - 1).start);
    firsts.forEach((kind, k) => { if (k < count) kinds[k] = kind; });
    return kinds;
}
// Le bâtiment le plus proche de from, et sa case la plus proche : { id, cell }
function goalOf(sites, from) {
    return sites.map(s => {
        const cell = s.cells.reduce((best, c) => (distance(c, from) < distance(best, from) ? c : best));
        return { id: s.id, cell, d: distance(cell, from) };
    }).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))[0];
}
// Un égaré qui marche de from à son bâtiment, sorti à l'instant at
function walkOf(id, kind, sites, from, at) {
    const goal = goalOf(sites, from);
    const path = lineOf(from, goal.cell);
    const pace = paceOf(kind);
    return { id, kind, site: goal.id, path, at, pace, arrives: at + (path.length - 1) * pace };
}

// Les égarés d'une nuit. island = { owned (Set des quartiers à soi), sites ([{ id, level }] : bâtiments bâtis),
// acts (actes finis), places (où sont les bâtiments ; ceux de la carte par défaut), first, unlocks, rainAt (kindsOf) }.
// [{ id, kind, site, path: [{ x, y }], at (instant d'apparition), pace (ms par case), arrives (instant d'arrivée), back
// (l'Esprit qui revient : l'id de sa première sortie) }]
function planOf(userId, night, island) {
    const sites = island.sites.map(s => ({ id: s.id, cells: cellsOf(s.id, s.level, island.places) }));
    const origins = originsOf(island.owned);
    if (!sites.length || !origins.border.length) return [];
    const random = randomOf('nuit', userId, night);
    const again = randomOf('retour', userId, night);
    const { start, end } = boundsOf(night);
    const count = countOf(island.acts);
    const kinds = kindsOf(userId, night, island, count);
    return Array.from({ length: count }, (_, k) => {
        const from = (origins[kinds[k]] || origins.border)[Math.floor(random() * (origins[kinds[k]] || origins.border).length)];
        // Ils sortent l'un après l'autre, dans la première moitié de la nuit
        const at = Math.round(start + ((k + random()) / count) * (end - start) / 2);
        const walk = walkOf(`${night}:${k}`, kinds[k], sites, from, at);
        if (walk.kind !== 'esprit') return [walk];
        // (l'Esprit revient d'ailleurs, s'il a été repoussé : outcomeOf)
        const others = origins.border.filter(c => distance(c, from) > SIGHT);
        const back = (others.length ? others : origins.border)[Math.floor(again() * (others.length || origins.border.length))];
        return [walk, { ...walkOf(`${walk.id}:retour`, 'esprit', sites, back, walk.arrives + RETURN_MS), back: walk.id }];
    }).flat();
}

// Les défenses de l'île : lumières (le feu du Foyer, lanternes, braseros, torches ; reach : leur portée ; camp : le feu
// de camp à découvert, que la pluie affaiblit) et barrières (clôtures, murets). crafts : [{ craft, x, y }] posées ;
// levels : { site: palier } ; places : où sont les bâtiments ; rainAt : pleut-il à cet instant (ms) ? (weather.js)
function defenseOf(crafts, levels, places = STATIC, rainAt = () => false) {
    const lights = crafts.filter(c => LIGHTS.has(c.craft)).map(c => ({ x: c.x, y: c.y, reach: REACH[c.craft] || LIGHT_REACH }));
    const camp = (levels.foyer || 0) < SHELTER_LEVEL;
    if (levels.foyer) lights.push(...cellsOf('foyer', levels.foyer, places).map(c => ({ ...c, reach: LIGHT_REACH, camp })));
    return { lights, fences: new Set(crafts.filter(c => FENCES.has(c.craft)).map(key)), rainAt };
}
// La portée d'une lumière à l'instant at : le feu de camp à découvert, sous la pluie, ne porte qu'à RAIN_REACH
const reachAt = (light, defense, at) => (light.camp && defense.rainAt && defense.rainAt(at) ? RAIN_REACH : light.reach);
// Le chemin du Sans-Nom : à la première case d'où il voit une lumière (SIGHT cases), il part droit vers elle (la plus
// proche) ; null s'il n'en voit aucune
function detourOf(path, defense) {
    for (const [step, cell] of path.entries()) {
        const seen = defense.lights.filter(light => distance(light, cell) <= SIGHT)
            .sort((a, b) => distance(a, cell) - distance(b, cell) || a.y - b.y || a.x - b.x)[0];
        if (seen) return [...path.slice(0, step), ...lineOf(cell, seen)];
    }
    return null;
}
// Le sort d'un égaré sur son chemin : { end: 'luciole' | 'barre' | 'dort' | 'arrive', step, path? } (step : la case où il
// s'arrête ; path : son chemin, s'il a dévié). La barrière d'abord : une clôture sur son chemin l'arrête (le Dormeur s'y
// endort ; la Racine passe dessous), même s'il passe avant dans une lumière ; sinon, la première lumière à portée le
// change en luciole (pas le Dormeur)
function fateOf(creature, defense) {
    const detour = creature.kind === 'fantome' ? detourOf(creature.path, defense) : null;
    const path = detour || creature.path;
    const pace = creature.pace || MS_PER_CELL;
    const out = fate => (detour ? { ...fate, path } : fate);
    const barred = creature.kind === 'racine' ? -1 : path.findIndex(cell => defense.fences.has(key(cell)));
    if (barred >= 0) return out({ end: creature.kind === 'zombie' ? 'dort' : 'barre', step: barred });
    if (creature.kind !== 'zombie') {
        for (const [step, cell] of path.entries()) {
            const at = creature.at + step * pace;
            if (defense.lights.some(light => distance(light, cell) <= reachAt(light, defense, at))) return out({ end: 'luciole', step });
        }
    }
    return out({ end: 'arrive', step: path.length - 1 });
}
// Celui que le coq chasse : parmi ceux qui arriveraient (fates), le premier à entrer dans sa vue (watch : sa place,
// ou null) ; { id, step } (la case où il le voit), ou null
function crowOf(plan, fates, watch) {
    if (!watch) return null;
    let best = null;
    for (const creature of plan) {
        if (fates[creature.id].end !== 'arrive') continue;
        const step = creature.path.findIndex(cell => distance(cell, watch) <= COQ_SIGHT);
        const at = creature.at + step * (creature.pace || MS_PER_CELL);
        if (step >= 0 && (!best || at < best.at || (at === best.at && creature.id < best.id))) best = { id: creature.id, step, at };
    }
    return best;
}
// L'issue d'une nuit : le sort de chacun, et la panne (le premier arrivé embrume son bâtiment), ou null.
// helpers : Set des bâtiments dont le camarade est content (il repousse un égaré, une fois) ; repelled : Set des égarés
// repoussés d'un toucher ; watch : la place du coq ({ x, y }), ou null. { fates: { id: { end, step, path? } }, panne: { site, at } | null }
// (l'Esprit qui ne revient pas, parce que sa première sortie a fini en luciole ou arrivée : end 'absent')
function outcomeOf(plan, defense, helpers = new Set(), repelled = new Set(), watch = null) {
    const helping = new Set(helpers);
    const fates = {};
    const sorted = [...plan].sort((a, b) => a.arrives - b.arrives || (a.id < b.id ? -1 : 1));
    for (const creature of sorted) {
        if (creature.back && !RETURNS.has(fates[creature.back].end)) {
            fates[creature.id] = { end: 'absent', step: null };
            continue;
        }
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
    }
    // (le coq chasse un de ceux qui arriveraient vraiment : ni barrière, ni lumière, ni camarade)
    const crow = crowOf(plan, fates, watch);
    if (crow) fates[crow.id] = { end: 'coq', step: crow.step };
    // (l'Esprit chassé par le coq revient lui aussi)
    const returning = crow && plan.find(creature => creature.back === crow.id);
    if (returning) fates[returning.id] = repelled.has(returning.id) ? { end: 'touche', step: null } : fateOf(returning, defense);
    const first = sorted.find(creature => fates[creature.id].end === 'arrive');
    return { fates, panne: first ? { site: first.site, at: first.arrives } : null };
}

// Anya, un jour de Paris de son passage (services/anya.js, slotOn : 'aube' ou 'crepuscule'), passe à chaque aube, ou à
// chaque crépuscule, de l'horloge du jeu ce jour-là (le front la montre à ces moments, sky.js) ; la première après la
// panne guérit le bâtiment embrumé. [instants], dans l'ordre
function anyaTimesOn(day, slot) {
    const from = parisAt(day, 0);
    const to = parisAt(nextDay(day), 0);
    const offset = slot === 'aube' ? 0 : clock.DUSK_MS;
    const out = [];
    for (let cycle = clock.cycleOf(from - 1) + 1; clock.startOf(cycle) < to; cycle++) out.push(clock.startOf(cycle) + offset);
    return out;
}

// Réparer un bâtiment embrumé : de la pierre ou du bois selon le bâtiment, 3 au palier I, puis 2 de plus par palier
const STONE_SITES = new Set(['carriere', 'puits', 'atelier', 'foyer']);
const repairOf = (site, level) => ({ resource: STONE_SITES.has(site) ? 'stone' : 'wood', amount: 3 + 2 * (Math.max(1, level) - 1) });

module.exports = {
    LIGHT_REACH, REACH, COQ_SIGHT, RAIN_REACH, SHELTER_LEVEL, MS_PER_CELL, LIGHTS, FENCES, countOf, anyaTimesOn,
    KINDS, SIGHT, RETURN_MS, SCRIPT, paceOf, indexOf, kindsOf,
    parisAt, dayOf, nextDay, boundsOf, nightAt, nightNear, endedBetween, borderOf, lineOf, planOf, defenseOf, fateOf, outcomeOf, repairOf
};
