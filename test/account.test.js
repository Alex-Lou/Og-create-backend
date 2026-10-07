// Réglages du compte (routes/account.js) : profil, mot de passe, nouvelle adresse confirmée par un lien, pause,
// suppression avec sept jours de grâce, export des données ; se reconnecter lève la pause et annule la suppression
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, randomPassword } = require('./helpers');
const { digest } = require('../src/utils/crypto');
const settings = require('../src/services/accountSettings');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const login = (email, password) => {
  const player = { cookies: {} };
  return api('POST', '/auth/login', { email, password }, player).then(res => ({ res, player }));
};

test('le profil, puis un nouveau mot de passe : l’ancien d’abord, les autres appareils déconnectés', async () => {
  const player = await newPlayer();
  assert.equal((await api('GET', '/account', null, { cookies: {} })).status, 401);
  const profile = (await api('GET', '/account', null, player)).data;
  assert.deepEqual([profile.email, profile.provisional, profile.pendingEmail], [player.email, false, null]);
  assert.ok(profile.createdAt && profile.username);
  assert.deepEqual([profile.name, profile.look], [null, null]);
  await api('POST', '/play/world/player', { name: 'Maëlle' }, player);
  await api('POST', '/play/world/avatar', { look: 'avatar-03' }, player);
  const named = (await api('GET', '/account', null, player)).data;
  assert.deepEqual([named.name, named.look], ['Maëlle', 'avatar-03']);
  const other = (await login(player.email, player.password)).player;
  const next = randomPassword();
  assert.match((await api('POST', '/account/password', { current: 'mauvais-mot', password: next }, player)).data.message, /incorrect/);
  assert.match((await api('POST', '/account/password', { current: player.password, password: 'court' }, player)).data.message, /8 caractères/);
  const done = await api('POST', '/account/password', { current: player.password, password: next }, player);
  assert.equal(done.status, 200);
  // L'autre appareil ne se renouvelle plus ; celui-ci a une session neuve ; l'ancien mot de passe ne marche plus
  assert.equal((await api('POST', '/auth/refresh', {}, other)).status, 401);
  assert.equal((await api('POST', '/auth/refresh', {}, player)).status, 200);
  assert.equal((await login(player.email, player.password)).res.status, 401);
  const again = (await login(player.email, next)).res;
  // Une connexion ordinaire ne dit rien de plus
  assert.deepEqual([again.status, again.data.back], [200, undefined]);
});

test('une nouvelle adresse : refusée si fausse, prise ou la même ; confirmée une seule fois par le lien', async () => {
  const player = await newPlayer();
  const someone = await newPlayer();
  const ask = (email, password = player.password) => api('POST', '/account/email', { email, password }, player);
  assert.equal((await ask('pas-une-adresse')).status, 400);
  assert.equal((await ask(`ailleurs-${Date.now()}@exemple.fr`, 'mauvais-mot')).status, 403);
  assert.equal((await ask(player.email)).status, 400);
  assert.equal((await ask(someone.email)).status, 409);
  // Sans serveur de mail (tests), le lien ne part pas : la demande n'attend pas pour rien
  const fresh = `ailleurs-${process.pid}-${Date.now()}@exemple.fr`;
  const sent = await ask(fresh);
  assert.ok([200, 503].includes(sent.status), String(sent.status));
  if (sent.status === 503) assert.deepEqual(await sql('SELECT 1 FROM email_changes WHERE user_id = $1', [player.userId]), []);
  // Le lien (posé ici à la main, comme s'il était parti)
  const token = 'b'.repeat(63) + String(player.userId % 10);
  await sql(`INSERT INTO email_changes (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
    ON CONFLICT (user_id) DO UPDATE SET new_email = EXCLUDED.new_email, token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
    [player.userId, fresh, digest(token)]);
  assert.equal((await api('GET', '/account', null, player)).data.pendingEmail, fresh);
  assert.equal((await api('POST', '/account/email/confirm', { token: 'x' }, { cookies: {} })).status, 400);
  const confirmed = await api('POST', '/account/email/confirm', { token }, { cookies: {} });
  assert.deepEqual([confirmed.status, confirmed.data.email], [200, fresh]);
  assert.equal((await api('POST', '/account/email/confirm', { token }, { cookies: {} })).status, 400);
  assert.equal((await login(fresh, player.password)).res.status, 200);
  assert.equal((await login(player.email, player.password)).res.status, 401);
});

test('en pause : déconnecté partout, l’île gardée ; se reconnecter réactive le compte', async () => {
  const player = await newPlayer({ coins: 120 });
  const paused = await api('POST', '/account/suspend', {}, player);
  assert.equal(paused.status, 200);
  assert.equal((await api('POST', '/auth/refresh', {}, player)).status, 401);
  assert.ok((await sql('SELECT suspended_at FROM users WHERE id = $1', [player.userId]))[0].suspended_at);
  const { res, player: back } = await login(player.email, player.password);
  assert.deepEqual([res.status, res.data.back], [200, 'suspendu']);
  assert.equal((await sql('SELECT suspended_at FROM users WHERE id = $1', [player.userId]))[0].suspended_at, null);
  assert.equal((await api('GET', '/coins/balance', null, back)).data.coins, 120);
});

test('supprimer : mot de passe d’abord, sept jours de grâce annulés par une reconnexion, puis tout s’efface', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  assert.equal((await api('POST', '/account/delete', { password: 'mauvais-mot' }, player)).status, 403);
  const planned = await api('POST', '/account/delete', { password: player.password }, player);
  assert.equal(planned.status, 200);
  const days = (new Date(planned.data.deleteAt).getTime() - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days <= 7, String(days));
  assert.equal((await api('POST', '/auth/refresh', {}, player)).status, 401);
  // Revenu avant la fin : rien n'est supprimé
  const { res, player: back } = await login(player.email, player.password);
  assert.deepEqual([res.status, res.data.back], [200, 'suppression']);
  assert.equal(await settings.sweepDeleted().then(() => sql('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [player.userId])).then(r => r[0].n), 1);
  // Parti pour de bon : la grâce passée, le compte et son île s'effacent
  assert.equal((await api('POST', '/account/delete', { password: player.password }, back)).status, 200);
  await sql(`UPDATE users SET delete_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [player.userId]);
  assert.ok((await settings.sweepDeleted()) >= 1);
  assert.deepEqual(await sql('SELECT 1 FROM users WHERE id = $1', [player.userId]), []);
  assert.deepEqual(await sql('SELECT 1 FROM world_stock WHERE user_id = $1', [player.userId]), []);
  assert.equal((await login(player.email, player.password)).res.status, 401);
});

test('mes données : le compte sans empreinte, l’île et le carnet ; jamais les sessions ni les jetons', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  const out = await api('GET', '/account/export', null, player);
  assert.equal(out.status, 200);
  assert.equal(out.data.account.email, player.email);
  assert.equal(out.data.account.password_hash, undefined);
  assert.ok(out.data.data.progress && out.data.data.world_stock);
  assert.equal(out.data.data.auth_sessions, undefined);
  assert.equal((await api('GET', '/account/export', null, { cookies: {} })).status, 401);
});

test('un compte provisoire signe d’abord sa page de garde', async () => {
  const player = { cookies: {} };
  assert.equal((await api('POST', '/play/guest', {}, player)).status, 200);
  assert.equal((await api('POST', '/auth/provisional', {}, player)).status, 201);
  assert.equal((await api('GET', '/account', null, player)).data.provisional, true);
  assert.match((await api('POST', '/account/suspend', {}, player)).data.message, /page de garde/);
});
