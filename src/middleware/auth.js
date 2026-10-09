// Session obligatoire : le jeton d'accès vient du cookie httpOnly (services/authSession.js), et sa session doit être
// toujours ouverte (checkAccess). Aucun en-tête Authorization n'est accepté : le JavaScript du site ne manipule jamais
// de jeton.
const { checkAccess } = require('../services/authSession');
const { log } = require('../utils/logger');

async function authMiddleware(req, res, next) {
    let user;
    try {
        user = await checkAccess(req);
    } catch (error) {
        return next(error);
    }
    if (!user) {
        log('debug', 'Requête sans session valable');
        return res.status(401).json({ message: 'Session expirée ou absente', code: 'TOKEN_EXPIRED' });
    }
    req.user = user;
    next();
}

module.exports = authMiddleware;
