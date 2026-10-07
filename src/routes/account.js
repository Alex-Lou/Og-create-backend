// Réglages du compte (services/accountSettings.js) : profil, mot de passe, nouvelle adresse, pause, suppression,
// export des données. Session obligatoire, sauf pour confirmer une nouvelle adresse (le lien du mail suffit).
const express = require('express');
const settings = require('../services/accountSettings');
const authSession = require('../services/authSession');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { isToken } = require('../utils/crypto');
const { failure } = require('../utils/failure');

const router = express.Router();
const isEmail = email => typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// Ce qui demande le mot de passe (ou coûte : mail, export) : 10 essais par quart d'heure et par compte ; le lien de
// confirmation, sans session : 10 par adresse IP
const TOO_MANY = 'Trop de tentatives, réessaie dans quelques minutes.';
const guarded = limiter({ minutes: 15, max: 10, key: req => `account:${req.user.id}`, message: TOO_MANY });
const linkLimiter = limiter({ minutes: 15, max: 10, message: TOO_MANY });
const refused = (res, done) => res.status(done.status).json({ message: done.message });

router.get('/', authMiddleware, async (req, res) => {
    try {
        const profile = await settings.profileOf(req.user.id);
        if (!profile) return res.status(404).json({ message: 'Compte introuvable.' });
        res.json(profile);
    } catch (error) {
        failure(res, 'Le compte n’a pas pu être lu', error);
    }
});

// Nouveau mot de passe : les autres appareils sont déconnectés, celui-ci reçoit une session neuve
router.post('/password', authMiddleware, guarded, async (req, res) => {
    try {
        const done = await settings.changePassword(req.user.id, req.body.current, req.body.password);
        if (done.status) return refused(res, done);
        await authSession.issue(res, done.user);
        res.json({ message: 'Mot de passe changé.' });
    } catch (error) {
        failure(res, 'Le mot de passe n’a pas pu être changé', error);
    }
});

router.post('/email', authMiddleware, guarded, async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!isEmail(email)) return res.status(400).json({ message: 'Adresse e-mail invalide.' });
    try {
        const done = await settings.requestEmailChange(req.user.id, req.body.password, email);
        if (done.status) return refused(res, done);
        res.json({ message: `Un lien vient de partir vers ${email} : ouvre-le pour confirmer.`, pendingEmail: email });
    } catch (error) {
        failure(res, 'L’adresse n’a pas pu être changée', error);
    }
});

router.post('/email/confirm', linkLimiter, async (req, res) => {
    if (!isToken(req.body.token)) return res.status(400).json({ message: 'Lien invalide ou expiré.' });
    try {
        const done = await settings.confirmEmailChange(req.body.token);
        if (done.status) return refused(res, done);
        res.json({ message: 'Ta nouvelle adresse est confirmée.', email: done.email });
    } catch (error) {
        failure(res, 'L’adresse n’a pas pu être confirmée', error);
    }
});

// Pause : déconnexion partout ; se reconnecter réactive le compte
router.post('/suspend', authMiddleware, async (req, res) => {
    try {
        const done = await settings.suspend(req.user.id);
        if (done.status) return refused(res, done);
        await authSession.revoke(req, res);
        res.json({ message: 'Ton compte est en pause. Reconnecte-toi quand tu veux : ton île t’attend.' });
    } catch (error) {
        failure(res, 'Le compte n’a pas pu être mis en pause', error);
    }
});

// Suppression dans sept jours ; se reconnecter avant l'annule
router.post('/delete', authMiddleware, guarded, async (req, res) => {
    try {
        const done = await settings.scheduleDeletion(req.user.id, req.body.password);
        if (done.status) return refused(res, done);
        await authSession.revoke(req, res);
        res.json({ message: `Ton compte sera supprimé dans ${settings.GRACE_DAYS} jours. Reconnecte-toi d’ici là pour l’annuler.`, deleteAt: done.deleteAt });
    } catch (error) {
        failure(res, 'La suppression n’a pas pu être prévue', error);
    }
});

// Mes données : un fichier JSON à télécharger
router.get('/export', authMiddleware, guarded, async (req, res) => {
    try {
        const data = await settings.exportOf(req.user.id);
        if (!data) return res.status(404).json({ message: 'Compte introuvable.' });
        res.setHeader('Content-Disposition', 'attachment; filename="brumelune-mes-donnees.json"');
        res.json(data);
    } catch (error) {
        failure(res, 'Les données n’ont pas pu être exportées', error);
    }
});

module.exports = router;
