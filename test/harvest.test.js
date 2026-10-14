// Récolte : moteur déterministe rejoué par le serveur (même vecteur que tests/harvest.test.js côté navigateur)
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/services/harvest');

const SHORT = { stone: 'S', wood: 'W', water: 'E', food: 'F', fish: 'P', lune: 'L' };
const rows = board => board.map(row => row.map(k => SHORT[k]).join(''));
// Vecteur commun : graine 12345, quatre chaînes jouées
const SEED = 12345;
const START = ['FWWFEW', 'SFFFWF', 'FFESWW', 'FFEFFE', 'WSWSFS', 'WSEFWS'];
const MOVES = [[[0, 0], [1, 1], [2, 1]], [[2, 0], [3, 0], [3, 1]], [[3, 0], [4, 0], [3, 1]], [[2, 0], [3, 1], [3, 2]]];
const END = ['SEFEEW', 'SWWFWF', 'FFEFWW', 'FFEFFE', 'WSWSFS', 'WSEFWS'];

test('la Récolte : même graine, même plateau, mêmes chutes', () => {
  const game = h.create(SEED, h.BASE_KINDS);
  assert.deepEqual(rows(game.board), START);
  for (const path of MOVES) {
    assert.ok(h.chainOk(game.board, path));
    h.play(game, path);
  }
  assert.deepEqual(rows(game.board), END);
});

test('la Récolte : le serveur rejoue les coups et calcule seul le gain', () => {
  // Pierre doublée par la Carrière
  assert.deepEqual(h.replay(SEED, h.BASE_KINDS, MOVES, 15, { stone: 2 }), { ok: true, gains: { stone: 6, wood: 0, water: 3, food: 6 }, totals: [3, 6, 9, 15] });
  // Trop de coups, chaîne trop courte, cases non voisines, tuiles différentes : refusé
  assert.equal(h.replay(SEED, h.BASE_KINDS, MOVES, 3).ok, false);
  assert.equal(h.replay(SEED, h.BASE_KINDS, [[[0, 0], [1, 1]]], 15).ok, false);
  assert.equal(h.replay(SEED, h.BASE_KINDS, [[[0, 0], [1, 1], [3, 1]]], 15).ok, false);
  assert.equal(h.replay(SEED, h.BASE_KINDS, [[[0, 0], [1, 0], [2, 0]]], 15).ok, false);
  assert.equal(h.replay(SEED, h.BASE_KINDS, [[[0, 0], [1, 1], [0, 0]]], 15).ok, false);
  assert.equal(h.replay(SEED, h.BASE_KINDS, ['nimporte'], 15).ok, false);
});

test('la Récolte : bonus des longues chaînes et poisson nourrissant', () => {
  assert.deepEqual(h.gainOf('wood', 3), { resource: 'wood', amount: 3 });
  assert.deepEqual(h.gainOf('wood', 5), { resource: 'wood', amount: 7 });
  assert.deepEqual(h.gainOf('food', 4, { food: 2 }), { resource: 'food', amount: 8 });
  assert.deepEqual(h.gainOf('fish', 3), { resource: 'food', amount: 9 });
});

test('la Récolte : un plateau a toujours une chaîne possible', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const game = h.create(seed, [...h.BASE_KINDS, 'fish']);
    assert.ok(h.hasChain(game.board), String(seed));
  }
});

// Règles 2 (les combos : la lune et la série) : graine 2, six longues chaînes jouées, la Scierie double le bois
const SEED2 = 2;
const MOVES2 = [
  [[3, 1], [3, 2], [3, 3], [4, 3], [5, 3], [5, 4], [4, 5], [5, 5]],
  [[0, 3], [1, 4], [2, 3], [1, 2], [2, 1], [3, 0], [4, 0], [3, 1], [4, 2], [4, 3]],
  [[3, 1], [2, 2], [1, 2], [0, 2], [0, 3], [1, 3], [2, 4], [1, 5], [0, 5]],
  [[0, 0], [1, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 3], [4, 3], [3, 4], [3, 5], [4, 4], [5, 5]],
  [[1, 0], [1, 1], [0, 2], [1, 3], [2, 2], [3, 1], [4, 1], [4, 2], [3, 3], [2, 3], [2, 4], [3, 4]],
  [[3, 1], [3, 2], [4, 3], [5, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 3], [0, 4], [0, 5], [1, 5]]
];

