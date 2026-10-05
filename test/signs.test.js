// Enseignes : catalogue des styles, nom saisi (nettoyé, refusé s'il ne convient pas), nom proposé par défaut
const test = require('node:test');
const assert = require('node:assert/strict');
const signs = require('../src/services/signs');

test('six styles d’enseigne, la planche de bois offerte, les autres payants', () => {
  assert.equal(signs.SIGN_LEVEL, 5);
  assert.deepEqual(signs.STYLES.map(s => s.id), ['bois', 'ardoise', 'fer', 'laiton', 'fleurie', 'lanterne']);
  assert.equal(signs.STYLE_BY_ID.bois.price, 0);
  for (const s of signs.STYLES.slice(1)) assert.ok(s.price > 0, s.id);
  for (const s of signs.STYLES) assert.match(s.id, /^[a-z]{1,20}$/);
});

test('le nom d’enseigne : 2 à 14 lettres ou chiffres, séparateurs simples entre deux, espaces nettoyés', () => {
  assert.equal(signs.cleanName('Alex'), 'Alex');
  assert.equal(signs.cleanName('  Alex   de   la  Mer '), 'Alex de la Mer');
  assert.equal(signs.cleanName('Jean-Pierre'), 'Jean-Pierre');
  assert.equal(signs.cleanName('L’Île'), 'L’Île');
  assert.equal(signs.cleanName('Zoé'), 'Zoé');
  assert.equal(signs.cleanName('42'), '42');
  assert.equal(signs.cleanName('abcdefghijklmn'), 'abcdefghijklmn');
  for (const bad of ['A', '', '   ', 'abcdefghijklmno', 'a--b', '-ab', 'ab-', '<b>', 'a\u0000b', 'x'.repeat(500), null, undefined, ['A', 'b']]) {
    assert.equal(signs.cleanName(bad), null, JSON.stringify(bad));
  }
});

test('le nom proposé vient du premier mot de l’identifiant, sinon « Alchimiste »', () => {
  assert.equal(signs.defaultName('alex.dupont_4821'), 'Alex');
  assert.equal(signs.defaultName('zoé_1234'), 'Zoé');
  assert.equal(signs.defaultName('jean-pierre.martin_9999'), 'Jean');
  assert.equal(signs.defaultName('__1234'), 'Alchimiste');
  assert.equal(signs.defaultName('x_1'), 'Alchimiste');
  assert.equal(signs.defaultName(undefined), 'Alchimiste');
  assert.equal(signs.defaultName('anticonstitutionnellement_1000'), 'Anticonstituti');
});
