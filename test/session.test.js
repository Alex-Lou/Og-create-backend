// Sessions : cookies httpOnly, aucun jeton lisible, rotation, réutilisation d'un jeton volé, anti-CSRF
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, newPlayer, randomPassword } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('la connexion pose des cookies httpOnly et ne renvoie aucun jeton', async () => {
  const player = await newPlayer();
  const login = await api('POST', '/auth/login', { email: player.email, password: player.password }, player);
  assert.equal(login.status, 200);
  assert.deepEqual(Object.keys(login.data).sort(), ['userId', 'username']);
  assert.equal(login.setCookies.length, 2);
  for (const line of login.setCookies) {
    assert.match(line, /HttpOnly/i);
    assert.match(line, /SameSite=Strict/i);
  }
  assert.ok(login.setCookies.some(line => /^oc_refresh=.*Path=\/api\/auth/i.test(line)));
});

test('un nouveau mot de passe : 8 caractères au moins, 72 octets au plus (bcrypt ne lit pas plus loin)', async () => {
  const register = password => api('POST', '/auth/register', { email: `long-${Date.now()}-${Math.random()}@exemple.fr`, password });
  const tooLong = /trop long : 72 caractères au plus/;
  assert.equal((await register('court')).status, 400);
  const long = await register('a'.repeat(73));
  assert.deepEqual([long.status, tooLong.test(long.data.message)], [400, true]);
  // 37 « é » font 74 octets ; 36, 72
  assert.equal((await register('é'.repeat(37))).status, 400);
  assert.equal((await register('é'.repeat(36))).status, 201);
  assert.equal((await register('a'.repeat(72))).status, 201);
  // Même règle pour un mot de passe oublié (vérifiée avant le lien)
  const reset = password => api('POST', '/auth/reset-password', { token: 'a'.repeat(64), password });
  const longReset = await reset('a'.repeat(73));
  assert.deepEqual([longReset.status, tooLong.test(longReset.data.message)], [400, true]);
  assert.match((await reset('court')).data.message, /au moins 8 caractères/);
  assert.match((await reset('a'.repeat(72))).data.message, /Lien invalide/);
});

test('un mauvais mot de passe et une adresse inconnue répondent pareil', async () => {
  const player = await newPlayer();
  const guess = randomPassword();
  const wrong = await api('POST', '/auth/login', { email: player.email, password: guess });
  const unknown = await api('POST', '/auth/login', { email: 'personne@exemple.fr', password: guess });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.data, unknown.data);
});

test('un jeton dans l’en-tête Authorization n’ouvre rien', async () => {
  const player = await newPlayer();
  const access = player.cookies.oc_access;
  assert.equal((await api('GET', '/auth/me', null, null, { headers: { Authorization: `Bearer ${access}` } })).status, 401);
});

test('une écriture sans l’en-tête de l’application est refusée (CSRF)', async () => {
  const player = await newPlayer();
  assert.equal((await api('POST', '/coins/spend', { reason: 'joker' }, player, { csrf: false })).status, 403);
});

test('le jeton de rafraîchissement change à chaque usage ; un ancien jeton réutilisé coupe la session', async () => {
  const player = await newPlayer();
  const stolen = player.cookies.oc_refresh;
  const first = await api('POST', '/auth/refresh', null, player);
  assert.equal(first.status, 200);
  assert.notEqual(player.cookies.oc_refresh, stolen);

  // Le voleur rejoue l'ancien jeton : toute la famille est révoquée, la victime aussi doit se reconnecter
  const thief = { cookies: { oc_refresh: stolen } };
  assert.equal((await api('POST', '/auth/refresh', null, thief)).status, 401);
  assert.equal((await api('POST', '/auth/refresh', null, player)).status, 401);
});

test('la déconnexion révoque la session', async () => {
  const player = await newPlayer();
  const refresh = player.cookies.oc_refresh;
  await api('POST', '/auth/logout', null, player);
  assert.equal((await api('POST', '/auth/refresh', null, { cookies: { oc_refresh: refresh } })).status, 401);
});
