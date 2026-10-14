// Ce que le serveur dit du compte et de la session : l'inscription, la connexion et la déconnexion (routes/auth.js),
// les réglages du compte (routes/account.js, services/accountSettings.js), le mot de passe oublié
// (routes/passwordReset.js), les règles du mot de passe et la signature d'un compte provisoire (services/accounts.js),
// le renouvellement de session (services/authSession.js, que routes/auth.js renvoie au jeu).
// Les courriels envoyés au joueur sont dans texts/emails.js.

// Limites de requêtes
const TOO_MANY_TRIES = 'Trop de tentatives, réessaie dans quelques minutes.';
const TOO_MANY_TRIES_ACCOUNT = 'Trop de tentatives sur ce compte, réessaie dans quelques minutes.';
const TOO_MANY_RESETS = 'Trop de demandes, réessaie dans quelques minutes.';

// Inscription, connexion, session (routes/auth.js)
const EMAIL_PASSWORD_REQUIRED = 'Email et mot de passe requis';
const EMAIL_FORMAT = 'Format d\'email invalide';
const EMAIL_TAKEN = 'Email ou username déjà utilisé';
const REGISTERED = 'Utilisateur créé avec succès';
const REGISTER_FAILED = 'Erreur lors de l\'inscription';
const ALREADY_ACCOUNT = 'Tu as déjà un compte.';
const CREATE_FAILED = 'Erreur lors de la création du compte';
const CREATED = 'Compte créé avec succès';
const LOGIN_REFUSED = 'Authentification échouée';
const LOGIN_FAILED = 'Erreur lors de la connexion';
const REFRESH_FAILED = 'Erreur lors du renouvellement de session';
const CHECK_FAILED = 'Erreur lors de la vérification de session';
const LOGGED_OUT = 'Déconnexion réussie';
const LOGOUT_FAILED = 'Erreur lors de la déconnexion';

// Renouvellement de session (services/authSession.js)
const SESSION = {
    absent: 'Session absente',
    expired: 'Session expirée',
    renewed: 'Session déjà renouvelée',
    revoked: 'Session révoquée'
};

// Mot de passe (services/accounts.js) et compte provisoire
const PASSWORD_TOO_SHORT = 'Le mot de passe doit contenir au moins 8 caractères.';
const PASSWORD_TOO_LONG = 'Mot de passe trop long : 72 caractères au plus (moins avec des accents ou des emojis).';
const ACCOUNT_NOT_FOUND = 'Compte introuvable.';
const ALREADY_CLAIMED = 'Ce compte a déjà son adresse.';

// Réglages du compte (routes/account.js, services/accountSettings.js)
const PROFILE_FAILED = 'Le compte n’a pas pu être lu';
const PASSWORD_CHANGED = 'Mot de passe changé.';
const PASSWORD_FAILED = 'Le mot de passe n’a pas pu être changé';
const EMAIL_INVALID = 'Adresse e-mail invalide.';
const EMAIL_LINK_SENT = email => `Un lien vient de partir vers ${email} : ouvre-le pour confirmer.`;
const EMAIL_FAILED = 'L’adresse n’a pas pu être changée';
const LINK_INVALID = 'Lien invalide ou expiré.';
const EMAIL_CONFIRMED = 'Ta nouvelle adresse est confirmée.';
const CONFIRM_FAILED = 'L’adresse n’a pas pu être confirmée';
const SUSPENDED = 'Ton compte est en pause. Reconnecte-toi quand tu veux : ton île t’attend.';
const SUSPEND_FAILED = 'Le compte n’a pas pu être mis en pause';
const DELETION_PLANNED = days => `Ton compte sera supprimé dans ${days} jours. Reconnecte-toi d’ici là pour l’annuler.`;
const DELETION_FAILED = 'La suppression n’a pas pu être prévue';
const EXPORT_FAILED = 'Les données n’ont pas pu être exportées';
const SIGN_FIRST = 'Signe d’abord la page de garde du Grimoire : ton compte aura alors une adresse et un mot de passe.';
const WRONG_PASSWORD = 'Mot de passe incorrect.';
const SAME_EMAIL = 'C’est déjà ton adresse.';
const EMAIL_IN_USE = 'Cette adresse est déjà prise.';
const MAIL_FAILED = 'Le mail n’a pas pu partir. Réessaie un peu plus tard.';
const EMAIL_TAKEN_MEANWHILE = 'Cette adresse a été prise entre-temps.';

// Mot de passe oublié (routes/passwordReset.js)
const RESET_GENERIC = 'Si un compte existe pour cette adresse, un lien vient de lui être envoyé.';
const RESET_LINK_INVALID = 'Lien invalide ou expiré';
const EMAIL_REQUIRED = 'Adresse e-mail requise';
const RESET_DONE = 'Mot de passe changé. Tu peux te connecter.';
const RESET_FAILED = 'Le mot de passe n’a pas pu être changé, réessaie plus tard.';

module.exports = {
    TOO_MANY_TRIES, TOO_MANY_TRIES_ACCOUNT, TOO_MANY_RESETS, EMAIL_PASSWORD_REQUIRED, EMAIL_FORMAT, EMAIL_TAKEN, REGISTERED,
    REGISTER_FAILED, ALREADY_ACCOUNT, CREATE_FAILED, CREATED, LOGIN_REFUSED, LOGIN_FAILED, REFRESH_FAILED, CHECK_FAILED,
    LOGGED_OUT, LOGOUT_FAILED, SESSION, PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG, ACCOUNT_NOT_FOUND, ALREADY_CLAIMED,
    PROFILE_FAILED, PASSWORD_CHANGED, PASSWORD_FAILED, EMAIL_INVALID, EMAIL_LINK_SENT, EMAIL_FAILED, LINK_INVALID,
    EMAIL_CONFIRMED, CONFIRM_FAILED, SUSPENDED, SUSPEND_FAILED, DELETION_PLANNED, DELETION_FAILED, EXPORT_FAILED,
    SIGN_FIRST, WRONG_PASSWORD, SAME_EMAIL, EMAIL_IN_USE, MAIL_FAILED, EMAIL_TAKEN_MEANWHILE, RESET_GENERIC,
    RESET_LINK_INVALID, EMAIL_REQUIRED, RESET_DONE, RESET_FAILED
};
