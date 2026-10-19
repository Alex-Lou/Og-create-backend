// Les erreurs du serveur :
// - HttpError : une erreur attendue (une adresse déjà prise…), dite au joueur avec son statut ;
// - failsWith : le message qu'une route donne au joueur si elle tombe en panne ;
// - lastResort : le dernier middleware d'app.js, où remonte toute erreur des routes (Express 5 y passe aussi celles
//   des routes async).
const { log } = require('./logger');
const { SERVER_ERROR } = require('../texts/errors');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const failsWith = message => (req, res, next) => {
    res.locals.failure = message;
    next();
};

// Une erreur attendue : son statut et son message, sans bruit. Une panne : journalisée avec sa pile ; le joueur lit le
// message de la route, jamais de détail interne. (une réponse déjà commencée ne peut plus changer : Express la coupe)
function lastResort(err, req, res, next) {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    const status = err.status || 500;
    log(status >= 500 ? 'error' : 'debug', `${req.method} ${req.path}`, err.stack);
    res.status(status).json({ message: res.locals.failure || SERVER_ERROR });
}

module.exports = { HttpError, failsWith, lastResort };
