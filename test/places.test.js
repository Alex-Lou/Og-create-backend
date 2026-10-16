// Les bâtiments ont leur place (world/places.js) : celle de la carte, celle d'une île à la plage (le Feu près de
// l'épave), ou celle où le joueur les a déplacés (world/moves.js). Et rien n'est là avant son personnage : le camp et les
// chantiers d'une île qui suit l'histoire paraissent avec eux (world/camp.js, la vue de l'île)
const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../src/services/worldMap');
const places = require('../src/services/world/places');
const { campOf, overgrowthOf } = require('../src/services/world/camp');
const { moveBlock } = require('../src/services/world/moves');
const { startServer, api, sql, newPlayer } = require('./helpers');

test('les places : la carte, la plage, puis le joueur', () => {
  assert.deepEqual(places.STATIC.foyer, map.SITE_BIG.foyer);
  const beach = places.placesFrom({ beach: true });
  assert.deepEqual(beach.foyer, places.BEACH.foyer);
  // Une île à la plage : chaque personnage a sa zone, son bâtiment au milieu (le Puits de Léo à l'ouest, près du
  // ruisseau) ; une île d'avant garde les places de la carte
  assert.deepEqual(beach.puits, { x: 88, y: 86 });
  assert.deepEqual(places.STATIC.puits, map.SITE_BIG.puits);
  assert.deepEqual(places.placesFrom({ beach: true, rows: [{ site: 'foyer', x: 90, y: 92 }, { site: 'inconnu', x: 1, y: 1 }] }).foyer, { x: 90, y: 92 });
  // Emprise : le coin avant (2 × 2) avant le palier IV, la grande ensuite ; réservée en entier dès le départ
  assert.deepEqual(places.footprintAt(beach, 'foyer', 1), { x: 99, y: 93, w: 2, h: 2 });
  assert.deepEqual(places.footprintAt(beach, 'foyer', 4), { x: 98, y: 92, w: 3, h: 3 });
  assert.equal(places.inSiteAt(beach, 98, 92), true);
  assert.equal(places.inSiteAt(beach, 98, 92, 'foyer'), false);
  assert.equal(places.inFootprintAt(beach, 98, 92, { foyer: 1 }), false);
  assert.equal(places.inFootprintAt(beach, 99, 93, { foyer: 1 }), true);
});

test('une île à la plage : chaque bâtiment tient sur sa place (herbe, sable ou prairie, libre, dans son quartier)', () => {
  const beach = places.placesFrom({ beach: true });
  const ctx = { places: beach, levels: {}, zones: new Set(map.ZONES.map(z => z.id)), ground: map.groundAt, taken: new Set(), placed: [] };
  for (const [id, at] of Object.entries(places.BEACH)) {
    assert.equal(moveBlock(id, at.x, at.y, ctx), null, id);
    assert.ok(['coeur', map.siteZone(id)].includes(map.zoneAt(at.x + 1, at.y + 1)), id);
  }
});

