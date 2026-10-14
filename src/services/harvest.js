// Récolte : le mini-jeu de l'île. On relie au doigt des tuiles identiques voisines (diagonales comprises).
// Moteur déterministe : à partir d'une graine, le serveur rejoue les coups envoyés et calcule seul le gain.
// Copie conforme de src/game/harvest.js côté navigateur : les deux suites de tests vérifient le même vecteur.
// Règles versionnées (config.rules de la partie ; sans elle, les règles 1) ; les règles 2 (choix de l'auteur, 14 oct. :
// les combos, « contrôlé, pas trop, mais waouh ») ajoutent :
// - la tuile de lune : une chaîne d'au moins MOON_FROM tuiles la laisse sur sa dernière case ; joker, elle prend place
//   dans toute chaîne (la sorte est celle de sa première vraie tuile ; jamais une chaîne de lunes seules) et rapporte
//   MOON_BONUS de plus, au poids de la sorte et au bonus du bâtiment ;
// - la série : les coups d'au moins STREAK_FROM tuiles qui se suivent gagnent +10 % par coup après le premier, +50 %
//   au plus, après le bâtiment et la lune ; un coup plus court la casse.

const SIZE = 6;
const MIN_CHAIN = 3;
const BASE_KINDS = ['stone', 'wood', 'water', 'food'];
// Ressource rapportée par chaque tuile et son poids (le poisson nourrit davantage)
const YIELD = { stone: ['stone', 1], wood: ['wood', 1], water: ['water', 1], food: ['food', 1], fish: ['food', 3] };
// Les règles des nouvelles parties (config.rules ; sans elle, une partie d'avant : les règles 1)
const RULES = 2;
// La tuile de lune (règles 2) : jamais tirée au hasard
const MOON = 'lune';
const MOON_FROM = 7;
const MOON_BONUS = 2;
// La série (règles 2) : un coup d'au moins STREAK_FROM tuiles la poursuit ; +STREAK_STEP par coup, STREAK_MAX fois au plus
const STREAK_FROM = 5;
const STREAK_STEP = 0.1;
const STREAK_MAX = 5;
// La sorte d'une chaîne : celle de sa première tuile qui n'est pas une lune (null : rien que des lunes)
const kindOfPath = (board, path) => {
    const cell = path.find(([x, y]) => board[y][x] !== MOON);
    return cell ? board[cell[1]][cell[0]] : null;
};

// Générateur pseudo-aléatoire 32 bits (mulberry32)
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

// Au moins une chaîne possible sur le plateau : un groupe relié d'au moins MIN_CHAIN cases d'une même sorte, les lunes
// comptant comme jokers, avec au moins une vraie tuile de la sorte
function hasChain(board) {
    const kinds = new Set(board.flat().filter(kind => kind !== MOON));
    for (const kind of kinds) {
        const seen = new Set();
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (seen.has(y * SIZE + x) || board[y][x] !== kind) continue;
                // Groupe de tuiles de cette sorte (ou de lunes) reliées, depuis une vraie
                const stack = [[x, y]];
                let count = 0;
                seen.add(y * SIZE + x);
                while (stack.length) {
                    const [cx, cy] = stack.pop();
                    count++;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || seen.has(ny * SIZE + nx)) continue;
                            if (board[ny][nx] !== kind && board[ny][nx] !== MOON) continue;
                            seen.add(ny * SIZE + nx);
                            stack.push([nx, ny]);
                        }
                    }
                }
                if (count >= MIN_CHAIN) return true;
            }
        }
    }
    return false;
}

// Nouvelle partie : plateau [y][x] et tirage des tuiles suivantes
function create(seed, kinds) {
    const next = rng(seed);
    const draw = () => kinds[Math.floor(next() * kinds.length)];
    const fill = () => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, draw));
    let board = fill();
    while (!hasChain(board)) board = fill();
    return { board, draw, fill };
}

// Chaîne valable : au moins 3 cases distinctes, voisines deux à deux, toutes de la même sorte (les lunes comptent,
// jokers ; une chaîne de lunes seules est refusée)
function chainOk(board, path) {
    if (!Array.isArray(path) || path.length < MIN_CHAIN || path.length > SIZE * SIZE) return false;
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        if (!Array.isArray(cell) || cell.length !== 2) return false;
        const [x, y] = cell;
        if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < SIZE) || seen.has(y * SIZE + x)) return false;
        seen.add(y * SIZE + x);
        if (i > 0) {
            const [px, py] = path[i - 1];
            if (Math.max(Math.abs(px - x), Math.abs(py - y)) !== 1) return false;
        }
    }
    const kind = kindOfPath(board, path);
    return kind !== null && path.every(([x, y]) => board[y][x] === kind || board[y][x] === MOON);
}

