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

test('besoins : manger tient 24 h et se renouvelle à mi-chemin ; travailler vient avec l’Atelier ; humeur et effet', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const hoursAgo = h => new Date(now - h * 3600000);
  const ids = needs => needs.map(n => [n.id, n.met]);
  // Absent : arrivé à l'instant, comblé ; sans Atelier, pas d'outils
  const fresh = v.needsOf({}, 0, false, now);
  assert.deepEqual(ids(fresh), [['manger', true], ['deco', false]]);
  assert.deepEqual([fresh[0].left, fresh[0].refill], [24 * 3600000, false]);
  assert.equal(v.moodOf(fresh), 'content');
  // À mi-chemin : renouvelable ; au bout : il manque
  assert.equal(v.needsOf({ manger: hoursAgo(12) }, 0, false, now)[0].refill, true);
  assert.equal(v.needsOf({ manger: hoursAgo(11.9) }, 0, false, now)[0].refill, false);
  assert.deepEqual(ids(v.needsOf({ manger: hoursAgo(24) }, 3, true, now)), [['manger', false], ['outils', true], ['deco', true]]);
  // Humeur : rien ne manque → heureux, un → content, deux ou plus → triste
  assert.equal(v.moodOf(v.needsOf({}, 3, true, now)), 'heureux');
  assert.equal(v.moodOf(v.needsOf({ outils: hoursAgo(48) }, 3, true, now)), 'content');
  assert.equal(v.moodOf(v.needsOf({ manger: hoursAgo(30), outils: hoursAgo(50) }, 3, true, now)), 'triste');
  assert.equal(v.needsOf({}, 7, false, now)[1].have, 3);
  // Effet de l'humeur selon le bâtiment
  assert.equal(v.moodEffect('potager', true, 'heureux'), '+10 % de production');
  assert.equal(v.moodEffect('atelier', false, 'triste'), '−2 coups par Récolte');
  assert.equal(v.moodEffect('foyer', false, 'heureux'), 'Une partie de Récolte revient 3 min plus vite');
  assert.equal(v.moodEffect('potager', true, 'content'), null);
});
