// Mini-jeux des bâtiments : parties tirées d'une graine (mêmes vecteurs que src/game/minigames.js du navigateur),
// gestes rejoués selon les règles, écus plafonnés selon le palier
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/services/minigames');

// Le moment où un poisson passe sous l'hameçon
const under = f => Math.round(f.t0 + (0.6 / f.speed) * 1000);

test('la graine 42 donne toujours les mêmes parties (vecteurs partagés avec le navigateur)', () => {
  const fish = m.fishingOf(42);
  assert.equal(fish.length, 40);
  assert.deepEqual(fish[0], { id: 0, lane: 2, kind: 'truite', dir: 1, speed: 0.314, t0: 400 });
  assert.deepEqual(fish[39], { id: 39, lane: 2, kind: 'gardon', dir: -1, speed: 0.221, t0: 41995 });
  const vein = m.veinOf(42);
  assert.equal(vein.hard.join(''), '213212123113211222112121111221121211112212');
  assert.equal(vein.gems.map(g => (g ? g[0] : '.')).join(''), '.......aq....aaqq...rrr....q......q......a');
  const berries = m.pickingOf(42);
  assert.equal(berries.length, 47);
  assert.deepEqual(berries[0], { id: 0, cell: 9, kind: 'mure', at: 500, until: 2582 });
  assert.deepEqual(berries[46], { id: 46, cell: 12, kind: 'mure', at: 37445, until: 39157 });
});

test('pêche : un lancer prend le poisson sous l’hameçon ; la ligne reste à l’eau 0,7 s ; gestes invalides refusés', () => {
  const fish = m.fishingOf(42);
  const first = fish[0];
  const t = under(first);
  assert.equal(m.catchAt(fish, new Set(), t, first.lane).id, 0);
  assert.equal(m.catchAt(fish, new Set(), t, (first.lane + 1) % 3)?.id ?? null, fish.find(f => f.lane === (first.lane + 1) % 3 && Math.abs(m.fishX(f, t) - 0.5) <= 0.08)?.id ?? null);
  const once = m.replay('peche', 42, [[t, first.lane]]);
  assert.deepEqual(once, { ok: true, raw: 4, detail: ['truite'], last: t });
  // Un second lancer 0,3 s plus tard ne compte pas (ligne encore à l'eau)
  assert.equal(m.replay('peche', 42, [[t, first.lane], [t + 300, first.lane]]).detail.length, 1);
  // Lancer dans le vide : rien
  assert.equal(m.replay('peche', 42, [[100, 0]]).raw, 0);
  for (const bad of [[[5, 1], [3, 0]], [[10, 3]], [[-1, 0]], [[46000, 0]], [['a', 0]], [[1, 1, 1]], [5]]) assert.equal(m.replay('peche', 42, bad).ok, false, JSON.stringify(bad));
  assert.equal(m.replay('peche', 42, Array.from({ length: 151 }, (_, k) => [k * 100, 0])).ok, false);
});

test('filon : on creuse depuis le haut, un coup de pioche par geste, les pierres du filon se gagnent', () => {
  const { hard, gems } = m.veinOf(42);
  assert.equal(m.reachable(Array(42).fill(false), 3), true);
  assert.equal(m.reachable(Array(42).fill(false), 9), false);
  // Ouvrir la colonne 1 jusqu'à la rangée 2 : la pierre en 13 (rangée 2, colonne 1)
  const column = [1, 7, 13].flatMap(i => Array(hard[i]).fill(i));
  const dug = m.replay('filon', 42, column);
  assert.equal(dug.ok, true);
  assert.deepEqual(dug.detail, [gems[7], gems[13]].filter(Boolean));
  assert.equal(dug.raw, dug.detail.reduce((s, g) => s + m.GEMS[g].value, 0));
  assert.equal(m.glintOf(gems, 1), [0, 2, 6, 7, 8].filter(i => gems[i]).length);
  // Frapper sans accès, frapper un bloc déjà ouvert, trop de coups : refusé
  assert.equal(m.replay('filon', 42, [20]).ok, false);
  assert.equal(m.replay('filon', 42, [...Array(hard[1]).fill(1), 1]).ok, false);
  assert.equal(m.replay('filon', 42, Array(27).fill(0)).ok, false);
});

test('cueillette : une baie mûre se cueille une fois ; un buisson vide fait perdre un instant, les guêpes davantage', () => {
  const events = m.pickingOf(42);
  const first = events[0];
  const got = m.replay('cueillette', 42, [[first.at + 100, first.cell], [first.at + 200, first.cell]]);
  assert.deepEqual(got.detail, ['mure']);
  // Un buisson vide juste avant : la cueillette suivante, trop proche, ne compte pas
  const empty = (first.cell + 1) % 16;
  assert.equal(m.ripeAt(events, new Set(), first.at, empty), null);
  assert.equal(m.replay('cueillette', 42, [[first.at, empty], [first.at + 100, first.cell]]).detail.length, 0);
  const wasp = events.find(e => e.kind === 'guepes');
  if (wasp) {
    const next = events.find(e => e.at > wasp.at && e.at < wasp.at + 1000 && e.cell !== wasp.cell);
    if (next) assert.deepEqual(m.replay('cueillette', 42, [[wasp.at, wasp.cell], [next.at, next.cell]]).detail, ['guepes']);
  }
  for (const bad of [[[5, 1], [3, 0]], [[10, 16]], [[41000, 0]], [null]]) assert.equal(m.replay('cueillette', 42, bad).ok, false, JSON.stringify(bad));
  assert.equal(m.replay('rien', 42, []).ok, false);
});

test('écus : ×1 au palier III, +0,2 par palier, plafonnés par partie', () => {
  assert.deepEqual([3, 4, 5, 6, 7].map(m.multOf), [1, 1.2, 1.4, 1.6, 1.8]);
  assert.equal(m.earnedOf(30, 3), 30);
  assert.equal(m.earnedOf(30, 7), 54);
  assert.equal(m.earnedOf(200, 3), 60);
  assert.equal(m.earnedOf(200, 7), 108);
  assert.deepEqual(Object.values(m.GAMES).map(g => g.site), ['ponton', 'carriere', 'bosquet']);
});
