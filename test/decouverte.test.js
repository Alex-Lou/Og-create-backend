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

test('« Recommencer l’île » : une fois, confirmé en toutes lettres ; l’île repart de zéro, le Grimoire et les écus restent', async () => {
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
    const chaptersBefore = (await api('GET', '/play/book', null, player)).data.chapters.map(c => c.open);

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
    // Gardés : les écus, le Grimoire (ses chapitres ouverts aussi), le coffre de chapitre, la boutique
    assert.equal((await sql('SELECT coins FROM progress WHERE user_id = $1', [id]))[0].coins, 777);
    assert.ok((await sql('SELECT infinite_elements FROM progress WHERE user_id = $1', [id]))[0].infinite_elements.includes('Boue'));
    assert.deepEqual((await api('GET', '/play/book', null, player)).data.chapters.map(c => c.open), chaptersBefore);
    const chests = (await sql('SELECT source FROM world_chests WHERE user_id = $1 ORDER BY source', [id])).map(r => r.source);
    assert.deepEqual(chests, ['chapitre:I']);
    const items = (await sql('SELECT item FROM world_items WHERE user_id = $1 ORDER BY item', [id])).map(r => r.item);
    // (l'île recommencée part de ses sentiers, son Feu sur la plage : world/places.js)
    assert.deepEqual(items, ['banc', 'ile:plage', 'ile:recommencee', 'ile:sentiers']);
    // Les habitants arrivent un à un : Aster après le feu, Cannelle après la Récolte.
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser'), ($1, 'feu')`, [id]);
    assert.deepEqual((await view(player)).villagers.map(v => v.id), ['ponton']);
    await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte')`, [id]);
    assert.equal((await view(player)).villagers.some(v => v.id === 'foyer'), true);
    // Pendant le développement, on recommence autant qu'on veut (pas deux fois coup sur coup)
    await sql(`UPDATE world_items SET bought_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND item = 'ile:recommencee'`, [id]);
    assert.equal((await restart(player)).status, 200);
    assert.equal((await restart(player)).status, 409);
});

test('au tutoriel, La Source se découvre en écrivant la Source : sans écus ; un compte d’avant la bible l’achète', async () => {
    const player = await newPlayer({ veteran: false });
    const id = player.userId;
    await view(player);
    const done = ['pages', 'ramasser', 'feu', 'recolte', 'soupe', 'poules', 'deco'];
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
