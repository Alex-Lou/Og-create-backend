// Progression d'un compte (services/progress.js) : chargement, et sauvegarde de la progression de l'Épreuve.
const express = require('express');
const progress = require('../services/progress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failsWith } = require('../utils/failure');
const T = require('../texts/progress');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: T.TOO_MANY_REQUESTS }));

router.get('/load', failsWith(T.LOAD_FAILED), async (req, res) => {
    res.json(await progress.load(req.user.id));
});

router.post('/save', failsWith(T.SAVE_FAILED), async (req, res) => {
    res.json(await progress.save(req.user.id, req.body || {}));
});

module.exports = router;
