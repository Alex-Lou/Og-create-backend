// Habitants : prénoms et goûts, cœurs d'amitié, points d'un cadeau
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/services/villagers');

test('un habitant par bâtiment (et la cuisinière du Foyer), chacun ses goûts', () => {
  assert.deepEqual(Object.keys(v.VILLAGERS), ['potager', 'carriere', 'bosquet', 'puits', 'ponton', 'atelier', 'foyer']);
  for (const [id, who] of Object.entries(v.VILLAGERS)) {
    assert.ok(who.name && who.role, id);
    assert.ok(v.RESOURCES.includes(who.loves) && v.RESOURCES.includes(who.likes), id);
    assert.notEqual(who.loves, who.likes, id);
  }
  assert.equal(new Set(Object.values(v.VILLAGERS).map(w => w.name)).size, 7);
});

test('cinq cœurs, chacun récompensé ; un cadeau adoré compte plus', () => {
  assert.deepEqual([0, 29, 30, 79, 80, 150, 249, 250, 399, 400].map(v.heartsOf), [0, 0, 1, 1, 2, 3, 3, 4, 4, 5]);
  assert.equal(v.REWARDS.length, 5);
  assert.equal(v.MAX_POINTS, 400);
  const rose = v.VILLAGERS.potager;
  assert.equal(v.giftPoints(rose, 'water'), 30);
  assert.equal(v.giftPoints(rose, 'food'), 15);
  assert.equal(v.giftPoints(rose, 'stone'), 6);
});
