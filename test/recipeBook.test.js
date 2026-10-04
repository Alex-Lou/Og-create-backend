// Indices calculés par le serveur : fonctions pures sur un petit livre de recettes
const test = require('node:test');
const assert = require('node:assert/strict');
const { combine, unexplored, nextStep, keyOf } = require('../src/services/recipeBook');

const RULES = { 'Eau+Feu': 'Vapeur', 'Air+Vapeur': 'Nuage', 'Eau+Nuage': 'Pluie', 'Feu+Terre': 'Lave' };
const recipes = new Map(Object.entries(RULES).map(([key, result]) => [keyOf(key.split('+')), result]));
const BOOK = { recipes, entries: [...recipes].map(([key, result]) => [key.split('+'), result]) };
const BASE = ['Eau', 'Feu', 'Terre', 'Air'];

test('un mélange ne dépend pas de l’ordre des ingrédients', () => {
  assert.equal(combine(BOOK, ['Feu', 'Eau']), 'Vapeur');
  assert.equal(combine(BOOK, ['Eau', 'Eau']), null);
});

test('l’étape suivante remonte vers une fusion faisable tout de suite', () => {
  assert.deepEqual(nextStep(BOOK, BASE, ['Pluie']), { ingredients: ['Eau', 'Feu'], result: 'Vapeur' });
  assert.deepEqual(nextStep(BOOK, [...BASE, 'Vapeur'], ['Pluie']), { ingredients: ['Air', 'Vapeur'], result: 'Nuage' });
  assert.equal(nextStep(BOOK, ['Eau'], ['Pluie']), null);
});

test('recettes inexplorées par élément possédé', () => {
  assert.deepEqual(unexplored(BOOK, [...BASE, 'Vapeur']), { Air: 1, Vapeur: 1, Eau: 1, Feu: 1, Terre: 1 });
});

test('fusion de la progression de l’Épreuve', () => {
  const { merge } = require('../src/services/timerProgress');
  const merged = merge(
    { completedQuestions: { Facile: { A: [1] } }, unlockedCategories: { Facile: ['A'] }, bestScores: { Facile: 5 } },
    { completedQuestions: { Moyen: { B: [2] } }, unlockedCategories: { Facile: ['A', 'B'], Moyen: ['C'] }, bestScores: { Facile: 3, Moyen: 2 } });
  // Les records envoyés par le navigateur ne sont pas gardés
  assert.deepEqual(merged, {
    completedQuestions: { Facile: { A: [1] }, Moyen: { B: [2] } },
    unlockedCategories: { Facile: ['A', 'B'], Moyen: ['C'], Difficile: [] }
  });
});

test('le Livre : pages trouvées, pages à portée sans nom, chapitres scellés', () => {
  const { view, reachableById, pageId } = require('../src/services/bookPages');
  const meta = new Map([
    ['Eau', { emoji: '💧', family: 'Elements Fondamentaux' }], ['Feu', { emoji: '🔥', family: 'Elements Fondamentaux' }],
    ['Terre', { emoji: '🌱', family: 'Elements Fondamentaux' }], ['Air', { emoji: '💨', family: 'Elements Fondamentaux' }],
    ['Vapeur', { emoji: '♨️', family: 'Matériaux', riddle: 'Je m’élève en soupirant.' }], ['Nuage', { emoji: '☁️', family: 'Phénomènes Naturels' }],
    ['Pluie', { emoji: '🌧️', family: 'Phénomènes Naturels' }], ['Lave', { emoji: '🌋', family: 'Matériaux' }]
  ]);
  const b = { ...BOOK, meta };
  const start = view(b, BASE);
  assert.equal(start.stars, 0);
  const [one, two, three] = start.chapters;
  assert.equal(one.pages.filter(p => p.status === 'found').length, 4);
  assert.equal(one.far, 2);
  const reach = two.pages.filter(p => p.status === 'reach');
  assert.equal(reach.length, 2);
  // Aucune page à portée ne porte de nom ni d'emoji : seulement famille, longueur et indice de familles
  for (const page of reach) {
    assert.equal(page.name, undefined);
    assert.equal(page.emoji, undefined);
    assert.deepEqual(page.clue, ['Elements Fondamentaux', 'Elements Fondamentaux']);
  }
  // L'énigme de l'élément accompagne sa page ; un élément sans énigme n'en porte pas
  assert.equal(reach.find(p => p.id === pageId('Vapeur')).riddle, 'Je m’élève en soupirant.');
  assert.equal(reach.find(p => p.id === pageId('Lave')).riddle, undefined);
  assert.ok(two.verse);
  assert.equal(three.open, false);
  assert.deepEqual(three.pages, []);
  // L'identifiant d'une page à portée retrouve son élément côté serveur seulement
  assert.equal(reachableById(b, BASE, pageId('Vapeur')).name, 'Vapeur');
  assert.equal(reachableById(b, BASE, pageId('Pluie')), null);
  // Une page trouvée montre sa recette
  const after = view(b, [...BASE, 'Vapeur']);
  const vapeur = after.chapters[1].pages.find(p => p.name === 'Vapeur');
  assert.deepEqual(vapeur.recipe, ['Eau', 'Feu']);
  assert.equal(vapeur.riddle, 'Je m’élève en soupirant.');
  assert.equal(after.stars, 1);
});

