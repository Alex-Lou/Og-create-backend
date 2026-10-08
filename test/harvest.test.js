// Récolte : moteur déterministe rejoué par le serveur (même vecteur que tests/harvest.test.js côté navigateur)
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/services/harvest');

const SHORT = { stone: 'S', wood: 'W', water: 'E', food: 'F', fish: 'P' };
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
