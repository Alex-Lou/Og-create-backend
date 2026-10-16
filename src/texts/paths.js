// Ce que répond l'île quand on trace ou efface des chemins (services/world/paths.js).

const OUTSIDE = 'Case hors de l’île.';
const OWN_ZONES = 'Trace tes chemins dans tes quartiers.';
const ALREADY_PATH = 'Il y a déjà un chemin ici.';
const GROUND = 'Un chemin se trace sur l’herbe, le sable ou la prairie.';
const CELL_TAKEN = 'Cette case est occupée.';
const NOTHING = 'Aucune case à tracer ni à effacer.';
const TOO_MANY = max => `Pas plus de ${max} cases à la fois.`;
const CELL_INVALID = 'Case invalide.';
const ONLY_YOURS = 'Seuls les chemins que tu as tracés s’effacent.';
const LEANS_ON = name => `« ${name} » s’appuie sur ce chemin : déplace-la d’abord.`;
const STONE_COST = (pay, stone) => `Il te faut ${pay} pierre${pay > 1 ? 's' : ''} pour ce chemin (tu en as ${stone}).`;
// Le pavé (world/paths.js : planOf)
const PAVE_LOCKED = 'Le pavé se pose une fois la Carrière bâtie.';
const ALREADY_PAVED = 'Cette case est déjà pavée.';
const NOT_PAVED = 'Cette case n’est pas pavée.';
const PAVE_ON_PATH = 'Le pavé se pose sur un chemin.';
const PAVE_COST = (need, stone) => `Il te faut ${need} pierres pour ce pavé (tu en as ${stone}).`;

module.exports = {
    OUTSIDE, OWN_ZONES, ALREADY_PATH, GROUND, CELL_TAKEN, NOTHING, TOO_MANY, CELL_INVALID, ONLY_YOURS, LEANS_ON, STONE_COST, PAVE_LOCKED, ALREADY_PAVED,
    NOT_PAVED, PAVE_ON_PATH, PAVE_COST
};
