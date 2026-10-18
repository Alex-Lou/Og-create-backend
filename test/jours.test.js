// Le compteur de jours de l'île (choix de l'auteur, 18 oct.) : la vue dit d'où il part une fois le tutoriel quitté
// (brume.days : { at, quest }) ; pendant le tutoriel, rien (le jeu compte ses jours lui-même)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const days = async player => (await api('GET', '/play/world', null, player)).data.brume.days;

test('pendant le tutoriel, rien ; passé, l’étape où l’on en était et l’instant ; fini, sa dernière étape', async () => {
  const player = await newPlayer();
  assert.equal(await days(player), null);
  // Passé au soir de Lorena : on en était à la soupe d’Agathe
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte'), ($1, 'veille')`, [player.userId]);
  assert.equal((await api('POST', '/play/world/prologue/skip', {}, player)).status, 200);
  const skipped = await days(player);
  assert.equal(skipped.quest, 'soupe');
  assert.ok(Math.abs(skipped.at - Date.now()) < 60000);
  // Fini : à sa dernière quête réclamée
  const other = await newPlayer();
  await sql(`INSERT INTO world_quests (user_id, quest, claimed_at) VALUES ($1, 'chemin', NOW() - INTERVAL '3 hours')`, [other.userId]);
  const done = await days(other);
  assert.equal(done.quest, 'chemin');
  assert.ok(Math.abs(done.at - (Date.now() - 3 * 3600000)) < 60000);
});
