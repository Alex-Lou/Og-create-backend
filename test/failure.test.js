// Le dernier recours (utils/failure.js), sur une petite application Express : ce que le joueur lit quand une route
// refuse (HttpError) ou tombe en panne (failsWith), et ce que le journal garde
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { HttpError, failsWith, lastResort } = require('../src/utils/failure');
const { SERVER_ERROR } = require('../src/texts/errors');

let server, base;
test.before(async () => {
  const app = express();
  app.get('/panne', failsWith('Le solde est indisponible.'), async () => { throw new Error('base injoignable'); });
  app.get('/panne-muette', async () => { throw new Error('base injoignable'); });
  app.get('/refus', failsWith('Le solde est indisponible.'), async () => { throw new HttpError(409, 'Déjà pris.'); });
  app.use(lastResort);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server?.close());

const call = async route => {
  const response = await fetch(base + route);
  return { status: response.status, body: await response.json() };
};

test('une panne : 500, le message de la route, la pile au journal (jamais au joueur)', async t => {
  const logged = t.mock.method(console, 'error', () => {});
  const { status, body } = await call('/panne');
  assert.equal(status, 500);
  assert.deepEqual(body, { message: 'Le solde est indisponible.' });
  assert.match(logged.mock.calls[0].arguments.join(' '), /GET \/panne[\s\S]*base injoignable[\s\S]*at /);
});

test('une panne sans message de route : le message générique', async t => {
  t.mock.method(console, 'error', () => {});
  assert.deepEqual(await call('/panne-muette'), { status: 500, body: { message: SERVER_ERROR } });
});

test('une erreur attendue (HttpError) : son statut et son message, rien au journal', async t => {
  const logged = t.mock.method(console, 'error', () => {});
  assert.deepEqual(await call('/refus'), { status: 409, body: { message: 'Déjà pris.' } });
  assert.equal(logged.mock.callCount(), 0);
});
