// Les erreurs du jeu (navigateur) vont au journal de l'API (journalctl -u brumelune-api) : sans elles, une erreur en
// production ne laissait aucune trace (le build retire la console). Ouvert aux invités ; peu d'envois par adresse.
const express = require('express');
const { clean } = require('../services/clientErrors');
const { limiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');

const router = express.Router();
const reportLimiter = limiter({ minutes: 1, max: 10, message: 'Trop de rapports d’erreur.' });

router.post('/', reportLimiter, (req, res) => {
    const report = clean(req.body);
    if (!report) return res.status(400).json({ message: 'Rapport d’erreur invalide' });
    log('warn', 'Erreur du jeu', report);
    res.status(204).end();
});

module.exports = router;
