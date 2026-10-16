// Le tutoriel de l'île neuve (bible du dépôt front, § 9) : la plage de Brumelune, le feu bâti avec Brume, puis Lorena et sa Récolte ;
// un compte d'avant la v6 garde ses règles (le feu allumé d'office, Agathe après la Récolte, Nathan
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
  // Le premier soir : deux bois flottés et un galet, le prix du feu ; les coquillages attendent le jour d’Agathe
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
  // Au jour d’Agathe, les coquillages
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'veille')`, [id]);
  assert.deepEqual((await view(player)).pickups.filter(p => p.kind === 'coquillage').map(p => p.id), ['greve-coquillage-1', 'greve-coquillage-2']);
  assert.deepEqual((await pick(player, 'greve-coquillage-1')).data.gives, { food: 5 });
  // Les ramassages de la plage ne comptent pas pour les gisements (quête « trouvaille »)
  await sql('DELETE FROM world_quests WHERE user_id = $1', [id]);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'coeur')`, [id]);
  const trouvaille = (await view(player)).brume.quest;
  assert.deepEqual([trouvaille.id, trouvaille.done], ['trouvaille', false]);
});

test('les trouvailles de la plage paient chacune leur leçon : deux bois et un galet le feu, deux coquillages la soupe d’Agathe', () => {
    const pickups = require('../src/services/pickups');
    const villagers = require('../src/services/villagers');
    const gives = (after, resource) => pickups.SPOTS.filter(s => (s.after || null) === after).reduce((n, s) => n + (pickups.KINDS[s.kind].gives[resource] || 0), 0);
    assert.ok(gives('veille', 'food') >= villagers.NEEDS.manger.cost.food);
    // (les débris de la grande Hirondelle, sur l'ancienne butte : après le Feu, de quoi bâtir ; choix de l'auteur, 15 oct.)
    assert.deepEqual([gives('feu', 'wood'), gives('feu', 'stone')], [6, 2]);
    assert.ok(pickups.SPOTS.filter(s => s.after === 'feu').every(s => /^greve-[a-z]{1,12}-\d$/.test(s.id)));
});

test('un nouveau compte bâtit son feu ; Lorena vient au matin, Agathe après sa Récolte, Nathan après la troisième nuit', async () => {
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
  // Le feu réclamé : personne encore ; la première nuit passée : Lorena, puis sa Récolte fait venir Agathe. La
  // soupe seule n'amène plus Nathan.
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'feu')`, [id]);
  assert.deepEqual(met(await view(player)), []);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit')`, [id]);
  assert.deepEqual(met(await view(player)), ['ponton']);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'recolte'), ($1, 'veille'), ($1, 'soupe')`, [id]);
  const after = await view(player);
  assert.deepEqual([met(after).includes('ponton'), met(after).includes('foyer'), met(after).includes('atelier')], [true, true, false]);
  // Le jour d’Agathe (la cage, ses poules, leur poulailler) ne fait pas encore venir Nathan : sa troisième nuit, si
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'cage'), ($1, 'poules'), ($1, 'poulailler')`, [id]);
  assert.equal(met(await view(player)).includes('atelier'), false);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit-cannelle')`, [id]);
  assert.equal(met(await view(player)).includes('atelier'), true);
  // Le jour de Nathan (sa lanterne) ne fait pas encore venir Léo : sa quatrième nuit, si (choix de l'auteur, 13 oct.)
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'deco')`, [id]);
  assert.equal(met(await view(player)).includes('puits'), false);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'nuit-rivet')`, [id]);
  assert.equal(met(await view(player)).includes('puits'), true);
});

