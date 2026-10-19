// Réglages du compte (services/accountSettings.js) : profil, mot de passe, nouvelle adresse, pause, suppression,
// export des données. Session obligatoire, sauf pour confirmer une nouvelle adresse (le lien du mail suffit).
const express = require('express');
const settings = require('../services/accountSettings');
const authSession = require('../services/authSession');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { isToken } = require('../utils/crypto');
const { failsWith } = require('../utils/failure');
const T = require('../texts/account');

const router = express.Router();
const isEmail = email => typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// Ce qui demande le mot de passe (ou coûte : mail, export) : 10 essais par quart d'heure et par compte ; le lien de
// confirmation, sans session : 10 par adresse IP
const TOO_MANY = T.TOO_MANY_TRIES;
const guarded = limiter({ minutes: 15, max: 10, key: req => `account:${req.user.id}`, message: TOO_MANY });
const linkLimiter = limiter({ minutes: 15, max: 10, message: TOO_MANY });
const refused = (res, done) => res.status(done.status).json({ message: done.message });

router.get('/', authMiddleware, failsWith(T.PROFILE_FAILED), async (req, res) => {
    const profile = await settings.profileOf(req.user.id);
    if (!profile) return res.status(404).json({ message: T.ACCOUNT_NOT_FOUND });
    res.json(profile);
});

// Le mode debug de ce compte (services/accountSettings.js : debugOf) → { debug }
router.get('/debug', authMiddleware, failsWith(T.PROFILE_FAILED), async (req, res) => {
    res.json({ debug: await settings.debugOf(req.user.id) });
});

// Nouveau mot de passe : les autres appareils sont déconnectés, celui-ci reçoit une session neuve
router.post('/password', authMiddleware, guarded, failsWith(T.PASSWORD_FAILED), async (req, res) => {
    const done = await settings.changePassword(req.user.id, req.body.current, req.body.password);
    if (done.status) return refused(res, done);
    await authSession.issue(res, done.user);
    res.json({ message: T.PASSWORD_CHANGED });
});

router.post('/email', authMiddleware, guarded, failsWith(T.EMAIL_FAILED), async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!isEmail(email)) return res.status(400).json({ message: T.EMAIL_INVALID });
    const done = await settings.requestEmailChange(req.user.id, req.body.password, email);
    if (done.status) return refused(res, done);
    res.json({ message: T.EMAIL_LINK_SENT(email), pendingEmail: email });
});

router.post('/email/confirm', linkLimiter, failsWith(T.CONFIRM_FAILED), async (req, res) => {
    if (!isToken(req.body.token)) return res.status(400).json({ message: T.LINK_INVALID });
    const done = await settings.confirmEmailChange(req.body.token);
    if (done.status) return refused(res, done);
    res.json({ message: T.EMAIL_CONFIRMED, email: done.email });
});

// Pause : déconnexion partout ; se reconnecter réactive le compte
router.post('/suspend', authMiddleware, failsWith(T.SUSPEND_FAILED), async (req, res) => {
    const done = await settings.suspend(req.user.id);
    if (done.status) return refused(res, done);
    await authSession.revoke(req, res);
    res.json({ message: T.SUSPENDED });
});

// Suppression dans sept jours ; se reconnecter avant l'annule
router.post('/delete', authMiddleware, guarded, failsWith(T.DELETION_FAILED), async (req, res) => {
    const done = await settings.scheduleDeletion(req.user.id, req.body.password);
    if (done.status) return refused(res, done);
    await authSession.revoke(req, res);
    res.json({ message: T.DELETION_PLANNED(settings.GRACE_DAYS), deleteAt: done.deleteAt });
});

// Mes données : un fichier JSON à télécharger
router.get('/export', authMiddleware, guarded, failsWith(T.EXPORT_FAILED), async (req, res) => {
    const data = await settings.exportOf(req.user.id);
    if (!data) return res.status(404).json({ message: T.ACCOUNT_NOT_FOUND });
    res.setHeader('Content-Disposition', 'attachment; filename="brumelune-mes-donnees.json"');
    res.json(data);
});

module.exports = router;
