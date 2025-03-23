const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

process.env.LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

const { ensureJWTSecret } = require('./utils/jwt');
const { initRegions } = require('./initRegions');

ensureJWTSecret();

const app = express();

const morganFormat = process.env.NODE_ENV === 'production' 
    ? '[:date[clf]] :method :url :status :response-time ms' 
    : 'dev';

app.use(morgan(morganFormat, {
    skip: (req, res) => {
        return process.env.NODE_ENV === 'production' && res.statusCode < 400;
    }
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"]
        }
    }
}));

const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const createRateLimiter = (windowMinutes, maxRequests, message) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        message: message,
        standardHeaders: true,
        legacyHeaders: false,
        skipFailedRequests: true,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Trop de requêtes',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60)
            });
        }
    });
};

const globalLimiter = createRateLimiter(
    process.env.RATE_LIMIT_WINDOW_MINUTES || 15, 
    process.env.RATE_LIMIT_MAX_REQUESTS || 1000, 
    'Trop de requêtes, veuillez réessayer plus tard'
);

const gameLimiter = createRateLimiter(
    1, 
    process.env.GAME_RATE_LIMIT_MAX_REQUESTS || 200, 
    'Trop de requêtes de jeu, veuillez réessayer plus tard'
);

app.use(globalLimiter);

app.use(express.json({ 
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb',
    strict: true
}));
app.use(express.urlencoded({ 
    extended: true,
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb' 
}));

const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const achievementsRouter = require('./routes/progressAchievements');
const coinsRouter = require('./routes/progressCoins');
const contactRoutes = require('./routes/contactRoutes');
const customizationRoutes = require('./routes/customization');
const explorerRoutes = require('./routes/explorer');
const gameDataController = require('./routes/gameDataController');
const timerService = require('./routes/timerServiceBack');

const KNOWN_MISSING_FILES = {
    animaux: { elements: {}, rules: {} },
    biologie: { elements: {}, rules: {} },
    'créations_humaines': { elements: {}, rules: {} },
    elements_data: { 
        elements: {},
        categories: {},
        rules: {} 
    },
    elements: { 
        elements: {},
        categories: {},
        rules: {} 
    },
    geologie: { elements: {}, rules: {} },
    magie: { elements: {}, rules: {} },
    achievements: []
};

const generateMissingFileResponse = (filename) => {
    return (req, res, next) => {
        if (KNOWN_MISSING_FILES.hasOwnProperty(filename)) {
            return res.status(200).json(KNOWN_MISSING_FILES[filename]);
        }
        next();
    };
};

app.use('/api/auth', authRoutes);
app.use('/api/progress', gameLimiter, progressRoutes);
app.use('/api/progress/achievements', gameLimiter, achievementsRouter);
app.use('/api/progress/coins', gameLimiter, coinsRouter);
app.use('/api/contact', contactRoutes);
app.use('/api/customization', customizationRoutes);
app.use('/api/explorer', gameLimiter, explorerRoutes);

Object.keys(KNOWN_MISSING_FILES).forEach(filename => {
    app.use(`/api/game-data/${filename}`, generateMissingFileResponse(filename));
});

app.use('/api/game-data', gameLimiter, gameDataController);
app.use('/api/timer', timerService);

app.use('/data', (req, res, next) => {
    if (req.path.endsWith('.json')) {
        return res.status(403).send('Accès direct aux fichiers JSON interdit');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    if (process.env.LOG_LEVEL === 'debug') {
        console.log('Health check requested');
    }
    res.status(200).json({
        status: 'OK',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

app.use((req, res, next) => {
    if (req.path !== '/favicon.ico') {
        console.log(`Route non trouvée: ${req.method} ${req.path}`);
    }
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err.message);
    
    if (process.env.LOG_LEVEL === 'debug') {
        console.error('Détails:', err.stack);
    }
    
    const errorResponse = {
        message: 'Une erreur serveur est survenue',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    };
    
    res.status(err.status || 500).json(errorResponse);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`
    🚀 Serveur démarré
    • Port: ${PORT}
    • Environnement: ${process.env.NODE_ENV}
    • Niveau de log: ${process.env.LOG_LEVEL}
    • Heure: ${new Date().toLocaleString()}
    `);
    
    try {
        const result = await initRegions();
        if (result.success) {
            console.log('✅ Régions initialisées avec succès');
        } else {
            console.warn('⚠️ Erreur lors de l\'initialisation des régions, le serveur continue de fonctionner');
        }
    } catch (error) {
        console.error('❌ Erreur critique lors de l\'initialisation des régions:', error.message);
    }
    
    console.log('Tout roule! :)');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});

module.exports = app;