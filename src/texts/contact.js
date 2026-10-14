// Ce que répond le formulaire « Écrire aux créateurs » (routes/contact.js). Le courriel qu'il envoie va à l'adresse du
// jeu, pas au joueur : il reste dans la route.

const TOO_MANY_MESSAGES = 'Trop de messages, réessaie plus tard.';
const EMAIL_INVALID = 'Adresse e-mail invalide';
const MESSAGE_LENGTH = max => `Le message doit faire entre 1 et ${max} caractères`;
const SENT = 'Message envoyé avec succès';
const SEND_FAILED = 'Erreur lors de l\'envoi du message';

module.exports = { TOO_MANY_MESSAGES, EMAIL_INVALID, MESSAGE_LENGTH, SENT, SEND_FAILED };
