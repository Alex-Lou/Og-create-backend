// Ce que répond le Cabinet (les pièces de sceau : cadres, emblèmes) : routes/customization.js et services/customization.js.

const ITEMS_FAILED = 'Erreur lors de la récupération des items';
const UNLOCKED_FAILED = 'Erreur lors de la récupération des items déverrouillés';
const SELECTIONS_FAILED = 'Erreur lors de la récupération des sélections';
const SELECTION_REQUIRED = 'Frame et avatar requis';
const SELECTIONS_SAVED = 'Sélections sauvegardées avec succès';
const SELECTIONS_SAVE_FAILED = 'Erreur lors de la sauvegarde des sélections';
const ITEM_REQUIRED = 'ID de l\'item requis';
const ITEM_BOUGHT = 'Item acheté avec succès';
const PURCHASE_FAILED = 'Erreur lors de l\'achat de l\'item';

const NOT_UNLOCKED = 'Vous n\'avez pas déverrouillé ces items';
const ITEM_NOT_FOUND = 'Item non trouvé';
const EARNED_ONLY = achievement => `Cette pièce se mérite : succès « ${achievement} »`;
const ALREADY_OWNED = 'Vous possédez déjà cet item';
const NOT_ENOUGH_COINS = 'Vous n\'avez pas assez de pièces';

module.exports = {
    ITEMS_FAILED, UNLOCKED_FAILED, SELECTIONS_FAILED, SELECTION_REQUIRED, SELECTIONS_SAVED, SELECTIONS_SAVE_FAILED,
    ITEM_REQUIRED, ITEM_BOUGHT, PURCHASE_FAILED, NOT_UNLOCKED, ITEM_NOT_FOUND, EARNED_ONLY, ALREADY_OWNED, NOT_ENOUGH_COINS
};
