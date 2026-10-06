// Le compte provisoire (bible v6, § 9 ; V20) : le tutoriel ouvre l'île avant le compte ; signer la page de garde
// (étape 6) y met l'adresse et le mot de passe du joueur ; les comptes provisoires abandonnés s'effacent
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, randomPassword } = require('./helpers');
const accounts = require('../src/services/accounts');
const { digest } = require('../src/utils/crypto');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const guest = async () => {
  const player = { cookies: {} };
  assert.equal((await api('POST', '/play/guest', {}, player)).status, 200);
  return player;
};
const email = tag => `provisoire-${process.pid}-${Date.now()}-${tag}@exemple.fr`;

test('l’île s’ouvre avant le compte ; signer y met l’adresse et le mot de passe, une seule fois', async () => {
  // Un invité qui a déjà écrit le Vent (son carnet, côté serveur)
  const player = await guest();
  await sql(`UPDATE guest_players SET elements = elements || '["Vent"]'::jsonb WHERE token_hash = $1`, [digest(player.cookies.oc_guest)]);
  // Invité : l'île demande un compte
  assert.equal((await api('GET', '/play/world', null, player)).status, 402);
  // Le compte provisoire : ni adresse ni mot de passe connus, la session de l'appareil
  const made = await api('POST', '/auth/provisional', {}, player);
  assert.equal(made.status, 201);
  assert.equal(made.data.provisional, true);
  assert.match(made.data.username, /^naufrage_[0-9a-f]{16}$/);
  const userId = made.data.userId;
  assert.deepEqual((await api('GET', '/auth/me', null, player)).data, { userId, username: made.data.username, provisional: true });
  // L'île s'ouvre ; le carnet invité a rejoint le compte
  assert.equal((await api('GET', '/play/world', null, player)).status, 200);
  const [progress] = await sql('SELECT infinite_elements FROM progress WHERE user_id = $1', [userId]);
  assert.ok(progress.infinite_elements.includes('Vent'));
  // Déjà un compte : pas un second
  assert.equal((await api('POST', '/auth/provisional', {}, player)).status, 409);

  // Signer : refus d'abord (rien n'est écrit)
  const claim = body => api('POST', '/auth/claim', body, player);
  const password = randomPassword();
  assert.equal((await claim({})).status, 400);
  assert.equal((await claim({ email: 'pas-une-adresse', password })).status, 400);
  assert.equal((await claim({ email: 'x@provisoire.invalid', password })).status, 400);
  assert.match((await claim({ email: email('a'), password: 'court' })).data.message, /8 caractères/);
  const other = await newPlayer();
  const taken = await claim({ email: other.email, password });
  assert.deepEqual([taken.status, taken.data.message], [400, 'Email ou username déjà utilisé']);
  assert.equal((await api('GET', '/auth/me', null, player)).data.provisional, true);
  // Puis la vraie adresse : même compte, même île ; on s'y connecte comme à tout compte
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [userId]);
  const mine = email('b');
  const signed = await claim({ email: mine, password });
  assert.equal(signed.status, 200);
  assert.deepEqual([signed.data.userId, signed.data.provisional], [userId, false]);
  assert.match(signed.data.username, /^provisoire-.*_\d{4}$/);
  assert.equal((await api('GET', '/auth/me', null, player)).data.provisional, false);
  const elsewhere = { cookies: {} };
  const login = await api('POST', '/auth/login', { email: mine, password }, elsewhere);
  assert.equal(login.data.userId, userId);
  const world = (await api('GET', '/play/world', null, elsewhere)).data;
  assert.ok(world.map.zones.find(z => z.id === 'source').owned);
  // Une fois signé, c'est fini ; un compte ordinaire non plus
  assert.equal((await claim({ email: email('c'), password })).status, 409);
  assert.equal((await api('POST', '/auth/claim', { email: email('d'), password }, other)).status, 409);
});

test('deux signatures en même temps avec la même adresse : une seule passe', async () => {
  const [a, b] = [{ cookies: {} }, { cookies: {} }];
  assert.equal((await api('POST', '/auth/provisional', {}, a)).status, 201);
  assert.equal((await api('POST', '/auth/provisional', {}, b)).status, 201);
  const same = { email: email('meme'), password: randomPassword() };
  const results = await Promise.all([api('POST', '/auth/claim', same, a), api('POST', '/auth/claim', same, b)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [same.email]))[0].n, 1);
});

test('un compte provisoire n’a pas de vraie adresse : aucun lien de mot de passe ne part', async () => {
  const player = { cookies: {} };
  const { userId } = (await api('POST', '/auth/provisional', {}, player)).data;
  const [{ email: address }] = await sql('SELECT email FROM users WHERE id = $1', [userId]);
  assert.ok(accounts.isProvisional(address));
  assert.equal((await api('POST', '/auth/forgot-password', { email: address })).status, 200);
  assert.deepEqual(await sql('SELECT 1 FROM password_resets WHERE user_id = $1', [userId]), []);
});

test('les comptes provisoires abandonnés s’effacent, avec leur île ; les autres restent', async () => {
  const old = `NOW() - make_interval(days => ${accounts.PROVISIONAL_DAYS + 10})`;
  const make = async (address, at) => (await sql(
    `INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, 'x', $2, ${at}) RETURNING id`,
    [address, address.split('@')[0]]))[0].id;
  const tag = `${process.pid}${Date.now()}`;
  // Abandonné : vieux, sans session récente, avec une île
  const gone = await make(`naufrage-a${tag}@provisoire.invalid`, old);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [gone]);
  await sql(`INSERT INTO auth_sessions (user_id, family, token_hash, expires_at, created_at) VALUES ($1, gen_random_uuid(), $2, NOW(), ${old})`, [gone, `a${tag}`.padEnd(64, '0')]);
  // Vieux mais encore joué (une session récente) ; ou tout neuf ; ou vieux et signé : ils restent
  const playing = await make(`naufrage-b${tag}@provisoire.invalid`, old);
  await sql(`INSERT INTO auth_sessions (user_id, family, token_hash, expires_at) VALUES ($1, gen_random_uuid(), $2, NOW() + INTERVAL '1 day')`, [playing, `b${tag}`.padEnd(64, '0')]);
  const fresh = await make(`naufrage-c${tag}@provisoire.invalid`, 'NOW()');
  const signed = await make(`signe-${tag}@exemple.fr`, old);
  assert.ok(await accounts.sweepProvisional({ force: true }) >= 1);
  const left = (await sql('SELECT id FROM users WHERE id = ANY($1::int[])', [[gone, playing, fresh, signed]])).map(r => r.id).sort((x, y) => x - y);
  assert.deepEqual(left, [playing, fresh, signed].sort((x, y) => x - y));
  assert.deepEqual(await sql('SELECT 1 FROM world_zones WHERE user_id = $1', [gone]), []);
  // Au plus une fois par heure sans force
  assert.equal(await accounts.sweepProvisional(), 0);
});
