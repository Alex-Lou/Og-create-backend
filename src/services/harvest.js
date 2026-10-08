// Récolte : le mini-jeu de l'île. On relie au doigt des tuiles identiques voisines (diagonales comprises).
// Moteur déterministe : à partir d'une graine, le serveur rejoue les coups envoyés et calcule seul le gain.
// Copie conforme de src/game/harvest.js côté navigateur : les deux suites de tests vérifient le même vecteur.

const SIZE = 6;
const MIN_CHAIN = 3;
const BASE_KINDS = ['stone', 'wood', 'water', 'food'];
// Ressource rapportée par chaque tuile et son poids (le poisson nourrit davantage)
const YIELD = { stone: ['stone', 1], wood: ['wood', 1], water: ['water', 1], food: ['food', 1], fish: ['food', 3] };

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

// Au moins une chaîne possible sur le plateau
function hasChain(board) {
    const seen = new Set();
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (seen.has(y * SIZE + x)) continue;
            // Groupe de tuiles identiques reliées
            const kind = board[y][x];
            const stack = [[x, y]];
            let count = 0;
            seen.add(y * SIZE + x);
            while (stack.length) {
                const [cx, cy] = stack.pop();
                count++;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || seen.has(ny * SIZE + nx) || board[ny][nx] !== kind) continue;
                        seen.add(ny * SIZE + nx);
                        stack.push([nx, ny]);
                    }
                }
            }
            if (count >= MIN_CHAIN) return true;
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

// Chaîne valable : au moins 3 cases distinctes, voisines deux à deux, toutes de la même tuile
function chainOk(board, path) {
    if (!Array.isArray(path) || path.length < MIN_CHAIN || path.length > SIZE * SIZE) return false;
    const seen = new Set();
    let kind = null;
    for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        if (!Array.isArray(cell) || cell.length !== 2) return false;
        const [x, y] = cell;
        if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < SIZE) || seen.has(y * SIZE + x)) return false;
        seen.add(y * SIZE + x);
        if (kind === null) kind = board[y][x];
        else if (board[y][x] !== kind) return false;
        if (i > 0) {
            const [px, py] = path[i - 1];
            if (Math.max(Math.abs(px - x), Math.abs(py - y)) !== 1) return false;
        }
    }
    return true;
}

// Ressources d'une chaîne : une par tuile, bonus dès 5, multiplié par le bâtiment de la ressource
function gainOf(kind, length, boosts = {}) {
    const [resource, weight] = YIELD[kind];
    const base = length + (length >= 5 ? Math.floor(length / 2) : 0);
    return { resource, amount: base * weight * (boosts[resource] || 1) };
}

// Joue une chaîne : les tuiles disparaissent, les colonnes tombent, le haut se remplit (de gauche à droite)
function play(game, path) {
    const { board, draw } = game;
    const kind = board[path[0][1]][path[0][0]];
    const gone = new Set(path.map(([x, y]) => y * SIZE + x));
    for (let x = 0; x < SIZE; x++) {
        const kept = [];
        for (let y = 0; y < SIZE; y++) if (!gone.has(y * SIZE + x)) kept.push(board[y][x]);
        const fresh = Array.from({ length: SIZE - kept.length }, draw);
        const column = [...fresh, ...kept];
        for (let y = 0; y < SIZE; y++) board[y][x] = column[y];
    }
    // Plus aucune chaîne possible : le plateau est rebattu (game.shuffled le signale à l'affichage)
    game.shuffled = !hasChain(board);
    if (game.shuffled) {
        let next = game.fill();
        while (!hasChain(next)) next = game.fill();
        for (let y = 0; y < SIZE; y++) board[y] = next[y];
    }
    return kind;
}

// Rejoue une partie entière ; { ok, gains } ou { ok: false, error }
function replay(seed, kinds, moves, maxMoves, boosts = {}) {
    if (!Array.isArray(moves) || moves.length > maxMoves) return { ok: false, error: 'Trop de coups' };
    const game = create(seed, kinds);
    const gains = { stone: 0, wood: 0, water: 0, food: 0 };
    // (le total des ressources après chaque coup : l'objectif du niveau, game/levels.js)
    const totals = [];
    for (const path of moves) {
        if (!chainOk(game.board, path)) return { ok: false, error: 'Coup impossible' };
        const kind = play(game, path);
        const { resource, amount } = gainOf(kind, path.length, boosts);
        gains[resource] += amount;
        totals.push((totals.length ? totals[totals.length - 1] : 0) + amount);
    }
    return { ok: true, gains, totals };
}

module.exports = { SIZE, MIN_CHAIN, BASE_KINDS, YIELD, rng, hasChain, create, chainOk, gainOf, play, replay };
