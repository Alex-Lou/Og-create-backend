// Fabrique des limites de requêtes (express-rate-limit) : fenêtre en minutes, plafond, message, clé (IP par défaut)
const rateLimit = require('express-rate-limit');

function limiter({ minutes, max, message, key, handler }) {
    return rateLimit({
        windowMs: minutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        ...(message ? { message: { message } } : {}),
        ...(key ? { keyGenerator: key } : {}),
        ...(handler ? { handler } : {})
    });
}

module.exports = { limiter };
