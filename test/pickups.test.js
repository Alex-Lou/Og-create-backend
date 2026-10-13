// Le tutoriel de l'île neuve (bible du dépôt front, § 9) : la plage de Brumelune, le feu bâti avec Brume, puis Aster et sa Récolte ;
// un compte d'avant la v6 garde ses règles (le feu allumé d'office, Cannelle après la Récolte, Rivet
// après la soupe) et ne recule jamais
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const view = async player => (await api('GET', '/play/world', null, player)).data;
const pick = (player, id) => api('POST', '/play/world/pickup', { id }, player);
const foyerOf = world => world.sites.find(s => s.id === 'foyer').level;
const met = world => world.villagers.map(v => v.id);

test('ramasser sur la plage de Brumelune : une fois, puis la mer en rapporte ; cases inconnues, mal écrites ou recouvertes refusées', async () => {
  const player = await newPlayer();
  const id = player.userId;
  assert.equal((await pick(player, 'greve-bois-9')).status, 404);
  for (const bad of ['', 'cratere-1', 'greve-BOIS-1', 'greve-bois-12']) assert.equal((await pick(player, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await api('POST', '/play/world/pickup', { id: 'greve-galet-1' }, { cookies: {} })).status, 401);
  // Le premier soir : deux bois flottés et un galet, le prix du feu ; les coquillages attendent le jour de Cannelle
  assert.deepEqual((await view(player)).pickups.map(p => p.id), ['greve-bois-1', 'greve-galet-1', 'greve-bois-2']);
  assert.equal((await pick(player, 'greve-coquillage-1')).status, 404);
  // Deux touchers à la fois : un seul ramassage versé
  const both = await Promise.all([1, 2].map(() => pick(player, 'greve-galet-1')));
  assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
  assert.equal((await view(player)).stock.stone, 2);
  assert.ok((await view(player)).pickups.every(p => p.zone === 'coeur'));
  // Trois heures plus tard, la mer en a rapporté
  await sql(`UPDATE world_deposits SET gathered_at = gathered_at - INTERVAL '3 hours' WHERE user_id = $1`, [id]);
  assert.equal((await view(player)).pickups.find(p => p.id === 'greve-galet-1').readyIn, 0);
  assert.equal((await pick(player, 'greve-galet-1')).status, 200);
  // Une création posée sur la case la cache : rien à ramasser là
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 95, 98)`, [id]);
  assert.equal((await view(player)).pickups.some(p => p.id === 'greve-bois-1'), false);
  assert.equal((await pick(player, 'greve-bois-1')).status, 404);
  // Au jour de Cannelle, les coquillages
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'veille')`, [id]);
  assert.deepEqual((await view(player)).pickups.filter(p => p.kind === 'coquillage').map(p => p.id), ['greve-coquillage-1', 'greve-coquillage-2']);
  assert.deepEqual((await pick(player, 'greve-coquillage-1')).data.gives, { food: 5 });
  // Les ramassages de la plage ne comptent pas pour les gisements (quête « trouvaille »)
  await sql('DELETE FROM world_quests WHERE user_id = $1', [id]);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'coeur')`, [id]);
  const trouvaille = (await view(player)).brume.quest;
  assert.deepEqual([trouvaille.id, trouvaille.done], ['trouvaille', false]);
});

test('les trouvailles de la plage paient chacune leur leçon : deux bois et un galet le feu, deux coquillages la soupe de Cannelle', () => {
    const pickups = require('../src/services/pickups');
    const villagers = require('../src/services/villagers');
    const gives = (after, resource) => pickups.SPOTS.filter(s => (s.after || null) === after).reduce((n, s) => n + (pickups.KINDS[s.kind].gives[resource] || 0), 0);
    assert.ok(gives('veille', 'food') >= villagers.NEEDS.manger.cost.food);
});

test('un nouveau compte bâtit son feu ; Aster vient au matin, Cannelle après sa Récolte, Rivet après la troisième nuit', async () => {
  const player = await newPlayer();
  const id = player.userId;
  const first = await view(player);
  assert.equal(foyerOf(first), 0);
  assert.deepEqual(first.sites.find(s => s.id === 'foyer').next.cost, { wood: 4, stone: 2 });
  // Le feu de camp naît du Grimoire : le Brasier d'abord (le ruban y mène), puis bois et galets
  assert.equal(first.sites.find(s => s.id === 'foyer').next.plan, 'Brasier');
  const noPlan = await api('POST', '/play/world/build', { site: 'foyer' }, player);
  assert.deepEqual([noPlan.status, noPlan.data.message], [403, 'Il te faut d’abord faire naître « Brasier » dans l’Athanor du Grimoire.']);
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Brasier"]'::jsonb WHERE user_id = $1`, [id]);
  // Sans bois ni pierre : refusé ; Brume reste seule pendant la construction du camp.
  assert.equal((await api('POST', '/play/world/build', { site: 'foyer' }, player)).status, 400);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages'), ($1, 'ramasser')`, [id]);
  assert.deepEqual([met(await view(player)), (await view(player)).brume.quest.id], [[], 'feu']);
  assert.equal((await api('POST', '/play/world/beasts/cage', {}, player)).status, 403);
  // Le feu réclamé : personne encore ; la première nuit passée : Aster, puis sa Récolte fait venir Cannelle. La
  // soupe seule n'amène plus Rivet.
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'feu')`, [id]);
  assert.deepEqual(met(await view(player)), []);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit')`, [id]);
  assert.deepEqual(met(await view(player)), ['ponton']);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte'), ($1, 'veille'), ($1, 'soupe')`, [id]);
  const after = await view(player);
  assert.deepEqual([met(after).includes('ponton'), met(after).includes('foyer'), met(after).includes('atelier')], [true, true, false]);
  // Le jour de Cannelle (la cage, ses poules, leur poulailler) ne fait pas encore venir Rivet : sa troisième nuit, si
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'cage'), ($1, 'poules'), ($1, 'poulailler')`, [id]);
  assert.equal(met(await view(player)).includes('atelier'), false);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit-cannelle')`, [id]);
  assert.equal(met(await view(player)).includes('atelier'), true);
  // Le jour de Rivet (sa lanterne) ne fait pas encore venir Ondin : sa quatrième nuit, si (choix de l'auteur, 13 oct.)
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'deco')`, [id]);
  assert.equal(met(await view(player)).includes('puits'), false);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit-rivet')`, [id]);
  assert.equal(met(await view(player)).includes('puits'), true);
});

