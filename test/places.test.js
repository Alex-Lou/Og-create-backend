// Les bâtiments ont leur place (world/places.js) : celle de la carte, celle d'une île à la plage (le Feu près de
// l'épave), ou celle où le joueur les a déplacés (world/moves.js). Et rien n'est là avant son personnage : le camp et les
// chantiers d'une île qui suit l'histoire paraissent avec eux (world/camp.js, la vue de l'île)
const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../src/services/worldMap');
const places = require('../src/services/world/places');
const { campOf } = require('../src/services/world/camp');
const { moveBlock } = require('../src/services/world/moves');
const { startServer, api, sql, newPlayer } = require('./helpers');

test('les places : la carte, la plage, puis le joueur', () => {
  assert.deepEqual(places.STATIC.foyer, map.SITE_BIG.foyer);
  const beach = places.placesFrom({ beach: true });
  assert.deepEqual(beach.foyer, places.BEACH.foyer);
  assert.deepEqual(beach.puits, map.SITE_BIG.puits);
  assert.deepEqual(places.placesFrom({ beach: true, rows: [{ site: 'foyer', x: 90, y: 92 }, { site: 'inconnu', x: 1, y: 1 }] }).foyer, { x: 90, y: 92 });
  // Emprise : le coin avant (2 × 2) avant le palier IV, la grande ensuite ; réservée en entier dès le départ
  assert.deepEqual(places.footprintAt(beach, 'foyer', 1), { x: 99, y: 93, w: 2, h: 2 });
  assert.deepEqual(places.footprintAt(beach, 'foyer', 4), { x: 98, y: 92, w: 3, h: 3 });
  assert.equal(places.inSiteAt(beach, 98, 92), true);
  assert.equal(places.inSiteAt(beach, 98, 92, 'foyer'), false);
  assert.equal(places.inFootprintAt(beach, 98, 92, { foyer: 1 }), false);
  assert.equal(places.inFootprintAt(beach, 99, 93, { foyer: 1 }), true);
});

test('le camp : rien avant son personnage ; sur une île à la plage, la cuisine prend l’ancienne place du Feu', () => {
  const ids = camp => camp.map(c => c.id).sort();
  // Brume seule : l'épave, rien d'autre
  assert.deepEqual(ids(campOf({ met: new Set() })), ['hirondelle']);
  // Aster arrive avec son camp
  assert.deepEqual(ids(campOf({ met: new Set(['ponton']) })), ['aster', 'caisses', 'filet', 'hirondelle', 'rondins', 'sos']);
  // Cannelle : sa cuisine ; sur une île à la plage, à l'ancienne place du Feu (rien ne l'y gêne)
  const beach = places.placesFrom({ beach: true });
  const kitchen = campOf({ met: new Set(['ponton', 'foyer']), places: beach, beach: true }).find(c => c.id === 'cannelle');
  assert.deepEqual([kitchen.x, kitchen.y], [map.SITE_PLACES.foyer.x, map.SITE_PLACES.foyer.y]);
  // Un compte d'avant la bible (met : null) : tout, comme avant
  assert.ok(ids(campOf({})).includes('cannelle') && ids(campOf({})).includes('rivet'));
  // Rien du camp sur la grande emprise du Feu (les caisses et la cage s'écartent)
  const all = campOf({ met: new Set(['ponton', 'foyer', 'atelier']), places: beach, beach: true, cage: 'coincee' });
  const cells = c => Array.from({ length: c.w * c.h }, (_, i) => [c.x + (i % c.w), c.y + Math.floor(i / c.w)]);
  assert.ok(all.every(c => cells(c).every(([x, y]) => !places.inSiteAt(beach, x, y))), JSON.stringify(all));
});

test('déplacer : sur ses quartiers, sur l’herbe ou le sable, sur des cases libres ; les créations « près de » restent à portée', () => {
  const ctx = (over = {}) => ({
    places: places.placesFrom({ beach: true }), levels: { foyer: 1 }, zones: new Set(['coeur']),
    ground: map.groundAt, taken: new Set(), placed: [], ...over
  });
  // Au cœur, sur l'herbe libre : permis
  assert.equal(moveBlock('foyer', 92, 92, ctx()), null);
  // Hors de ses quartiers, hors de l'île, sur un chemin, sur un autre bâtiment, sur une case prise
  assert.match(moveBlock('foyer', 40, 40, ctx()), /tes quartiers/);
  assert.match(moveBlock('foyer', -1, 0, ctx()), /Hors/);
  assert.match(moveBlock('foyer', 95, 89, ctx({ ground: (x, y) => (x === 97 ? 'p' : map.groundAt(x, y)) })), /chemin/);
  assert.match(moveBlock('puits', 98, 92, ctx({ zones: new Set(['coeur', 'source']) })), /prise/);
  assert.match(moveBlock('foyer', 92, 92, ctx({ taken: new Set([93 * map.SIZE + 93]) })), /prise/);
  // Un Étal du marché posé près du Feu (7 cases) : le Feu ne s'en éloigne pas
  const placed = [{ craft: 'etal', x: 100, y: 97 }];
  assert.match(moveBlock('foyer', 93, 86, ctx({ placed })), /Étal du marché/);
  assert.equal(moveBlock('foyer', 92, 92, ctx({ placed })), null);
});

