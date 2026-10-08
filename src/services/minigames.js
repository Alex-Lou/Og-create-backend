// Mini-jeux des bâtiments (lot 4e) : la Pêche au Ponton, le Filon à la Carrière, la Cueillette au Bosquet, ouverts au
// palier III de leur bâtiment. Chacun a sa réserve de parties (3, une de plus toutes les 2 h) et rapporte des écus,
// davantage aux paliers suivants, plafonnés par partie.
// Moteurs déterministes : à partir d'une graine, le serveur rejoue ce que le joueur a fait et calcule seul le gain.
// Copie conforme de src/game/minigames.js côté navigateur : les deux suites de tests vérifient les mêmes parties.

const GAME_LEVEL = 3;
const PLAYS = 3;
const PLAY_REGEN_MS = 2 * 3600 * 1000;
const CAP = 60; // écus au plus par partie au palier III (× le multiplicateur du palier)

const GAMES = {
    peche: { site: 'ponton', name: 'Pêche', text: 'Touche le couloir d’eau quand un poisson passe sous l’hameçon.' },
    filon: { site: 'carriere', name: 'Filon', text: 'Creuse la paroi bloc par bloc : les éclats disent où dort le filon.' },
    cueillette: { site: 'bosquet', name: 'Cueillette', text: 'Cueille les baies mûres avant qu’elles tombent, sans réveiller les guêpes.' }
};

// Générateur pseudo-aléatoire 32 bits (mulberry32, le même que la Récolte)
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Tirage pondéré dans { clé: { weight } }
function draw(r, table) {
    const entries = Object.entries(table);
    let x = r() * entries.reduce((sum, [, v]) => sum + v.weight, 0);
    for (const [key, v] of entries) if ((x -= v.weight) < 0) return key;
    return entries[entries.length - 1][0];
}
const round3 = x => Math.round(x * 1000) / 1000;
const fail = error => ({ ok: false, error });
const isInt = v => Number.isInteger(v);
const sum = (list, table) => list.reduce((s, k) => s + table[k].value, 0);

/* ---------- Pêche : trois couloirs d'eau, l'hameçon au milieu ---------- */
const FISHING = { duration: 45000, lanes: 3, hook: 0.5, reach: 0.08, busy: 700, maxTaps: 150 };
const FISH = {
    gardon: { value: 2, weight: 56, speed: [0.16, 0.24] },
    truite: { value: 4, weight: 24, speed: [0.26, 0.34] },
    dore: { value: 10, weight: 6, speed: [0.38, 0.44] },
    botte: { value: 0, weight: 14, speed: [0.1, 0.14] }
};
// Les poissons de la partie : couloir, sorte, sens, vitesse (largeurs par seconde), instant d'entrée (ms)
// (duration : celle de la partie, plus courte pour les premières : SHORT)
function fishingOf(seed, duration = FISHING.duration) {
    const r = rng(seed);
    const fish = [];
    let t = 400;
    while (t < duration - 1500) {
        const kind = draw(r, FISH);
        const [a, b] = FISH[kind].speed;
        const dir = r() < 0.5 ? 1 : -1;
        fish.push({ id: fish.length, lane: Math.floor(r() * FISHING.lanes), kind, dir, speed: round3(a + (b - a) * r()), t0: Math.round(t) });
        t += 650 + r() * 900;
    }
    return fish;
}
// Position d'un poisson à l'instant t (0 : bord gauche, 1 : bord droit) ; il entre à -0,1 et sort à 1,1
function fishX(f, t) {
    const run = (f.speed * (t - f.t0)) / 1000;
    return f.dir > 0 ? -0.1 + run : 1.1 - run;
}
// Poisson pris par un lancer dans ce couloir à l'instant t : le plus proche de l'hameçon, à portée ; ou null
function catchAt(fish, caught, t, lane) {
    let best = null;
    let near = Infinity;
    for (const f of fish) {
        if (f.lane !== lane || caught.has(f.id) || t < f.t0) continue;
        const d = Math.abs(fishX(f, t) - FISHING.hook);
        if (d <= FISHING.reach && d < near) {
            best = f;
            near = d;
        }
    }
    return best;
}
// taps : [[t (ms depuis le début), couloir]] dans l'ordre ; un toucher pendant que la ligne est à l'eau ne compte pas
function replayFishing(seed, taps, duration = FISHING.duration) {
    if (taps.length > FISHING.maxTaps) return fail('trop de lancers');
    const fish = fishingOf(seed, duration);
    const caught = new Set();
    const catches = [];
    let free = 0;
    let last = 0;
    for (const tap of taps) {
        if (!Array.isArray(tap) || tap.length !== 2) return fail('lancer invalide');
        const [t, lane] = tap;
        if (!isInt(t) || !isInt(lane) || t < last || t > duration || lane < 0 || lane >= FISHING.lanes) return fail('lancer invalide');
        last = t;
        if (t < free) continue;
        free = t + FISHING.busy;
        const f = catchAt(fish, caught, t, lane);
        if (f) {
            caught.add(f.id);
            catches.push(f.kind);
        }
    }
    return { ok: true, raw: sum(catches, FISH), detail: catches, last };
}

