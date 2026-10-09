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
// Du Puits (palier I, 2 × 2 en 88, 85) au sentier (97, 89), qui descend jusqu'à la porte du Feu sur la plage : dix
// cases d'herbe, hors des grandes emprises
const LINK = [[90, 86], [91, 86], [92, 86], [93, 86], [94, 86], [94, 87], [94, 88], [94, 89], [95, 89], [96, 89]];

test('une île neuve n’a que son sentier ; une île d’avant garde ses routes', async () => {
    const fresh = await newPlayer();
    const w = await view(fresh);
    // La grande route de la plage (rangées 90-91) est redevenue de l'herbe ; le sentier descend de la cuisine de
    // Cannelle au rivage, puis d'une case jusqu'à la porte du Feu, qui brûle près de l'épave (île à la plage)
    assert.equal(at(w, 90, 90), 'g');
    for (let y = 89; y <= 95; y++) assert.equal(at(w, 97, y), 'p', `sentier ${y}`);
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
    const twelve = [[92, 91], ...[92, 93, 94, 95, 96, 98, 99, 100, 101, 102, 103].map(x => [x, 90])];
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
    const player = await newPlayer({ veteran: false });
    await view(player);
    const done = ['pages', 'ramasser', 'feu', 'nuit', 'recolte', 'soupe', 'poules', 'deco', 'achat-source', 'eveil-ondin', 'souvenir-ondin', 'puits-ondin'];
    await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, done]);
    await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [player.userId]);
    await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 1), ($1, 'puits', 1)
        ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level`, [player.userId]);
    const before = await view(player);
    assert.deepEqual([before.brume.quest.id, before.brume.quest.done], ['chemin', false]);
    const linked = await draw(player, LINK);
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
    assert.equal(linked.data.world.brume.quest.done, true);
    const claim = await api('POST', '/play/world/quest', { id: 'chemin' }, player);
    assert.equal(claim.status, 200, JSON.stringify(claim.data));
    // Une île d'avant (toutes ses routes) a déjà son chemin
    const old = await newPlayer();
    await view(old);
    await sql(`DELETE FROM world_items WHERE user_id = $1 AND item = 'ile:sentiers'`, [old.userId]);
    await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [old.userId, done]);
    await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [old.userId]);
    await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 1), ($1, 'puits', 1)
        ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level`, [old.userId]);
    assert.equal((await view(old)).brume.quest.done, true);
});
