// Ce que le serveur répond sur la progression d'un compte : chargement et sauvegarde (routes/progress.js,
// services/progress.js), progression de l'Épreuve (routes/timer.js), questions de l'Épreuve (routes/gameData.js),
// succès (routes/achievements.js, services/achievementService.js), solde d'écus (routes/coins.js).

const TOO_MANY_REQUESTS = 'Trop de requêtes, veuillez réessayer plus tard';
const LOAD_FAILED = 'Erreur lors du chargement de la progression';
const SAVE_FAILED = 'Erreur lors de la sauvegarde de la progression';
const SAVED = 'Progression sauvegardée avec succès';

const TIMER_INVALID = 'La progression du timer est invalide';
const TIMER_UPDATED = 'Progression du timer mise à jour avec succès';
const TIMER_FAILED = 'Erreur lors de la mise à jour de la progression du timer';
const QUESTIONS_FAILED = 'Erreur lors du chargement des questions du timer';

const NO_ACHIEVEMENT = 'Aucun achievement trouvé';
const ACHIEVEMENTS_FAILED = 'Erreur lors de la récupération des achievements';
const NOTHING_TO_UPDATE = 'Aucun achievement à mettre à jour';
const ACHIEVEMENTS_UPDATE_FAILED = 'Erreur lors de la mise à jour des achievements';
const ACHIEVEMENTS_CHECKED = 'Succès vérifiés';

const BALANCE_UNAVAILABLE = 'Solde indisponible';

module.exports = {
    TOO_MANY_REQUESTS, LOAD_FAILED, SAVE_FAILED, SAVED, TIMER_INVALID, TIMER_UPDATED, TIMER_FAILED, QUESTIONS_FAILED,
    NO_ACHIEVEMENT, ACHIEVEMENTS_FAILED, NOTHING_TO_UPDATE, ACHIEVEMENTS_UPDATE_FAILED, ACHIEVEMENTS_CHECKED,
    BALANCE_UNAVAILABLE
};