test('le Livre : difficulté par chapitre (pages ouvertes, profondeur, plateau, aides)', () => {
  const { view, pageId, DIFFICULTY } = require('../src/services/bookPages');
  const meta = new Map(BASE.map(name => [name, { emoji: '·', family: 'Elements Fondamentaux' }]));
  const entries = [];
  // Chapitre I : cinq phénomènes à un mélange des éléments premiers, un sixième à deux mélanges
  const pairs = [['Eau', 'Eau'], ['Eau', 'Feu'], ['Air', 'Eau'], ['Feu', 'Feu'], ['Air', 'Air']];
  pairs.forEach((parts, i) => { meta.set(`Phéno${i}`, { emoji: '·', family: 'Phénomènes Naturels' }); entries.push([parts, `Phéno${i}`]); });
  meta.set('Profond', { emoji: '·', family: 'Phénomènes Naturels' });
  entries.push([['Eau', 'Phéno0'], 'Profond']);
  // Chapitre V : 25 matériaux possédés ouvrent le chapitre ; une création à portée
  const fillers = Array.from({ length: 25 }, (_, i) => `Matière${i}`);
  fillers.forEach(name => meta.set(name, { emoji: '·', family: 'Matériaux' }));
  meta.set('Outil', { emoji: '·', family: 'Créations Humaines' });
  entries.push([['Matière0', 'Terre'], 'Outil']);
  const b = { meta, entries };

  const start = view(b, BASE);
  const one = start.chapters[0];
  const reach = one.pages.filter(p => p.status === 'reach');
  assert.equal(reach.length, DIFFICULTY.I.open);
  assert.equal(one.sealed, 5 - DIFFICULTY.I.open);
  for (const page of reach) {
    // Premiers chapitres : première lettre ; aucun ingrédient offert d'emblée, l'encre l'est après quelques ratés
    assert.equal(page.first, 'P');
    assert.equal(page.given, undefined);
    assert.equal(page.freeInkAfter, DIFFICULTY.I.freeInkAfter);
    // Plateau : seulement des éléments possédés, bons ingrédients compris, leurres bornés
    assert.ok(page.tray.every(name => BASE.includes(name)));
    assert.ok(page.tray.length <= new Set(page.groups).size + DIFFICULTY.I.decoys);
  }
  // Le plateau ne bouge pas d'un chargement à l'autre
  assert.deepEqual(view(b, BASE).chapters[0].pages.map(p => p.tray), one.pages.map(p => p.tray));

  // Profondeur : avec Phéno0 en main, l'élément à deux mélanges passe après ceux à un mélange
  const later = view(b, [...BASE, 'Phéno0']).chapters[0];
  assert.ok(!later.pages.some(p => p.id === pageId('Profond')));
  assert.equal(later.sealed, 2);

  // Chapitre V : ni première lettre ni ingrédient offert, encre offerte plus tard, plateau plus large
  const deep = view(b, [...BASE, ...fillers]).chapters[4];
  assert.equal(deep.open, true);
  const outil = deep.pages.find(p => p.status === 'reach');
  assert.equal(outil.first, undefined);
  assert.equal(outil.given, undefined);
  assert.equal(outil.freeInkAfter, DIFFICULTY.V.freeInkAfter);
  assert.equal(outil.tray.length, 2 + DIFFICULTY.V.decoys);
  assert.ok(outil.tray.includes('Matière0') && outil.tray.includes('Terre'));
});

