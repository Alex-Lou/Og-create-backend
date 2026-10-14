// L'avatar du joueur : ce que répond l'île quand un choix ne convient pas (services/avatarChoices.js,
// services/world.js).

const AVATAR_INVALID = 'Avatar invalide.';
const AVATAR_UNKNOWN = 'Avatar inconnu.';
const CHOICE_NOT_YOURS = 'Ce choix n’existe pas, ou n’est pas encore à toi.';
const ITEM_MISSING = 'Cet objet n’existe pas.';
const WRONG_PLACE = 'Cet objet ne se porte pas là.';
const ITEM_NOT_YOURS = 'Cet objet n’est pas encore à toi.';
const COLOR_NOT_YOURS = 'Cette couleur n’existe pas, ou n’est pas encore à toi.';

module.exports = { AVATAR_INVALID, AVATAR_UNKNOWN, CHOICE_NOT_YOURS, ITEM_MISSING, WRONG_PLACE, ITEM_NOT_YOURS, COLOR_NOT_YOURS };
