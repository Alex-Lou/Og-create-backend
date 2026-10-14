// Ce que répondent les routes de jeu communes à tous les modes : limites et panne (routes/play/shared.js), partie et
// compte requis, aides payantes (shared.js), mélanges (routes/play/index.js), l'Épreuve et ses jokers
// (routes/play/trial.js). Les requêtes mal formées : INVALID, dans texts/errors.js.

const SLOW_DOWN = 'Doucement ! Réessaie dans un instant.';
const SERVER_DOWN = 'Le serveur de jeu ne répond pas, réessaie.';
const NO_PLAYER = 'Aucune partie';
const ACCOUNT_ONLY = 'Ton île t’attend : crée un compte pour la bâtir.';
const PAID_HELP_ACCOUNT = 'Les aides payantes demandent un compte.';

const NO_RUN = 'Aucune partie en cours';
const NOT_IN_HAND = 'Ingrédient absent de ton carnet';

const QUESTION_UNKNOWN = 'Question inconnue';
const JOKER_UNKNOWN = 'Joker inconnu';
const NO_TRIAL = 'Aucune épreuve en cours';
const NO_STEP = 'Aucune étape à révéler.';

module.exports = {
    SLOW_DOWN, SERVER_DOWN, NO_PLAYER, ACCOUNT_ONLY, PAID_HELP_ACCOUNT, NO_RUN, NOT_IN_HAND, QUESTION_UNKNOWN, JOKER_UNKNOWN,
    NO_TRIAL, NO_STEP
};