test('le camp : rien avant son personnage ; sur une île à la plage, chacun dans sa zone', () => {
  const ids = camp => camp.map(c => c.id).sort();
  // Brume seule : l'épave, rien d'autre
  assert.deepEqual(ids(campOf({ met: new Set() })), ['hirondelle']);
  // Lorena arrive avec son camp
  assert.deepEqual(ids(campOf({ met: new Set(['ponton']) })), ['aster', 'caisses', 'filet', 'hirondelle', 'rondins', 'sos']);
  // Sur une île à la plage : la cuisine d’Agathe sur la plage (sa zone), le camp de Lorena au sud-ouest, le coin de
  // Nathan au nord du Feu
  const beach = places.placesFrom({ beach: true });
  const camp = campOf({ met: new Set(['ponton', 'foyer', 'atelier']), places: beach, beach: true });
  const at = id => { const c = camp.find(e => e.id === id); return [c.x, c.y]; };
  // (la cuisine d’Agathe sous l'enclos du Feu, sur le sable du rivage : choix de l'auteur, 16 oct.)
  assert.deepEqual([at('cannelle'), at('aster'), at('rivet')], [[99, 97], [90, 95], [93, 86]]);
  // La grande Hirondelle (choix de l'auteur, 15 oct.) : 6 × 3 cases en travers de l'anse à l'ouest, sa poupe arrachée à
  // l'ancienne place (elle ferme le coin de l'enclos du Feu) ; sur l'ancienne butte, deux palmiers et deux étoiles de mer
  const ship = camp.find(c => c.id === 'hirondelle');
  assert.deepEqual([ship.art, ship.x, ship.y, ship.w, ship.h, ship.stade, ship.lanterne], ['hirondelle', 86, 97, 6, 3, 0, true]);
  assert.deepEqual([at('poupe'), at('palmier-1'), at('palmier-2'), at('etoile-1'), at('etoile-2')], [[96, 96], [103, 97], [104, 96], [102, 97], [103, 96]]);
  // (sa végétation : un stade aux jours 3, 10 et 30 ; la lanterne de Lorena, une fois Lorena là)
  assert.deepEqual([0, 2, 3, 9, 10, 29, 30, 99].map(overgrowthOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(campOf({ met: new Set(), places: beach, beach: true }).find(c => c.id === 'hirondelle').lanterne, false);
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
  assert.match(moveBlock('foyer', 97, 88, ctx({ ground: (x, y) => (x === 97 ? 'p' : map.groundAt(x, y)) })), /chemin/);
  assert.match(moveBlock('puits', 98, 92, ctx({ zones: new Set(['coeur', 'source']) })), /prise/);
  assert.match(moveBlock('foyer', 92, 92, ctx({ taken: new Set([93 * map.SIZE + 93]) })), /prise/);
  // Un Étal du marché posé près du Feu (7 cases) : le Feu ne s'en éloigne pas
  const placed = [{ craft: 'etal', x: 100, y: 97 }];
  assert.match(moveBlock('foyer', 95, 80, ctx({ placed })), /Étal du marché/);
  assert.equal(moveBlock('foyer', 92, 92, ctx({ placed })), null);
});

test.describe('île', () => {
  let server;
  test.before(async () => { server = await startServer(); });
  test.after(() => server?.kill());

  test('le Bosquet bâti pour la première fois sur une île à la plage : sa place est retenue, il ne saute pas', async () => {
    const player = await newPlayer({ settled: true });
    const bosquet = world => world.sites.find(s => s.id === 'bosquet');
    await sql(`INSERT INTO world_items (user_id, item) VALUES ($1, 'ile:plage'), ($1, 'ile:sentiers') ON CONFLICT DO NOTHING`, [player.userId]);
    await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'lisiere') ON CONFLICT DO NOTHING`, [player.userId]);
    await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Arbre"]'::jsonb WHERE user_id = $1`, [player.userId]);
    const before = bosquet((await api('GET', '/play/world', null, player)).data);
    assert.deepEqual([before.x, before.y], [82, 85]);
    await sql('UPDATE world_stock SET stone = 5 WHERE user_id = $1', [player.userId]);
    const built = await api('POST', '/play/world/build', { site: 'bosquet' }, player);
    assert.equal(built.status, 200, JSON.stringify(built.data));
    assert.equal(built.data.built, 'Bosquet');
    const after = bosquet(built.data.world);
    assert.deepEqual([after.x, after.y, after.level], [82, 85, 1]);
    // (le bois mort, jamais un arbre abattu : ses paliers et leurs plans, chacun de son chapitre)
    assert.deepEqual(after.levels.map(l => l.name), ['Bosquet', 'Taillis', 'Clairière aux fagots', 'Chênaie', 'Menuiserie', 'Moulin à scie', 'Forêt enchantée']);
    assert.deepEqual(after.levels.map(l => l.plan), ['Arbre', 'Forêt', 'Taïga', 'Chêne', 'Menuisier', 'Moulin à eau', 'Fée']);
    assert.deepEqual(built.data.world.harvest.boosts, { wood: 2 });
    // (un joueur qui l'avait bâti à la Lisière avant : il l'y garde)
    const old = await newPlayer({ settled: true });
    await sql(`INSERT INTO world_items (user_id, item) VALUES ($1, 'ile:plage'), ($1, 'ile:sentiers') ON CONFLICT DO NOTHING`, [old.userId]);
    await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'bosquet', 1)`, [old.userId]);
    const kept = bosquet((await api('GET', '/play/world', null, old)).data);
    assert.deepEqual([kept.x, kept.y], [73, 87]);
  });

  test('une île neuve : le Feu sur la plage ; les chantiers et le camp paraissent avec leurs personnages', async () => {
    const player = await newPlayer();
    const view = async () => (await api('GET', '/play/world', null, player)).data;
    const start = await view();
    const foyer = start.sites.find(s => s.id === 'foyer');
    assert.deepEqual([foyer.x, foyer.y, foyer.hidden], [99, 93, false]);
    assert.deepEqual(start.sites.filter(s => !s.hidden).map(s => s.id), ['foyer']);
    // (l'épave et sa poupe, le décor de l'ancienne butte ; personne encore)
    assert.deepEqual(start.camp.map(c => c.id), ['hirondelle', 'poupe', 'palmier-1', 'palmier-2', 'etoile-1', 'etoile-2']);
    // (la végétation gagne l'épave avec les jours depuis la naissance de l'île : douze jours, le deuxième stade)
    assert.equal(start.camp[0].stade, 0);
    await sql(`UPDATE world_items SET bought_at = now() - interval '12 days' WHERE user_id = $1 AND item = 'ile:plage'`, [player.userId]);
    assert.equal((await view()).camp.find(c => c.id === 'hirondelle').stade, 2);
    // Le suivi des quêtes montre tout le tutoriel : vingt-deux étapes, de la première page au premier chemin
    assert.deepEqual([start.brume.steps.length, start.brume.steps[0].id, start.brume.steps.at(-1).id], [25, 'pages', 'chemin']);
    assert.ok(start.brume.steps.every(st => st.label && st.done === false));
    // Le feu fait : personne encore (la première nuit se passe seul) ; la nuit passée : Lorena arrive, son Ponton et
    // son camp avec elle
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'feu')`, [player.userId]);
    assert.deepEqual((await view()).villagers.map(v => v.id), []);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit')`, [player.userId]);
    const after = await view();
    assert.deepEqual(after.sites.filter(s => !s.hidden).map(s => s.id).sort(), ['foyer', 'ponton']);
    assert.ok(after.camp.some(c => c.id === 'aster') && !after.camp.some(c => c.id === 'cannelle'));
    assert.deepEqual(after.brume.steps.filter(st => st.done).map(st => st.id), ['pages', 'ramasser', 'feu', 'nuit']);
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

test('le Bosquet, rapproché du Puits (choix de l’auteur, 14 oct.) : bâti là, il y reste ; bâti avant, il garde sa place', () => {
  assert.deepEqual(places.placesFrom({ beach: true }).bosquet, { x: 81, y: 84 });
  assert.deepEqual(places.placesFrom({ beach: true, built: ['bosquet'] }).bosquet, { x: 72, y: 86 });
  // (sa place retenue à sa construction prime : world.js, build)
  assert.deepEqual(places.placesFrom({ beach: true, built: ['bosquet'], rows: [{ site: 'bosquet', x: 81, y: 84 }] }).bosquet, { x: 81, y: 84 });
  // (une île d'avant la plage : la carte, rien ne change)
  assert.deepEqual(places.placesFrom({ built: ['bosquet'] }).bosquet, map.SITE_BIG.bosquet);
});