test('au Grimoire, pendant la quête d’Ondin : la page que marque le ruban a son Encre offerte, elle seule', async () => {
  const player = await newPlayer();
  const id = player.userId;
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Vent", "Brasier"]'::jsonb WHERE user_id = $1`, [id]);
  const pages = async () => (await api('GET', '/play/book', null, player)).data.chapters.flatMap(c => c.pages);
  const ink = page => api('POST', '/play/ink', { page }, player);
  // Réveiller Ondin réclamé : la quête active écrit la Pluie (la clé du Puits), avec ses leurres
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'eveil-ondin')`, [id]);
  const guided = await pages();
  const marked = guided.find(p => p.marked);
  assert.ok(marked, 'une page marquée');
  assert.deepEqual(guided.filter(p => p.guidedInk).map(p => p.id), [marked.id]);
  assert.ok(marked.tray.length > 2, 'des leurres : l’Encre sert vraiment');
  // Sans un écu : une autre page se paie (refusée), la page marquée est offerte
  const other = guided.find(p => p.status === 'reach' && !p.marked);
  if (other) assert.equal((await ink(other.id)).status, 400);
  const free = await ink(marked.id);
  assert.deepEqual([free.status, free.data.free], [200, true]);
  assert.ok(free.data.ingredient);
  // La quête suivante (bâtir le Puits) : plus d'Encre offerte d'office
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'souvenir-ondin')`, [id]);
  assert.equal((await pages()).some(p => p.guidedInk), false);
});

