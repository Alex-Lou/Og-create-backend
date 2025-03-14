// routes/timerService.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { log } = require('../utils/logger')

// Configuration du rate limiting
const timerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

// Route pour sauvegarder les éléments du mode Timer
router.post('/save-elements', authMiddleware, timerRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { elements = [] } = req.body;
    
    log('info', 'Sauvegarde des éléments du mode Timer', { 
      userId, 
      elementsCount: elements.length 
    });
    
    // Vérifier si la progression existe
    const existingProgress = await db.query(
      'SELECT timer_elements FROM progress WHERE user_id = $1',
      [userId]
    );
    
    // Assurer que les éléments fondamentaux sont inclus
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    let elementsToSave = Array.isArray(elements) ? [...elements] : [];
    
    // Fusionner avec les éléments existants
    if (existingProgress.rows.length > 0) {
      let existingElements;
      try {
        existingElements = typeof existingProgress.rows[0].timer_elements === 'string'
          ? JSON.parse(existingProgress.rows[0].timer_elements)
          : existingProgress.rows[0].timer_elements || [];
      } catch (e) {
        existingElements = [];
      }
      
      // Combiner et dédupliquer
      elementsToSave = [...new Set([...existingElements, ...elementsToSave])];
    }
    
    // S'assurer que la progression existe
    if (existingProgress.rows.length === 0) {
      await db.query(
        `INSERT INTO progress (
          user_id, 
          timer_elements,
          discovered_elements,
          discovered_categories,
          last_saved
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          userId, 
          JSON.stringify(elementsToSave),
          JSON.stringify(fundamentalElements),
          JSON.stringify(["Elements Fondamentaux"])
        ]
      );
    } else {
      await db.query(
        `UPDATE progress 
         SET timer_elements = $1, 
             last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [JSON.stringify(elementsToSave), userId]
      );
    }
    
    res.status(200).json({
      message: 'Éléments du mode Timer sauvegardés avec succès',
      timerElements: elementsToSave,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('error', 'Erreur lors de la sauvegarde des éléments du mode Timer', error);
    res.status(500).json({ 
      message: 'Erreur lors de la sauvegarde des éléments du mode Timer',
      error: error.message 
    });
  }
});

// Route pour mettre à jour la progression du timer uniquement
router.post('/update-timer-progress', authMiddleware, async (req, res) => {
  try {
      const userId = req.user.id;
      const { timerProgress } = req.body;
      
      log('debug', 'Mise à jour de la progression du timer', { userId });
      
      if (!timerProgress || typeof timerProgress !== 'object') {
          log('warn', 'Progression du timer invalide', { userId });
          return res.status(400).json({ message: 'La progression du timer est invalide' });
      }

      // Vérification plus détaillée de la structure
      const safeTimerProgress = {
          completedQuestions: timerProgress.completedQuestions || {},
          unlockedCategories: timerProgress.unlockedCategories || {},
          bestScores: {
              Facile: timerProgress.bestScores?.Facile || 0,
              Moyen: timerProgress.bestScores?.Moyen || 0,
              Difficile: timerProgress.bestScores?.Difficile || 0
          }
      };

      log('debug', 'Timer Progress à sauvegarder', safeTimerProgress);

      const result = await db.query(
          `UPDATE progress 
          SET 
              timer_progress = $1,
              last_saved = CURRENT_TIMESTAMP
          WHERE user_id = $2
          RETURNING timer_progress`,
          [JSON.stringify(safeTimerProgress), userId]
      );

      res.status(200).json({
          message: 'Progression du timer mise à jour avec succès',
          timerProgress: safeTimerProgress
      });
  } catch (error) {
      log('error', 'Erreur lors de la mise à jour de la progression du timer', error);
      res.status(500).json({ 
          message: 'Erreur lors de la mise à jour de la progression du timer',
          error: error.message 
      });
  }
});

// Route pour charger spécifiquement les éléments du mode Timer
router.get('/load-elements', authMiddleware, timerRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    
    log('debug', 'Chargement des éléments du mode Timer', { userId });
    
    const result = await db.query(
      'SELECT timer_elements FROM progress WHERE user_id = $1',
      [userId]
    );
    
    let timerElements = [];
    
    if (result.rows.length > 0) {
      try {
        timerElements = typeof result.rows[0].timer_elements === 'string'
          ? JSON.parse(result.rows[0].timer_elements)
          : result.rows[0].timer_elements || [];
      } catch (e) {
        log('error', 'Erreur lors du parsing des éléments du mode Timer', e);
        timerElements = [];
      }
    }
    
    res.status(200).json({
      timerElements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('error', 'Erreur lors du chargement des éléments du mode Timer', error);
    res.status(500).json({ 
      message: 'Erreur lors du chargement des éléments du mode Timer',
      error: error.message 
    });
  }
});

module.exports = router;