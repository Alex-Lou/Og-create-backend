// Ce que répond l'île pour ses habitants et ses visiteurs (services/world/people.js) : bavarder, offrir un cadeau,
// combler leurs besoins, satisfaire la demande d'un visiteur et l'installer dans une maison.

const VILLAGER_UNKNOWN = 'Habitant inconnu.';
const NOT_HERE_YET = name => `${name} n’habite pas encore ton île.`;

// Bavardage et cadeau
const GIFT_INVALID = 'Cadeau invalide.';
const ALREADY_TALKED = name => `Vous avez déjà bavardé aujourd’hui : ${name} t’attend demain.`;
const ALREADY_GIFTED = name => `${name} a déjà reçu un cadeau aujourd’hui.`;
const GIFT_COST = (count, resource) => `Il te faut ${count} ${resource} pour ce cadeau.`;

// Besoins
const NEED_UNKNOWN = 'Besoin inconnu.';
const WORKSHOP_FIRST = 'Bâtis d’abord l’Atelier : c’est lui qui forge les outils.';
const NO_NEED_YET = name => `${name} n’en a pas encore besoin.`;
const NEED_COST = parts => `Il te faut ${parts.join(' et ')}.`;
const NEEDS_SHORT = 'Il te manque des ressources pour combler leurs besoins : joue une Récolte.';
const NOBODY_NEEDS = 'Personne n’a besoin de rien pour l’instant.';

// Arrivants
const ARRIVAL_GONE = 'Personne n’attend au Ponton.';
const ARRIVAL_NAME = 'Choisis-lui un prénom : des lettres, de 2 à 16.';
const ARRIVAL_SITE = 'Il ne peut travailler qu’à un bâtiment déjà bâti.';
const NO_FREE_HOUSE = 'Aucune maison libre : pose une Maison près du Foyer (annexes du Foyer).';

module.exports = {
    VILLAGER_UNKNOWN, NOT_HERE_YET, GIFT_INVALID, ALREADY_TALKED, ALREADY_GIFTED, GIFT_COST, NEED_UNKNOWN, WORKSHOP_FIRST,
    NO_NEED_YET, NEED_COST, NEEDS_SHORT, NOBODY_NEEDS, ARRIVAL_GONE, ARRIVAL_NAME, ARRIVAL_SITE, NO_FREE_HOUSE
};
