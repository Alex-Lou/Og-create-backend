// Mot de passe oublié (services/passwordReset.js) : la réponse ne dit jamais si l'adresse existe.
const express = require('express');
const passwordReset = require('../services/passwordReset');
const { limiter } = require('../middleware/rateLimit');
const { isToken } = require('../utils/crypto');
const { log } = require('../utils/logger');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
const GENERIC_REPLY = { message: 'Si un compte existe pour cette adresse, un lien vient de lui être envoyé.' };
const INVALID_LINK = { message: 'Lien invalide ou expiré' };

// Compteurs séparés par adresse IP : demandes de lien (5 / 15 min), changements (10 / 15 min)
const tooMany = max => limiter({ minutes: 15, max, message: 'Trop de demandes, réessaie dans quelques minutes.' });

router.post('/forgot-password', tooMany(5), async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!email || email.length > 255) return res.status(400).json({ message: 'Adresse e-mail requise' });
    try {
        await passwordReset.request(email);
    } catch (error) {
        // Même réponse qu'en cas de succès : un échec ne doit pas révéler que l'adresse existe
        log('error', 'Échec de la demande de réinitialisation', { errorMessage: error.message });
    }
    res.status(200).json(GENERIC_REPLY);
});

router.post('/reset-password', tooMany(10), async (req, res) => {
    const { token, password } = req.body;
    if (!isToken(token)) return res.status(400).json(INVALID_LINK);
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
        return res.status(400).json({ message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` });
    }
    try {
        if (!(await passwordReset.reset(token, password))) return res.status(400).json(INVALID_LINK);
        res.status(200).json({ message: 'Mot de passe changé. Tu peux te connecter.' });
    } catch (error) {
        log('error', 'Échec de la réinitialisation', { errorMessage: error.message });
        res.status(500).json({ message: 'Le mot de passe n’a pas pu être changé, réessaie plus tard.' });
    }
});

module.exports = router;
