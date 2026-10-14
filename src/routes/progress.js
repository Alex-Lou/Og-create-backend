// Progression d'un compte (services/progress.js) : chargement, et sauvegarde de la progression de l'Épreuve.
const express = require('express');
const progress = require('../services/progress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failure } = require('../utils/failure');
const T = require('../texts/progress');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: T.TOO_MANY_REQUESTS }));

router.get('/load', async (req, res) => {
    try {
        res.json(await progress.load(req.user.id));
    } catch (error) {
        failure(res, T.LOAD_FAILED, error);
    }
});

router.post('/save', async (req, res) => {
    try {
        res.json(await progress.save(req.user.id, req.body || {}));
    } catch (error) {
        failure(res, T.SAVE_FAILED, error);
    }
});

module.exports = router;
