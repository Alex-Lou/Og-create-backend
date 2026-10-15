// Ce que fait une chose de l'île, en une ligne de sa fiche : une annexe (ANNEX_EFFECTS : services/annexes.js), un lieu
// remarquable découvert (LANDMARK_EFFECTS : services/landmarks.js), l'humeur d'un habitant (MOOD_EFFECTS :
// services/villagers.js), un palier de bâtiment (LEVEL_EFFECTS : services/world/rules.js), un article de la boutique
// (SHOP_EFFECTS : services/worldShop.js) ; et les lignes que plusieurs d'entre eux partagent (CHARGES, MOVES,
// REGEN_CUT).

const CHARGES = charges => `+${charges} partie de Récolte en réserve`;
const MOVES = moves => `+${moves} coup${moves > 1 ? 's' : ''} par Récolte`;
const REGEN_CUT = minutes => `Une partie revient ${minutes} min plus vite`;

// (word : le pluriel de la ressource du bâtiment ; capHours : les heures gardées sans réserve)
const ANNEX_EFFECTS = {
    rate: (rate, word, earn) => `+${rate} ${word} et +${earn} écus par heure`,
    cap: (hours, capHours) => `Garde ${hours} h de production au lieu de ${capHours}`,
    house: 'Loge un visiteur qui veut rester sur l’île',
    hens: 'Un toit pour les poules d’Agathe'
};

// (site : « la Carrière », « le Bosquet »…)
const LANDMARK_EFFECTS = {
    moves: moves => `+${moves} coups par Récolte`,
    cap: hours => `Chaque bâtiment garde ${hours} h de production de plus`,
    prod: (percent, site) => `+${percent} % de production pour ${site}`
};

// (sign : « + » ou « − »)
const MOOD_EFFECTS = {
    prod: (sign, percent) => `${sign}${percent} % de production`,
    moves: (sign, moves) => `${sign}${moves} coups par Récolte`,
    regen: (minutes, faster) => `Une partie de Récolte revient ${minutes} min plus ${faster ? 'vite' : 'lentement'}`
};

// (grows : la phrase grows au palier où le bâtiment s'agrandit, sinon rien ; made : la ligne made)
const LEVEL_EFFECTS = {
    grows: ' Le bâtiment s’agrandit (3 × 3 cases).',
    foyer: (charges, grows) => `${charges} parties de Récolte en réserve.${grows}`,
    atelier: (moves, grows) => `${moves} coups de plus par Récolte.${grows}`,
    made: (amount, word, coins) => `${amount} ${word} et ${coins} écus par heure`,
    ponton: (made, more, grows) => `Pêche ${made} ; des poissons à la Récolte${more ? ', 2 coups de plus' : ''}.${grows}`,
    produce: (made, word, boost, grows) => `Produit ${made} ; ${word} rapporte ×${boost} à la Récolte.${grows}`
};

const SHOP_EFFECTS = {
    rareChapter: chapter => `Pièce rare : offerte par le chapitre ${chapter} du Grimoire.`,
    rare: 'Pièce rare : elle se trouve dans les coffres légendaires.',
    tint: 'Recolore le bâtiment, à tous ses paliers.',
    skin: 'Change l’apparence du bâtiment.',
    deco: 'Vit sur ton île.',
    prod: percent => `+${percent} % de production`,
    coins: coins => `+${coins} écu${coins > 1 ? 's' : ''} par heure`,
    regen: minutes => `Une partie revient toutes les ${minutes} min`
};

module.exports = { CHARGES, MOVES, REGEN_CUT, ANNEX_EFFECTS, LANDMARK_EFFECTS, MOOD_EFFECTS, LEVEL_EFFECTS, SHOP_EFFECTS };
