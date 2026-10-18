// Le mode debug (choix de l'auteur, 18 oct. : temporaire) : seuls les comptes de DEBUG_ACCOUNTS ont, dans le jeu, le bouton
// qui recommence l'île d'un appui long ; il passe par le même « Recommencer l'île » que Mon compte
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, newPlayer, randomPassword } = require('./helpers');

const debugEmail = `debug-${process.pid}-${Date.now()}@exemple.fr`;
let server;
test.before(async () => {
  process.env.DEBUG_ACCOUNTS = ` autre@exemple.fr , ${debugEmail.toUpperCase()} `;
  server = await startServer();
});
test.after(() => {
  delete process.env.DEBUG_ACCOUNTS;
  server?.kill();
});

test('le mode debug : le compte listé seulement, et la session obligatoire', async () => {
  assert.equal((await api('GET', '/account/debug', null, { cookies: {} })).status, 401);
  const other = await newPlayer();
  assert.deepEqual((await api('GET', '/account/debug', null, other)).data, { debug: false });
  const player = { email: debugEmail, password: randomPassword(), cookies: {} };
  assert.equal((await api('POST', '/auth/register', { email: player.email, password: player.password }, player)).status, 201);
  assert.deepEqual((await api('GET', '/account/debug', null, player)).data, { debug: true });
  // (le bouton recommence l'île comme Mon compte, autant de fois qu'on veut)
  assert.deepEqual((await api('POST', '/play/world/restart', { confirm: 'RECOMMENCER' }, player)).data, { restarted: true });
});
