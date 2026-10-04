// L'Épreuve (services/trial.js) : début de question, jokers, fin du sablier.
const express = require('express');
const book = require('../../services/recipeBook');
const players = require('../../services/players');
const trial = require('../../services/trial');
const { playLimiter, withPlayer, pay } = require('./shared');

const router = express.Router();
const JOKER_TIME = 30; // secondes ajoutées par le joker de temps

// Début d'une question : les éléments en main
router.post('/run', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (req.body.mode !== 'timer') return res.status(400).json({ message: 'Mode invalide' });
    const questionId = Number(req.body.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) return res.status(400).json({ message: 'Question invalide' });
    const q = await trial.question(questionId);
    if (!q) return res.status(404).json({ message: 'Question inconnue' });
    const started = await trial.start(owner, q, req.body.launch === true);
    res.json({ elements: started.inventory, known: book.describe(b, started.inventory), freeJokers: started.freeJokers, required: started.required });
}));

// Joker : une étape, un ingrédient, ou du temps ; offert s'il en reste, sinon payé
router.post('/joker', playLimiter, withPlayer(async (req, res, owner, b) => {
    const { kind } = req.body;
    if (!['step', 'ingredient', 'time'].includes(kind)) return res.status(400).json({ message: 'Joker inconnu' });
    const run = await players.getRun(owner, 'timer');
    if (!run) return res.status(409).json({ message: 'Aucune épreuve en cours', code: 'NO_RUN' });

    let step = null;
    if (kind !== 'time') {
        const q = await trial.question(Number(run.context));
        step = book.nextStep(b, run.inventory, q?.valid_answers || []);
        if (!step) return res.status(409).json({ message: 'Aucune étape à révéler.' });
    }

    const reply = {};
    const free = await players.takeFreeJoker(owner);
    if (free === null) {
        const paid = await pay(owner, 'joker');
        if (paid.status) return res.status(paid.status).json({ message: paid.message });
        reply.coins = paid.coins;
        reply.freeJokers = 0;
    } else {
        reply.freeJokers = free;
    }
    if (kind === 'time') await trial.addTime(owner, JOKER_TIME);
    if (kind === 'step') reply.ingredients = step.ingredients;
    if (kind === 'ingredient') reply.ingredient = step.ingredients.find(p => !book.BASE_ELEMENTS.includes(p)) || step.ingredients[0];
    res.json(reply);
}));

// Fin du sablier : score compté par le serveur, bonus de record versé s'il monte
router.post('/timer/finish', playLimiter, withPlayer(async (req, res, owner) => {
    res.json(await trial.finish(owner));
}));

module.exports = router;
