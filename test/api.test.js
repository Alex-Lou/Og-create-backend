// Tests de l'API sur une vraie base : le serveur est le seul juge des écus et des succès
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, coinsOf } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('le client ne peut plus écrire son solde', async () => {
  const player = await newPlayer({ coins: 40 });
  await api('POST', '/progress/save', { discoveredElements: ['Eau', 'Feu', 'Terre', 'Air'], coins: 999999 }, player);
  assert.equal(await coinsOf(player), 40);
  const old = await api('POST', '/progress/coins/update', { coins: 999999 }, player);
  assert.equal(old.status, 404);
  assert.equal(await coinsOf(player), 40);
});

test('un succès se mérite côté serveur, pas en le déclarant', async () => {
  const player = await newPlayer();
  const claim = { 'Maître des Arcanes': { unlocked: true, unlockedAt: new Date().toISOString() } };
  await api('POST', '/achievements/update', { achievements: claim }, player);
  const [row] = await sql('SELECT achievements FROM progress WHERE user_id = $1', [player.userId]);
  assert.equal(row.achievements['Maître des Arcanes'], undefined);

  // La pièce méritée reste inaccessible
  const items = (await api('GET', '/customization/items', null, player)).data;
  const ouroboros = items.find(item => item.image_path === 'ouroboros');
  assert.equal((await api('POST', '/customization/purchase', { itemId: ouroboros.id }, player)).status, 403);

  // Une fois les éléments découverts, le succès est reconnu
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Pierre philosophale","Kraken","Centaure"]'::jsonb WHERE user_id = $1`, [player.userId]);
  await api('POST', '/achievements/update', { achievements: claim }, player);
  const [after] = await sql('SELECT achievements FROM progress WHERE user_id = $1', [player.userId]);
  assert.equal(after.achievements['Maître des Arcanes'].unlocked, true);
  const owned = (await api('GET', '/customization/unlocked', null, player)).data.map(item => item.image_path);
  assert.ok(owned.includes('ouroboros'));
});

test('la déconnexion d’un autre joueur est impossible', async () => {
  const victim = await newPlayer();
  await api('POST', '/auth/logout', { userId: victim.userId, refreshToken: 'x' });
  assert.equal((await api('GET', '/auth/me', null, victim)).status, 200);
});

test('le formulaire de contact refuse une adresse invalide', async () => {
  const response = await api('POST', '/contact/send', { email: 'pas-une-adresse', message: '<b>salut</b>' });
  assert.equal(response.status, 400);
});
