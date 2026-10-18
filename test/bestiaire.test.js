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
  // (dans l'ordre du livre, avec la date de la rencontre)
  const list = await animals(player);
  assert.deepEqual(list.map(a => a.id), ['lapin', 'cerf']);
  assert.ok(list.every(a => Math.abs(a.at - Date.now()) < 60000));
});
