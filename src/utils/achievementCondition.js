// Conditions de succès (même grammaire que le front, src/utils/achievementChecker.js), sans évaluer de code :
//   "this.discoveredElements.includes('Vie')"   -> l'élément est découvert
//   "this.discoveredElements.length >= 20"      -> au moins N éléments découverts
// Les clauses se combinent avec && et ||. Une condition non reconnue n'est jamais remplie.

const INCLUDES = /includes\(\s*['"]([^'"]+)['"]\s*\)/;
const LENGTH = /length\s*>=\s*(\d+)/;

function isClauseMet(clause, elements) {
  const includes = clause.match(INCLUDES);
  if (includes) return elements.includes(includes[1]);
  const length = clause.match(LENGTH);
  if (length) return elements.length >= parseInt(length[1], 10);
  return false;
}

function isConditionMet(condition, elements) {
  if (typeof condition !== 'string' || !Array.isArray(elements)) return false;
  // "A && B || C" : au moins une alternative (||) dont toutes les clauses (&&) sont remplies
  return condition.split('||').some(alternative =>
    alternative.split('&&').every(clause => isClauseMet(clause, elements))
  );
}

module.exports = { isConditionMet };