/* ---------- Filon : une paroi à creuser, des pierres précieuses le long d'un filon ---------- */
const VEIN = { cols: 6, rows: 7, strokes: 26, length: 10, strays: 2 };
const GEMS = {
    quartz: { value: 3, weight: 50 },
    amethyste: { value: 5, weight: 30 },
    rubis: { value: 8, weight: 15 },
    diamant: { value: 16, weight: 5 }
};
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const inWall = (x, y) => x >= 0 && y >= 0 && x < VEIN.cols && y < VEIN.rows;
// La paroi : dureté de chaque bloc (1 à 3 coups) et pierre précieuse cachée derrière (ou null). Le filon part d'un bloc
// des rangées du milieu et serpente ; deux pierres perdues ailleurs
function veinOf(seed) {
    const r = rng(seed);
    const n = VEIN.cols * VEIN.rows;
    const hard = Array.from({ length: n }, () => {
        const x = r();
        return x < 0.5 ? 1 : x < 0.85 ? 2 : 3;
    });
    const gems = Array(n).fill(null);
    let x = Math.floor(r() * VEIN.cols);
    let y = 2 + Math.floor(r() * 3);
    let placed = 0;
    for (let k = 0; k < 60 && placed < VEIN.length; k++) {
        const i = y * VEIN.cols + x;
        if (!gems[i]) {
            gems[i] = draw(r, GEMS);
            placed++;
        }
        const next = STEPS.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inWall(nx, ny));
        [x, y] = next[Math.floor(r() * next.length)];
    }
    for (let k = 0; k < VEIN.strays;) {
        const i = Math.floor(r() * n);
        if (!gems[i]) {
            gems[i] = draw(r, GEMS);
            k++;
        }
    }
    return { hard, gems };
}
// Bloc qu'on peut frapper : sur la rangée du haut (la paroi à nu), ou à côté d'un bloc déjà ouvert
function reachable(broken, i) {
    const x = i % VEIN.cols;
    const y = (i - x) / VEIN.cols;
    return y === 0 || STEPS.some(([dx, dy]) => inWall(x + dx, y + dy) && broken[(y + dy) * VEIN.cols + x + dx]);
}
// Éclats d'un bloc ouvert : pierres précieuses dans les huit blocs autour
function glintOf(gems, i) {
    const x = i % VEIN.cols;
    const y = (i - x) / VEIN.cols;
    return AROUND.filter(([dx, dy]) => inWall(x + dx, y + dy) && gems[(y + dy) * VEIN.cols + x + dx]).length;
}
// taps : [bloc frappé] dans l'ordre, un coup de pioche chacun (VEIN.strokes au plus)
function replayVein(seed, taps, limit = VEIN.strokes) {
    if (taps.length > limit) return fail('trop de coups');
    const { hard, gems } = veinOf(seed);
    const left = hard.slice();
    const broken = Array(hard.length).fill(false);
    const found = [];
    // (le coup où chaque pierre est trouvée : l'objectif du niveau)
    const at = [];
    let strokes = 0;
    for (const i of taps) {
        if (!isInt(i) || i < 0 || i >= hard.length || broken[i] || !reachable(broken, i)) return fail('coup invalide');
        left[i]--;
        strokes++;
        if (left[i] === 0) {
            broken[i] = true;
            if (gems[i]) {
                found.push(gems[i]);
                at.push(strokes);
            }
        }
    }
    return { ok: true, raw: sum(found, GEMS), detail: found, last: 0, at };
}

