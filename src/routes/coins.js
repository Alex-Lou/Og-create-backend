// Gains et dépenses d'écus : montants fixés par le serveur, inscrits au grand livre (services/ledger.js)
const express = require('express');
const authMiddleware = require('../middleware/auth');
const ledger = require('../services/ledger');
const { failsWith } = require('../utils/failure');
const { BALANCE_UNAVAILABLE } = require('../texts/progress');

const router = express.Router();
router.use(authMiddleware);

router.get('/balance', failsWith(BALANCE_UNAVAILABLE), async (req, res) => {
  res.json({ coins: await ledger.balance(req.user.id) });
});

// Les points de l'Épreuve et le bonus de record sont versés par le serveur de jeu (services/trial.js)

// Les aides payantes (encre, joker) sont débitées par routes/play, qui calcule l'aide elle-même

module.exports = router;
