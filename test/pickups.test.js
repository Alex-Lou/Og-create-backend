// Le tutoriel de la v6 (bible du dépôt front, § 9) : ce que la mer rend sur la Grève, le feu de camp bâti par un
// nouveau compte ; un compte d'avant la v6 garde ses règles (le feu allumé d'office, Cannelle après la Récolte, Rivet
// après la soupe) et ne recule jamais
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const { V6_SINCE } = require('../src/services/players');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const view = async player => (await api('GET', '/play/world', null, player)).data;
const pick = (player, id) => api('POST', '/play/world/pickup', { id }, player);
const foyerOf = world => world.sites.find(s => s.id === 'foyer').level;
const met = world => world.villagers.map(v => v.id);

test('ramasser sur la Grève : une fois, puis la mer en rapporte ; cases inconnues, mal écrites ou recouvertes refusées', async () => {
  const player = await newPlayer({ veteran: false });
  const id = player.userId;
  assert.equal((await pick(player, 'greve-bois-9')).status, 404);
  for (const bad of ['', 'cratere-1', 'greve-BOIS-1', 'greve-bois-12']) assert.equal((await pick(player, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await api('POST', '/play/world/pickup', { id: 'greve-galet-2' }, { cookies: {} })).status, 401);
  // Deux touchers à la fois : un seul ramassage versé
  const both = await Promise.all([1, 2].map(() => pick(player, 'greve-galet-2')));
  assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
  assert.equal((await view(player)).stock.stone, 2);
  // Trois heures plus tard, la mer en a rapporté
  await sql(`UPDATE world_deposits SET gathered_at = gathered_at - INTERVAL '3 hours' WHERE user_id = $1`, [id]);
  assert.equal((await view(player)).pickups.find(p => p.id === 'greve-galet-2').readyIn, 0);
  assert.equal((await pick(player, 'greve-galet-2')).status, 200);
  // Une création posée sur la case la cache : rien à ramasser là
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 93, 98)`, [id]);
  assert.equal((await view(player)).pickups.some(p => p.id === 'greve-bois-1'), false);
  assert.equal((await pick(player, 'greve-bois-1')).status, 404);
  // Les ramassages de la Grève ne comptent pas pour les gisements (quête « trouvaille »)
  await sql('DELETE FROM world_quests WHERE user_id = $1', [id]);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'coeur')`, [id]);
  const trouvaille = (await view(player)).brume.quest;
  assert.deepEqual([trouvaille.id, trouvaille.done], ['trouvaille', false]);
});

test('un nouveau compte bâtit son feu ; Cannelle ne vient qu’au feu, Rivet qu’aux poules', async () => {
  const player = await newPlayer({ veteran: false });
  const id = player.userId;
  const first = await view(player);
  assert.equal(foyerOf(first), 0);
  assert.deepEqual(first.sites.find(s => s.id === 'foyer').next.cost, { wood: 4, stone: 2 });
  // Sans bois ni pierre : refusé ; plus loin dans la chaîne sans feu (la Récolte faite) : Cannelle n'est pas là
  assert.equal((await api('POST', '/play/world/build', { site: 'foyer' }, player)).status, 400);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte')`, [id]);
  assert.deepEqual([met(await view(player)), (await view(player)).brume.quest.id], [['ponton'], 'feu']);
  assert.equal((await api('POST', '/play/world/beasts/cage', {}, player)).status, 403);
  // Le feu réclamé : Cannelle ; la soupe seule n'amène plus Rivet (les poules, si)
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'feu'), ($1, 'soupe')`, [id]);
  const after = await view(player);
  assert.deepEqual([foyerOf(after), met(after).includes('foyer'), met(after).includes('atelier')], [1, true, false]);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'poules')`, [id]);
  assert.equal(met(await view(player)).includes('atelier'), true);
});

test('un compte d’avant la v6 ne recule jamais : feu allumé, Cannelle après la Récolte, Rivet après la soupe', async () => {
  const player = await newPlayer({ veteran: false });
  const id = player.userId;
  // Créé juste avant la v6 (après la bible : pas un vétéran)
  await sql('UPDATE users SET created_at = $2 WHERE id = $1', [id, new Date(V6_SINCE.getTime() - 60000)]);
  const first = await view(player);
  assert.deepEqual([foyerOf(first), met(first)], [1, ['ponton']]);
  // Au milieu du prologue (les pages réclamées) : la Grève s'offre aussi, rien n'est perdu
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages')`, [id]);
  assert.equal((await view(player)).brume.quest.id, 'ramasser');
  // La Récolte réclamée : Cannelle est là, le feu compte comme fait (palier I, sans ligne)
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'ramasser'), ($1, 'recolte')`, [id]);
  const cannelle = await view(player);
  assert.deepEqual([met(cannelle).includes('foyer'), cannelle.brume.quest.id, cannelle.brume.quest.done], [true, 'feu', true]);
  assert.equal((await api('POST', '/play/world/quest', { id: 'feu' }, player)).status, 200);
  // La soupe réclamée : Rivet, sans attendre les poules
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'soupe')`, [id]);
  const rivet = await view(player);
  assert.deepEqual([met(rivet).includes('atelier'), rivet.brume.quest.id], [true, 'poules']);
  // Le feu bâti ensuite (Abri) passe au palier II comme avant
  assert.equal(foyerOf(rivet), 1);
});
