// Gains et dépenses d'écus : montants fixés par le serveur, inscrits au grand livre (services/ledger.js)
const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const ledger = require('../services/ledger');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

const LEVELS = ['Facile', 'Moyen', 'Difficile'];
// Bonus de record de l'Épreuve : 5 écus par réussite, versé quand le record du niveau monte
const RECORD_BONUS = 5;

const isId = value => Number.isInteger(value) && value > 0;

router.get('/balance', async (req, res) => {
  try {
    res.json({ coins: await ledger.balance(req.user.id) });
  } catch (error) {
    log('error', 'Lecture du solde', { errorMessage: error.message });
    res.status(500).json({ message: 'Solde indisponible' });
  }
});

// Question de l'Épreuve réussie : ses points, une seule fois par question
router.post('/claim/timer-question', async (req, res) => {
  const questionId = Number(req.body.questionId);
  if (!isId(questionId)) return res.status(400).json({ message: 'Question invalide' });
  try {
    const { rows } = await db.query('SELECT points FROM timer_questions WHERE id = $1', [questionId]);
    if (!rows.length) return res.status(404).json({ message: 'Question inconnue' });
    res.json(await ledger.credit(req.user.id, rows[0].points, 'timer-question', questionId));
  } catch (error) {
    log('error', 'Gain de question', { errorMessage: error.message });
    res.status(500).json({ message: 'Gain non enregistré' });
  }
});

// Fin d'Épreuve : bonus si le record du niveau monte (score borné par le nombre de questions du niveau)
router.post('/claim/timer-record', async (req, res) => {
  const { level } = req.body;
  const score = Number(req.body.score);
  if (!LEVELS.includes(level) || !isId(score)) return res.status(400).json({ message: 'Record invalide' });
  try {
    const { rows: [{ count }] } = await db.query('SELECT COUNT(*)::int AS count FROM timer_questions WHERE level = $1', [level]);
    if (score > count) return res.status(400).json({ message: 'Record invalide' });
    const { rows: [{ best }] } = await db.query(
      `SELECT COALESCE(MAX(split_part(ref, ':', 2)::int), 0) AS best
       FROM coin_ledger WHERE user_id = $1 AND reason = 'timer-record' AND split_part(ref, ':', 1) = $2`,
      [req.user.id, level]
    );
    if (score <= best) return res.json({ credited: false, coins: await ledger.balance(req.user.id) });
    res.json(await ledger.credit(req.user.id, score * RECORD_BONUS, 'timer-record', `${level}:${score}`));
  } catch (error) {
    log('error', 'Bonus de record', { errorMessage: error.message });
    res.status(500).json({ message: 'Bonus non enregistré' });
  }
});

// Les aides payantes (joker, piste) sont débitées par routes/play.js, qui calcule l'aide elle-même

module.exports = router;
