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
