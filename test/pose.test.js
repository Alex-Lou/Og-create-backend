// La pose (lot Pose) : une annexe ou une création se pose en miroir ou non ; une annexe dessinée en variantes prend la
// couleur choisie (sinon celle de son rang, comme avant) ; on pivote et on change de couleur après coup, sans rien payer
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

// Un joueur au Potager palier II (quartier possédé), de quoi payer un champ
async function farmer() {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'jardins') ON CONFLICT DO NOTHING`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 2)`, [player.userId]);
  await sql('UPDATE world_stock SET stone = 500, wood = 500, water = 500, food = 500 WHERE user_id = $1', [player.userId]);
  await sql('UPDATE progress SET coins = 1000 WHERE user_id = $1', [player.userId]);
  const potager = (await api('GET', '/play/world', null, player)).data.sites.find(s => s.id === 'potager');
  return { player, potager };
}

test('annexe : posée en miroir et dans la couleur choisie ; le catalogue dit combien de couleurs', async () => {
  const { player, potager } = await farmer();
  const looks = id => potager.annexes.find(a => a.id === id).looks;
  assert.deepEqual([looks('champ'), looks('grenier')], [3, 1]);
  const [a] = potager.spots;
  const place = body => api('POST', '/play/world/annex', { annex: 'champ', ...a, ...body }, player);
  // Couleur qui n'existe pas, demande mal formée : refusé, rien n'est payé
  assert.equal((await place({ look: 3 })).status, 400);
  assert.equal((await place({ look: 'rouge' })).status, 400);
  assert.equal((await place({ flip: 'oui' })).status, 400);
  const done = await place({ flip: true, look: 2 });
  assert.equal(done.status, 200);
  assert.equal(done.data.coins, 900);
  assert.deepEqual(done.data.world.annexes.map(r => [r.annex, r.flip, r.look]), [['champ', true, 2]]);
});

test('annexe posée : pivoter, changer de couleur, revenir à celle de son rang ; ce qui n’est pas demandé reste', async () => {
  const { player, potager } = await farmer();
  const [a] = potager.spots;
  // Posée comme avant (sans pose) : ni miroir ni couleur choisie
  assert.deepEqual((await api('POST', '/play/world/annex', { annex: 'champ', ...a }, player)).data.world.annexes.map(r => [r.flip, r.look]), [[false, null]]);
  const pose = body => api('POST', '/play/world/annex/pose', { ...a, ...body }, player);
  const now = async res => (await res).data.annexes.map(r => [r.flip, r.look]);
  assert.deepEqual(await now(pose({ flip: true })), [[true, null]]);
  assert.deepEqual(await now(pose({ look: 1 })), [[true, 1]]);
  assert.deepEqual(await now(pose({ flip: false, look: null })), [[false, null]]);
  // Refus : rien demandé, couleur absente pour cette annexe, case vide
  assert.equal((await pose({})).status, 400);
  assert.equal((await pose({ look: 3 })).status, 400);
  assert.equal((await api('POST', '/play/world/annex/pose', { x: a.x + 40, y: a.y, flip: true }, player)).status, 404);
  // Le pivot ne coûte rien
  assert.equal((await sql('SELECT coins FROM progress WHERE user_id = $1', [player.userId]))[0].coins, 900);
});

test('création : posée en miroir, pivotée ensuite ; une case vide refuse', async () => {
  const { player } = await farmer();
  await sql(`INSERT INTO world_crafts (user_id, craft) VALUES ($1, 'cloture')`, [player.userId]);
  const [spot] = (await api('GET', '/play/world', null, player)).data.crafts.catalog.find(c => c.id === 'cloture').spots;
  assert.equal((await api('POST', '/play/world/craft/place', { craft: 'cloture', ...spot, flip: 1 }, player)).status, 400);
  const placed = await api('POST', '/play/world/craft/place', { craft: 'cloture', ...spot, flip: true }, player);
  assert.equal(placed.status, 200);
  assert.equal(placed.data.world.crafts.placed[0].flip, true);
  const turn = (cell, flip) => api('POST', '/play/world/craft/turn', { ...cell, flip }, player);
  assert.equal((await turn(spot, false)).data.world.crafts.placed[0].flip, false);
  assert.equal((await turn(spot, 'non')).status, 400);
  assert.equal((await turn({ x: spot.x + 40, y: spot.y }, true)).status, 404);
});
