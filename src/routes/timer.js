// Progression de l'Épreuve (services/timerProgress.js) : questions réussies, chapitres ouverts, records.
const express = require('express');
const timerProgress = require('../services/timerProgress');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimit');
const { failsWith } = require('../utils/failure');
const T = require('../texts/progress');

const router = express.Router();
router.use(authMiddleware, limiter({ minutes: 1, max: 120, key: req => req.user.id, message: T.TOO_MANY_REQUESTS }));

router.get('/load-progress', failsWith(T.LOAD_FAILED), async (req, res) => {
    res.json(await timerProgress.load(req.user.id));
});

router.post('/update-timer-progress', failsWith(T.TIMER_FAILED), async (req, res) => {
    const { timerProgress: next } = req.body;
    if (!next || typeof next !== 'object') return res.status(400).json({ message: T.TIMER_INVALID });
    res.json({ message: T.TIMER_UPDATED, timerProgress: await timerProgress.update(req.user.id, next) });
});

module.exports = router;
