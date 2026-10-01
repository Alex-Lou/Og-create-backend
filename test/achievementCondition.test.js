const test = require('node:test');
const assert = require('node:assert/strict');
const { isConditionMet } = require('../src/utils/achievementCondition');

test('une condition « includes » demande l’élément', () => {
  assert.equal(isConditionMet("this.discoveredElements.includes('Vie')", ['Eau', 'Vie']), true);
  assert.equal(isConditionMet("this.discoveredElements.includes('Vie')", ['Eau']), false);
});

test('les clauses && demandent toutes les découvertes', () => {
  const condition = "this.discoveredElements.includes('Acier') && this.discoveredElements.includes('Bronze')";
  assert.equal(isConditionMet(condition, ['Acier']), false);
  assert.equal(isConditionMet(condition, ['Acier', 'Bronze']), true);
});

test('un palier de nombre se compte', () => {
  assert.equal(isConditionMet('this.discoveredElements.length >= 3', ['a', 'b']), false);
  assert.equal(isConditionMet('this.discoveredElements.length >= 3', ['a', 'b', 'c']), true);
});

test('une condition inconnue ou du code ne débloque rien', () => {
  assert.equal(isConditionMet('process.exit(1)', ['a']), false);
  assert.equal(isConditionMet(null, ['a']), false);
});
