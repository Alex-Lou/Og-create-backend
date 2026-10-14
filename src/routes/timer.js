// Progression de l'Épreuve (services/timerProgress.js) : questions réussies, chapitres ouverts, records.
const express = require('express');
const timerProgress = require('../services/timerProgress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failure } = require('../utils/failure');
const T = require('../texts/progress');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: T.TOO_MANY_REQUESTS }));

router.get('/load-progress', async (req, res) => {
    try {
        res.json(await timerProgress.load(req.user.id));
    } catch (error) {
        failure(res, T.LOAD_FAILED, error);
    }
});

router.post('/update-timer-progress', async (req, res) => {
    const { timerProgress: next } = req.body;
    if (!next || typeof next !== 'object') return res.status(400).json({ message: T.TIMER_INVALID });
    try {
        res.json({ message: T.TIMER_UPDATED, timerProgress: await timerProgress.update(req.user.id, next) });
    } catch (error) {
        failure(res, T.TIMER_FAILED, error);
    }
});

module.exports = router;
