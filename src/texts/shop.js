// La boutique de l'île (services/world.js) : ce qu'elle répond quand on achète, rend ou porte un article (skins
// compris). Le texte d'effet de chaque article est dans texts/effects.js.

const ITEM_UNKNOWN = 'Article inconnu.';
const RARE_NOT_SOLD = 'Cette pièce rare ne s’achète pas : elle se trouve dans les butins.';
const ALREADY_YOURS = 'Tu l’as déjà.';
const RARE_NOT_RETURNED = 'Une pièce rare ne se rend pas.';
const TOO_LATE = 'Trop tard pour annuler cet achat.';
const ALREADY_USED = 'Cet article a déjà servi à une partie : il ne se rend plus.';
const SKIN_WRONG_SITE = 'Ce skin ne va pas sur ce bâtiment.';
const FIND_RARE_FIRST = 'Trouve d’abord cette pièce rare dans les butins.';
const BUY_SKIN_FIRST = 'Achète d’abord ce skin.';

module.exports = {
    ITEM_UNKNOWN, RARE_NOT_SOLD, ALREADY_YOURS, RARE_NOT_RETURNED, TOO_LATE, ALREADY_USED, SKIN_WRONG_SITE, FIND_RARE_FIRST,
    BUY_SKIN_FIRST
};
