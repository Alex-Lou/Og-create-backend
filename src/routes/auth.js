const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenManager');

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

// Génération de username unique
const generateUsername = (email) => {
    const baseUsername = email.split('@')[0];
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    return `${baseUsername}_${randomSuffix}`;
};

// Route d'inscription
router.post('/register', async (req, res) => {
    log('info', 'Nouvelle demande d\'inscription');
    
    try {
        const { email, password } = req.body;

        // Validation des données d'entrée
        if (!email || !password) {
            log('warn', 'Données d\'inscription incomplètes');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        if (!validateEmail(email)) {
            log('warn', 'Format d\'email invalide', { email });
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
            log('warn', 'Email ou username déjà utilisé', { email });
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

        // Génération des tokens
        log('debug', 'Génération des tokens');
        const userData = { 
            userId: result.rows[0].id, 
            email: result.rows[0].email,
            username: result.rows[0].username
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        // Stocker le refreshToken dans la base de données
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
            [result.rows[0].id, refreshToken]
        );

        log('info', 'Inscription réussie', { userId: result.rows[0].id, username });
        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token: accessToken,
            refreshToken,
            userId: result.rows[0].id,
            username: result.rows[0].username,
            expiresIn: 3600 // 1 heure en secondes
        });
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
router.post('/login', async (req, res) => {
    log('info', 'Tentative de connexion');

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            log('warn', 'Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        // Recherche de l'utilisateur
        log('debug', 'Recherche de l\'utilisateur', { email });
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            log('warn', 'Utilisateur non trouvé', { email });
            return res.status(401).json({ message: 'Authentification échouée' });
        }

        const user = result.rows[0];
        log('debug', 'Utilisateur trouvé', { userId: user.id, username: user.username });

        // Vérification du mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            log('warn', 'Mot de passe incorrect', { userId: user.id });
            return res.status(401).json({ message: 'Authentification échouée' });
        }

        // Génération des tokens
        log('debug', 'Génération des tokens');
        const userData = { 
            userId: user.id, 
            email: user.email,
            username: user.username
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        // Supprimer les anciens refresh tokens de cet utilisateur (optionnel)
        await db.query(
            'DELETE FROM refresh_tokens WHERE user_id = $1',
            [user.id]
        );
        
        // Stocker le nouveau refresh token
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
            [user.id, refreshToken]
        );

        log('info', 'Connexion réussie', { userId: user.id });
        res.status(200).json({
            token: accessToken,
            refreshToken,
            userId: user.id,
            username: user.username,
            expiresIn: 3600 // 1 heure en secondes
        });
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

// Route pour rafraîchir le token
router.post('/refresh-token', async (req, res) => {
    log('debug', 'Demande de rafraîchissement de token');

    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            log('warn', 'Refresh token manquant');
            return res.status(400).json({ message: 'Refresh token requis' });
        }

        // Vérifier le refresh token
        const decoded = verifyRefreshToken(refreshToken);
        
        if (!decoded) {
            log('warn', 'Refresh token invalide');
            return res.status(401).json({ message: 'Refresh token invalide ou expiré' });
        }
        
        log('debug', 'Refresh token décodé', { userId: decoded.userId });
        
        // Vérifier si le refresh token existe dans la base de données
        const tokenResult = await db.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
            [refreshToken, decoded.userId]
        );
        
        if (tokenResult.rows.length === 0) {
            log('warn', 'Refresh token non trouvé ou expiré en BDD', { userId: decoded.userId });
            return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
        }

        // Récupérer les données complètes de l'utilisateur
        const userResult = await db.query(
            'SELECT id, email, username FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            log('warn', 'Utilisateur non trouvé lors du rafraîchissement', { userId: decoded.userId });
            return res.status(401).json({ message: 'Utilisateur non trouvé, veuillez vous reconnecter' });
        }
        
        const user = userResult.rows[0];

        // Générer un nouveau token d'accès
        const userData = {
            userId: user.id,
            email: user.email,
            username: user.username
        };
        
        log('debug', 'Génération d\'un nouveau token d\'accès');
        const newAccessToken = generateAccessToken(userData);

        log('info', 'Rafraîchissement de token réussi', { userId: user.id });
        res.status(200).json({
            token: newAccessToken,
            userId: user.id,
            username: user.username,
            expiresIn: 3600 // 1 heure en secondes
        });
    } catch (error) {
        log('error', 'Erreur lors du rafraîchissement du token', { 
            errorType: error.name,
            errorMessage: error.message
        });

        res.status(401).json({ 
            message: 'Erreur lors du rafraîchissement du token',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Route de déconnexion
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken, userId } = req.body;
        
        log('info', 'Demande de déconnexion', { userId });
        
        if (refreshToken) {
            // Supprimer le refresh token spécifique
            await db.query(
                'DELETE FROM refresh_tokens WHERE token = $1',
                [refreshToken]
            );
            log('debug', 'Refresh token supprimé');
        } else if (userId) {
            // Supprimer tous les refresh tokens de l'utilisateur
            await db.query(
                'DELETE FROM refresh_tokens WHERE user_id = $1',
                [userId]
            );
            log('debug', 'Tous les refresh tokens de l\'utilisateur supprimés', { userId });
        }
        
        res.status(200).json({ message: 'Déconnexion réussie' });
    } catch (error) {
        log('error', 'Erreur lors de la déconnexion', { 
            errorType: error.name,
            errorMessage: error.message
        });
        
        res.status(500).json({
            message: 'Erreur lors de la déconnexion',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

module.exports = router;