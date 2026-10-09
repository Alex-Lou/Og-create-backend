// Limite globale de requêtes (app.js : tooMany) : la réponse 429 dit combien de minutes attendre, et porte un message
// que le jeu affiche (utils/errors.js lit « message »)
const test = require('node:test');
const assert = require('node:assert/strict');

// Ce fichier a son propre serveur : une limite globale basse, pour l'atteindre vite
process.env.RATE_LIMIT_MAX_REQUESTS = '3';
process.env.RATE_LIMIT_WINDOW_MINUTES = '15';
const { startServer, api } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('au-delà de la limite : 429, les minutes à attendre (1 à 15) et un message lisible', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await api('GET', '/achievements')).status, 200);
  const res = await api('GET', '/achievements');
  assert.equal(res.status, 429);
  assert.equal(res.data.error, 'Trop de requêtes');
  assert.ok(Number.isInteger(res.data.retryAfter) && res.data.retryAfter >= 1 && res.data.retryAfter <= 15, String(res.data.retryAfter));
  assert.equal(res.data.message, `Trop de requêtes, réessaie dans ${res.data.retryAfter} min.`);
});
