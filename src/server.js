const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan'); // Ajout de morgan pour les logs
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Importer la vérification de la clé JWT
const { ensureJWTSecret } = require('./utils/jwt');

// Vérifier et générer la clé JWT si nécessaire
ensureJWTSecret();

const app = express();

// Middleware de logging
app.use(morgan('dev')); // Ajout des logs de requêtes

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

// Limite de requêtes pour prévenir les attaques par force brute
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes par défaut
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // 100 requêtes par défaut
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

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

app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);

// Route de santé pour vérifier l'état du serveur
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).json({
        status: 'OK',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Gestion des erreurs 404
app.use((req, res, next) => {
    console.log(`Route non trouvée: ${req.method} ${req.path}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.path
    });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error('Erreur serveur détaillée:', err);

    const errorResponse = {
        message: 'Une erreur serveur est survenue',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    };

    res.status(err.status || 500).json(errorResponse);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`
    🚀 Serveur démarré
    • Port: ${PORT}
    • Environnement: ${process.env.NODE_ENV}
    • Heure: ${new Date().toLocaleString()}
    `);
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