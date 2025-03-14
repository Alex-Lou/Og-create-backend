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

const saveQueue = {};

const processSaveQueue = async (userId) => {
  if (saveQueue[userId] && saveQueue[userId].length > 0) {
    const { data, resolve, reject } = saveQueue[userId].shift();
    try {
      const {
        gameMode = 'infinite',
        elements = ["Eau", "Feu", "Terre", "Air"],
        discoveredCategories = ["Elements Fondamentaux"],
        achievements = {},
        categoryProgress = {},
        coins = 0,
        timerProgress = {
          completedQuestions: {},
          unlockedCategories: {},
          bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
        }
      } = data;
      const columnName = gameMode === 'timer' ? 'timer_elements' : 'infinite_elements';
      const existingProgress = await db.query(
        `SELECT id, ${columnName}, achievements FROM progress WHERE user_id = $1`,
        [userId]
      );
      const timerProgressToSave = JSON.stringify(timerProgress || {
        completedQuestions: {},
        unlockedCategories: {},
        bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
      });
      let elementsToSave = elements;
      let achievementsToSave = achievements;
      if (existingProgress.rows.length > 0) {
        const existingElements = typeof existingProgress.rows[0][columnName] === 'string'
          ? JSON.parse(existingProgress.rows[0][columnName])
          : existingProgress.rows[0][columnName] || [];
        elementsToSave = [...new Set([...existingElements, ...elements])];
        const existingAchievements = typeof existingProgress.rows[0].achievements === 'string'
          ? JSON.parse(existingProgress.rows[0].achievements)
          : existingProgress.rows[0].achievements || {};
        achievementsToSave = { ...existingAchievements, ...achievements };
      }
      if (existingProgress.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET 
             ${columnName} = $1,
             discovered_categories = $2,
             achievements = $3,
             category_progress = $4,
             coins = $5,
             timer_progress = $6,
             last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $7`,
          [
            JSON.stringify(elementsToSave),
            discoveredCategories,
            JSON.stringify(achievementsToSave),
            JSON.stringify(categoryProgress),
            coins,
            timerProgressToSave,
            userId
          ]
        );
      } else {
        const emptyArray = JSON.stringify([]);
        const elementsJson = JSON.stringify(elementsToSave);
        let infiniteElementsValue = gameMode === 'infinite' ? elementsJson : JSON.stringify(["Eau", "Feu", "Terre", "Air"]);
        let timerElementsValue = gameMode === 'timer' ? elementsJson : emptyArray;
        await db.query(
          `INSERT INTO progress (
             user_id,
             infinite_elements,
             timer_elements,
             discovered_categories,
             achievements,
             category_progress,
             coins,
             timer_progress,
             last_saved
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
          [
            userId,
            infiniteElementsValue,
            timerElementsValue,
            discoveredCategories,
            JSON.stringify(achievements),
            JSON.stringify(categoryProgress),
            coins,
            timerProgressToSave
          ]
        );
      }
      resolve({
        message: 'Progression sauvegardée avec succès',
        lastSaved: new Date().toISOString()
      });
    } catch (error) {
      log('error', 'Erreur lors du traitement de la queue', error);
      reject(error);
    } finally {
      if (saveQueue[userId] && saveQueue[userId].length > 0) {
        setTimeout(() => processSaveQueue(userId), 300);
      }
    }
  }
};

router.post('/save', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    log('info', 'Requête de sauvegarde reçue', { userId });
    const savePromise = new Promise((resolve, reject) => {
      if (!saveQueue[userId]) {
        saveQueue[userId] = [];
      }
      saveQueue[userId].push({ data: req.body, resolve, reject });
      if (saveQueue[userId].length === 1) {
        processSaveQueue(userId);
      }
    });
    const result = await savePromise;
    res.status(200).json(result);
  } catch (error) {
    log('error', 'Erreur lors de la sauvegarde de la progression', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde de la progression', error: error.message });
  }
});

