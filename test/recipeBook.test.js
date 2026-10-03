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
