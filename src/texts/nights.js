// Ce que répond l'île la nuit (services/world/nights.js) : repousser un égaré, réparer un bâtiment embrumé.

const DAYTIME = 'Il fait jour : aucun égaré dehors.';
const NO_STRAY = 'Aucun égaré cette nuit.';
const STRAY_NOT_FOUND = 'Égaré introuvable.';
const ALREADY_SULKING = 'Celui-là est déjà rentré dans la brume.';
const NOT_ON_PATH = 'Cet égaré n’est pas sur le chemin.';
const NOT_BLIGHTED = 'Ce bâtiment n’est pas embrumé.';
const REPAIR_COST = (amount, resource) => `Il te faut ${amount} ${resource} pour réparer.`;

module.exports = { DAYTIME, NO_STRAY, STRAY_NOT_FOUND, ALREADY_SULKING, NOT_ON_PATH, NOT_BLIGHTED, REPAIR_COST };