test('le Livre : la recette d’une page grandit avec le chapitre, sans dépasser les emplacements', () => {
  const { view, reachableById, aim, pageId } = require('../src/services/bookPages');
  const meta = new Map(BASE.map(name => [name, { emoji: '·', family: 'Elements Fondamentaux' }]));
  const add = (name, family) => meta.set(name, { emoji: '·', family });
  // Trois familles possédées : l'Athanor a 3 emplacements ; cinq découvertes ouvrent le chapitre III
  ['Brume', 'Rosée', 'Givre'].forEach(name => add(name, 'Phénomènes Naturels'));
  ['Sel', 'Argile'].forEach(name => add(name, 'Matériaux'));
  add('Étoile', 'Cosmos');
  add('Comète', 'Cosmos');
  const entries = [
    [['Air', 'Feu'], 'Étoile'],
    [['Air', 'Feu', 'Brume'], 'Étoile'],
    [['Eau', 'Feu', 'Sel', 'Argile'], 'Comète']
  ];
  const b = { meta, entries };
  const owned = [...BASE, 'Brume', 'Rosée', 'Givre', 'Sel', 'Argile'];
  const three = view(b, owned).chapters[2];
  const etoile = three.pages.find(p => p.id === pageId('Étoile'));
  // Chapitre III : la recette à 3 ingrédients plutôt que la paire
  assert.deepEqual(etoile.groups, [0, 1, 2]);
  assert.deepEqual(reachableById(b, owned, pageId('Étoile')).parts, ['Air', 'Feu', 'Brume']);
  assert.deepEqual(aim(b, owned, pageId('Étoile'), ['Air', 'Feu']), { name: 'Étoile', right: 2, of: 3 });
  // Une recette à 4 ne tient pas dans 3 emplacements : la page reste loin
  assert.equal(three.pages.some(p => p.id === pageId('Comète')), false);
  assert.equal(reachableById(b, owned, pageId('Comète')), null);
  assert.equal(three.far, 1);
});

test('le pendu : lettre posée dans une case, verdicts, masque et illustration', () => {
  const { fold, state, judge, solvedBy, maxMisses } = require('../src/services/hangman');
  assert.equal(fold('É'), 'E');
  assert.equal(fold('ç'), 'C');
  assert.equal(fold('-'), null);
  assert.equal(fold('œ'), null);
  assert.equal(maxMisses('I'), 3);
  assert.equal(maxMisses('V'), 2);
  // Juste, présente ailleurs, absente (accents ignorés)
  assert.equal(judge('Éclair', 0, 'E'), 'hit');
  assert.equal(judge('Éclair', 1, 'E'), 'elsewhere');
  assert.equal(judge('Éclair', 1, 'Z'), 'miss');
  // Rien de posé : la première lettre (donnée par la page) et les tirets, ni emoji ni nom
  const start = state('Arc-en-ciel', null, 3, true, '🌈');
  assert.deepEqual(start.mask, ['A', null, null, '-', null, null, '-', null, null, null, null]);
  assert.equal(start.emoji, undefined);
  assert.equal(start.name, undefined);
  // Une lettre posée : seulement sa case, et l'illustration commence à paraître
  const one = state('Éclair', { letters: 'EQ', revealed: [0], misses: 1 }, 3, false, '⚡');
  assert.deepEqual(one.mask, ['É', null, null, null, null, null]);
  assert.deepEqual(one.absent, ['Q']);
  assert.equal(one.emoji, '⚡');
  assert.ok(Math.abs(one.share - 1 / 6) < 1e-9);
  // Mot complet (première lettre donnée comprise)
  assert.equal(solvedBy('Vent', [1, 2, 3], true), true);
  assert.equal(solvedBy('Vent', [1, 2], true), false);
  // Partie perdue : rejouable 24 h plus tard, avec toutes ses vies
  const now = new Date('2026-10-04T12:00:00Z');
  const lost = state('Vent', { letters: 'XYZ', revealed: [], misses: 3, failed_at: new Date('2026-10-04T11:00:00Z') }, 3, true, '🌬️', now);
  assert.equal(lost.failedUntil, '2026-10-05T11:00:00.000Z');
  const later = state('Vent', { letters: 'XYZ', revealed: [], misses: 3, failed_at: new Date('2026-10-03T10:00:00Z') }, 3, true, '🌬️', now);
  assert.equal(later.failedUntil, null);
  assert.equal(later.misses, 0);
});

