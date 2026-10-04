// Erreur serveur inattendue : journalisée, et un message clair pour le joueur (détail technique en développement seulement)
const { log } = require('./logger');

function failure(res, message, error) {
    log('error', message, { errorMessage: error.message });
    res.status(500).json({ message, errorDetails: process.env.NODE_ENV === 'development' ? error.message : null });
}

module.exports = { failure };
