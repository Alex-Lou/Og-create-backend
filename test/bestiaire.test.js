// Le Bestiaire des animaux rencontrés (choix de l'auteur, 18 oct.) : le premier toucher d'un animal l'y inscrit, une
// seule fois, pour tous les appareils du compte ; un animal inconnu ou mal écrit est refusé
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const meet = (player, id) => api('POST', '/play/world/animal', { id }, player);
const animals = async player => (await api('GET', '/play/world', null, player)).data.animals;

test('un animal rencontré entre au Bestiaire, une seule fois ; les inconnus sont refusés', async () => {
  const player = await newPlayer();
  assert.deepEqual(await animals(player), []);
  assert.equal((await api('POST', '/play/world/animal', { id: 'cerf' }, { cookies: {} })).status, 401);
  for (const bad of ['', 'Cerf', 'cerf!', 'x'.repeat(21)]) assert.equal((await meet(player, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await meet(player, 'licorne')).status, 404);
  // Deux touchers à la fois : une seule rencontre
  const both = await Promise.all([1, 2].map(() => meet(player, 'cerf')));
  assert.deepEqual(both.map(r => r.status), [200, 200]);
  assert.deepEqual(both.map(r => r.data.new).sort(), [false, true]);
  assert.equal(both[0].data.at, both[1].data.at);
  await meet(player, 'lapin');
  // (un égaré repoussé, le Kraken : le nom le plus long passe)
  for (const id of ['salamandre-de-brume', 'kraken']) assert.equal((await meet(player, id)).status, 200, id);
  // (dans l'ordre du livre, avec la date de la rencontre)
  const list = await animals(player);
  assert.deepEqual(list.map(a => a.id), ['lapin', 'cerf', 'kraken', 'salamandre-de-brume']);
  assert.ok(list.every(a => Math.abs(a.at - Date.now()) < 60000));
});

test('une catégorie complète rapporte 25 écus par animal, une seule fois', async () => {
  const player = await newPlayer();
  // (les Êtres de légende : deux animaux)
  const first = await meet(player, 'cerf-blanc');
  assert.deepEqual(first.data.rewards, []);
  assert.equal(first.data.coins, undefined);
  const last = await meet(player, 'phenix');
  assert.deepEqual(last.data.rewards, [{ category: 'legendes', coins: 50 }]);
  assert.equal(typeof last.data.coins, 'number');
  // (redit, ou une autre rencontre ensuite : rien de plus)
  assert.deepEqual((await meet(player, 'phenix')).data.rewards, []);
  const other = await meet(player, 'lapin');
  assert.deepEqual(other.data.rewards, []);
  assert.equal(other.data.coins, undefined);
});
