// Erreurs du jeu envoyées par le navigateur (services/clientErrors.js, routes/clientErrors.js) : nettoyées, bornées,
// sans rien qui désigne le joueur ; la route répond 204, refuse ce qui n'est pas une erreur, et se limite en débit
const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, LIMITS } = require('../src/services/clientErrors');
const { startServer, api } = require('./helpers');

test('un rapport d’erreur : gardé tel quel s’il est propre', () => {
  assert.deepEqual(clean({ kind: 'vue', message: 'x is undefined', info: 'render function', mode: 'world', version: 'abc123' }),
    { kind: 'vue', message: 'x is undefined', info: 'render function', mode: 'world', version: 'abc123' });
});

test('un rapport d’erreur : ni adresse e-mail, ni paramètres d’adresse web (jetons), ni caractères de contrôle', () => {
  const report = clean({
    kind: 'error',
    message: 'Échec pour alice@exemple.fr\u0007 sur https://brumelune.eu/?reset=abcdef0123',
    source: 'https://brumelune.eu/js/index.js?v=2:10:5',
    stack: 'Error: boom\n    at f (https://brumelune.eu/js/a.js?x=1:2:3)\n    at g (b.js:4:5)'
  });
  assert.equal(report.message, 'Échec pour [adresse]  sur https://brumelune.eu/');
  assert.equal(report.source, 'https://brumelune.eu/js/index.js');
  assert.equal(report.stack, 'Error: boom\n    at f (https://brumelune.eu/js/a.js)\n    at g (b.js:4:5)');
});

test('un rapport d’erreur : borné ; refusé sans genre connu ni message ; champs non textuels ignorés', () => {
  const long = clean({ kind: 'rejection', message: 'm'.repeat(1000), stack: 's'.repeat(5000), mode: { a: 1 } });
  assert.equal(long.message.length, LIMITS.message);
  assert.equal(long.stack.length, LIMITS.stack);
  assert.equal(long.mode, undefined);
  for (const bad of [null, [], 'texte', {}, { kind: 'autre', message: 'x' }, { kind: 'error' }, { kind: 'error', message: '   ' }, { kind: 'error', message: 42 }]) {
    assert.equal(clean(bad), null, JSON.stringify(bad));
  }
});

test.describe('route', () => {
  let server;
  test.before(async () => { server = await startServer(); });
  test.after(() => server?.kill());

  test('POST /client-errors : 204, 400 si ce n’est pas une erreur, 403 sans l’en-tête du jeu, 429 au-delà de 10 par minute', async () => {
    const send = (body, options) => api('POST', '/client-errors', body, null, options);
    assert.equal((await send({ kind: 'error', message: 'boom' })).status, 204);
    assert.equal((await send({ kind: 'error' })).status, 400);
    assert.equal((await send({ kind: 'error', message: 'boom' }, { csrf: false })).status, 403);
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await send({ kind: 'error', message: `boom ${i}` })).status);
    assert.equal(statuses.at(-1), 429);
    assert.ok(statuses.filter(s => s === 204).length >= 7, statuses.join(','));
  });
});
