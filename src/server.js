const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Configuration du niveau de log
process.env.LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

// Importer la vérification de la clé JWT
const { ensureJWTSecret } = require('./utils/jwt');
// Importer la fonction d'initialisation des régions
const { initRegions } = require('./initRegions');

// Vérifier et générer la clé JWT si nécessaire
ensureJWTSecret();

const app = express();

// Format de log Morgan personnalisé pour être moins verbeux
const morganFormat = process.env.NODE_ENV === 'production' 
    ? '[:date[clf]] :method :url :status :response-time ms' 
    : 'dev';

// Middleware de logging avec Morgan 
app.use(morgan(morganFormat, {
    skip: (req, res) => {
        // En production, ne pas logger les requêtes 2xx et 3xx
        return process.env.NODE_ENV === 'production' && res.statusCode < 400;
    }
}));

// Middleware de sécurité
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

// Configuration CORS
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Configuration des limiteurs de requêtes par route
// Limiteur global plus souple
const globalLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes par défaut
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000, // 1000 requêtes par fenêtre
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false,
    // Ignorer les requêtes OPTIONS pour éviter les problèmes avec CORS
    skip: (req) => req.method === 'OPTIONS'
});

// Limiteur spécifique pour les routes de progression et explorer
// Ces routes sont appelées plus fréquemment dans l'application
const gameLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requêtes par minute
    message: 'Trop de requêtes de jeu, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});

// Appliquer le limiteur global à toutes les routes
app.use(globalLimiter);

// Middlewares de parsing
app.use(express.json({ 
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb' 
}));
app.use(express.urlencoded({ 
    extended: true,
    limit: process.env.REQUEST_BODY_SIZE_LIMIT || '10kb' 
}));

// Routes
const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const contactRoutes = require('./routes/contactRoutes');
const customizationRoutes = require('./routes/customization');
const explorerRoutes = require('./routes/explorer');
const gameDataController = require('./routes/gameDataController');

const timerService = require('./routes/timerService');

app.use('/api/auth', authRoutes);
app.use('/api/progress', gameLimiter, progressRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/customization', customizationRoutes);
app.use('/api/explorer', gameLimiter, explorerRoutes);
app.use('/api/game-data', gameLimiter, gameDataController);


app.use('/api/timer', timerService);



// Bloquer l'accès direct aux fichiers JSON du dossier data
app.use('/data', (req, res, next) => {
    if (req.path.endsWith('.json')) {
        return res.status(403).send('Accès direct aux fichiers JSON interdit');
    }
    next();
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route de santé pour vérifier l'état du serveur
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

// Gestion des erreurs 404
app.use((req, res, next) => {
    if (req.path !== '/favicon.ico') {  // Ignorer les requêtes pour favicon
        console.log(`Route non trouvée: ${req.method} ${req.path}`);
    }
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.path
    });
});

// Gestion des erreurs globales
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
    
    // Initialiser les régions au démarrage du serveur
    try {
        const result = await initRegions();
        if (result.success) {
            console.log('✅ Régions initialisées avec succès');
        } else {
            console.warn('⚠️ Erreur lors de l\'initialisation des régions, le serveur continue de fonctionner');
        }
    } catch (error) {
        console.error('❌ Erreur critique lors de l\'initialisation des régions:', error.message);
        // Ne pas arrêter le serveur, mais loguer l'erreur
    }
    
    console.log('Tout roule! :)');
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});

module.exports = app;