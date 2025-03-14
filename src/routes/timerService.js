const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { log } = require('../utils/logger');

const timerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

router.post('/save-elements', authMiddleware, timerRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { elements = [] } = req.body;
    
    log('info', 'Sauvegarde des éléments du mode Timer', { 
      userId, 
      elementsCount: elements.length 
    });
    
    const existingProgress = await db.query(
      'SELECT timer_elements FROM progress WHERE user_id = $1',
      [userId]
    );
    
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    let elementsToSave = Array.isArray(elements) ? [...elements] : [];
    
    if (existingProgress.rows.length > 0) {
      let existingElements;
      try {
        existingElements = typeof existingProgress.rows[0].timer_elements === 'string'
          ? JSON.parse(existingProgress.rows[0].timer_elements)
          : existingProgress.rows[0].timer_elements || [];
      } catch (e) {
        existingElements = [];
      }
      elementsToSave = [...new Set([...existingElements, ...elementsToSave])];
    }
    
    if (existingProgress.rows.length === 0) {
      await db.query(
        `INSERT INTO progress (
          user_id, 
          timer_elements,
          last_saved
        ) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [
          userId, 
          JSON.stringify(elementsToSave)
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

router.post('/update-timer-progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timerProgress } = req.body;
    
    log('debug', 'Mise à jour de la progression du timer', { userId });
    
    if (!timerProgress || typeof timerProgress !== 'object') {
      log('warn', 'Progression du timer invalide', { userId });
      return res.status(400).json({ message: 'La progression du timer est invalide' });
    }

    // Récupérer les données existantes de la progression
    const existingResult = await db.query(
      'SELECT timer_progress FROM progress WHERE user_id = $1',
      [userId]
    );

    let existingTimerProgress = {};
    if (existingResult.rows.length > 0 && existingResult.rows[0].timer_progress) {
      try {
        existingTimerProgress = typeof existingResult.rows[0].timer_progress === 'string'
          ? JSON.parse(existingResult.rows[0].timer_progress)
          : existingResult.rows[0].timer_progress;
      } catch (e) {
        log('error', 'Erreur lors du parsing de timer_progress existant', e);
      }
    }

    // Fusionner les données existantes avec les nouvelles données
    const safeTimerProgress = {
      completedQuestions: {
        ...existingTimerProgress.completedQuestions || {},
        ...timerProgress.completedQuestions || {}
      },
      unlockedCategories: {
        Facile: [...new Set([
          ...(existingTimerProgress.unlockedCategories?.Facile || []),
          ...(timerProgress.unlockedCategories?.Facile || [])
        ])],
        Moyen: [...new Set([
          ...(existingTimerProgress.unlockedCategories?.Moyen || []),
          ...(timerProgress.unlockedCategories?.Moyen || [])
        ])],
        Difficile: [...new Set([
          ...(existingTimerProgress.unlockedCategories?.Difficile || []),
          ...(timerProgress.unlockedCategories?.Difficile || [])
        ])]
      },
      bestScores: {
        Facile: Math.max(existingTimerProgress.bestScores?.Facile || 0, timerProgress.bestScores?.Facile || 0),
        Moyen: Math.max(existingTimerProgress.bestScores?.Moyen || 0, timerProgress.bestScores?.Moyen || 0),
        Difficile: Math.max(existingTimerProgress.bestScores?.Difficile || 0, timerProgress.bestScores?.Difficile || 0)
      }
    };
    
    log('debug', 'Timer Progress fusionné à sauvegarder', safeTimerProgress);
    
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

router.get('/load-progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT timer_progress FROM progress WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(200).json({
        completedQuestions: {},
        unlockedCategories: {},
        bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
      });
    }
    const timerProgress = typeof result.rows[0].timer_progress === 'string'
      ? JSON.parse(result.rows[0].timer_progress)
      : result.rows[0].timer_progress;
    res.status(200).json(timerProgress);
  } catch (error) {
    console.error('Erreur lors du chargement de la progression du Timer:', error);
    res.status(500).json({
      message: 'Erreur lors du chargement de la progression',
      error: error.message
    });
  }
});

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