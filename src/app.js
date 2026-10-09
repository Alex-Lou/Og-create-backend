// L'application Express : sécurité, limites, anti-CSRF, routes de l'API et réponses d'erreur.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { limiter } = require('./middleware/rateLimit');

const app = express();
// Render place le serveur derrière un proxy (et le site relaie /api : un saut de plus) : l'adresse du joueur,
// pour les limites de requêtes, se lit dans X-Forwarded-For en ne faisant confiance qu'à ces sauts
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

const production = process.env.NODE_ENV === 'production';
app.use(morgan(production ? '[:date[clf]] :method :url :status :response-time ms' : 'dev', {
    skip: (req, res) => production && res.statusCode < 400
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:']
        }
    }
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Map-Key'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Limites globales (par adresse) ; les routes de jeu ont en plus leurs limites par joueur
// retryAfter : les minutes à attendre (resetTime est la date de fin de la fenêtre) ; message : ce que le jeu affiche
// (utils/errors.js lit message)
const tooMany = (req, res) => {
    const reset = req.rateLimit && req.rateLimit.resetTime ? new Date(req.rateLimit.resetTime).getTime() : Date.now();
    const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60000));
    res.status(429).json({ error: 'Trop de requêtes', message: `Trop de requêtes, réessaie dans ${minutes} min.`, retryAfter: minutes });
};
const globalLimiter = limiter({ minutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15, max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, handler: tooMany });
const gameLimiter = limiter({ minutes: 1, max: Number(process.env.GAME_RATE_LIMIT_MAX_REQUESTS) || 200, handler: tooMany });
app.use(globalLimiter);

// Anti-CSRF : toute requête d'écriture porte l'en-tête de l'application (en plus des cookies SameSite=Strict)
app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('X-Requested-With') === 'origins') return next();
    res.status(403).json({ message: 'Requête refusée' });
});

const bodyLimit = process.env.REQUEST_BODY_SIZE_LIMIT || '10kb';
// (les réponses JSON partent compressées : middleware/compress.js)
app.use('/api', require('./middleware/compress').compressJson);
app.use(express.json({ limit: bodyLimit, strict: true }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/passwordReset'));
app.use('/api/account', require('./routes/account'));
app.use('/api/progress', gameLimiter, require('./routes/progress'));
app.use('/api/achievements', gameLimiter, require('./routes/achievements'));
app.use('/api/coins', gameLimiter, require('./routes/coins'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/customization', require('./routes/customization'));
app.use('/api/play', require('./routes/play'));
app.use('/api/game-data', gameLimiter, require('./routes/gameData'));
app.use('/api/timer', require('./routes/timer'));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', environment: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

app.use((req, res) => {
    if (req.path !== '/favicon.ico') console.log(`Route non trouvée: ${req.method} ${req.path}`);
    res.status(404).json({ message: 'Route non trouvée', path: req.path });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err.message);
    if (process.env.LOG_LEVEL === 'debug') console.error('Détails:', err.stack);
    res.status(err.status || 500).json({
        message: 'Une erreur serveur est survenue',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

module.exports = app;
