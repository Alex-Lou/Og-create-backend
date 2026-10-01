const { verifyAccess } = require('../services/authSession');

// Configuration des niveaux de log
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Niveau de log par défaut, peut être remplacé par une variable d'environnement
const logLevel = process.env.LOG_LEVEL || 'warn';

/**
 * Fonction de logging avec niveau
 * @param {string} level - Niveau de log (debug, info, warn, error)
 * @param {string} message - Message à logger
 * @param {any} data - Données additionnelles (optionnel)
 */
function log(level, message, data) {
    // Ne logger que si le niveau est supérieur ou égal au niveau configuré
    if (LOG_LEVELS[level] >= LOG_LEVELS[logLevel]) {
        if (data !== undefined) {
            console[level](`[${level.toUpperCase()}] ${message}`, 
                typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
        } else {
            console[level](`[${level.toUpperCase()}] ${message}`);
        }
    }
}

/**
 * Middleware d'authentification : le jeton d'accès vient du cookie httpOnly (services/authSession.js).
 * Aucun en-tête Authorization n'est accepté : le JavaScript du site ne manipule jamais de jeton.
 */
const authMiddleware = (req, res, next) => {
    const user = verifyAccess(req);
    if (!user) {
        log('debug', 'Requête sans session valable');
        return res.status(401).json({ message: 'Session expirée ou absente', code: 'TOKEN_EXPIRED' });
    }
    req.user = user;
    next();
};

module.exports = authMiddleware;
