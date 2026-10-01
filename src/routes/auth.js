const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const rateLimit = require('express-rate-limit');
const authSession = require('../services/authSession');
const authMiddleware = require('../middleware/auth');

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

// Validation des entrées
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    // Nouveau critère : au moins 8 caractères (plus souple)
    const passwordRegex = /^.{8,}$/;
    return passwordRegex.test(password);
};

// Empreinte bcrypt sans compte associé (même coût), comparée quand l'adresse est inconnue
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(16).toString('hex'), 12);

// Génération de username unique
const generateUsername = (email) => {
    const baseUsername = email.split('@')[0];
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    return `${baseUsername}_${randomSuffix}`;
};

// Limites par adresse IP : essais de connexion (échecs compris) et créations de compte
const limiter = (windowMinutes, max) => rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Trop de tentatives, réessaie dans quelques minutes.' }
});
const loginLimiter = limiter(15, 10);
// Second verrou, par compte visé : indépendant de l'adresse IP (proxies, réseaux partagés)
const accountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: req => `login:${String(req.body?.email || '').trim().toLowerCase()}`,
    message: { message: 'Trop de tentatives sur ce compte, réessaie dans quelques minutes.' }
});
const registerLimiter = limiter(60, 10);
const refreshLimiter = limiter(15, 60);

// Route d'inscription
router.post('/register', registerLimiter, async (req, res) => {
    log('info', 'Nouvelle demande d\'inscription');
    
    try {
        const { email, password } = req.body;

        // Validation des données d'entrée
        if (!email || !password) {
            log('warn', 'Données d\'inscription incomplètes');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        if (!validateEmail(email)) {
            log('warn', 'Format d\'email invalide');
            return res.status(400).json({ message: 'Format d\'email invalide' });
        }

        if (!validatePassword(password)) {
            log('warn', 'Mot de passe ne respectant pas les critères de sécurité');
            return res.status(400).json({ 
                message: 'Mot de passe invalide. Doit contenir au moins 8 caractères' 
            });
        }

        // Génération du username
        const username = generateUsername(email);
        log('debug', 'Username généré', { username });

        // Vérifier si l'utilisateur existe déjà
        log('debug', 'Vérification de l\'existence de l\'utilisateur');
        const userExists = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (userExists.rows.length > 0) {
            log('warn', 'Email ou username déjà utilisé');
            return res.status(400).json({ message: 'Email ou username déjà utilisé' });
        }

        // Hasher le mot de passe
        log('debug', 'Hashage du mot de passe');
        const hashedPassword = await bcrypt.hash(password, 12);

        // Créer l'utilisateur
        log('debug', 'Création de l\'utilisateur en base de données');
        const result = await db.query(
            'INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, username',
            [email, hashedPassword, username]
        );

        // Session en cookies httpOnly : aucun jeton dans la réponse
        const session = await authSession.issue(res, { id: result.rows[0].id, username: result.rows[0].username });
        log('info', 'Inscription réussie', { userId: session.userId });
        res.status(201).json({ message: 'Utilisateur créé avec succès', ...session });
    } catch (error) {
        log('error', 'Erreur lors de l\'inscription', { 
            errorType: error.name,
            errorMessage: error.message,
            pgErrorCode: error.code
        });
        
        res.status(500).json({ 
            message: 'Erreur lors de l\'inscription',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Route de connexion
router.post('/login', loginLimiter, accountLimiter, async (req, res) => {
    log('info', 'Tentative de connexion');

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            log('warn', 'Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        // Recherche de l'utilisateur
        log('debug', 'Recherche de l\'utilisateur');
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        // Même travail (bcrypt) que l'adresse existe ou non : la durée ne trahit pas les comptes
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(String(password), user ? user.password_hash : DUMMY_HASH);

        if (!user || !validPassword) {
            log('warn', 'Connexion refusée');
            return res.status(401).json({ message: 'Authentification échouée' });
        }

        const session = await authSession.issue(res, user);
        log('info', 'Connexion réussie', { userId: user.id });
        res.status(200).json(session);
    } catch (error) {
        log('error', 'Erreur lors de la connexion', { 
            errorType: error.name,
            errorMessage: error.message
        });
        
        res.status(500).json({ 
            message: 'Erreur lors de la connexion',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Renouvellement de session : le jeton de rafraîchissement (cookie) est changé à chaque usage
router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
        const result = await authSession.rotate(req, res);
        if (result.error) return res.status(result.status).json({ message: result.error, code: result.code });
        res.status(200).json(result.user);
    } catch (error) {
        log('error', 'Erreur lors du renouvellement de session', { errorMessage: error.message });
        res.status(500).json({ message: 'Erreur lors du renouvellement de session' });
    }
});

// Qui suis-je : l'interface vérifie ainsi qu'une session est valable
router.get('/me', authMiddleware, (req, res) => {
    res.status(200).json({ userId: req.user.id, username: req.user.username });
});

// Déconnexion : la session du cookie présenté est révoquée, les cookies effacés
router.post('/logout', async (req, res) => {
    try {
        await authSession.revoke(req, res);
        res.status(200).json({ message: 'Déconnexion réussie' });
    } catch (error) {
        log('error', 'Erreur lors de la déconnexion', { errorMessage: error.message });
        res.status(500).json({ message: 'Erreur lors de la déconnexion' });
    }
});

module.exports = router;