// Les bêtes de ferme (bible du dépôt front, § 6.16, v6 ; réglage « petit plus ») : celles du Potager selon son palier,
// contentes un jour une fois nourries, leur bulle d'un jour au plus (fonctions pures)
const test = require('node:test');
const assert = require('node:assert/strict');
const beasts = require('../src/services/beasts');

const H = 3600 * 1000;
const T = Date.parse('2026-10-06T08:00:00Z');
const hen = beasts.BEAST_BY_ID['poule-rousse'];
const cow = beasts.BEAST_BY_ID.vache;

test('les bêtes du Potager selon son palier, comme le front les montre', () => {
  const ids = level => beasts.beastsOf(level).map(b => b.id);
  assert.deepEqual(ids(0), []);
  assert.deepEqual(ids(1), ['poule-rousse', 'poule-noire']);
  assert.deepEqual(ids(3), ['poule-rousse', 'poule-noire', 'vache']);
  assert.deepEqual(ids(6), ['poule-rousse', 'poule-noire', 'vache', 'mouton', 'brebis', 'cochon', 'chevre']);
  // Le petit plus : par jour, poule 4, vache 8, mouton 4, cochon 6, chèvre 6 ; un repas coûte 2 vivres
  assert.deepEqual(beasts.BEASTS.map(b => b.daily), [4, 4, 8, 4, 4, 6, 6]);
  assert.deepEqual(beasts.FEED_COST, { food: 2 });
});

test('nourrie, elle est contente un jour et remplit sa bulle ; on la renourrit passé la moitié du jour', () => {
  // Jamais nourrie : elle a faim, la bulle est vide
  assert.deepEqual(beasts.stateOf(hen, undefined, T), { fed: false, left: 0, refill: true, ready: 0 });
  const row = { fed_at: T, collected_at: T };
  // Une poule : un œuf toutes les 6 heures
  assert.deepEqual(beasts.stateOf(hen, row, T + 5 * H), { fed: true, left: 19 * H, refill: false, ready: 0 });
  assert.deepEqual(beasts.stateOf(hen, row, T + 13 * H), { fed: true, left: 11 * H, refill: true, ready: 2 });
  // Un jour plus tard, elle a faim : la bulle ne se remplit plus (4 œufs)
  assert.deepEqual(beasts.stateOf(hen, row, T + 40 * H), { fed: false, left: 0, refill: true, ready: 4 });
  // Une vache : 8 par jour
  assert.equal(beasts.stateOf(cow, row, T + 9 * H).ready, 3);
});

test('ramasser garde la part d’une unité en cours ; la bulle garde un jour au plus', () => {
  const row = { fed_at: T, collected_at: T };
  // 13 h : deux œufs ; la troisième heure de l'œuf suivant reste due
  assert.deepEqual(beasts.readyOf(hen, row, T + 13 * H), { amount: 2, collectedAt: T + 12 * H });
  // Nourrie souvent, jamais ramassée : un jour au plus
  const often = { fed_at: T + 36 * H, collected_at: T };
  assert.deepEqual(beasts.readyOf(hen, often, T + 48 * H), { amount: 4, collectedAt: T + 48 * H });
});

test('nourrir ramasse d’abord ; contente, la part en cours reste due ; affamée, elle repart de maintenant', () => {
  // Jamais nourrie
  assert.deepEqual(beasts.feedOf(hen, undefined, T), { amount: 0, row: { fed_at: T, collected_at: T } });
  // Encore contente à 13 h : deux œufs ramassés, l'heure en cours compte encore
  const row = { fed_at: T, collected_at: T };
  assert.deepEqual(beasts.feedOf(hen, row, T + 13 * H), { amount: 2, row: { fed_at: T + 13 * H, collected_at: T + 12 * H } });
  // Affamée depuis 6 h : quatre œufs ramassés, et rien pour les heures où elle avait faim
  assert.deepEqual(beasts.feedOf(hen, row, T + 30 * H), { amount: 4, row: { fed_at: T + 30 * H, collected_at: T + 30 * H } });
});
