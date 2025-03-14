const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { log } = require('../utils/logger');

const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

router.post('/update', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { coins } = req.body;
    
    log('debug', 'Mise à jour des pièces', { userId, coins });
    
    const currentProgress = await db.query(
      'SELECT coins, last_saved FROM progress WHERE user_id = $1',
      [userId]
    );
    
    log('debug', 'Valeurs actuelles', { 
      currentCoins: currentProgress.rows[0]?.coins,
      lastSaved: currentProgress.rows[0]?.last_saved
    });
    
    if (currentProgress.rows.length === 0) {
      log('info', 'Création nouvelle entrée progress pour les pièces', { userId });
      await db.query(
        `INSERT INTO progress (user_id, coins, last_saved)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [userId, coins]
      );
    } else {
      log('debug', 'Mise à jour coins existants', { userId });
      await db.query(
        `UPDATE progress 
         SET coins = $1, last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING coins, last_saved`,
        [coins, userId]
      );
    }
  
    res.status(200).json({
      message: 'Pièces mises à jour avec succès',
      coins: coins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des pièces', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des pièces' });
  }
});

module.exports = router;
