// Les messages d'erreur communs à tout le serveur : les limites de requêtes et les réponses générales (app.js), la
// session absente (middleware/auth.js), les rapports d'erreur du jeu (routes/clientErrors.js) ; ce que disent plusieurs
// services à la fois quand il manque des écus ou des ressources (routes/play/shared.js, services/bookLetters.js,
// services/world.js, services/crafts.js, services/world/annexPlots.js, services/world/shelters.js) ; et les requêtes
// mal formées des routes de jeu (INVALID : routes/play/index.js, trial.js, book.js, world.js).

const TOO_MANY_REQUESTS = 'Trop de requêtes';
const TOO_MANY_WAIT = minutes => `Trop de requêtes, réessaie dans ${minutes} min.`;
const REQUEST_REFUSED = 'Requête refusée';
const ROUTE_NOT_FOUND = 'Route non trouvée';
const SERVER_ERROR = 'Une erreur serveur est survenue';

const SESSION_MISSING = 'Session expirée ou absente';

const CLIENT_ERRORS_TOO_MANY = 'Trop de rapports d’erreur.';
const CLIENT_ERROR_INVALID = 'Rapport d’erreur invalide';

const NEED_COINS = coins => `Il te faut ${coins} écus.`;
const MISSING_RESOURCES = 'Il te manque des ressources : joue une Récolte.';

const INVALID = {
    mode: 'Mode invalide',
    mix: 'Mélange invalide',
    question: 'Question invalide',
    page: 'Page invalide',
    letter: 'Lettre invalide',
    cell: 'Case invalide',
    craft: 'Création invalide',
    layout: 'Assemblage invalide',
    pose: 'Pose invalide',
    trace: 'Tracé invalide',
    shelter: 'Abri invalide',
    item: 'Article invalide',
    skin: 'Skin invalide',
    name: 'Nom invalide',
    sign: 'Enseigne invalide',
    annex: 'Annexe invalide',
    place: 'Place invalide',
    zone: 'Quartier invalide',
    stray: 'Égaré invalide',
    site: 'Bâtiment invalide',
    landmark: 'Lieu invalide',
    scene: 'Scène invalide',
    deposit: 'Gisement invalide',
    find: 'Trouvaille invalide',
    worksite: 'Chantier invalide',
    level: 'Niveau invalide',
    run: 'Partie invalide',
    game: 'Mini-jeu invalide',
    villager: 'Habitant invalide',
    gift: 'Cadeau invalide',
    need: 'Besoin invalide',
    beast: 'Bête invalide',
    visitor: 'Visiteur invalide',
    chest: 'Coffre invalide',
    quest: 'Quête invalide'
};

module.exports = {
    TOO_MANY_REQUESTS, TOO_MANY_WAIT, REQUEST_REFUSED, ROUTE_NOT_FOUND, SERVER_ERROR, SESSION_MISSING, CLIENT_ERRORS_TOO_MANY,
    CLIENT_ERROR_INVALID, NEED_COINS, MISSING_RESOURCES, INVALID
};
