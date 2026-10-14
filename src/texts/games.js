// Les jeux de l'île : ce que dit la fiche de chaque mini-jeu (GAME_TEXTS : services/minigames.js), l'objectif d'un
// niveau (GOAL_TEXTS : services/levels.js), pourquoi une partie est refusée (REFUSAL : les mini-jeux,
// services/minigames.js ; HARVEST_REFUSAL : la Récolte, services/harvest.js et services/world.js), et ce que répond
// l'île quand on lance ou rend une partie (services/world.js).

const GAME_TEXTS = {
    peche: 'Touche le couloir d’eau quand un poisson passe sous l’hameçon.',
    filon: 'Creuse la paroi bloc par bloc : les éclats disent où dort le filon.',
    cueillette: 'Cueille les baies mûres avant qu’elles tombent, sans réveiller les guêpes.'
};

const GOAL_TEXTS = {
    recolte: need => `Récolte ${need} ressources`,
    filon: need => `Trouve ${need} pierres précieuses`,
    cueillette: need => `Remplis ton panier : ${need} cueillettes`
};

// (en minuscules : ils suivent « Partie refusée : »)
const REFUSAL = {
    tooManyCasts: 'trop de lancers',
    badCast: 'lancer invalide',
    tooManyStrokes: 'trop de coups',
    badStroke: 'coup invalide',
    tooManyPicks: 'trop de gestes',
    badPick: 'geste invalide',
    unknownGame: 'jeu inconnu',
    badRun: 'partie invalide'
};

// (mis en minuscules après « Partie refusée : »)
const HARVEST_REFUSAL = {
    tooManyMoves: 'Trop de coups',
    impossible: 'Coup impossible',
    expired: 'Partie expirée'
};

const LEVEL_LOCKED = 'Ce niveau n’est pas encore ouvert : gagne une étoile au précédent.';
const NO_CHARGE = 'Plus de partie en réserve : la prochaine revient bientôt.';
const RUN_RETURNED = 'Cette partie est déjà rendue.';
const RUN_REFUSED = reason => `Partie refusée : ${reason}.`;
const RUN_EXPIRED = 'Partie refusée : partie expirée.';
const RUN_TOO_FAST = 'Partie refusée : partie trop rapide.';
const GAME_UNKNOWN = 'Mini-jeu inconnu.';
const GAME_LEVEL = name => `${name} : au palier III du bâtiment.`;

module.exports = {
    GAME_TEXTS, GOAL_TEXTS, REFUSAL, HARVEST_REFUSAL, LEVEL_LOCKED, NO_CHARGE, RUN_RETURNED, RUN_REFUSED, RUN_EXPIRED,
    RUN_TOO_FAST, GAME_UNKNOWN, GAME_LEVEL
};
