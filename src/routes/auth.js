const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenManager');

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
    console.log('===== DÉBUT DE L\'INSCRIPTION =====');
    console.log('Données reçues:', JSON.stringify(req.body, null, 2));
    console.log('En-têtes de la requête:', JSON.stringify(req.headers, null, 2));

    try {
        const { email, password } = req.body;

        // Validation des données d'entrée
        if (!email || !password) {
            console.log('ERREUR : Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        if (!validateEmail(email)) {
            console.log('ERREUR : Format d\'email invalide');
            return res.status(400).json({ message: 'Format d\'email invalide' });
        }

        if (!validatePassword(password)) {
            console.log('ERREUR : Mot de passe ne respectant pas les critères de sécurité');
            return res.status(400).json({ 
                message: 'Mot de passe invalide. Doit contenir au moins 8 caractères' 
            });
        }

        // Génération du username
        const username = generateUsername(email);
        console.log(`Username généré : ${username}`);

        // Vérifier si l'utilisateur existe déjà
        console.log('Vérification de l\'existence de l\'utilisateur');
        const userExists = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (userExists.rows.length > 0) {
            console.log('ERREUR : Email ou username déjà utilisé');
            return res.status(400).json({ message: 'Email ou username déjà utilisé' });
        }

        // Hasher le mot de passe
        console.log('Hashage du mot de passe');
        const hashedPassword = await bcrypt.hash(password, 12);

        // Créer l'utilisateur
        console.log('Création de l\'utilisateur en base de données');
        const result = await db.query(
            'INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, username',
            [email, hashedPassword, username]
        );

        // Génération des tokens
        console.log('Génération des tokens');
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

        console.log('===== INSCRIPTION RÉUSSIE =====');
        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token: accessToken,
            refreshToken,
            userId: result.rows[0].id,
            username: result.rows[0].username,
            expiresIn: 3600 // 1 heure en secondes
        });
    } catch (error) {
        console.error('===== ERREUR COMPLÈTE D\'INSCRIPTION =====');
        console.error('Type d\'erreur:', error.name);
        console.error('Message d\'erreur:', error.message);
        console.error('Code d\'erreur PostgreSQL:', error.code);
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({ 
            message: 'Erreur lors de l\'inscription',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Route de connexion
router.post('/login', async (req, res) => {
    console.log('===== DÉBUT DE LA CONNEXION =====');
    console.log('Données reçues:', JSON.stringify(req.body, null, 2));
    console.log('En-têtes de la requête:', JSON.stringify(req.headers, null, 2));

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('ERREUR : Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        // Recherche de l'utilisateur
        console.log(`Recherche de l'utilisateur avec l'email : ${email}`);
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            console.log('ERREUR : Utilisateur non trouvé');
            return res.status(401).json({ message: 'Authentification échouée' });
        }

        const user = result.rows[0];
        console.log('Utilisateur trouvé:', JSON.stringify(user, null, 2));

        // Vérification du mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            console.log('ERREUR : Mot de passe incorrect');
            return res.status(401).json({ message: 'Authentification échouée' });
        }

        // Génération des tokens
        console.log('Génération des tokens');
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

        console.log('===== CONNEXION RÉUSSIE =====');
        res.status(200).json({
            token: accessToken,
            refreshToken,
            userId: user.id,
            username: user.username,
            expiresIn: 3600 // 1 heure en secondes
        });
    } catch (error) {
        console.error('===== ERREUR COMPLÈTE DE CONNEXION =====');
        console.error('Erreur détaillée:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la connexion',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Route pour rafraîchir le token
router.post('/refresh-token', async (req, res) => {
    console.log('===== DÉBUT DU RAFRAÎCHISSEMENT DE TOKEN =====');
    console.log('Données reçues:', JSON.stringify(req.body, null, 2));

    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            console.log('ERREUR : Refresh token manquant');
            return res.status(400).json({ message: 'Refresh token requis' });
        }

        // Vérifier le refresh token
        const decoded = verifyRefreshToken(refreshToken);
        
        if (!decoded) {
            console.log('ERREUR : Refresh token invalide');
            return res.status(401).json({ message: 'Refresh token invalide ou expiré' });
        }
        
        console.log('Refresh token décodé:', decoded);
        
        // Vérifier si le refresh token existe dans la base de données
        const tokenResult = await db.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
            [refreshToken, decoded.userId]
        );
        
        if (tokenResult.rows.length === 0) {
            console.log('ERREUR : Refresh token non trouvé ou expiré en BDD');
            return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
        }

        // Récupérer les données complètes de l'utilisateur
        const userResult = await db.query(
            'SELECT id, email, username FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            console.log('ERREUR : Utilisateur non trouvé lors du rafraîchissement');
            return res.status(401).json({ message: 'Utilisateur non trouvé, veuillez vous reconnecter' });
        }
        
        const user = userResult.rows[0];

        // Générer un nouveau token d'accès
        const userData = {
            userId: user.id,
            email: user.email,
            username: user.username
        };
        
        console.log('Génération d\'un nouveau token d\'accès');
        const newAccessToken = generateAccessToken(userData);

        console.log('===== RAFRAÎCHISSEMENT DE TOKEN RÉUSSI =====');
        res.status(200).json({
            token: newAccessToken,
            userId: user.id,
            username: user.username,
            expiresIn: 3600 // 1 heure en secondes
        });
    } catch (error) {
        console.error('===== ERREUR COMPLÈTE DE RAFRAÎCHISSEMENT DE TOKEN =====');
        console.error('Type d\'erreur:', error.name);
        console.error('Message d\'erreur:', error.message);
        console.error('Stack trace:', error.stack);

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
        
        if (refreshToken) {
            // Supprimer le refresh token spécifique
            await db.query(
                'DELETE FROM refresh_tokens WHERE token = $1',
                [refreshToken]
            );
        } else if (userId) {
            // Supprimer tous les refresh tokens de l'utilisateur
            await db.query(
                'DELETE FROM refresh_tokens WHERE user_id = $1',
                [userId]
            );
        }
        
        res.status(200).json({ message: 'Déconnexion réussie' });
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        res.status(500).json({
            message: 'Erreur lors de la déconnexion',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

module.exports = router;