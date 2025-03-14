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
    const { discoveredElements, gameMode = 'infinite' } = req.body;
    log('debug', 'Mise à jour des éléments', { 
      userId, 
      elementsCount: discoveredElements ? discoveredElements.length : 0,
      gameMode
    });
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    const fundamentalCategory = "Elements Fondamentaux";
    const currentProgress = await db.query(
      `SELECT 
         infinite_elements, 
         explorer_elements, 
         timer_elements,
         category_progress
       FROM progress WHERE user_id = $1`,
      [userId]
    );
    let elementsToSave = Array.isArray(discoveredElements) ? [...discoveredElements] : [];
    fundamentalElements.forEach(element => {
      if (!elementsToSave.includes(element)) {
        elementsToSave.push(element);
      }
    });
    if (currentProgress.rows.length === 0) {
      log('info', 'Création nouvelle entrée progress pour éléments', { userId });
      let infiniteElements = gameMode === 'infinite' ? elementsToSave : fundamentalElements;
      let timerElements = gameMode === 'timer' ? elementsToSave : [];
      let explorerElements = gameMode === 'explorer' ? elementsToSave : [];
      const categoryProgress = { [fundamentalCategory]: 100 };
      await db.query(
        `INSERT INTO progress (
           user_id, 
           discovered_categories,
           category_progress,
           infinite_elements,
           explorer_elements,
           timer_elements,
           last_saved
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          userId, 
          [fundamentalCategory],
          JSON.stringify(categoryProgress),
          JSON.stringify(infiniteElements),
          JSON.stringify(explorerElements),
          JSON.stringify(timerElements)
        ]
      );
      return res.status(200).json({
        message: 'Éléments mis à jour avec succès',
        elements: elementsToSave,
        timestamp: new Date().toISOString()
      });
    } else {
      log('debug', 'Mise à jour éléments existants', { userId });
      let currentInfiniteElements = currentProgress.rows[0].infinite_elements
        ? (typeof currentProgress.rows[0].infinite_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].infinite_elements)
           : currentProgress.rows[0].infinite_elements)
        : [];
      let currentTimerElements = currentProgress.rows[0].timer_elements
        ? (typeof currentProgress.rows[0].timer_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].timer_elements)
           : currentProgress.rows[0].timer_elements)
        : [];
      let currentExplorerElements = currentProgress.rows[0].explorer_elements
        ? (typeof currentProgress.rows[0].explorer_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].explorer_elements)
           : currentProgress.rows[0].explorer_elements)
        : [];
      let categoryProgress = currentProgress.rows[0].category_progress
        ? (typeof currentProgress.rows[0].category_progress === 'string'
           ? JSON.parse(currentProgress.rows[0].category_progress)
           : currentProgress.rows[0].category_progress)
        : { [fundamentalCategory]: 100 };
      let newElements;
      if (gameMode === 'infinite') {
        newElements = [...new Set([...currentInfiniteElements, ...elementsToSave])];
        fundamentalElements.forEach(el => { if (!newElements.includes(el)) { newElements.push(el); } });
        await db.query(
          `UPDATE progress 
           SET 
             infinite_elements = $1,
             category_progress = $2,
             last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...categoryProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      } else if (gameMode === 'timer') {
        newElements = [...new Set([...currentTimerElements, ...elementsToSave])];
        await db.query(
          `UPDATE progress 
           SET 
             timer_elements = $1,
             category_progress = $2,
             last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...categoryProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      } else if (gameMode === 'explorer') {
        newElements = [...new Set([...currentExplorerElements, ...elementsToSave])];
        await db.query(
          `UPDATE progress 
           SET 
             explorer_elements = $1,
             category_progress = $2,
             last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...categoryProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      }
      return res.status(200).json({
        message: 'Éléments mis à jour avec succès',
        elements: newElements,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des éléments', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour des éléments',
      error: error.message
    });
  }
});

module.exports = router;
