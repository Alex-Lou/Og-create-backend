// Anya (bible du dépôt front, § 6.14) : la condition de la Révélation, les traces, la Bénédiction (fonctions pures)
const test = require('node:test');
const assert = require('node:assert/strict');
const anya = require('../src/services/anya');

test('Anya s’éveille quand toute l’île principale est découverte : douze terres explorées, neuf quartiers du cœur', () => {
  assert.equal(anya.LANDS.length, 12);
  assert.equal(anya.CORE.length, 9);
  const core = new Set(['coeur', ...anya.CORE]);
  // Rien d'exploré : aucune trace
  assert.deepEqual(anya.stateOf(core, []), { traces: [], awake: false, revealed: false });
  // Des traces, dans l'ordre du retour ; une expédition refaite ne compte qu'une fois ; les îlots ne sont pas des traces
  assert.deepEqual(anya.stateOf(core, ['roselieres', 'menhirs', 'roselieres', 'phare']).traces, ['roselieres', 'menhirs']);
  // Les douze terres sans tout le cœur : elle dort encore
  assert.equal(anya.stateOf(new Set(['coeur', 'source']), anya.LANDS).awake, false);
  assert.equal(anya.stateOf(core, anya.LANDS.slice(1)).awake, false);
  // Tout : elle s'éveille ; la Révélation vue ne compte qu'une fois éveillée
  assert.deepEqual(anya.stateOf(core, anya.LANDS, true), { traces: anya.LANDS, awake: true, revealed: true });
  assert.equal(anya.stateOf(core, [], true).revealed, false);
});

test('la Bénédiction : l’humeur ne descend plus sous « content », les gisements repoussent en 4 h', () => {
  assert.deepEqual(['heureux', 'content', 'triste'].map(anya.blessedMood), ['heureux', 'content', 'content']);
  assert.equal(anya.BLESSING.regrowMs, 4 * 3600 * 1000);
});
