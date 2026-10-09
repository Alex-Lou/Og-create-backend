// Sessions : cookies httpOnly, aucun jeton lisible, rotation, réutilisation d'un jeton volé, anti-CSRF
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
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

// Le jeton d'accès (15 min) ne survit pas à sa session : il est refusé dès qu'elle est fermée, sur les routes de compte
// (authMiddleware) comme sur celles du jeu (players.resolve)
const accessOnly = player => ({ cookies: { oc_access: player.cookies.oc_access } });
const refused = async (device, label) => {
  const account = await api('GET', '/account', null, device);
  assert.deepEqual([account.status, account.data.code], [401, 'TOKEN_EXPIRED'], `${label} : /account`);
  const play = await api('GET', '/play/state', null, device);
  assert.deepEqual([play.status, play.data.code], [401, 'NO_PLAYER'], `${label} : /play/state`);
};

test('un jeton d’accès copié avant la déconnexion est refusé tout de suite', async () => {
  const player = await newPlayer();
  const copy = accessOnly(player);
  assert.equal((await api('GET', '/account', null, copy)).status, 200);
  assert.equal((await api('GET', '/play/state', null, copy)).status, 200);
  await api('POST', '/auth/logout', null, player);
  await refused(copy, 'après déconnexion');
});

test('nouveau mot de passe : les jetons d’accès des autres appareils tombent, celui-ci continue', async () => {
  const player = await newPlayer();
  const other = { cookies: {} };
  assert.equal((await api('POST', '/auth/login', { email: player.email, password: player.password }, other)).status, 200);
  const otherAccess = accessOnly(other);
  assert.equal((await api('POST', '/account/password', { current: player.password, password: randomPassword() }, player)).status, 200);
  await refused(otherAccess, 'autre appareil');
  assert.equal((await api('GET', '/account', null, player)).status, 200);
  assert.equal((await api('GET', '/play/state', null, player)).status, 200);
});

test('compte en pause ou à supprimer : son jeton d’accès est refusé tout de suite', async () => {
  const paused = await newPlayer();
  const pausedAccess = accessOnly(paused);
  assert.equal((await api('POST', '/account/suspend', {}, paused)).status, 200);
  await refused(pausedAccess, 'en pause');

  const leaving = await newPlayer();
  const leavingAccess = accessOnly(leaving);
  assert.equal((await api('POST', '/account/delete', { password: leaving.password }, leaving)).status, 200);
  await refused(leavingAccess, 'à supprimer');
});

test('le renouvellement garde la session : l’ancien et le nouveau jeton d’accès restent valables', async () => {
  const player = await newPlayer();
  const before = accessOnly(player);
  // (dans la même seconde, le nouveau jeton peut être identique à l'ancien : même session, même iat)
  assert.equal((await api('POST', '/auth/refresh', null, player)).status, 200);
  assert.equal((await api('GET', '/account', null, before)).status, 200);
  assert.equal((await api('GET', '/account', null, player)).status, 200);
});

test('jetons sans session : l’ancien format (sans sid) seulement s’il précède le démarrage ; sid inconnu ou malformé refusé', async () => {
  const player = await newPlayer();
  const username = jwt.decode(player.cookies.oc_access).username;
  const now = Math.floor(Date.now() / 1000);
  const forge = (payload, iat = now) => ({ cookies: { oc_access: jwt.sign(
    { typ: 'access', username, iat, ...payload }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: String(player.userId), expiresIn: 15 * 60 }
  ) } });
  // Signé avant le démarrage de ce serveur (10 min plus tôt, encore 5 min de validité) : la mise à jour ne déconnecte personne
  assert.equal((await api('GET', '/account', null, forge({}, now - 600))).status, 200);
  // Sans sid mais signé après le démarrage : ce serveur n'en signe plus, refusé
  assert.equal((await api('GET', '/account', null, forge({}))).status, 401);
  // sid d'une session qui n'existe pas, ou qui n'est pas un UUID : refusé, sans erreur serveur
  assert.equal((await api('GET', '/account', null, forge({ sid: '00000000-0000-4000-8000-000000000000' }))).status, 401);
  assert.equal((await api('GET', '/account', null, forge({ sid: 'pas-un-uuid' }))).status, 401);
  assert.equal((await api('GET', '/account', null, forge({ sid: 42 }))).status, 401);
  // La session d'un autre compte ne vaut pas pour celui-ci
  const someone = await newPlayer();
  const sid = jwt.decode(someone.cookies.oc_access).sid;
  assert.equal((await api('GET', '/account', null, forge({ sid }))).status, 401);
});
