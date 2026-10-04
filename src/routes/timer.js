// Progression de l'Épreuve (services/timerProgress.js) : questions réussies, chapitres ouverts, records.
const express = require('express');
const timerProgress = require('../services/timerProgress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failure } = require('../utils/failure');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: 'Trop de requêtes, veuillez réessayer plus tard' }));

router.get('/load-progress', async (req, res) => {
    try {
        res.json(await timerProgress.load(req.user.id));
    } catch (error) {
        failure(res, 'Erreur lors du chargement de la progression', error);
    }
});

router.post('/update-timer-progress', async (req, res) => {
    const { timerProgress: next } = req.body;
    if (!next || typeof next !== 'object') return res.status(400).json({ message: 'La progression du timer est invalide' });
    try {
        res.json({ message: 'Progression du timer mise à jour avec succès', timerProgress: await timerProgress.update(req.user.id, next) });
    } catch (error) {
        failure(res, 'Erreur lors de la mise à jour de la progression du timer', error);
    }
});

module.exports = router;