test.describe('île', () => {
  let server;
  test.before(async () => { server = await startServer(); });
  test.after(() => server?.kill());

  test('une île neuve : le Feu sur la plage ; les chantiers et le camp paraissent avec leurs personnages', async () => {
    const player = await newPlayer({ veteran: false });
    const view = async () => (await api('GET', '/play/world', null, player)).data;
    const start = await view();
    const foyer = start.sites.find(s => s.id === 'foyer');
    assert.deepEqual([foyer.x, foyer.y, foyer.hidden], [99, 93, false]);
    assert.deepEqual(start.sites.filter(s => !s.hidden).map(s => s.id), ['foyer']);
    assert.deepEqual(start.camp.map(c => c.id), ['hirondelle']);
    // Le suivi des quêtes montre tout le tutoriel : douze étapes, de la première page au premier chemin
    assert.deepEqual([start.brume.steps.length, start.brume.steps[0].id, start.brume.steps.at(-1).id], [12, 'pages', 'chemin']);
    assert.ok(start.brume.steps.every(st => st.label && st.done === false));
    // Le feu fait : Aster arrive, son Ponton et son camp avec elle
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'feu')`, [player.userId]);
    const after = await view();
    assert.deepEqual(after.sites.filter(s => !s.hidden).map(s => s.id).sort(), ['foyer', 'ponton']);
    assert.ok(after.camp.some(c => c.id === 'aster') && !after.camp.some(c => c.id === 'cannelle'));
    assert.deepEqual(after.brume.steps.filter(st => st.done).map(st => st.id), ['pages', 'ramasser', 'feu']);
    // Un compte d'avant la bible voit tout, comme avant
    const old = await newPlayer();
    const oldView = (await api('GET', '/play/world', null, old)).data;
    assert.equal(oldView.sites.filter(s => s.hidden).length, 0);
    assert.equal(oldView.brume.steps, undefined);
  });

  test('déplacer un bâtiment : ses places possibles, puis la pose ; refusée ailleurs ; « Recommencer » la défait', async () => {
    const player = await newPlayer();
    const here = (await api('GET', '/play/world', null, player)).data.sites.find(s => s.id === 'foyer');
    const spots = await api('GET', '/play/world/site/spots?site=foyer', null, player);
    assert.equal(spots.status, 200);
    assert.ok(spots.data.spots.length > 10);
    assert.ok(spots.data.spots.every(s => map.zoneAt(s.x, s.y) === 'coeur'));
    const to = spots.data.spots.find(s => s.x + 1 !== here.x || s.y + 1 !== here.y);
    const moved = await api('POST', '/play/world/site/move', { site: 'foyer', ...to }, player);
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    const foyer = moved.data.sites.find(s => s.id === 'foyer');
    assert.deepEqual([foyer.x, foyer.y], [to.x + 1, to.y + 1]);
    // Ailleurs : refusé, la place ne bouge pas
    assert.equal((await api('POST', '/play/world/site/move', { site: 'foyer', x: 40, y: 40 }, player)).status, 400);
    assert.equal((await api('POST', '/play/world/site/move', { site: 'nulle-part', x: 90, y: 90 }, player)).status, 404);
    assert.equal((await api('GET', '/play/world/site/spots?site=nulle-part', null, player)).status, 404);
    assert.deepEqual(await sql('SELECT x, y FROM world_site_places WHERE user_id = $1', [player.userId]), [{ x: to.x, y: to.y }]);
    // « Recommencer l'île » : les bâtiments reprennent leur place
    await api('POST', '/play/world/restart', { confirm: 'RECOMMENCER' }, player);
    assert.deepEqual(await sql('SELECT 1 FROM world_site_places WHERE user_id = $1', [player.userId]), []);
  });
});