/* ---------- Cueillette : seize buissons, des baies mûres un instant ---------- */
const PICKING = { duration: 40000, cols: 4, rows: 4, stun: 1500, slip: 350, gap: 300, maxPicks: 220 };
const BERRIES = {
    mure: { value: 1, weight: 52, life: [1400, 2200] },
    fraise: { value: 2, weight: 26, life: [1200, 1900] },
    myrtille: { value: 2, weight: 12, life: [1100, 1700] },
    cepe: { value: 6, weight: 4, life: [800, 1100] },
    guepes: { value: 0, weight: 6, life: [1500, 2200] }
};
// Ce qui mûrit pendant la partie : buisson, sorte, de at à until (ms) ; un buisson ne porte qu'une chose à la fois
function pickingOf(seed, duration = PICKING.duration) {
    const r = rng(seed);
    const n = PICKING.cols * PICKING.rows;
    const free = Array(n).fill(0);
    const events = [];
    let t = 500;
    while (t < duration - 800) {
        const cell = Math.floor(r() * n);
        const kind = draw(r, BERRIES);
        const [a, b] = BERRIES[kind].life;
        const life = Math.round(a + (b - a) * r());
        const at = Math.max(Math.round(t), free[cell]);
        if (at + life <= duration) {
            events.push({ id: events.length, cell, kind, at, until: at + life });
            free[cell] = at + life + PICKING.gap;
        }
        t += 500 + r() * 600;
    }
    return events;
}
// Ce qui est mûr sur ce buisson à l'instant t (et pas encore cueilli), ou null
function ripeAt(events, picked, t, cell) {
    return events.find(e => e.cell === cell && !picked.has(e.id) && t >= e.at && t <= e.until) || null;
}
// picks : [[t (ms), buisson]] dans l'ordre. Un buisson vide fait perdre un instant, les guêpes davantage
function replayPicking(seed, picks, duration = PICKING.duration) {
    if (picks.length > PICKING.maxPicks) return fail('trop de gestes');
    const events = pickingOf(seed, duration);
    const picked = new Set();
    const got = [];
    // (l'instant de chaque cueillette, guêpes à part : l'objectif du niveau)
    const at = [];
    let stunned = 0;
    let last = 0;
    for (const pick of picks) {
        if (!Array.isArray(pick) || pick.length !== 2) return fail('geste invalide');
        const [t, cell] = pick;
        if (!isInt(t) || !isInt(cell) || t < last || t > duration || cell < 0 || cell >= PICKING.cols * PICKING.rows) return fail('geste invalide');
        last = t;
        if (t < stunned) continue;
        const e = ripeAt(events, picked, t, cell);
        if (!e) {
            stunned = t + PICKING.slip;
            continue;
        }
        picked.add(e.id);
        if (e.kind === 'guepes') stunned = t + PICKING.stun;
        got.push(e.kind);
        if (e.kind !== 'guepes') at.push(t);
    }
    return { ok: true, raw: sum(got, BERRIES), detail: got, last, at };
}

/* ---------- Commun ---------- */
const REPLAY = { peche: replayFishing, filon: replayVein, cueillette: replayPicking };
// Les premières parties de chaque jeu (SHORT_RUNS) sont courtes, pour apprendre sans s'épuiser (choix de l'auteur,
// 8 oct.) : la durée de la Pêche et de la Cueillette (ms), les coups de pioche du Filon
const SHORT_RUNS = 2;
const SHORT = { peche: 25000, cueillette: 20000, filon: 12 };
const LIMIT = { peche: FISHING.duration, cueillette: PICKING.duration, filon: VEIN.strokes };
// La durée (ou les coups) d'une partie
const limitOf = (game, short = false) => (short ? SHORT[game] : LIMIT[game]);
// Rejoue une partie : { ok, raw (valeur brute), detail (prises, dans l'ordre), last (instant du dernier geste) }
// (short : une des premières parties, plus courte)
function replay(game, seed, input, short = false) {
    if (!REPLAY[game]) return fail('jeu inconnu');
    if (!Array.isArray(input)) return fail('partie invalide');
    return REPLAY[game](seed, input, limitOf(game, short));
}
// Multiplicateur du palier du bâtiment (III : ×1, puis +0,2 par palier) et écus gagnés, plafonnés
const multOf = level => Math.round((1 + 0.2 * Math.max(0, level - GAME_LEVEL)) * 10) / 10;
const earnedOf = (raw, level) => Math.min(Math.round(raw * multOf(level)), Math.round(CAP * multOf(level)));

module.exports = {
    GAME_LEVEL, PLAYS, PLAY_REGEN_MS, CAP, GAMES, FISHING, FISH, VEIN, GEMS, PICKING, BERRIES,
    SHORT_RUNS, SHORT, limitOf, rng, fishingOf, fishX, catchAt, veinOf, reachable, glintOf, pickingOf, ripeAt, replay, multOf, earnedOf
};
