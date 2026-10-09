// Le camp des naufragés sur la plage de Brumelune (world/camp.js) : sobre et qui libère ; il change avec les actes et les paliers ;
// une place prise par le joueur fait poser l'élément au plus près ; ses cases sont réservées (ni annexe ni création)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const camp = require('../src/services/world/camp');
const map = require('../src/services/worldMap');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const ids = list => list.map(c => c.art);
const SIZE = map.SIZE;

test('au début : l’épave, la cuisine de Cannelle, les débris d’Aster et de Rivet, le SOS et trois objets, à leur place', () => {
  const start = camp.campOf({});
  assert.deepEqual(ids(start), ['hirondelle', 'cannelle_debris', 'aster_debris', 'rivet_debris', 'sos', 'caisses', 'filet', 'rondins']);
  for (const c of start) {
    const place = camp.PLACES.find(p => p.id === c.id);
    assert.deepEqual([c.x, c.y], [place.x, place.y], c.id);
    for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) assert.equal(map.zoneAt(c.x + dx, c.y + dy), 'coeur', c.id);
  }
  assert.equal(start.reduce((n, c) => n + c.w * c.h, 0), 20);
});

test('il change avec l’histoire, et libère la plage de Brumelune', () => {
  assert.deepEqual(ids(camp.campOf({ acts: ['I'], levels: { foyer: 1 } })).slice(2, 4), ['aster_abri', 'rivet_abri']);
  // Pas de cabanon avant l'Abri ; à l'Abri, Cannelle quitte la cuisine de l'épave
  assert.equal(camp.campOf({ acts: ['I', 'II'], levels: { foyer: 1 } }).find(c => c.id === 'aster').art, 'aster_abri');
  const abri = camp.campOf({ acts: ['I', 'II'], levels: { foyer: 2 } });
  assert.deepEqual([abri.find(c => c.id === 'aster').art, abri.some(c => c.id === 'cannelle')], ['aster_cabanon', false]);
  // Aster a son Ponton, Rivet son Atelier : leurs coins s'en vont
  const built = camp.campOf({ acts: ['I', 'II'], levels: { foyer: 2, ponton: 1, atelier: 1 } });
  assert.ok(!built.some(c => c.id === 'aster' || c.id === 'rivet'));
  // Acte IV : les voyageurs arrivent (tente, hamac), le SOS s'en va
  const later = camp.campOf({ acts: ['I', 'II', 'III', 'IV'], levels: { foyer: 3, ponton: 2, atelier: 2 } });
  assert.deepEqual(ids(later), ['hirondelle', 'tente', 'hamac', 'caisses', 'filet', 'rondins']);
});

test('une place prise par le joueur : l’élément se pose au plus près, rien ne se chevauche', () => {
  const wreck = camp.PLACES.find(p => p.id === 'hirondelle');
  const moved = camp.campOf({ taken: new Set([wreck.y * SIZE + wreck.x]) });
  const ship = moved.find(c => c.id === 'hirondelle');
  assert.notDeepEqual([ship.x, ship.y], [wreck.x, wreck.y]);
  assert.ok(Math.hypot(ship.x - wreck.x, ship.y - wreck.y) <= 3);
  const cells = [...camp.cellsOfCamp(moved)];
  assert.equal(new Set(cells).size, moved.reduce((n, c) => n + c.w * c.h, 0));
  assert.ok(!cells.includes(wreck.y * SIZE + wreck.x));
});

test('la vue montre le camp ; ses cases refusent annexes et créations', async () => {
  const player = await newPlayer();
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.equal(view.camp[0].id, 'hirondelle');
  const wreck = view.camp[0];
  // Une création d'île : pas sur le camp, ni dans ses cases proposées
  await sql(`INSERT INTO world_crafts (user_id, craft) VALUES ($1, 'cloture')`, [player.userId]);
  const spots = (await api('GET', '/play/world', null, player)).data.crafts.catalog.find(c => c.id === 'cloture').spots;
  assert.ok(!spots.some(s => s.x === wreck.x && s.y === wreck.y));
  assert.equal((await api('POST', '/play/world/craft/place', { craft: 'cloture', x: wreck.x, y: wreck.y }, player)).status, 400);
  // Une annexe du Foyer (jardin d'herbes, palier II) : pas sur le camp, ni dans ses cases proposées
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 2) ON CONFLICT (user_id, site) DO UPDATE SET level = 2`, [player.userId]);
  await sql(`UPDATE progress SET coins = 1000 WHERE user_id = $1`, [player.userId]);
  await sql(`UPDATE world_stock SET stone = 500, wood = 500, water = 500, food = 500 WHERE user_id = $1`, [player.userId]);
  const foyer = (await api('GET', '/play/world', null, player)).data.sites.find(s => s.id === 'foyer');
  assert.ok(foyer.spots.length && !foyer.spots.some(s => s.x === wreck.x && s.y === wreck.y));
  const refused = await api('POST', '/play/world/annex', { annex: 'jardin', x: wreck.x, y: wreck.y }, player);
  assert.deepEqual([refused.status, refused.data.message], [409, 'Cette case est au camp des naufragés.']);
});
