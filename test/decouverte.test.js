// La découverte (choix de l'auteur) : « Recommencer l'île » (autant qu'on veut pendant le développement ; une fois avec
// ISLAND_RESTART_ONCE=1) efface l'île et garde le Grimoire ;
// l'île recommencée suit les règles d'un compte neuf (habitants un à un) ; au tutoriel, La Source se découvre en
// écrivant la Source, sans écus
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const view = async player => (await api('GET', '/play/world', null, player)).data;
const restart = (player, confirm = 'RECOMMENCER') => api('POST', '/play/world/restart', { confirm }, player);
const count = async (table, id) => (await sql(`SELECT COUNT(*)::int AS n FROM ${table} WHERE user_id = $1`, [id]))[0].n;

test('« Recommencer l’île » : confirmé en toutes lettres ; tout repart de zéro, sauf le compte', async () => {
    const player = await newPlayer({ coins: 777 });
    const id = player.userId;
    await view(player);
    await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Vent", "Pluie", "Vapeur", "Boue"]'::jsonb WHERE user_id = $1`, [id]);
    // Une île d'avant la bible : bâtiments, quartiers, quêtes, une création, un coffre de quête et de chapitre, un
    // article de boutique, « Passer le tutoriel »
    await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 3), ($1, 'puits', 1) ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level`, [id]);
    await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source'), ($1, 'lisiere')`, [id]);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'recolte')`, [id]);
    await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 93, 98)`, [id]);
    await sql(`INSERT INTO world_chests (user_id, source, rarity, prize) VALUES ($1, 'quete:recolte', 'rare', '{}'), ($1, 'chapitre:I', 'legendaire', '{}')`, [id]);
    await sql(`INSERT INTO world_items (user_id, item, source) VALUES ($1, 'banc', 'boutique'), ($1, 'prologue:passe', 'tutoriel')`, [id]);
    await sql(`UPDATE world_stock SET wood = 50, stone = 40 WHERE user_id = $1`, [id]);
    const before = await view(player);
    assert.ok(before.villagers.length > 1);

    assert.equal((await api('POST', '/play/world/restart', { confirm: 'RECOMMENCER' }, { cookies: {} })).status, 401);
    assert.equal((await restart(player, 'oui')).status, 400);
    // Deux demandes à la fois : une seule recommence
    const both = await Promise.all([restart(player), restart(player)]);
    assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
    assert.equal((await restart(player)).status, 409);

    const after = await view(player);
    // L'île : vide, personne encore, le feu à bâtir, la plage de Brumelune
    // seule à soi, la réserve vide
    assert.equal(after.sites.find(s => s.id === 'foyer').level, 0);
    assert.deepEqual(after.villagers.map(v => v.id), []);
    assert.deepEqual(after.map.zones.filter(z => z.owned).map(z => z.id), ['coeur']);
    assert.deepEqual([after.stock.wood, after.stock.stone], [0, 0]);
    for (const table of ['world_quests', 'world_crafts', 'world_buildings']) assert.equal(await count(table, id), 0, table);
    // Le tutoriel reprend (la vue de Brume le dit) : « Passer » est oublié
    assert.deepEqual([after.brume.tutorial, after.brume.skipped], [true, false]);
    // Tout le reste aussi (choix de l'auteur, 9 oct.) : les écus et leur grand livre, le Grimoire réduit aux quatre
    // Souffles, les coffres, la boutique ; le compte, lui, reste (et sa session)
    const [prog] = await sql('SELECT coins, infinite_elements, achievements, user_customization FROM progress WHERE user_id = $1', [id]);
    assert.deepEqual([prog.coins, prog.infinite_elements, prog.achievements, prog.user_customization], [0, ['Eau', 'Feu', 'Terre', 'Air'], {}, null]);
    for (const table of ['coin_ledger', 'world_chests', 'user_items', 'book_tries', 'world_avatars']) assert.equal(await count(table, id), 0, table);
    assert.equal((await sql('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [id]))[0].n, 1);
    assert.equal((await api('GET', '/account', null, player)).status, 200);
    const items = (await sql('SELECT item FROM world_items WHERE user_id = $1 ORDER BY item', [id])).map(r => r.item);
    // (l'île recommencée part de ses sentiers, son Feu sur la plage : world/places.js)
    assert.deepEqual(items, ['ile:plage', 'ile:recommencee', 'ile:sentiers']);
    // Les habitants arrivent un à un : personne pendant la première nuit, Aster au matin, Cannelle après la Récolte.
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'feu')`, [id]);
    assert.deepEqual((await view(player)).villagers.map(v => v.id), []);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit')`, [id]);
    assert.deepEqual((await view(player)).villagers.map(v => v.id), ['ponton']);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte')`, [id]);
    assert.equal((await view(player)).villagers.some(v => v.id === 'foyer'), true);
    // Pendant le développement, on recommence autant qu'on veut (pas deux fois coup sur coup)
    await sql(`UPDATE world_items SET bought_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND item = 'ile:recommencee'`, [id]);
    assert.equal((await restart(player)).status, 200);
    assert.equal((await restart(player)).status, 409);
});

