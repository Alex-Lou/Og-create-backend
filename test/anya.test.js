// Anya (bible du dépôt front, § 6.14, v6) : la condition de la Révélation, les traces, l'errance, la Bénédiction
// (fonctions pures)
const test = require('node:test');
const assert = require('node:assert/strict');
const anya = require('../src/services/anya');

test('Anya s’éveille quand le cœur de l’île est libéré : les huit quartiers, sans les terres lointaines', () => {
  assert.equal(anya.CORE.length, 8);
  assert.equal(anya.LANDS.length, 12);
  const core = new Set(['coeur', ...anya.CORE]);
  // Les huit quartiers suffisent ; la Révélation vue ne compte qu'une fois éveillée
  assert.deepEqual(anya.stateOf(core, [], true), { traces: [1, 2, 3, 4, 5, 6, 7, 8], awake: true, revealed: true });
  assert.equal(anya.stateOf(new Set(['coeur']), [], true).revealed, false);
  // Un quartier manque : elle dort, même avec les douze terres explorées
  const missing = new Set(['coeur', ...anya.CORE.slice(1)]);
  assert.equal(anya.stateOf(missing, anya.LANDS).awake, false);
  assert.equal(anya.awakeOf(core), true);
});

test('les huit traces : une par quartier libéré après La Source, dans l’ordre ; celles de la v5 restent acquises', () => {
  const owned = ids => new Set(['coeur', ...ids]);
  // La Source seule : aucune trace ; puis une par quartier, quel que soit le quartier
  assert.deepEqual(anya.stateOf(owned(['source']), []).traces, []);
  assert.deepEqual(anya.stateOf(owned(['source', 'hameau']), []).traces, [1]);
  assert.deepEqual(anya.stateOf(owned(['source', 'lisiere', 'crique', 'foret']), []).traces, [1, 2, 3]);
  // Un joueur de la v5 garde ses traces (une par terre explorée ; une terre refaite ou un îlot ne comptent pas)…
  assert.deepEqual(anya.stateOf(owned(['source']), ['roselieres', 'menhirs', 'roselieres', 'phare']).traces, [1, 2]);
  assert.deepEqual(anya.stateOf(owned(['source', 'lisiere', 'crique']), ['menhirs']).traces, [1, 2]);
  // … sans aller jusqu'à la huitième, celle de la Révélation
  assert.deepEqual(anya.stateOf(owned(['source']), anya.LANDS).traces, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(anya.TRACE_COUNT, 8);
});

test('l’errance : deux ou trois passages par semaine, à l’aube ou au crépuscule, toujours les mêmes pour un joueur', () => {
  // Le lundi et le rang d'un jour (0 : lundi … 6 : dimanche)
  assert.deepEqual(anya.weekOf('2026-10-05'), { monday: '2026-10-05', rank: 0 });
  assert.deepEqual(anya.weekOf('2026-10-11'), { monday: '2026-10-05', rank: 6 });
  assert.deepEqual(anya.weekOf('2027-01-01'), { monday: '2026-12-28', rank: 4 });
  let total = 0;
  for (let user = 1; user <= 50; user++) {
    for (let week = 0; week < 20; week++) {
      const monday = new Date(Date.UTC(2026, 0, 5 + 7 * week)).toISOString().slice(0, 10);
      const visits = anya.visitsOf(user, monday);
      assert.ok(visits.length === 2 || visits.length === 3);
      // Des jours différents, dans l'ordre ; un moment chacun
      assert.deepEqual(visits.map(v => v.rank), [...new Set(visits.map(v => v.rank))].sort((a, b) => a - b));
      assert.ok(visits.every(v => v.rank >= 0 && v.rank <= 6 && anya.SLOTS.includes(v.slot)));
      // La même graine donne les mêmes passages
      assert.deepEqual(anya.visitsOf(user, monday), visits);
      total += visits.length;
    }
  }
  // Environ deux et demi par semaine
  assert.ok(total / 1000 > 2.3 && total / 1000 < 2.7, `moyenne : ${total / 1000}`);
});

test('le passage du jour : un endroit parmi ceux de l’île à soi, le même sur tous les appareils', () => {
  const places = [{ cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }, { cells: [] }, { cells: [{ x: 9, y: 9 }] }];
  const monday = '2026-10-05';
  const visits = anya.visitsOf(7, monday);
  const day = rank => new Date(Date.UTC(2026, 9, 5 + rank)).toISOString().slice(0, 10);
  for (let rank = 0; rank < 7; rank++) {
    const planned = visits.find(v => v.rank === rank);
    const visit = anya.visitOn(7, day(rank), places);
    assert.equal(anya.visitsOn(7, day(rank)), Boolean(planned));
    if (!planned) {
      assert.equal(visit, null);
      continue;
    }
    // Un endroit qui a des cases (le quartier sans case libre n'est jamais choisi), le moment prévu
    assert.equal(visit.slot, planned.slot);
    assert.ok([[1, 1], [2, 1], [9, 9]].some(([x, y]) => visit.x === x && visit.y === y));
    assert.deepEqual(anya.visitOn(7, day(rank), places), visit);
  }
  // Nulle part où passer : pas de passage
  assert.equal(anya.visitOn(7, day(visits[0].rank), [{ cells: [] }]), null);
});

test('la Bénédiction : l’humeur ne descend plus sous « content », les gisements repoussent en 4 h', () => {
  assert.deepEqual(['heureux', 'content', 'triste'].map(anya.blessedMood), ['heureux', 'content', 'content']);
  assert.equal(anya.BLESSING.regrowMs, 4 * 3600 * 1000);
});
