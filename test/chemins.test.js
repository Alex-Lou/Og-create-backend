// Les chemins (choix de l'auteur, 8 oct.) : une île neuve ne garde que son sentier (du Feu au rivage), les gués et les
// vieilles marches ; une île d'avant garde toutes ses routes. Chacun trace les siens : une pierre la case, les douze
// premières offertes ; une case effacée rend sa pierre. Le premier chemin relie le Puits au Feu (quête « chemin »)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const view = async player => (await api('GET', '/play/world', null, player)).data;
const at = (w, x, y) => w.map.ground[y][x];
const draw = (player, lay, erase = []) => api('POST', '/play/world/paths', { lay, erase }, player);
// Du Puits de Léo (île à la plage : palier I, 2 × 2 en 89, 87, contre le village) au sentier du Feu : quatre cases
// vers l'est, sous le Puits, jusqu'au haut du sentier (95, 89)
const LINK = [[91, 89], [92, 89], [93, 89], [94, 89]];

test('une île neuve n’a que son sentier ; une île d’avant garde ses routes', async () => {
    const fresh = await newPlayer();
    const w = await view(fresh);
    // La grande route de la plage (rangées 90-91) est redevenue de l'herbe ; le sentier descend de la cuisine de
    // Agathe au rivage, puis d'une case jusqu'à la porte du Feu, qui brûle près de l'épave (île à la plage)
    assert.equal(at(w, 90, 90), 'g');
    for (let y = 89; y <= 95; y++) assert.equal(at(w, 95, y), 'p', `sentier ${y}`);
    assert.equal(at(w, 96, 95), 'p');
    assert.equal(at(w, 97, 95), 'p');
    assert.equal(at(w, 98, 95), 'p');
    assert.deepEqual([w.roads.laid, w.roads.free, w.roads.stone], [[], 12, 1]);
    assert.match(w.map.key, /:b0$/);
    const foyer = w.sites.find(s => s.id === 'foyer');
    assert.deepEqual([foyer.x, foyer.y, foyer.w], [99, 93, 2]);

    const old = await newPlayer();
    await view(old);
    await sql(`DELETE FROM world_items WHERE user_id = $1 AND item = 'ile:sentiers'`, [old.userId]);
    const w2 = await view(old);
    assert.equal(at(w2, 90, 90), 'p');
    assert.match(w2.map.key, /:v0$/);
});

test('tracer : douze cases offertes, puis une pierre la case ; effacer rend la pierre', async () => {
    const player = await newPlayer();
    await view(player);
    await sql('UPDATE world_stock SET stone = 1 WHERE user_id = $1', [player.userId]);
    // Sur la plage de Brumelune (à soi d'office), là où passait la grande route : de l'herbe libre
    const twelve = [[92, 91], [92, 90], [93, 90], [94, 90], [99, 90], [100, 90], [101, 90], [102, 90], [103, 90], [96, 91], [97, 91], [98, 91]];
    const first = await draw(player, twelve);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.deepEqual([first.data.laid, first.data.world.roads.free, first.data.world.stock.stone], [12, 0, 1]);
    assert.equal(at(first.data.world, 92, 90), 'p');
    // La treizième coûte la pierre qui reste ; la quatorzième n'a plus de quoi
    const paid = await draw(player, [[93, 91]]);
    assert.deepEqual([paid.status, paid.data.world.stock.stone], [200, 0]);
    const poor = await draw(player, [[94, 91]]);
    assert.equal(poor.status, 409);
    assert.match(poor.data.message, /1 pierre/);
    // Refus : déjà un chemin (le sentier), hors de ses quartiers, une case pas tracée à effacer, trop de cases
    assert.equal((await draw(player, [[97, 92]])).status, 400);
    assert.equal((await draw(player, [[40, 40]])).status, 400);
    assert.equal((await draw(player, [], [[97, 92]])).status, 400);
    assert.equal((await draw(player, Array.from({ length: 81 }, (_, i) => [i % 9 + 80, 93 + Math.floor(i / 9)]))).status, 400);
    // Effacer la case payée rend sa pierre ; une case offerte, rien (mais elle redevient offerte)
    const back = await draw(player, [], [[93, 91], [92, 90]]);
    assert.deepEqual([back.status, back.data.world.stock.stone, back.data.world.roads.free], [200, 1, 1]);
    assert.equal(at(back.data.world, 93, 91), 'g');
    // Ni annexe ni création sur un chemin tracé
    assert.ok(!back.data.world.sites.flatMap(s => s.spots).some(s => s.x === 93 && s.y === 90));
});

