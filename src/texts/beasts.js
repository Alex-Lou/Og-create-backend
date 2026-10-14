// Ce que répond l'île pour les bêtes de ferme : ouvrir la cage des poules, nourrir une bête
// (services/world/beasts.js ; name : le nom de la bête).

const CAGE_OPEN = 'La cage est déjà ouverte.';
const NO_CAGE_YET = 'Pas encore de cage : Marcelle n’est pas arrivée.';
const BEAST_UNKNOWN = 'Bête inconnue.';
const OPEN_CAGE_FIRST = 'Ouvre d’abord la cage des poules, au camp.';
const NOT_HUNGRY = name => `${name} n’a pas encore faim.`;
const GARDEN_FIRST = 'Bâtis d’abord le Potager : les bêtes vivent autour.';
const GARDEN_GROWS = name => `${name} viendra quand le Potager aura grandi.`;
const FEED_COST = food => `Il te faut ${food} vivres pour la nourrir.`;

module.exports = { CAGE_OPEN, NO_CAGE_YET, BEAST_UNKNOWN, OPEN_CAGE_FIRST, NOT_HUNGRY, GARDEN_FIRST, GARDEN_GROWS, FEED_COST };
