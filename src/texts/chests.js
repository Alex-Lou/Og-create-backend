// Les coffres de l'île (services/world/chests.js) : d'où vient un coffre qui attend (LABELS), ce que garde la caisse
// d'Hermine (HERMINE_KEEPSAKES : enclos, le nombre de piquets ; doors, celui de ses portes), et ce que répond l'île quand on en ouvre un.

const LABELS = {
    chapter: chapter => `Chapitre ${chapter} du Grimoire`,
    quest: label => `Quête : ${label}`,
    landmark: name => `Lieu : ${name}`
};

const HERMINE_KEEPSAKES = (enclos, doors) => ['Longue-vue', 'Filet', 'Carnet de quart (le plan du Ponton)', `${enclos} piquets de clôture`, `${doors} portes à verrou`];

const CRATE_NOT_YET = 'Cette caisse n’a pas encore échoué.';
const CRATE_OPEN = 'Cette caisse est déjà ouverte.';
const CHEST_UNKNOWN = 'Coffre inconnu.';
const CLAIM_QUEST_FIRST = 'Réclame d’abord cette quête de Brume.';
const FIND_PLACE_FIRST = 'Découvre d’abord ce lieu sur l’île.';
const SEA_EMPTY = 'La mer n’a encore rien rendu.';
const BOTTLE_NOT_YET = 'La prochaine bouteille n’est pas encore arrivée.';
const CHEST_OPEN = 'Ce coffre est déjà ouvert.';
const NO_CHEST = 'Aucun coffre à ouvrir.';

module.exports = {
    LABELS, HERMINE_KEEPSAKES, CRATE_NOT_YET, CRATE_OPEN, CHEST_UNKNOWN, CLAIM_QUEST_FIRST, FIND_PLACE_FIRST, SEA_EMPTY,
    BOTTLE_NOT_YET, CHEST_OPEN, NO_CHEST
};