test('le Monde : écus dus (ancienne règle), parties qui reviennent, effets et production des bâtiments', () => {
  const { pendingOf, chargesAt, effectsOf, productionOf, isFree, CAP_HOURS, REGEN_MS } = require('../src/services/world');
  const now = Date.parse('2026-10-03T12:00:00Z');
  const hoursAgo = h => new Date(now - h * 3600000).toISOString();
  const tiles = [{ placed_at: hoursAgo(3) }, { placed_at: hoursAgo(20) }];
  // Ancienne règle, payée une dernière fois à la migration : 3 h + réservoir plein (8 h) pour le second
  assert.equal(pendingOf(tiles, null, now), 3 + CAP_HOURS);
  assert.equal(pendingOf(tiles, hoursAgo(1), now), 2);

  // Parties : une toutes les 30 min, plafonnées ; la progression partielle est gardée
  const stock = { charges: 0, charges_at: new Date(now - REGEN_MS * 1.5).toISOString() };
  assert.deepEqual(chargesAt(stock, 3, now), { count: 1, since: now - REGEN_MS * 0.5 });
  assert.equal(chargesAt({ charges: 2, charges_at: hoursAgo(5) }, 3, now).count, 3);

  // Effets : Foyer seul, puis niveau 1 (×2, +3 coups), puis niveau 2 (×3, Forge +5, Port +2)
  assert.deepEqual(effectsOf({ foyer: 1 }), { maxCharges: 3, maxMoves: 15, kinds: ['stone', 'wood', 'water', 'food'], boosts: {} });
  const grown = effectsOf({ foyer: 3, atelier: 1, ponton: 1, carriere: 1 });
  assert.equal(grown.maxCharges, 5);
  assert.equal(grown.maxMoves, 18);
  assert.ok(grown.kinds.includes('fish'));
  assert.deepEqual(grown.boosts, { stone: 2 });
  const evolved = effectsOf({ atelier: 2, ponton: 2, carriere: 2, potager: 2 });
  assert.equal(evolved.maxMoves, 22);
  assert.deepEqual(evolved.boosts, { stone: 3, food: 3 });

  // Production : 3 ressources et 2 écus par heure et par niveau, réservoir de 8 h ; l'Atelier ne produit rien
  assert.deepEqual(productionOf('potager', 1, hoursAgo(3), null, now), { resource: 'food', amount: 9, coins: 6 });
  assert.deepEqual(productionOf('carriere', 2, hoursAgo(20), null, now), { resource: 'stone', amount: 48, coins: 32 });
  assert.deepEqual(productionOf('potager', 1, hoursAgo(3), hoursAgo(1), now), { resource: 'food', amount: 3, coins: 2 });
  assert.equal(productionOf('atelier', 1, hoursAgo(3), null, now), null);

  // Cases libres : terre, hors chantier, dans un quartier possédé
  const core = new Set(['coeur']);
  assert.equal(isFree(9, 9, core), false);
  assert.equal(isFree(8, 8, core), true);
  assert.equal(isFree(0, 0, core), false);
  assert.equal(isFree(9, 15, core), false);
  assert.equal(isFree(9, 15, new Set(['coeur', 'source'])), true);
});

test('la carte de l’île : côte organique, chaque chantier sur la terre et dans un seul quartier', () => {
  const map = require('../src/services/worldMap');
  assert.equal(map.GRID.length, map.SIZE);
  assert.ok(map.GRID.every(row => row.length === map.SIZE));
  for (const [id, p] of Object.entries(map.SITE_PLACES)) {
    const zones = new Set([[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => map.zoneAt(p.x + dx, p.y + dy)));
    assert.equal(zones.size, 1, id);
    assert.ok(!zones.has(null), id);
  }
  assert.equal(map.siteZone('foyer'), 'coeur');
  // Chaque quartier a des cases et un panneau ; l'île n'est pas un carré (des cases de mer à l'intérieur de son cadre)
  map.ZONES.forEach(z => assert.ok(map.ANCHORS[z.id], z.id));
  assert.equal(map.isLand(1, 1), false);
  assert.equal(map.isLand(10, 10), true);
});