test('au Grimoire, pendant la quête de Léo : la page que marque le ruban a son Encre offerte, elle seule', async () => {
  const player = await newPlayer();
  const id = player.userId;
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Vent", "Brasier"]'::jsonb WHERE user_id = $1`, [id]);
  const pages = async () => (await api('GET', '/play/book', null, player)).data.chapters.flatMap(c => c.pages);
  const ink = page => api('POST', '/play/ink', { page }, player);
  // Réveiller Léo réclamé : la quête active écrit la Pluie (la clé du Puits), avec ses leurres
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

// Après le tutoriel (choix de l'auteur, 15 oct. : la plage ne doit pas être prévisible), chaque trouvaille revient
// ailleurs et d'une autre source à chaque marée
test('après le tutoriel, la mer rend ses trouvailles ailleurs à chaque marée, sur du sable libre au bord de l’eau ou autour de l’épave', () => {
  const pickups = require('../src/services/pickups');
  const map = require('../src/services/worldMap');
  const done = new Set(['veille', 'chemin']);
  const owned = new Set(['coeur']);
  const wreck = { x: 96, y: 96 };
  const shore = (userId, gathered = new Map(), free = () => true) => pickups.shoreOf({ userId, done, gathered, owned, free, wreck });
  const first = shore(7);
  // les cinq parues (les débris de l'épave attendent le Feu), chacune sur sa case : du sable du cœur, au bord de l'eau
  // (ou autour de l'épave, la source de « greve-galet-1 »)
  assert.deepEqual(first.map(p => p.id), pickups.SPOTS.filter(s => pickups.shownFor(s, done)).map(s => s.id));
  assert.equal(new Set(first.map(p => `${p.x},${p.y}`)).size, 5);
  for (const p of first) {
    assert.equal(map.groundAt(p.x, p.y), 's', p.id);
    assert.equal(map.zoneAt(p.x, p.y), 'coeur', p.id);
    if (p.id === 'greve-galet-1') assert.ok(Math.max(Math.abs(p.x - 96.5), Math.abs(p.y - 96.5)) <= 3.5, 'près de l’épave');
    else assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.heightAt(p.x + dx, p.y + dy) < 0 || map.groundAt(p.x + dx, p.y + dy) === 'w'), `${p.id} au bord de l’eau`);
    assert.ok(Object.hasOwn(pickups.SOURCES.laisse.weights, p.kind) || Object.hasOwn(pickups.SOURCES.anse.weights, p.kind));
  }
  // le même tirage à chaque lecture ; un autre joueur, une autre plage
  assert.deepEqual(shore(7), first);
  assert.notDeepEqual(shore(8).map(p => [p.x, p.y]), first.map(p => [p.x, p.y]));
  // ramassée, elle revient ailleurs, et pas toujours la même chose (sur vingt marées : au moins dix cases, deux sortes)
  for (const id of ['greve-bois-1', 'greve-galet-1', 'greve-coquillage-1']) {
    const tides = Array.from({ length: 20 }, (_, k) => shore(7, new Map([[id, new Date(Date.UTC(2026, 9, 15, k + 1))]])).find(p => p.id === id));
    assert.ok(new Set(tides.map(p => `${p.x},${p.y}`)).size >= 10, `${id} change de place`);
    assert.ok(new Set(tides.map(p => p.kind)).size >= 2, `${id} change de sorte`);
  }
  // ramasser l'une ne fait bouger aucune autre ; bâtir ailleurs non plus
  const picked = shore(7, new Map([['greve-bois-1', new Date(Date.UTC(2026, 9, 15, 3))]]));
  assert.deepEqual(picked.filter(p => p.id !== 'greve-bois-1'), first.filter(p => p.id !== 'greve-bois-1'));
  const elsewhere = new Set(['80,95', '100,98', '104,98'].filter(k => !first.some(p => `${p.x},${p.y}` === k)));
  assert.deepEqual(shore(7, new Map(), (x, y) => !elsewhere.has(`${x},${y}`)), first);
  // une case prise (une création, un chemin…) n'en reçoit pas
  const taken = new Set(first.map(p => `${p.x},${p.y}`));
  assert.ok(shore(7, new Map(), (x, y) => !taken.has(`${x},${y}`)).every(p => !taken.has(`${p.x},${p.y}`)));
  // la sorte au ramassage est celle de la vue, à chaque marée
  for (const p of first) assert.equal(pickups.kindOf({ userId: 7, done, spot: pickups.SPOT_BY_ID[p.id], at: null }), p.kind);
  // au tutoriel, rien ne bouge
  const tuto = pickups.shoreOf({ userId: 7, done: new Set(['veille']), gathered: new Map(), owned, free: () => true, wreck });
  assert.deepEqual(tuto.map(p => [p.id, p.kind, p.x, p.y]), pickups.SPOTS.filter(s => pickups.shownFor(s, new Set(['veille']))).map(s => [s.id, s.kind, s.x, s.y]));
});

// Les débris de la grande Hirondelle (6 × 3) : après le tutoriel, ils reviennent autour d'elle, planches et ferraille
test('après le tutoriel, les débris de la grande Hirondelle reviennent autour d’elle : planches et ferraille', () => {
  const pickups = require('../src/services/pickups');
  const map = require('../src/services/worldMap');
  const wreck = { x: 86, y: 97, w: 6, h: 3 };
  const shore = pickups.shoreOf({ userId: 7, done: new Set(['veille', 'feu', 'chemin']), gathered: new Map(), owned: new Set(['coeur']), free: () => true, wreck });
  const debris = shore.filter(p => /^greve-(planche|ferraille)-/.test(p.id));
  assert.equal(debris.length, 3);
  for (const p of debris) {
    assert.ok(Object.hasOwn(pickups.SOURCES.debris.weights, p.kind), p.id);
    assert.equal(map.groundAt(p.x, p.y), 's', p.id);
    const inWreck = p.x >= 86 && p.x <= 91 && p.y >= 97 && p.y <= 99;
    assert.ok(!inWreck && p.x >= 83 && p.x <= 94 && p.y >= 94 && p.y <= 102, `${p.id} autour de l’épave`);
  }
});

test('après le tutoriel, la plage de l’API : ramasser rend la sorte que la vue montrait, la trouvaille revient ailleurs', async () => {
  const player = await newPlayer();
  const id = player.userId;
  const order = require('../src/services/quests').QUESTS.map(q => q.id);
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [id, order.slice(0, order.indexOf('chemin') + 1)]);
  const before = (await view(player)).pickups;
  // (les cinq de la plage et les trois débris de l'épave, parus après le Feu)
  assert.equal(before.length, 8);
  const one = before.find(p => !p.readyIn);
  const done = await pick(player, one.id);
  assert.equal(done.status, 200);
  assert.equal(done.data.kind, one.kind);
  const again = done.data.world.pickups.find(p => p.id === one.id);
  assert.ok(again.readyIn > 0);
  assert.equal((await pick(player, one.id)).status, 409);
});
