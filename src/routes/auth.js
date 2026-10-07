// Comptes et sessions : inscription, connexion, renouvellement, déconnexion.
// La session voyage dans des cookies httpOnly (services/authSession.js) : aucun jeton dans les réponses.
const express = require('express');
const accounts = require('../services/accounts');
const authSession = require('../services/authSession');
const players = require('../services/players');
const accountSettings = require('../services/accountSettings');
const achievementService = require('../services/achievementService');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');
const { failure } = require('../utils/failure');

const router = express.Router();

const isEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    const problem = accounts.passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
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

// Compte provisoire (bible v6, § 9 ; V20) : créé en coulisse quand l'île sert au tutoriel, avant le compte. Ni adresse
// ni mot de passe connus : seule la session de l'appareil l'ouvre. Le carnet invité le rejoint.
router.post('/provisional', registerLimiter, async (req, res) => {
    if (authSession.verifyAccess(req)) return res.status(409).json({ message: 'Tu as déjà un compte.' });
    try {
        await accounts.sweepProvisional();
        const user = await accounts.registerProvisional();
        const session = await authSession.issue(res, user);
        await adoptGuest(req, res, session.userId);
        log('info', 'Compte provisoire créé', { userId: session.userId });
        res.status(201).json({ ...session, provisional: true });
    } catch (error) {
        failure(res, 'Erreur lors de la création du compte', error);
    }
});

// Signer la page de garde (étape 6) : le compte provisoire prend l'adresse et le mot de passe du joueur, une fois
router.post('/claim', registerLimiter, authMiddleware, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
    if (!isEmail(email) || email.length > 255 || accounts.isProvisional(email)) return res.status(400).json({ message: 'Format d\'email invalide' });
    const problem = accounts.passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
    try {
        const done = await accounts.claim(req.user.id, email, password);
        if (done.status) return res.status(done.status).json({ message: done.message });
        // Le nom du compte change avec l'adresse : une session neuve le porte
        const session = await authSession.issue(res, done.user);
        log('info', 'Compte provisoire signé', { userId: session.userId });
        res.status(200).json({ message: 'Compte créé avec succès', ...session, provisional: false });
    } catch (error) {
        // Deux signatures en même temps avec la même adresse : la seconde bute sur l'unicité
        if (error.code === '23505') return res.status(400).json({ message: 'Email ou username déjà utilisé' });
        failure(res, 'Erreur lors de la création du compte', error);
    }
});

router.post('/login', loginLimiter, accountLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
    try {
        const user = await accounts.login(email, password);
        if (!user) return res.status(401).json({ message: 'Authentification échouée' });
        // Un compte en pause est réactivé, une suppression prévue est annulée (back : ce qu'il faut en dire)
        const back = await accountSettings.welcomeBack(user.id);
        const session = await authSession.issue(res, user);
        await adoptGuest(req, res, user.id);
        log('info', 'Connexion réussie', { userId: user.id });
        res.status(200).json({ ...session, ...(back ? { back } : {}) });
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
router.get('/me', authMiddleware, async (req, res) => {
    try {
        res.status(200).json({ userId: req.user.id, username: req.user.username, provisional: await accounts.provisionalOf(req.user.id) });
    } catch (error) {
        failure(res, 'Erreur lors de la vérification de session', error);
    }
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