// Le coefficient de série du k-ième coup d'une série (1 pour le premier ; règles 2)
const streakOf = k => 1 + STREAK_STEP * Math.min(Math.max(0, k - 1), STREAK_MAX);

// Ressources d'une chaîne : une par tuile, bonus dès 5, multiplié par le bâtiment de la ressource ; règles 2 : chaque
// lune rapporte MOON_BONUS de plus (au poids de la sorte et au bonus du bâtiment), puis le coefficient de la série
// (streak : le rang du coup dans sa série, 0 hors série)
function gainOf(kind, length, boosts = {}, { moons = 0, streak = 0, rules = 1 } = {}) {
    const [resource, weight] = YIELD[kind];
    const base = length + (length >= 5 ? Math.floor(length / 2) : 0);
    if (rules < 2) return { resource, amount: base * weight * (boosts[resource] || 1) };
    const amount = (base + moons * MOON_BONUS) * weight * (boosts[resource] || 1);
    return { resource, amount: Math.floor(amount * streakOf(streak)) };
}

// Joue une chaîne : les tuiles disparaissent, les colonnes tombent, le haut se remplit (de gauche à droite) ; règles 2 :
// une chaîne d'au moins MOON_FROM tuiles laisse une lune sur sa dernière case (elle tombe avec les tuiles gardées).
// Rend la sorte de la chaîne ; game.moons : les lunes qu'elle a prises, game.moon : la case de la lune née, ou null
function play(game, path, rules = 1) {
    const { board, draw } = game;
    const kind = kindOfPath(board, path);
    game.moons = path.filter(([x, y]) => board[y][x] === MOON).length;
    const [lx, ly] = path[path.length - 1];
    const born = rules >= 2 && path.length >= MOON_FROM;
    if (born) board[ly][lx] = MOON;
    const gone = new Set((born ? path.slice(0, -1) : path).map(([x, y]) => y * SIZE + x));
    for (let x = 0; x < SIZE; x++) {
        const kept = [];
        for (let y = 0; y < SIZE; y++) if (!gone.has(y * SIZE + x)) kept.push(board[y][x]);
        const fresh = Array.from({ length: SIZE - kept.length }, draw);
        const column = [...fresh, ...kept];
        for (let y = 0; y < SIZE; y++) board[y][x] = column[y];
    }
    // (où la lune est tombée : sous elle, dans sa colonne, les cases vidées qu'elle a enjambées)
    game.moon = born ? [lx, ly + path.filter(([x, y]) => x === lx && y > ly).length] : null;
    // Plus aucune chaîne possible : le plateau est rebattu (game.shuffled le signale à l'affichage)
    game.shuffled = !hasChain(board);
    if (game.shuffled) {
        let next = game.fill();
        while (!hasChain(next)) next = game.fill();
        for (let y = 0; y < SIZE; y++) board[y] = next[y];
        game.moon = null;
    }
    return kind;
}

// Le rang d'un coup dans sa série (règles 2) : après un coup de rang before, un coup de length tuiles ; 0 hors série
const streakAfter = (before, length) => (length >= STREAK_FROM ? before + 1 : 0);

// Rejoue une partie entière avec ses règles (1 sans elles) ; { ok, gains, totals } ou { ok: false, error }
function replay(seed, kinds, moves, maxMoves, boosts = {}, rules = 1) {
    if (!Array.isArray(moves) || moves.length > maxMoves) return { ok: false, error: 'Trop de coups' };
    const game = create(seed, kinds);
    const gains = { stone: 0, wood: 0, water: 0, food: 0 };
    // (le total des ressources après chaque coup : l'objectif du niveau, game/levels.js)
    const totals = [];
    let streak = 0;
    for (const path of moves) {
        if (!chainOk(game.board, path)) return { ok: false, error: 'Coup impossible' };
        const kind = play(game, path, rules);
        streak = streakAfter(streak, path.length);
        const { resource, amount } = gainOf(kind, path.length, boosts, { moons: game.moons, streak, rules });
        gains[resource] += amount;
        totals.push((totals.length ? totals[totals.length - 1] : 0) + amount);
    }
    return { ok: true, gains, totals };
}

module.exports = {
    SIZE, MIN_CHAIN, BASE_KINDS, YIELD, MOON, MOON_FROM, MOON_BONUS, STREAK_FROM, RULES,
    rng, hasChain, create, chainOk, kindOfPath, streakOf, streakAfter, gainOf, play, replay
};
