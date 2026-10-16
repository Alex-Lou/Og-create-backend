// Le pavé (choix de l'auteur, 16 oct.) : une case de chemin se pave une fois la Carrière bâtie, 3 pierres la case,
// rendues quand on la dépave, qu'on l'efface ou qu'un bâtiment la recouvre ; ni sur l'herbe, ni deux fois
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const paths = require('../src/services/world/paths');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('paver, dépaver, effacer : la Carrière d’abord, 3 pierres la case, rendues', async () => {
  const player = await newPlayer();
  const id = player.userId;
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const send = body => api('POST', '/play/world/paths', body, player);
  const start = await view();
  assert.deepEqual(start.roads.pave, { stone: paths.PAVE_STONE, open: false });
  assert.deepEqual(start.roads.paved, []);
  await sql('UPDATE world_stock SET stone = 20 WHERE user_id = $1', [id]);
  // (une case du sentier d'une île neuve, un chemin dès le départ)
  const [sx, sy] = [95, 91];
  // Sans Carrière : refusé
  assert.equal((await send({ pave: [[sx, sy]] })).status, 403);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'carriere', 1) ON CONFLICT (user_id, site) DO UPDATE SET level = 1`, [id]);
  // Sur l'herbe : refusé ; sur le sentier : 3 pierres
  assert.equal((await send({ pave: [[sx + 3, sy]] })).status, 400);
  const paved = await send({ pave: [[sx, sy], [sx, sy + 1]] });
  assert.equal(paved.status, 200, JSON.stringify(paved.data));
  assert.deepEqual([paved.data.paved, paved.data.world.stock.stone, paved.data.world.roads.paved, paved.data.world.roads.pave.open], [2, 14, [[sx, sy], [sx, sy + 1]], true]);
  // Deux fois : refusé ; dépaver ce qui ne l'est pas : refusé
  assert.equal((await send({ pave: [[sx, sy]] })).status, 400);
  assert.equal((await send({ unpave: [[sx, sy + 2]] })).status, 400);
  // Dépaver rend ses pierres
  const off = await send({ unpave: [[sx, sy + 1]] });
  assert.deepEqual([off.status, off.data.unpaved, off.data.world.stock.stone, off.data.world.roads.paved], [200, 1, 17, [[sx, sy]]]);
  // Une case tracée puis pavée, effacée : son pavé est rendu avec elle (la case était offerte : rien de plus)
  const laid = await send({ lay: [[sx - 1, sy]] });
  assert.equal(laid.status, 200, JSON.stringify(laid.data));
  assert.equal((await send({ pave: [[sx - 1, sy]] })).data.world.stock.stone, 14);
  const erased = await send({ erase: [[sx - 1, sy]] });
  assert.deepEqual([erased.status, erased.data.unpaved, erased.data.world.stock.stone, erased.data.world.roads.paved], [200, 1, 17, [[sx, sy]]]);
  // Pas assez de pierres : refusé, rien ne change
  await sql('UPDATE world_stock SET stone = 2 WHERE user_id = $1', [id]);
  const poor = await send({ pave: [[sx, sy + 2]] });
  assert.equal(poor.status, 409);
  assert.deepEqual((await view()).roads.paved, [[sx, sy]]);
});
