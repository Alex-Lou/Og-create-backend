// Indices calculés par le serveur : fonctions pures sur un petit livre de recettes
const test = require('node:test');
const assert = require('node:assert/strict');
const { combine, nearby, unexplored, origins, nextStep, keyOf } = require('../src/services/recipeBook');

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

test('pistes, recettes inexplorées et origines', () => {
  assert.deepEqual(nearby(BOOK, BASE), ['Lave', 'Vapeur']);
  assert.deepEqual(nearby(BOOK, [...BASE, 'Vapeur', 'Lave']), ['Nuage']);
  assert.deepEqual(unexplored(BOOK, [...BASE, 'Vapeur']), { Air: 1, Vapeur: 1, Eau: 1, Feu: 1, Terre: 1 });
  assert.deepEqual(origins(BOOK, BASE, 'Vapeur'), [['Eau', 'Feu']]);
});

test('le Livre : pages trouvées, pages à portée sans nom, chapitres scellés', () => {
  const { view, reachableById, pageId } = require('../src/services/bookPages');
  const meta = new Map([
    ['Eau', { emoji: '💧', family: 'Elements Fondamentaux' }], ['Feu', { emoji: '🔥', family: 'Elements Fondamentaux' }],
    ['Terre', { emoji: '🌱', family: 'Elements Fondamentaux' }], ['Air', { emoji: '💨', family: 'Elements Fondamentaux' }],
    ['Vapeur', { emoji: '♨️', family: 'Matériaux' }], ['Nuage', { emoji: '☁️', family: 'Phénomènes Naturels' }],
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
  assert.equal(three.open, false);
  assert.deepEqual(three.pages, []);
  // L'identifiant d'une page à portée retrouve son élément côté serveur seulement
  assert.equal(reachableById(b, BASE, pageId('Vapeur')).name, 'Vapeur');
  assert.equal(reachableById(b, BASE, pageId('Pluie')), null);
  // Une page trouvée montre sa recette
  const after = view(b, [...BASE, 'Vapeur']);
  const vapeur = after.chapters[1].pages.find(p => p.name === 'Vapeur');
  assert.deepEqual(vapeur.recipe, ['Eau', 'Feu']);
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
    // Premiers chapitres : première lettre et ingrédient offert, présent sur le plateau
    assert.equal(page.first, 'P');
    assert.ok(BASE.includes(page.given));
    assert.ok(page.tray.includes(page.given));
    assert.equal(page.freeInkAfter, undefined);
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

test('le Monde : taille de l’île et écus en attente plafonnés', () => {
  const { sizeFor, pendingOf, CAP_HOURS } = require('../src/services/world');
  assert.equal(sizeFor(0), 6);
  assert.equal(sizeFor(40), 7);
  assert.equal(sizeFor(1000), 10);
  const now = Date.parse('2026-10-03T12:00:00Z');
  const hoursAgo = h => new Date(now - h * 3600000).toISOString();
  const tiles = [{ placed_at: hoursAgo(3) }, { placed_at: hoursAgo(20) }];
  // 3 h + réservoir plein (8 h) pour le second
  assert.equal(pendingOf(tiles, null, now), 3 + CAP_HOURS);
  // Après une récolte il y a 1 h, chacun repart de là
  assert.equal(pendingOf(tiles, hoursAgo(1), now), 2);
});
