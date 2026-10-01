// Tests de l'API sur une vraie base : le serveur est le seul juge des écus, des succès et de l'énergie
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

test('l’énergie s’achète en quantité positive, et la visite coûte le prix de la région', async () => {
  const player = await newPlayer({ coins: 200 });
  await api('GET', '/explorer/init', null, player);
  await sql('UPDATE progress SET explorer_energy = 10 WHERE user_id = $1', [player.userId]);
  const negative = await api('POST', '/explorer/buy-energy', { amount: -1000 }, player);
  assert.equal(negative.status, 400);
  assert.equal(await coinsOf(player), 200);
  const bought = await api('POST', '/explorer/buy-energy', { amount: 2 }, player);
  assert.equal(bought.data.coins_remaining, 180);
  assert.equal(bought.data.energy, 12);

  const [region] = await sql('SELECT id, energy_cost, energy_reward, coin_reward FROM explorer_regions WHERE is_default = TRUE ORDER BY id LIMIT 1');
  const visit = await api('POST', `/explorer/visit/${region.id}`, { energyCost: -1000 }, player);
  assert.equal(visit.data.energy, 12 - region.energy_cost);

  // Récompense de la base, versée une seule fois, quoi que dise le client
  const done = await api('POST', `/explorer/complete/${region.id}`, { coins: 999999, energy: 999 }, player);
  assert.equal(done.status, 200);
  assert.equal(await coinsOf(player), 180 + region.coin_reward);
  await api('POST', `/explorer/complete/${region.id}`, { coins: 999999 }, player);
  assert.equal(await coinsOf(player), 180 + region.coin_reward);

  // Un gardien ne se déclare vaincu que sur sa propre région
  const fake = await api('POST', `/explorer/complete/${region.id}`, { isBossVictory: true, bossRegionId: 5 }, player);
  assert.equal(fake.status, 400);
});

test('une région verrouillée (gardien compris) ne se visite pas', async () => {
  const player = await newPlayer();
  await api('GET', '/explorer/init', null, player);
  const [boss] = await sql('SELECT id FROM explorer_regions WHERE is_boss = TRUE ORDER BY id LIMIT 1');
  assert.equal((await api('POST', `/explorer/visit/${boss.id}`, {}, player)).status, 403);
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
