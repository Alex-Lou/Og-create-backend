// Questions de l'Épreuve, en lecture publique (mode invité) : les recettes ne quittent jamais le serveur (routes/play)
const express = require('express');
const timerQuestions = require('../services/timerQuestions');
const { failure } = require('../utils/failure');

const router = express.Router();

// Le front normalise le nom en « timer_questions » : les deux écritures mènent aux questions
router.get(['/timer-questions', '/timer_questions'], async (req, res) => {
    try {
        res.json(await timerQuestions.all());
    } catch (error) {
        failure(res, 'Erreur lors du chargement des questions du timer', error);
    }
});

module.exports = router;
