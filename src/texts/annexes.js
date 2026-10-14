// Ce que répond l'île quand on pose, déplace ou tourne une annexe (services/world/annexPlots.js). Le texte d'effet de
// chaque annexe est dans texts/effects.js.

const SPOT_MESSAGE = 'Une annexe se pose sur une case libre du quartier de son bâtiment.';
const LOOK_MESSAGE = 'Cette couleur n’existe pas pour cette annexe.';
const CAMP_MESSAGE = 'Cette case est au camp des naufragés.';
const ANNEX_UNKNOWN = 'Annexe inconnue.';
const ALL_COPIES_PLACED = 'Tous les exemplaires de cette annexe sont posés.';
const ALREADY_PLACED = 'Cette annexe est déjà posée.';
const CELL_TAKEN = 'Cette case est déjà occupée.';
const NEED_FINDS = (count, find) => `Il te faut ${count} ${find} : ramasses-en sur les gisements de son climat.`;
const NO_ANNEX_HERE = 'Aucune annexe sur cette case.';

module.exports = {
    SPOT_MESSAGE, LOOK_MESSAGE, CAMP_MESSAGE, ANNEX_UNKNOWN, ALL_COPIES_PLACED, ALREADY_PLACED, CELL_TAKEN, NEED_FINDS,
    NO_ANNEX_HERE
};