test('une création au bord d’un chemin le garde ; « Recommencer l’île » efface les chemins tracés', async () => {
    const player = await newPlayer();
    await view(player);
    await draw(player, [[92, 90], [93, 90]]);
    await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'lanterne', 92, 91)`, [player.userId]);
    const kept = await draw(player, [], [[92, 90]]);
    assert.equal(kept.status, 409);
    assert.match(kept.data.message, /Lanterne/);
    await sql('DELETE FROM world_crafts WHERE user_id = $1', [player.userId]);
    assert.equal((await api('POST', '/play/world/restart', { confirm: 'RECOMMENCER' }, player)).status, 200);
    const w = await view(player);
    assert.deepEqual([w.roads.laid, w.roads.free], [[], 12]);
    assert.equal(at(w, 92, 90), 'g');
    assert.match(w.map.key, /:b0$/);
});

test('la quête du premier chemin : relier le Puits au Feu', async () => {
    const player = await newPlayer();
    await view(player);
  const done = ['pages', 'ramasser', 'feu', 'nuit', 'recolte', 'veille', 'soupe', 'poules', 'deco', 'eveil-ondin', 'souvenir-ondin', 'puits-ondin'];
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, done]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 1), ($1, 'puits', 1)
      ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level`, [player.userId]);
    const before = await view(player);
    assert.deepEqual([before.brume.quest.id, before.brume.quest.done], ['chemin', false]);
    // Le chemin touche le bâtiment (choix de l'auteur, 11 oct.) : la place réservée derrière le Puits encore petit (sa
    // grande emprise, 88-90 × 86-88) se trace ; le Puits lui-même, non
    const puits = before.sites.find(s => s.id === 'puits');
    assert.deepEqual([puits.x, puits.y, puits.w], [89, 87, 2]);
    assert.equal((await draw(player, [[89, 87]])).status, 400);
    const behind = await draw(player, [[88, 87]]);
    assert.equal(behind.status, 200, JSON.stringify(behind.data));
    assert.equal((await draw(player, [], [[88, 87]])).status, 200);
    const linked = await draw(player, LINK);
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
    assert.equal(linked.data.world.brume.quest.done, true);
    const claim = await api('POST', '/play/world/quest', { id: 'chemin' }, player);
    assert.equal(claim.status, 200, JSON.stringify(claim.data));
    // Réclamé (choix de l'auteur, 26 oct.) : le compte suit désormais le tutoriel en huit jours. La cinquième nuit, puis
    // le jour de Maerys ; le conseil attend le soir du jour de Maggy
    const night = await view(player);
    assert.deepEqual([night.brume.quest.id, night.brume.quest.act, night.brume.tutorialLast, night.brume.scenes.due],
      ['nuit-ondin', 'T', 'potager', []]);
    assert.ok(night.brume.steps.some(step => step.id === 'potager'));
    assert.equal((await api('POST', '/play/world/sleep', {}, player)).status, 200);
    const maerys = await view(player);
    assert.deepEqual([maerys.brume.quest.id, maerys.brume.quest.act, maerys.brume.goal], ['lisiere', 'T', null]);
    // (le Potager de Maggy réclamé : le tutoriel fini, le conseil dû, l'objectif du phare et l'acte I commencent)
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'potager')`, [player.userId]);
    const council = await view(player);
    assert.deepEqual([council.brume.quest.id, council.brume.quest.act, council.brume.scenes.due, council.brume.goal.act], ['lumiere', 'I', ['conseil'], 'I']);
    // Un compte qui avait fini l'ancien tutoriel (son chemin réclamé avant, sans la marque) le garde : la Lisière ensuite,
    // et le conseil tout de suite
    const before26 = await newPlayer();
    await view(before26);
    await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [before26.userId, [...done, 'chemin']]);
    const kept = await view(before26);
    assert.deepEqual([kept.brume.quest.id, kept.brume.quest.act, kept.brume.tutorialLast, kept.brume.scenes.due], ['lisiere', 'I', 'chemin', ['conseil']]);
    // Une île d'avant (toutes ses routes) : le Puits, remonté contre le Feu, retombe sur la grande route, qui les relie
    // déjà ; elle n'a donc plus ce chemin à tracer
    const old = await newPlayer();
    await view(old);
    await sql(`DELETE FROM world_items WHERE user_id = $1 AND item = 'ile:sentiers'`, [old.userId]);
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [old.userId, done]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 1), ($1, 'puits', 1)
      ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level`, [old.userId]);
    assert.equal((await view(old)).brume.quest.done, true);
});

test('le parvis (choix de l’auteur, 14 oct.) : de la terre battue devant la porte de chaque bâtiment bâti, qui compte comme un chemin', () => {
  const paths = require('../src/services/world/paths');
  const places = require('../src/services/world/places').placesFrom({ beach: true });
  const rows = paths.groundRows(true, [], true);
  const base = (x, y) => rows[y]?.[x];
  // Le Puits : la rangée devant sa porte (le bas de son emprise), deux cases, puis trois quand il grandit ; rien d'un
  // bâtiment pas encore bâti, ni du Feu (son sentier arrive déjà à sa porte), ni du Ponton (la mer devant lui)
  assert.deepEqual(paths.parvisOf(places, { puits: 1, foyer: 2, ponton: 1, bosquet: 0 }, base), [{ x: 89, y: 89 }, { x: 90, y: 89 }]);
  assert.deepEqual(paths.parvisOf(places, { puits: 4 }, base).map(c => c.x), [88, 89, 90]);
  // Un chemin tracé jusqu'au parvis relie le bâtiment
  const ground = paths.groundRows(true, [{ x: 91, y: 89 }], true, paths.parvisOf(places, { puits: 1 }, base));
  const at = (x, y) => ground[y]?.[x];
  assert.equal(at(89, 89), 'p');
  assert.equal(paths.linked(at, { x: 89, y: 87, w: 2, h: 2 }, { x: 92, y: 88, w: 1, h: 1 }), true);
});
