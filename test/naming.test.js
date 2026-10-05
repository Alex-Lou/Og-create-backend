// Noms choisis par le joueur : règles communes (bâtiments, quartiers jusqu'à 22 caractères ; enseignes 14)
const test = require('node:test');
const assert = require('node:assert/strict');
const naming = require('../src/services/naming');
const signs = require('../src/services/signs');

test('un nom : 2 à 22 lettres ou chiffres, un séparateur seulement entre deux, espaces nettoyés', () => {
  assert.equal(naming.NAME_MAX, 22);
  assert.equal(naming.cleanName('  Port   de la Lune bleue '), 'Port de la Lune bleue');
  assert.equal(naming.cleanName('Ma Plage'), 'Ma Plage');
  assert.equal(naming.cleanName('L’Anse-aux-Fées'), 'L’Anse-aux-Fées');
  assert.equal(naming.cleanName('x'.repeat(22)), 'x'.repeat(22));
  for (const bad of ['x', 'x'.repeat(23), 'a  -b', '-ab', 'ab-', '<b>', '', null]) assert.equal(naming.cleanName(bad), null, JSON.stringify(bad));
  // L'enseigne garde sa limite de 14
  assert.equal(signs.cleanName('Port de la Lune'), null);
  assert.equal(signs.cleanName('Zoé des Îles'), 'Zoé des Îles');
});
