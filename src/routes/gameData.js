// Questions de l'Épreuve, en lecture publique (mode invité) : les recettes ne quittent jamais le serveur (routes/play)
const express = require('express');
const timerQuestions = require('../services/timerQuestions');
const { failsWith } = require('../utils/failure');
const { QUESTIONS_FAILED } = require('../texts/progress');

const router = express.Router();

// Le front normalise le nom en « timer_questions » : les deux écritures mènent aux questions
router.get(['/timer-questions', '/timer_questions'], failsWith(QUESTIONS_FAILED), async (req, res) => {
    res.json(await timerQuestions.all());
});

module.exports = router;
