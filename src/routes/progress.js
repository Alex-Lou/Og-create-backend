// Progression d'un compte (services/progress.js) : chargement, et sauvegarde de la progression de l'Épreuve.
const express = require('express');
const progress = require('../services/progress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failure } = require('../utils/failure');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: 'Trop de requêtes, veuillez réessayer plus tard' }));

router.get('/load', async (req, res) => {
    try {
        res.json(await progress.load(req.user.id));
    } catch (error) {
        failure(res, 'Erreur lors du chargement de la progression', error);
    }
});

router.post('/save', async (req, res) => {
    try {
        res.json(await progress.save(req.user.id, req.body || {}));
    } catch (error) {
        failure(res, 'Erreur lors de la sauvegarde de la progression', error);
    }
});

module.exports = router;
