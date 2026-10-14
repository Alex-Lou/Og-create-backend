// Questions de l'Épreuve, en lecture publique (mode invité) : les recettes ne quittent jamais le serveur (routes/play)
const express = require('express');
const timerQuestions = require('../services/timerQuestions');
const { failure } = require('../utils/failure');
const { QUESTIONS_FAILED } = require('../texts/progress');

const router = express.Router();

// Le front normalise le nom en « timer_questions » : les deux écritures mènent aux questions
router.get(['/timer-questions', '/timer_questions'], async (req, res) => {
    try {
        res.json(await timerQuestions.all());
    } catch (error) {
        failure(res, QUESTIONS_FAILED, error);
    }
});

module.exports = router;