test('les combos (règles 2) : une chaîne de 7 ou plus laisse une lune sur sa dernière case, qui tombe avec les tuiles gardées', () => {
  const game = h.create(SEED2, h.BASE_KINDS);
  assert.deepEqual(rows(game.board), ['EWWEFE', 'WWFSFS', 'WFESEW', 'FSFSSS', 'SFWEFS', 'WWSESS']);
  assert.equal(h.play(game, MOVES2[0], 2), 'stone');
  assert.deepEqual([game.moons, game.moon], [0, [5, 5]]);
  assert.deepEqual(rows(game.board), ['EWWFFF', 'WWFFSE', 'WFESFE', 'FSFEFS', 'SFWEEW', 'WWSEFL']);
  // (une chaîne de 10 : sa lune en (4, 3))
  h.play(game, MOVES2[1], 2);
  assert.deepEqual(rows(game.board)[3], 'WWEELS');
  // Règles 1 : pas de lune, les mêmes coups ne tiennent plus
  assert.deepEqual(h.replay(SEED2, h.BASE_KINDS, MOVES2, 15, { wood: 2 }), { ok: false, error: 'Coup impossible' });
});

test('les combos (règles 2) : la lune est un joker (+2 par lune), la série monte de 10 % par coup jusqu’à +50 %', () => {
  // Coups : 8 pierres (12), 10 vivres ×1,1 (16), 9 bois ×2 ×1,2 (31), 12 eaux dont 2 lunes ×1,3 (28), 12 vivres ×1,4 (25),
  // 12 pierres dont 2 lunes ×1,5 (33)
  assert.deepEqual(h.replay(SEED2, h.BASE_KINDS, MOVES2, 15, { wood: 2 }, 2),
    { ok: true, gains: { stone: 45, wood: 31, water: 28, food: 41 }, totals: [12, 28, 59, 87, 112, 145] });
  assert.deepEqual(h.gainOf('water', 12, {}, { moons: 2, streak: 4, rules: 2 }), { resource: 'water', amount: 28 });
  assert.deepEqual(h.gainOf('fish', 3, { food: 2 }, { moons: 1, streak: 1, rules: 2 }), { resource: 'food', amount: 30 });
  // Le plafond : +50 % au 6e coup et après ; un coup de moins de 5 tuiles casse la série
  assert.deepEqual([1, 2, 3, 6, 9].map(h.streakOf), [1, 1.1, 1.2, 1.5, 1.5]);
  assert.deepEqual([[0, 5], [1, 7], [3, 4], [0, 3]].map(([k, n]) => h.streakAfter(k, n)), [1, 2, 0, 0]);
  // Règles 1 : ni lune ni série
  assert.deepEqual(h.gainOf('water', 12, {}, { moons: 2, streak: 4 }), { resource: 'water', amount: 18 });
});

test('les combos (règles 2) : une chaîne de lunes seules est refusée ; les lunes comptent dans le minimum et pour une chaîne possible', () => {
  const L = h.MOON;
  // Un damier où aucune tuile ne touche sa pareille : aucune chaîne ; trois lunes posées sur la 2e rangée
  const plain = Array.from({ length: h.SIZE }, (_, y) => Array.from({ length: h.SIZE }, (_, x) => (y % 2 ? ['water', 'food'] : ['stone', 'wood'])[x % 2]));
  const board = plain.map((row, y) => row.map((t, x) => (y === 1 && x < 3 ? L : t)));
  assert.equal(h.hasChain(plain), false);
  assert.equal(h.hasChain(board), true);
  assert.equal(h.chainOk(board, [[0, 1], [1, 1], [2, 1]]), false);
  assert.equal(h.chainOk(board, [[0, 1], [1, 1], [0, 0]]), true);
  assert.equal(h.kindOfPath(board, [[0, 1], [1, 1], [0, 0]]), 'stone');
  assert.equal(h.chainOk(board, [[0, 0], [0, 1], [1, 0]]), false);
});
