// La caisse de Lorena ouverte avant qu'elle donne tout ce qu'il faut (choix de l'auteur, 15 oct.) : le serveur la
// complète une fois, tant que la barrière n'est pas finie, jusqu'à ce qu'elle donne aujourd'hui (les piquets de la
// barrière du nord : choix de l'auteur, 19 oct.) ; un compte déjà plus loin, ou une caisse d'aujourd'hui, ne reçoit rien de plus
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const quests = require('../src/services/quests');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const upTo = id => quests.QUESTS.slice(0, quests.QUESTS.findIndex(q => q.id === id) + 1).map(q => q.id);
// Un compte qui a ouvert une ancienne caisse : ses quêtes faites jusqu'à quest, la caisse ouverte, 3 piquets en réserve
async function oldCrate(quest) {
  const player = await newPlayer();
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, upTo(quest)]);
  await sql(`INSERT INTO world_chests (user_id, source, rarity, prize) VALUES ($1, 'caisse:aster', 'commun', '{}')`, [player.userId]);
  await sql(`INSERT INTO world_crafts (user_id, craft) SELECT $1, 'cloture' FROM generate_series(1, 3)`, [player.userId]);
  await sql(`DELETE FROM world_items WHERE user_id = $1 AND item = 'caisse-complete:aster'`, [player.userId]);
  return player;
}
// (ce que la vue montre : les piquets en réserve)
async function reserve(player) {
  const { catalog } = (await api('GET', '/play/world', null, player)).data.crafts;
  return catalog.find(c => c.id === 'cloture').reserve;
}

test('l’ancienne caisse, en plein tutoriel : complétée une fois (les piquets de la barrière)', async () => {
  const player = await oldCrate('chemin-aster');
  assert.equal(await reserve(player), quests.BARRIER);
  // (une fois : les vues suivantes ne donnent rien de plus, même en même temps)
  await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  assert.equal(await reserve(player), quests.BARRIER);
});

test('un compte dont la barrière est finie ne reçoit rien', async () => {
  const player = await oldCrate('barriere');
  assert.equal(await reserve(player), 3);
});

test('la caisse d’aujourd’hui, ouverte au tutoriel : rien de plus', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, upTo('nuit')]);
  assert.equal((await api('POST', '/play/world/chest', { source: 'caisse:aster' }, player)).status, 200);
  assert.equal(await reserve(player), quests.BARRIER);
});
