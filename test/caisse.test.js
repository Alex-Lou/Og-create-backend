// La caisse de Lorena ouverte avant qu'elle donne l'enclos entier (13 piquets, sans portes ; choix de l'auteur,
// 15 oct.) : le serveur la complète une fois, tant que l'enclos n'est pas fini, jusqu'à ce qu'elle donne aujourd'hui
// (20 piquets, deux portes à verrou) ; un compte déjà plus loin, ou une caisse d'aujourd'hui, ne reçoit rien de plus
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const quests = require('../src/services/quests');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const upTo = id => quests.QUESTS.slice(0, quests.QUESTS.findIndex(q => q.id === id) + 1).map(q => q.id);
// Un compte qui a ouvert l'ancienne caisse : ses quêtes faites jusqu'à quest, la caisse ouverte, 13 piquets en réserve
async function oldCrate(quest) {
  const player = await newPlayer();
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, upTo(quest)]);
  await sql(`INSERT INTO world_chests (user_id, source, rarity, prize) VALUES ($1, 'caisse:aster', 'commun', '{}')`, [player.userId]);
  await sql(`INSERT INTO world_crafts (user_id, craft) SELECT $1, 'cloture' FROM generate_series(1, 13)`, [player.userId]);
  await sql(`DELETE FROM world_items WHERE user_id = $1 AND item = 'caisse-complete:aster'`, [player.userId]);
  return player;
}
// (ce que la vue montre : les piquets et les portes en réserve, les portes qui ont leur verrou)
async function reserve(player) {
  const { catalog } = (await api('GET', '/play/world', null, player)).data.crafts;
  const of = id => catalog.find(c => c.id === id);
  return [of('cloture').reserve, of('porte').reserve, of('porte').lock.ready];
}

test('l’ancienne caisse, en plein tutoriel : complétée une fois (7 piquets, deux portes à verrou)', async () => {
  const player = await oldCrate('chemin-aster');
  assert.deepEqual(await reserve(player), [quests.ENCLOS, quests.ENCLOS_DOORS, quests.ENCLOS_DOORS]);
  // (une fois : les vues suivantes ne donnent rien de plus, même en même temps)
  await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  assert.deepEqual(await reserve(player), [quests.ENCLOS, quests.ENCLOS_DOORS, quests.ENCLOS_DOORS]);
});

test('un compte dont l’enclos est fini ne reçoit rien', async () => {
  const player = await oldCrate('portes');
  assert.deepEqual(await reserve(player), [13, 0, 0]);
});

test('la caisse d’aujourd’hui, ouverte au tutoriel : rien de plus', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, upTo('nuit')]);
  assert.equal((await api('POST', '/play/world/chest', { source: 'caisse:aster' }, player)).status, 200);
  assert.deepEqual(await reserve(player), [quests.ENCLOS, quests.ENCLOS_DOORS, quests.ENCLOS_DOORS]);
});
