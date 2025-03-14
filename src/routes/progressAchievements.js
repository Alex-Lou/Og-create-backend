const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { log } = require('../utils/logger');

router.post('/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { achievements } = req.body;
    
    log('debug', 'Mise à jour des achievements', { userId });
    
    if (!achievements || Object.keys(achievements).length === 0) {
      return res.status(400).json({ 
        message: 'Aucun achievement à mettre à jour' 
      });
    }

    const currentProgress = await db.query(
      'SELECT achievements FROM progress WHERE user_id = $1',
      [userId]
    );
    
    let currentAchievements = {};
    if (currentProgress.rows.length > 0) {
      try {
        currentAchievements = currentProgress.rows[0].achievements 
          ? (typeof currentProgress.rows[0].achievements === 'string'
              ? JSON.parse(currentProgress.rows[0].achievements)
              : currentProgress.rows[0].achievements)
          : {};
      } catch (error) {
        log('error', 'Erreur lors du parsing des achievements existants', error);
      }
    }

    const updatedAchievements = { 
      ...currentAchievements, 
      ...achievements 
    };

    const updateQuery = `
      UPDATE progress 
      SET 
        achievements = $1, 
        last_saved = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `;

    await db.query(updateQuery, [
      JSON.stringify(updatedAchievements),
      userId
    ]);

    res.status(200).json({
      message: 'Achievements mis à jour avec succès',
      achievements: updatedAchievements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des achievements', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour des achievements',
      error: error.message 
    });
  }
});

module.exports = router;
