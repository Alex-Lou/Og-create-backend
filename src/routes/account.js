// Réglages du compte (services/accountSettings.js) : profil, mot de passe, nouvelle adresse, pause, suppression,
// export des données. Session obligatoire, sauf pour confirmer une nouvelle adresse (le lien du mail suffit).
const express = require('express');
const settings = require('../services/accountSettings');
const authSession = require('../services/authSession');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { isToken } = require('../utils/crypto');
const { failure } = require('../utils/failure');
const T = require('../texts/account');

const router = express.Router();
const isEmail = email => typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// Ce qui demande le mot de passe (ou coûte : mail, export) : 10 essais par quart d'heure et par compte ; le lien de
// confirmation, sans session : 10 par adresse IP
const TOO_MANY = T.TOO_MANY_TRIES;
const guarded = limiter({ minutes: 15, max: 10, key: req => `account:${req.user.id}`, message: TOO_MANY });
const linkLimiter = limiter({ minutes: 15, max: 10, message: TOO_MANY });
const refused = (res, done) => res.status(done.status).json({ message: done.message });

router.get('/', authMiddleware, async (req, res) => {
    try {
        const profile = await settings.profileOf(req.user.id);
        if (!profile) return res.status(404).json({ message: T.ACCOUNT_NOT_FOUND });
        res.json(profile);
    } catch (error) {
        failure(res, T.PROFILE_FAILED, error);
    }
});

// Nouveau mot de passe : les autres appareils sont déconnectés, celui-ci reçoit une session neuve
router.post('/password', authMiddleware, guarded, async (req, res) => {
    try {
        const done = await settings.changePassword(req.user.id, req.body.current, req.body.password);
        if (done.status) return refused(res, done);
        await authSession.issue(res, done.user);
        res.json({ message: T.PASSWORD_CHANGED });
    } catch (error) {
        failure(res, T.PASSWORD_FAILED, error);
    }
});

router.post('/email', authMiddleware, guarded, async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!isEmail(email)) return res.status(400).json({ message: T.EMAIL_INVALID });
    try {
        const done = await settings.requestEmailChange(req.user.id, req.body.password, email);
        if (done.status) return refused(res, done);
        res.json({ message: T.EMAIL_LINK_SENT(email), pendingEmail: email });
    } catch (error) {
        failure(res, T.EMAIL_FAILED, error);
    }
});

router.post('/email/confirm', linkLimiter, async (req, res) => {
    if (!isToken(req.body.token)) return res.status(400).json({ message: T.LINK_INVALID });
    try {
        const done = await settings.confirmEmailChange(req.body.token);
        if (done.status) return refused(res, done);
        res.json({ message: T.EMAIL_CONFIRMED, email: done.email });
    } catch (error) {
        failure(res, T.CONFIRM_FAILED, error);
    }
});

// Pause : déconnexion partout ; se reconnecter réactive le compte
router.post('/suspend', authMiddleware, async (req, res) => {
    try {
        const done = await settings.suspend(req.user.id);
        if (done.status) return refused(res, done);
        await authSession.revoke(req, res);
        res.json({ message: T.SUSPENDED });
    } catch (error) {
        failure(res, T.SUSPEND_FAILED, error);
    }
});

// Suppression dans sept jours ; se reconnecter avant l'annule
router.post('/delete', authMiddleware, guarded, async (req, res) => {
    try {
        const done = await settings.scheduleDeletion(req.user.id, req.body.password);
        if (done.status) return refused(res, done);
        await authSession.revoke(req, res);
        res.json({ message: T.DELETION_PLANNED(settings.GRACE_DAYS), deleteAt: done.deleteAt });
    } catch (error) {
        failure(res, T.DELETION_FAILED, error);
    }
});

// Mes données : un fichier JSON à télécharger
router.get('/export', authMiddleware, guarded, async (req, res) => {
    try {
        const data = await settings.exportOf(req.user.id);
        if (!data) return res.status(404).json({ message: T.ACCOUNT_NOT_FOUND });
        res.setHeader('Content-Disposition', 'attachment; filename="brumelune-mes-donnees.json"');
        res.json(data);
    } catch (error) {
        failure(res, T.EXPORT_FAILED, error);
    }
});

module.exports = router;
