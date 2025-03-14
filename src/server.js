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
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const globalLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});

const gameLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: 'Trop de requêtes de jeu, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});

app.use(globalLimiter);

app.use(express.json({ 
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb' 
}));
app.use(express.urlencoded({ 
    extended: true,
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb' 
}));

const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const achievementsRouter = require('./routes/progressAchievements');
const coinsRouter = require('./routes/progressCoins');
const elementsRouter = require('./routes/progressElements');
const contactRoutes = require('./routes/contactRoutes');
const customizationRoutes = require('./routes/customization');
const explorerRoutes = require('./routes/explorer');
const gameDataController = require('./routes/gameDataController');
const timerService = require('./routes/timerService');

app.use('/api/auth', authRoutes);
app.use('/api/progress', gameLimiter, progressRoutes);
app.use('/api/progress/achievements', gameLimiter, achievementsRouter);
app.use('/api/progress/coins', gameLimiter, coinsRouter);
app.use('/api/progress/elements', gameLimiter, elementsRouter);
app.use('/api/contact', contactRoutes);
app.use('/api/customization', customizationRoutes);
app.use('/api/explorer', gameLimiter, explorerRoutes);
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
