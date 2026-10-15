// Les créations d'île : ce que dit leur fiche (la règle de pose en clair : GROUND_TEXT, PLACE ; ce qui ouvre un palier :
// TIER_LOCK), pourquoi on ne peut pas encore les fabriquer, les assembler, les poser ou les déplacer
// (services/crafts.js), et ce que répond l'île quand on les fabrique, les pose ou les range
// (services/world/creations.js).

// Sols des règles de pose, en clair
const GROUND_TEXT = { gm: 'sur l’herbe', s: 'sur le sable', n: 'sur la neige', lg: 'sur la lande', x: 'dans le marais', jg: 'dans la jungle', ar: 'sur la cendre ou la roche' };

// Règle de pose (fiche) : rule (« Se pose » + les morceaux, séparés par des virgules), ou anywhere
const PLACE = {
    climate: climate => `dans ${climate}`,
    path: 'au bord d’un chemin',
    near: (reach, name) => `à ${reach} cases au plus de « ${name} »`,
    rule: parts => `Se pose ${parts}.`,
    anywhere: 'Se pose sur n’importe quelle case libre.'
};

// Ce qui ouvre un palier fermé
const TIER_LOCK = {
    first: (stars, epreuves) => `Palier I : inscris ${stars} découvertes au Grimoire, ou réussis ${epreuves} questions de l’Épreuve.`,
    after: before => `S’ouvre avec le palier ${before}.`,
    chapter: (tier, missing) => `Ouvre le chapitre ${tier} du Grimoire : encore ${missing} découverte${missing > 1 ? 's' : ''}.`
};

// Ce qui empêche de fabriquer
const MAKE_FIRST = names => `Fabrique d’abord : ${names}.`;
const KNOW_HOW = elements => `Il faut savoir faire : ${elements} (Grimoire).`;
const NEED_FINDS = (count, find, place) => `Il te faut ${count} ${find} : ramasses-en sur les gisements ${place}.`;

// Ce qui empêche de poser sur une case
const SPOT = {
    taken: 'Case occupée ou hors de tes quartiers.',
    climate: climate => `Se pose dans ${climate}.`,
    path: 'Se pose au bord d’un chemin.',
    far: 'Trop loin du bâtiment demandé.',
    nearCraft: name => `Se pose près de « ${name} ».`
};

// Ce qui empêche de déplacer ou de ranger une création dont une autre a besoin
const LEAVE_BLOCK = (name, needed, reach) => `« ${name} » a besoin de « ${needed} » à ${reach} cases au plus : déplace ou range d’abord « ${name} ».`;

// Pourquoi un assemblage est refusé (en minuscules : ils suivent « Assemblage refusé : »)
const ASSEMBLY_ERRORS = {
    missing: 'il manque des pièces',
    badPiece: 'pièce invalide',
    overflow: 'une pièce dépasse du gabarit',
    overlap: 'deux pièces se chevauchent',
    unfilled: 'le gabarit n’est pas rempli'
};

// Ce que répond l'île (services/world/creations.js)
const CRAFT_UNKNOWN = 'Création inconnue.';
const ASSEMBLY_RETURNED = 'Cet assemblage est déjà rendu.';
const ASSEMBLY_LATE = 'Assemblage refusé : temps écoulé.';
const ASSEMBLY_REFUSED = reason => `Assemblage refusé : ${reason}.`;
const NONE_IN_RESERVE = name => `Pas de « ${name} » en réserve : fabrique d’abord cette création.`;
const NOT_A_LINE = 'Cette création ne se pose pas d’un trait.';
const WORKBENCH_FIRST = name => `Fabrique d’abord « ${name} » à l’établi.`;
const CELL_TAKEN = 'Case déjà prise.';
const NOTHING_TO_PLACE = 'Rien à poser.';
const NO_CRAFT_HERE = 'Aucune création sur cette case.';
// (défaire un piquet : seulement pendant une leçon des clôtures du tutoriel)
const UNPOSE_LESSON_ONLY = 'Un piquet ne se défait que pendant la leçon de l’enclos.';

module.exports = {
    GROUND_TEXT, PLACE, TIER_LOCK, MAKE_FIRST, KNOW_HOW, NEED_FINDS, SPOT, LEAVE_BLOCK, ASSEMBLY_ERRORS, CRAFT_UNKNOWN,
    ASSEMBLY_RETURNED, ASSEMBLY_LATE, ASSEMBLY_REFUSED, NONE_IN_RESERVE, NOT_A_LINE, WORKBENCH_FIRST, CELL_TAKEN,
    NOTHING_TO_PLACE, NO_CRAFT_HERE, UNPOSE_LESSON_ONLY
};