test('le Brasier dans la même visite du Grimoire que le Vent : le ruban y mène dès le Vent écrit, sans leurre et sans Encre offerte', async () => {
  const player = await newPlayer();
  const marked = async who => (await api('GET', '/play/book', null, who)).data.chapters.flatMap(c => c.pages).find(p => p.marked);
  // Avant le Vent : le ruban mène au Vent
  assert.equal((await api('GET', '/play/book', null, player)).data.ariane.target, 'Vent');
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Vent"]'::jsonb WHERE user_id = $1`, [player.userId]);
  const book = (await api('GET', '/play/book', null, player)).data;
  assert.equal(book.ariane.target, 'Brasier');
  const page = await marked(player);
  // (Feu + Feu : l'énigme suffit, pas d'Encre offerte ; ses seuls vrais ingrédients, sans leurre)
  assert.equal(page.guidedInk, undefined);
  assert.deepEqual(page.tray, ['Feu']);
  // (encore pendant « ramasser » ; plus une fois le Brasier écrit)
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'pages')`, [player.userId]);
  assert.equal((await api('GET', '/play/book', null, player)).data.ariane.target, 'Brasier');
});

test('la première nuit ne se passe pas ; ensuite le choix se retient sur le compte', async () => {
  const player = await newPlayer();
  const brume = async () => (await api('GET', '/play/world/brume', null, player)).data;
  assert.deepEqual([(await brume()).tutorial, (await brume()).skipped], [true, false]);
  assert.equal((await api('POST', '/play/world/prologue/skip', {}, { cookies: {} })).status, 401);
  assert.equal((await api('POST', '/play/world/prologue/skip', {}, player)).status, 409);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte'), ($1, 'veille')`, [player.userId]);
  const both = await Promise.all([1, 2].map(() => api('POST', '/play/world/prologue/skip', {}, player)));
  assert.deepEqual(both.map(r => r.status), [200, 200]);
  assert.equal((await brume()).skipped, true);
  assert.equal((await view(player)).brume.skipped, true);
  // (une ligne de world_items, que la boutique ignore)
  assert.ok((await view(player)).sites.every(s => s.shop.every(item => item.id !== 'prologue:passe')));
});

test('le verrou parlant : le palier suivant dit les pages jusqu’à son plan et les découvertes qui manquent à son chapitre ; le ruban suit ce qu’on choisit', async () => {
  const player = await newPlayer({ settled: true });
  const world = (await api('GET', '/play/world', null, player)).data;
  // La Carrière : son palier I demande la Pierre (Air + Lave, Lave = Feu + Terre : deux pages)
  const carriere = world.sites.find(s => s.id === 'carriere');
  assert.equal(carriere.next.plan, 'Pierre');
  assert.equal(carriere.next.planPages, 2);
  // Un palier plus haut, dans un chapitre scellé : combien de découvertes il manque
  const foyer = world.sites.find(s => s.id === 'foyer');
  assert.equal(foyer.levels[2].chapterMissing, undefined); // (seul le palier suivant le dit)
  const sealed = world.sites.flatMap(s => s.next ? [s.next] : []).find(n => !n.chapterOpen);
  if (sealed) assert.ok(sealed.chapterMissing > 0);
  // Suivre la Pierre : le ruban y mène, sans indice de quête ni page guidée
  const book = (await api('GET', '/play/book?follow=Pierre', null, player)).data;
  assert.deepEqual([book.ariane.target, book.ariane.remaining, book.ariane.followed], ['Pierre', 2, true]);
  assert.equal(book.ariane.hint, undefined);
  // Un nom inconnu, ou déjà écrit : la quête reprend la main
  const plain = (await api('GET', '/play/book?follow=Inconnu', null, player)).data;
  assert.notEqual(plain.ariane && plain.ariane.followed, true);
  const written = (await api('GET', '/play/book?follow=Feu', null, player)).data;
  assert.notEqual(written.ariane && written.ariane.followed, true);
});