router.get('/load', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameMode = req.query.gameMode || 'infinite';
    log('debug', 'Chargement de la progression', { userId, gameMode });
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    const fundamentalCategory = "Elements Fondamentaux";
    
    const result = await db.query(
      `SELECT 
         discovered_categories,
         achievements,
         category_progress,
         coins,
         timer_progress,
         infinite_elements,
         explorer_elements,
         timer_elements,
         last_saved
       FROM progress 
       WHERE user_id = $1`,
      [userId]
    );

    console.log('DEBUG Backend - Résultat de la requête:', {
      rowsCount: result.rows.length,
      rawData: result.rows[0]
    });

    if (result.rows.length === 0) {
      log('info', 'Aucune progression trouvée, création d\'une nouvelle entrée avec les valeurs par défaut', { userId });
      const defaultCategoryProgress = { "Elements Fondamentaux": 100 };
      const newProgress = await db.query(
        `INSERT INTO progress (
           user_id,
           infinite_elements,
           discovered_categories,
           achievements,
           category_progress,
           coins,
           timer_progress,
           timer_elements,
           explorer_elements,
           last_saved
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          userId,
          JSON.stringify(fundamentalElements),
          [fundamentalCategory],
          JSON.stringify({}),
          JSON.stringify(defaultCategoryProgress),
          0,
          JSON.stringify({ completedQuestions: {}, unlockedCategories: {}, bestScores: { Facile: 0, Moyen: 0, Difficile: 0 } }),
          JSON.stringify([]),
          JSON.stringify([])
        ]
      );
      const inserted = newProgress.rows[0];
      return res.status(200).json({
        discoveredElements: fundamentalElements, // Modification importante
        discoveredCategories: [fundamentalCategory],
        achievements: {},
        categoryProgress: defaultCategoryProgress,
        coins: 0,
        timerProgress: { completedQuestions: {}, unlockedCategories: {}, bestScores: { Facile: 0, Moyen: 0, Difficile: 0 } },
        explorerElements: [],
        lastSaved: inserted.last_saved
      });
    }
    
    const progress = result.rows[0];
    let inventory = [];
    
    console.log('DEBUG Backend - Types de données des éléments:', {
      infiniteElementsType: typeof progress.infinite_elements,
      timerElementsType: typeof progress.timer_elements
    });

    if (gameMode === 'timer') {
      inventory = typeof progress.timer_elements === 'string' 
        ? JSON.parse(progress.timer_elements) 
        : progress.timer_elements || [];
    } else {
      inventory = typeof progress.infinite_elements === 'string' 
        ? JSON.parse(progress.infinite_elements) 
        : progress.infinite_elements || [];
    }

    // Toujours ajouter les éléments fondamentaux
    fundamentalElements.forEach(el => { 
      if (!inventory.includes(el)) { 
        inventory.push(el); 
      } 
    });

    console.log('DEBUG Backend - Inventory final:', {
      inventory: inventory,
      inventoryLength: inventory.length
    });

    let parsedProgress = {
      discoveredElements: inventory, // Changement clé
      discoveredCategories: progress.discovered_categories || [fundamentalCategory],
      achievements: progress.achievements ? (
        typeof progress.achievements === 'string' 
          ? JSON.parse(progress.achievements) 
          : progress.achievements
      ) : {},
      categoryProgress: progress.category_progress ? (
        typeof progress.category_progress === 'string' 
          ? JSON.parse(progress.category_progress) 
          : progress.category_progress
      ) : { [fundamentalCategory]: 100 },
      coins: progress.coins || 0,
      timerProgress: progress.timer_progress ? (
        typeof progress.timer_progress === 'string' 
          ? JSON.parse(progress.timer_progress) 
          : progress.timer_progress
      ) : { 
        completedQuestions: {}, 
        unlockedCategories: {}, 
        bestScores: { Facile: 0, Moyen: 0, Difficile: 0 } 
      },
      explorerElements: progress.explorer_elements ? (
        typeof progress.explorer_elements === 'string' 
          ? JSON.parse(progress.explorer_elements) 
          : progress.explorer_elements
      ) : [],
      lastSaved: progress.last_saved
    };

    log('debug', 'Progression chargée', { 
      userId, 
      coins: parsedProgress.coins, 
      elementsCount: inventory.length 
    });

    res.status(200).json(parsedProgress);
  } catch (error) {
    log('error', 'Erreur lors du chargement de la progression', error);
    res.status(500).json({ 
      message: 'Erreur lors du chargement de la progression', 
      error: error.message 
    });
  }
});

router.post('/update-discovered-elements', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { discoveredElements, gameMode = 'infinite' } = req.body;
    log('debug', 'Mise à jour des éléments découverts', { 
      userId, 
      elementsCount: discoveredElements ? discoveredElements.length : 0,
      gameMode 
    });
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    const fundamentalCategory = "Elements Fondamentaux";
    // S'assurer que discoveredElements est un tableau et ajouter les fondamentaux
    let elementsToSave = Array.isArray(discoveredElements) ? [...discoveredElements] : [];
    fundamentalElements.forEach(el => {
      if (!elementsToSave.includes(el)) {
        elementsToSave.push(el);
      }
    });
    // Récupérer la progression existante pour l'utilisateur
    const currentProgress = await db.query(
      `SELECT 
         infinite_elements, 
         explorer_elements, 
         timer_elements,
         category_progress
       FROM progress WHERE user_id = $1`,
      [userId]
    );
    // Préparer la progression de catégories (si inexistante, on initialise)
    let catProgress;
    if (currentProgress.rows.length > 0 && currentProgress.rows[0].category_progress) {
      catProgress = typeof currentProgress.rows[0].category_progress === 'string'
        ? JSON.parse(currentProgress.rows[0].category_progress)
        : currentProgress.rows[0].category_progress;
    } else {
      catProgress = { [fundamentalCategory]: 100 };
    }
    catProgress[fundamentalCategory] = 100;
    
    if (currentProgress.rows.length === 0) {
      log('info', 'Création nouvelle entrée progress pour éléments', { userId });
      let infiniteElements, timerElements, explorerElements;
      if (gameMode === 'infinite') {
        infiniteElements = elementsToSave;
        timerElements = [];
        explorerElements = [];
      } else if (gameMode === 'timer') {
        infiniteElements = [];
        timerElements = elementsToSave;
        explorerElements = [];
      } else if (gameMode === 'explorer') {
        infiniteElements = [];
        timerElements = [];
        explorerElements = elementsToSave;
      } else {
        infiniteElements = elementsToSave;
        timerElements = [];
        explorerElements = [];
      }
      await db.query(
        `INSERT INTO progress (
           user_id, 
           discovered_categories,
           category_progress,
           timer_elements,
           infinite_elements,
           explorer_elements,
           last_saved
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          userId, 
          [fundamentalCategory],
          JSON.stringify(catProgress),
          JSON.stringify(timerElements),
          JSON.stringify(infiniteElements),
          JSON.stringify(explorerElements)
        ]
      );
      return res.status(200).json({
        message: 'Éléments découverts insérés avec succès',
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
      let newElements;
      if (gameMode === 'infinite') {
        newElements = [...new Set([...currentInfiniteElements, ...elementsToSave])];
        fundamentalElements.forEach(el => {
          if (!newElements.includes(el)) { newElements.push(el); }
        });
        await db.query(
          `UPDATE progress 
           SET infinite_elements = $1,
               category_progress = $2,
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...catProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      } else if (gameMode === 'timer') {
        newElements = [...new Set([...currentTimerElements, ...elementsToSave])];
        await db.query(
          `UPDATE progress 
           SET timer_elements = $1,
               category_progress = $2,
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...catProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      } else if (gameMode === 'explorer') {
        newElements = [...new Set([...currentExplorerElements, ...elementsToSave])];
        await db.query(
          `UPDATE progress 
           SET explorer_elements = $1,
               category_progress = $2,
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(newElements),
            JSON.stringify({ ...catProgress, [fundamentalCategory]: 100 }),
            userId
          ]
        );
      }
      return res.status(200).json({
        message: 'Éléments découverts mis à jour avec succès',
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
