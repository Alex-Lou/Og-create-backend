// Les terres nouvelles : la description de chaque lieu remarquable (LANDMARK_TEXTS, par identifiant :
// services/landmarks.js), et ce que répond l'île pour une expédition, un lieu à découvrir, un gisement ou une
// trouvaille de la plage (services/world/lands.js).

const LANDMARK_TEXTS = {
    grotte: 'Une bouche bleue s’ouvre au pied du glacier ; dedans, la glace chante quand le vent passe.',
    lac: 'Sous la glace claire dorment des poissons d’argent, immobiles comme des souvenirs.',
    col: 'Des fanions claquent entre deux pics : ici, le vent pousse toujours dans le dos du voyageur.',
    menhirs: 'Sept pierres dressées, plus vieilles que l’île ; leurs gravures luisent à la nuit tombée.',
    arche: 'La mer a percé la falaise d’une arche immense, où nichent les goélands.',
    saule: 'Ses branches trempent dans l’eau dormante ; les grenouilles le disent aussi vieux que la brume.',
    pilotis: 'Une cabane de pêcheur oubliée, perchée sur l’eau ; les lucioles y tiennent conseil chaque soir.',
    oasis: 'Au milieu du sable, une eau fraîche jaillit d’un rocher, à l’ombre de trois palmiers.',
    pyramide: 'Seul son sommet dépasse des dunes ; le soleil couchant y dessine des signes oubliés.',
    arbre: 'Son tronc vaut dix maisons ; dans ses racines, la jungle entière semble respirer.',
    cascade: 'L’eau tombe de la falaise en un rideau blanc ; dans ses embruns flotte toujours un arc-en-ciel.',
    geyser: 'Toutes les quelques minutes, la terre souffle une colonne de vapeur brûlante vers le ciel.',
    cratere: 'Au cœur du cratère, la lave bouillonne lentement ; ses lueurs se voient depuis toute l’île.'
};

// Expéditions
const ZONE_DISCOVERED = 'Ce quartier est déjà découvert.';
const EXPEDITION_GOING = 'Une expédition est déjà en route : attends son retour.';
const CORE_MISSING = missing => `Les terres alentour s’ouvrent quand le cœur de l’île est à toi. Il te manque : ${missing}.`;
const NOT_NEIGHBOR = 'Une expédition part d’un quartier à toi, vers un quartier voisin.';
const EXPEDITION_COST = (food, wood) => `Il faut emporter ${food} vivres et ${wood} bûches : joue une Récolte.`;
const EXPEDITION_CHARGE = 'Il faut une partie de Récolte en réserve : la prochaine revient bientôt.';

// Lieux, gisements, trouvailles de la plage
const LANDMARK_UNKNOWN = 'Lieu inconnu.';
const DEPOSIT_UNKNOWN = 'Gisement inconnu.';
const KNOW_FIRST = (find, key) => `${find} : il faut d’abord connaître « ${key} » — à écrire au Grimoire.`;
const DEPOSIT_REGROWS = minutes => `Ce gisement repousse : reviens dans ${minutes} min.`;
const NOTHING_HERE = 'Il n’y a rien à ramasser ici.';
const SEA_BRINGS_MORE = minutes => `La mer en rapportera d’autres : reviens dans ${minutes} min.`;

module.exports = {
    LANDMARK_TEXTS, ZONE_DISCOVERED, EXPEDITION_GOING, CORE_MISSING, NOT_NEIGHBOR, EXPEDITION_COST, EXPEDITION_CHARGE,
    LANDMARK_UNKNOWN, DEPOSIT_UNKNOWN, KNOW_FIRST, DEPOSIT_REGROWS, NOTHING_HERE, SEA_BRINGS_MORE
};
