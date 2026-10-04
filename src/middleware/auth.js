// Session obligatoire : le jeton d'accès vient du cookie httpOnly (services/authSession.js).
// Aucun en-tête Authorization n'est accepté : le JavaScript du site ne manipule jamais de jeton.
const { verifyAccess } = require('../services/authSession');
const { log } = require('../utils/logger');

function authMiddleware(req, res, next) {
    const user = verifyAccess(req);
    if (!user) {
        log('debug', 'Requête sans session valable');
        return res.status(401).json({ message: 'Session expirée ou absente', code: 'TOKEN_EXPIRED' });
    }
    req.user = user;
    next();
}

module.exports = authMiddleware;
