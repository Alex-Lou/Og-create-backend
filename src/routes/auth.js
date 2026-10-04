// Comptes et sessions : inscription, connexion, renouvellement, déconnexion.
// La session voyage dans des cookies httpOnly (services/authSession.js) : aucun jeton dans les réponses.
const express = require('express');
const accounts = require('../services/accounts');
const authSession = require('../services/authSession');
const players = require('../services/players');
const achievementService = require('../services/achievementService');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');
const { failure } = require('../utils/failure');

const router = express.Router();

const isEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isPassword = password => /^.{8,}$/.test(password);

// Limites par adresse IP : essais de connexion (échecs compris) et créations de compte
const TOO_MANY = 'Trop de tentatives, réessaie dans quelques minutes.';
const loginLimiter = limiter({ minutes: 15, max: 10, message: TOO_MANY });
// Second verrou, par compte visé : indépendant de l'adresse IP (proxies, réseaux partagés)
const accountLimiter = limiter({
    minutes: 15,
    max: 10,
    key: req => `login:${String(req.body?.email || '').trim().toLowerCase()}`,
    message: 'Trop de tentatives sur ce compte, réessaie dans quelques minutes.'
});
// Inscriptions par adresse et par heure (relevable pour les tests automatiques, qui créent beaucoup de comptes)
const registerLimiter = limiter({ minutes: 60, max: Number(process.env.REGISTER_RATE_LIMIT) || 10, message: TOO_MANY });
const refreshLimiter = limiter({ minutes: 15, max: 60, message: TOO_MANY });

// Les découvertes faites en invité rejoignent le compte ; un échec n'empêche pas la connexion
async function adoptGuest(req, res, userId) {
    try {
        await players.adoptGuest(req, res, userId);
        await achievementService.syncAchievements(userId);
    } catch (error) {
        log('error', 'Reprise du carnet invité', { errorMessage: error.message });
    }
}

router.post('/register', registerLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Format d\'email invalide' });
    if (!isPassword(password)) return res.status(400).json({ message: 'Mot de passe invalide. Doit contenir au moins 8 caractères' });
    try {
        const user = await accounts.register(email, password);
        if (!user) return res.status(400).json({ message: 'Email ou username déjà utilisé' });
        const session = await authSession.issue(res, user);
        await adoptGuest(req, res, session.userId);
        log('info', 'Inscription réussie', { userId: session.userId });
        res.status(201).json({ message: 'Utilisateur créé avec succès', ...session });
    } catch (error) {
        failure(res, 'Erreur lors de l\'inscription', error);
    }
});

router.post('/login', loginLimiter, accountLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
    try {
        const user = await accounts.login(email, password);
        if (!user) return res.status(401).json({ message: 'Authentification échouée' });
        const session = await authSession.issue(res, user);
        await adoptGuest(req, res, user.id);
        log('info', 'Connexion réussie', { userId: user.id });
        res.status(200).json(session);
    } catch (error) {
        failure(res, 'Erreur lors de la connexion', error);
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