test('dormir : la première nuit se passe seul, sans écus ; Aster n’arrive qu’au matin', async () => {
    const player = await newPlayer({ veteran: false });
    const id = player.userId;
    const view = async () => (await api('GET', '/play/world', null, player)).data;
    // Avant le feu : pas encore l'heure de dormir
    assert.equal((await api('POST', '/play/world/sleep', {}, player)).status, 409);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'feu')`, [id]);
    const before = await view();
    assert.deepEqual([before.brume.quest.id, before.villagers.map(v => v.id)], ['nuit', []]);
    // La nuit passée : la Récolte d'Aster s'ouvre, Aster rejoint le camp ; rien ne se gagne en dormant
    const slept = await api('POST', '/play/world/sleep', {}, player);
    assert.equal(slept.status, 200);
    assert.equal(slept.data.slept, true);
    assert.deepEqual([slept.data.world.brume.quest.id, slept.data.world.villagers.map(v => v.id)], ['recolte', ['ponton']]);
    const coins = (await sql('SELECT coins FROM progress WHERE user_id = $1', [id]))[0].coins;
    assert.equal(coins, 0);
    // Dormir deux fois : refusé
    assert.equal((await api('POST', '/play/world/sleep', {}, player)).status, 409);
});

test('au tutoriel, La Source se découvre en écrivant la Source : sans écus ; un compte d’avant la bible l’achète', async () => {
    const player = await newPlayer({ veteran: false });
    const id = player.userId;
    await view(player);
    const done = ['pages', 'ramasser', 'feu', 'nuit', 'recolte', 'soupe', 'poules', 'deco'];
    await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [id, done]);
    const first = await view(player);
    assert.deepEqual([first.brume.quest.id, first.brume.quest.label], ['achat-source', 'Découvre La Source : fais-la naître dans l’Athanor']);
    const source = first.map.zones.find(z => z.id === 'source');
    assert.deepEqual([source.price, source.plan, source.planOwned], [0, 'Source', false]);
    // Le ruban mène à la Source, l'Encre de sa page est offerte
    const book = (await api('GET', '/play/book', null, player)).data;
    assert.equal(book.ariane && book.ariane.target, 'Source');
    // Sans l'élément : refusé ; écrit : la brume se lève, sans un écu
    const no = await api('POST', '/play/world/zone', { zone: 'source' }, player);
    assert.deepEqual([no.status, no.data.message], [403, 'Fais d’abord naître « Source » dans l’Athanor : la brume se lèvera.']);
    await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Colline", "Source"]'::jsonb WHERE user_id = $1`, [id]);
    const yes = await api('POST', '/play/world/zone', { zone: 'source' }, player);
    assert.deepEqual([yes.status, yes.data.coins], [200, 0]);
    assert.equal(yes.data.world.brume.quest.done, true);

    // Un compte d'avant la bible garde son achat (prix et écus)
    const veteran = await newPlayer({ coins: 150 });
    await view(veteran);
    assert.equal((await view(veteran)).map.zones.find(z => z.id === 'source').plan, undefined);
    const bought = await api('POST', '/play/world/zone', { zone: 'source' }, veteran);
    assert.deepEqual([bought.status, bought.data.coins], [200, 50]);
});
