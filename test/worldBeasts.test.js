// Les bêtes de ferme, avec la base et l'API (bible du dépôt front, § 6.16, v6) : la cage des poules de Cannelle, la
// fiche, nourrir, la bulle, ramasser
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const herdOf = async player => (await api('GET', '/play/world', null, player)).data.beasts;

// Cannelle est là (les quêtes du prologue d'avant sa venue : les pages, la Récolte)
const withCannelle = id => sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'recolte') ON CONFLICT DO NOTHING`, [id]);
const cageOf = async player => ((await api('GET', '/play/world', null, player)).data.camp || []).find(c => c.id === 'cage') || null;

test('la cage de Cannelle : au camp dès qu’elle est là, ouverte une fois ; Paprika, Brioche et Madame en sortent', async () => {
  // Un compte d'après la bible (un ancien compte a déjà Cannelle, et la cage à ouvrir)
  const player = await newPlayer({ veteran: false });
  const id = player.userId;
  const open = () => api('POST', '/play/world/beasts/cage', {}, player);
  // Avant Cannelle : ni cage ni poules
  assert.equal(await cageOf(player), null);
  assert.deepEqual((await herdOf(player)).list, []);
  assert.equal((await open()).status, 403);
  assert.deepEqual([(await api('POST', '/play/world/beast/feed', { beast: 'poule-rousse' }, player)).data.message], ['Ouvre d’abord la cage des poules, au camp.']);
  // Cannelle est là : la cage, coincée sous les rochers
  await withCannelle(id);
  assert.equal((await cageOf(player)).art, 'cage_coincee');
  const opened = await open();
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.data.hens, ['Paprika', 'Brioche', 'Madame']);
  assert.equal(opened.data.world.camp.find(c => c.id === 'cage').art, 'cage_ouverte');
  // Elles sortent affamées, sans le Potager ; ouverte une seule fois
  assert.deepEqual(opened.data.world.beasts.list.map(b => [b.id, b.name, b.daily, b.fed, b.refill, b.ready]),
    [['poule-rousse', 'Paprika', 4, false, true, 0], ['poule-blanche', 'Brioche', 4, false, true, 0], ['poule-noire', 'Madame', 0, false, true, 0]]);
  assert.equal((await open()).status, 409);
  // Le Potager III ajoute la vache, pas d'autres poules
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'jardins')`, [id]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 3)`, [id]);
  assert.deepEqual((await herdOf(player)).list.map(b => b.id), ['poule-rousse', 'poule-blanche', 'poule-noire', 'vache']);
});

test('nourrir une poule, voir sa bulle se remplir, ramasser les œufs ; Madame juge', async () => {
  const player = await newPlayer();
  const id = player.userId;
  const feed = beast => api('POST', '/play/world/beast/feed', { beast }, player);
  await withCannelle(id);
  await api('POST', '/play/world/beasts/cage', {}, player);
  const herd = await herdOf(player);
  assert.deepEqual(herd.cost, { food: 2 });
  // Refus : mal écrite, inconnue, pas encore là (sans Potager), sans vivres
  assert.equal((await feed('Poule!')).status, 400);
  assert.equal((await feed('licorne')).status, 404);
  assert.equal((await feed('vache')).status, 403);
  await sql('UPDATE world_stock SET food = 1 WHERE user_id = $1', [id]);
  assert.deepEqual([(await feed('poule-rousse')).status, (await feed('poule-rousse')).data.message], [400, 'Il te faut 2 vivres pour la nourrir.']);
  // Nourrie : 2 vivres ; contente ; pas encore faim
  await sql('UPDATE world_stock SET food = 7 WHERE user_id = $1', [id]);
  const fed = await feed('poule-rousse');
  assert.equal(fed.status, 200);
  assert.equal(fed.data.world.stock.food, 5);
  const hen = fed.data.world.beasts.list.find(b => b.id === 'poule-rousse');
  assert.deepEqual([hen.fed, hen.refill, hen.ready], [true, false, 0]);
  assert.equal((await feed('poule-rousse')).status, 409);
  assert.equal((await feed('poule-noire')).status, 200);

  // 13 heures plus tard : deux œufs dans la bulle de Paprika, et elle peut de nouveau manger ; Madame, contente, rien
  await sql(`UPDATE world_beasts SET fed_at = fed_at - INTERVAL '13 hours', collected_at = collected_at - INTERVAL '13 hours' WHERE user_id = $1`, [id]);
  const later = (await herdOf(player)).list;
  assert.deepEqual([later[0].ready, later[0].refill], [2, true]);
  assert.deepEqual([later[2].fed, later[2].ready], [true, 0]);
  // Ramasser : les œufs vont aux vivres ; une seconde fois, la bulle est vide
  const collected = await api('POST', '/play/world/beasts/collect', {}, player);
  assert.equal(collected.status, 200);
  assert.equal(collected.data.food, 2);
  assert.equal(collected.data.world.stock.food, 5);
  assert.equal(collected.data.world.beasts.list.find(b => b.id === 'poule-rousse').ready, 0);
  assert.equal((await api('POST', '/play/world/beasts/collect', {}, player)).data.food, 0);
  // La nourrir de nouveau : l'heure de l'œuf en cours reste due
  assert.equal((await feed('poule-rousse')).status, 200);
  const [row] = await sql(`SELECT EXTRACT(EPOCH FROM fed_at - collected_at) / 3600 AS behind FROM world_beasts WHERE user_id = $1 AND beast = 'poule-rousse'`, [id]);
  assert.ok(Math.abs(Number(row.behind) - 1) < 0.01, `${row.behind} h`);
});

test('nourrie deux fois à la fois : un seul repas payé', async () => {
  const player = await newPlayer();
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'jardins')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 3)`, [player.userId]);
  await herdOf(player);
  await sql('UPDATE world_stock SET food = 10 WHERE user_id = $1', [player.userId]);
  const both = await Promise.all([1, 2].map(() => api('POST', '/play/world/beast/feed', { beast: 'vache' }, player)));
  assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
  assert.equal((await api('GET', '/play/world', null, player)).data.stock.food, 8);
});
