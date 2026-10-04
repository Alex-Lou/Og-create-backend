// Quêtes de Brume : la chaîne est cohérente avec l'île et le Livre, l'avancée se lit dans l'état
const test = require('node:test');
const assert = require('node:assert/strict');
const { QUESTS, progressOf, active, boardOf } = require('../src/services/quests');
const map = require('../src/services/worldMap');
const { SITES } = require('../src/services/world');

// Découvertes nécessaires à chaque chapitre (bookPages.CHAPTERS)
const NEED = { I: 0, II: 0, III: 5, IV: 12, V: 25, VI: 45, VII: 70 };
const CHAPTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const facts = (extra = {}) => ({ tiles: 0, runs: 0, stars: 0, zones: new Set(['coeur']), levels: { foyer: 1 }, ...extra });

test('chaque quête désigne un vrai quartier ou un vrai palier, avec un texte et une récompense', () => {
  assert.equal(new Set(QUESTS.map(q => q.id)).size, QUESTS.length);
  for (const q of QUESTS) {
    assert.match(q.id, /^[a-z0-9]{1,30}$/);
    assert.ok(CHAPTERS.includes(q.act));
    assert.ok(q.say.length > 20 && q.label.length > 5);
    assert.ok(Number.isInteger(q.coins) && q.coins > 0);
    if (q.goal.kind === 'zone') {
      assert.ok(map.ZONE_BY_ID[q.goal.zone], q.id);
      assert.ok(q.label.includes(map.ZONE_BY_ID[q.goal.zone].name), q.id);
    }
    if (q.goal.kind === 'level') {
      const tier = SITES[q.goal.site]?.levels[q.goal.need - 1];
      assert.ok(tier, q.id);
      assert.ok(q.label.includes(tier.name), q.id);
    }
  }
  // Les actes suivent les chapitres, dans l'ordre
  const acts = QUESTS.map(q => CHAPTERS.indexOf(q.act));
  assert.deepEqual(acts, [...acts].sort((a, b) => a - b));
});

test('chaque objectif est atteignable quand sa quête devient active (quartier acheté, chapitre ouvert avant)', () => {
  const zones = new Set(['coeur']);
  let stars = 0;
  for (const q of QUESTS) {
    const open = new Set(CHAPTERS.filter(c => stars >= NEED[c]));
    if (q.goal.kind === 'zone') {
      const zone = map.ZONE_BY_ID[q.goal.zone];
      assert.ok(!zone.chapter || open.has(zone.chapter), `${q.id} : chapitre ${zone.chapter} fermé`);
      zones.add(zone.id);
    }
    if (q.goal.kind === 'level') {
      assert.ok(zones.has(map.siteZone(q.goal.site)), `${q.id} : quartier pas encore acheté`);
      assert.ok(open.has(SITES[q.goal.site].levels[q.goal.need - 1].chapter), `${q.id} : chapitre du palier fermé`);
    }
    if (q.goal.kind === 'stars') stars = q.goal.need;
  }
});

test('avancée d’un objectif, plafonnée', () => {
  assert.deepEqual(progressOf({ kind: 'tiles', need: 10 }, facts({ tiles: 3 })), { have: 3, need: 10 });
  assert.deepEqual(progressOf({ kind: 'stars', need: 5 }, facts({ stars: 9 })), { have: 5, need: 5 });
  assert.deepEqual(progressOf({ kind: 'zone', zone: 'source' }, facts()), { have: 0, need: 1 });
  assert.deepEqual(progressOf({ kind: 'zone', zone: 'source' }, facts({ zones: new Set(['coeur', 'source']) })), { have: 1, need: 1 });
  assert.deepEqual(progressOf({ kind: 'level', site: 'foyer', need: 2 }, facts()), { have: 1, need: 2 });
  assert.deepEqual(progressOf({ kind: 'level', site: 'puits', need: 1 }, facts()), { have: 0, need: 1 });
  assert.deepEqual(progressOf({ kind: 'runs', need: 1 }, facts({ runs: 4 })), { have: 1, need: 1 });
});

test('la quête active est la première non réclamée ; à la fin, Brume se repose', () => {
  const first = active(new Set(), facts());
  assert.equal(first.id, QUESTS[0].id);
  assert.equal(first.step, 1);
  assert.equal(first.total, QUESTS.length);
  assert.equal(first.done, false);
  assert.equal(active(new Set(), facts({ tiles: 1 })).done, true);
  const second = active(new Set([QUESTS[0].id]), facts());
  assert.equal(second.id, QUESTS[1].id);
  assert.equal(second.kind, 'runs');
  assert.equal(second.target, null);
  const source = active(new Set(QUESTS.slice(0, 2).map(q => q.id)), facts());
  assert.deepEqual(source.target, { zone: 'source' });
  const puits = active(new Set(QUESTS.slice(0, 3).map(q => q.id)), facts());
  assert.deepEqual(puits.target, { site: 'puits' });
  assert.equal(active(new Set(QUESTS.map(q => q.id)), facts()), null);
  const board = boardOf(new Set(QUESTS.map(q => q.id)), facts());
  assert.equal(board.quest, null);
  assert.equal(board.done, QUESTS.length);
  assert.ok(board.rested.length > 10);
});
