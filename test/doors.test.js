// Les portes d'un enclos (choix de l'auteur, 15 oct.) : dans le mur (entre deux murs, sentiers compris, ou à la place d'un
// piquet qui retourne dans la réserve), 10 bois ; son verrou, 6 pierres, posé ou ôté ; la nuit, une porte verrouillée
// tient comme une clôture, une porte sans verrou s'ouvre ; personne ne se glisse en diagonale entre deux piquets
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const crafts = require('../src/services/crafts');
const nights = require('../src/services/nights');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('dans le mur : deux murs face à face, à gauche et à droite ou en haut et en bas', () => {
  const walls = new Set(['1,0', '1,2', '5,5', '7,5']);
  const wall = (x, y) => walls.has(`${x},${y}`);
  assert.deepEqual([crafts.inWall(1, 1, wall), crafts.inWall(6, 5, wall), crafts.inWall(2, 1, wall), crafts.inWall(6, 6, wall)], [true, true, false, false]);
});

test('la nuit : une porte verrouillée barre, une porte simple s’ouvre ; pas de glissement en diagonale entre deux piquets', () => {
  const path = nights.lineOf({ x: 10, y: 10 }, { x: 20, y: 10 });
  const walker = { id: 'n:0', kind: 'bete', site: 'puits', path, at: 0, pace: nights.paceOf('bete'), arrives: 10 * nights.paceOf('bete') };
  const door = locked => nights.defenseOf([{ craft: 'porte', x: 14, y: 10, locked }], {});
  assert.deepEqual(nights.fateOf(walker, door(true)), { end: 'barre', step: 4 });
  assert.equal(nights.fateOf(walker, door(false)).end, 'arrive');
  // En biais : deux piquets qui se touchent par le coin, le chemin passe entre eux ; il bute avant
  const slant = nights.lineOf({ x: 10, y: 10 }, { x: 20, y: 20 });
  const corner = nights.defenseOf([{ craft: 'cloture', x: 15, y: 14 }, { craft: 'cloture', x: 14, y: 15 }], {});
  assert.deepEqual(nights.fateOf({ ...walker, path: slant }, corner), { end: 'barre', step: 4 });
  assert.equal(nights.fateOf({ ...walker, path: slant }, nights.defenseOf([{ craft: 'cloture', x: 15, y: 14 }], {})).end, 'arrive');
});

test('poser une porte : dans un trou entre deux piquets ou à la place d’un piquet ; son verrou se paie, s’ôte sans remboursement', async () => {
  const player = await newPlayer();
  const id = player.userId;
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  await view();
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 1) ON CONFLICT (user_id, site) DO UPDATE SET level = 1`, [id]);
  await sql('UPDATE world_stock SET wood = 100, stone = 10 WHERE user_id = $1', [id]);
  // Deux piquets en colonne, un trou entre eux ; un troisième plus bas
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 93, 93), ($1, 'cloture', 93, 95), ($1, 'cloture', 93, 96), ($1, 'cloture', 93, 97)`, [id]);
  const door = body => api('POST', '/play/world/craft/door', body, player);
  // Hors du mur : refusée ; requête mal formée : refusée
  assert.equal((await door({ x: 90, y: 90, lock: false })).status, 400);
  assert.equal((await door({ x: 93, y: 94 })).status, 400);
  // Dans le trou, sans verrou : 10 bois
  const open = await door({ x: 93, y: 94, lock: false });
  assert.equal(open.status, 200, JSON.stringify(open.data));
  const placedAt = (world, x, y) => world.crafts.placed.find(c => c.x === x && c.y === y);
  assert.deepEqual([placedAt(open.data.world, 93, 94).craft, placedAt(open.data.world, 93, 94).locked, open.data.world.stock.wood], ['porte', false, 90]);
  // À la place d'un piquet, avec son verrou : 10 bois, 6 pierres ; le piquet retourne dans la réserve
  const before = open.data.world.crafts.catalog.find(c => c.id === 'cloture').reserve;
  const shut = await door({ x: 93, y: 96, lock: true });
  assert.equal(shut.status, 200, JSON.stringify(shut.data));
  const fence = shut.data.world.crafts.catalog.find(c => c.id === 'cloture');
  assert.deepEqual([placedAt(shut.data.world, 93, 96).craft, placedAt(shut.data.world, 93, 96).locked, shut.data.world.stock.wood, shut.data.world.stock.stone, fence.reserve], ['porte', true, 80, 4, before + 1]);
  // Le verrou : pas deux fois ; pas sans pierres ; ôté, sans remboursement
  const lock = (x, y, on) => api('POST', '/play/world/craft/lock', { x, y, lock: on }, player);
  assert.equal((await lock(93, 96, true)).status, 409);
  assert.equal((await lock(93, 94, true)).status, 409);
  const off = await lock(93, 96, false);
  assert.deepEqual([off.status, placedAt(off.data.world, 93, 96).locked, off.data.world.stock.stone], [200, false, 4]);
  assert.equal((await lock(93, 95, true)).status, 404);
  await sql('UPDATE world_stock SET stone = 6 WHERE user_id = $1', [id]);
  const on = await lock(93, 94, true);
  assert.deepEqual([on.status, placedAt(on.data.world, 93, 94).locked, on.data.world.stock.stone], [200, true, 0]);
});
