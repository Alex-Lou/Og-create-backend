const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Configuration des niveaux de log
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Niveau de log par défaut, peut être remplacé par une variable d'environnement
const logLevel = process.env.LOG_LEVEL || 'warn';

/**
 * Fonction de logging avec niveau
 * @param {string} level - Niveau de log (debug, info, warn, error)
 * @param {string} message - Message à logger
 * @param {any} data - Données additionnelles (optionnel)
 */
function log(level, message, data) {
    // Ne logger que si le niveau est supérieur ou égal au niveau configuré
    if (LOG_LEVELS[level] >= LOG_LEVELS[logLevel]) {
        if (data !== undefined) {
            console[level](`[${level.toUpperCase()}] ${message}`, 
                typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
        } else {
            console[level](`[${level.toUpperCase()}] ${message}`);
        }
    }
}

// Configuration du rate limiting spécifique pour les routes de progression
const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requêtes par minute (2 requêtes/sec, raisonnable)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

// Ajouter une queue pour les sauvegardes par utilisateur
const saveQueue = {};

// Fonction pour traiter la queue de sauvegarde d'un utilisateur
const processSaveQueue = async (userId) => {
  if (saveQueue[userId] && saveQueue[userId].length > 0) {
    const { data, resolve, reject } = saveQueue[userId].shift();
    try {
      // Extraire les données avec valeurs par défaut
      const { 
          discoveredElements = ["Eau", "Feu", "Terre", "Air"], 
          discoveredCategories = ["Elements Fondamentaux"], 
          achievements = {}, 
          categoryProgress = {},
          coins = 0,
          timerProgress = {
              completedQuestions: {},
              unlockedCategories: {},
              bestScores: {
                  Facile: 0,
                  Moyen: 0,
                  Difficile: 0
              }
          }
      } = data;
      
      // Vérifier si une entrée existe déjà
      const existingProgress = await db.query(
          'SELECT id, discovered_elements, achievements FROM progress WHERE user_id = $1',
          [userId]
      );
      
      // Préparer les données
      const timerProgressToSave = JSON.stringify(timerProgress || {
          completedQuestions: {},
          unlockedCategories: {},
          bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
      });
      
      // Fusion pour les éléments découverts
      let elementsToSave = discoveredElements;
      let achievementsToSave = achievements;
      
      if (existingProgress.rows.length > 0) {
          // Fusionner les éléments découverts existants
          const existingElements = typeof existingProgress.rows[0].discovered_elements === 'string'
              ? JSON.parse(existingProgress.rows[0].discovered_elements)
              : existingProgress.rows[0].discovered_elements || [];
          
          elementsToSave = [...new Set([...existingElements, ...discoveredElements])];
          
          // Fusionner les achievements existants
          const existingAchievements = typeof existingProgress.rows[0].achievements === 'string'
              ? JSON.parse(existingProgress.rows[0].achievements)
              : existingProgress.rows[0].achievements || {};
          
          achievementsToSave = { ...existingAchievements, ...achievements };
      }
      
      // Mise à jour ou insertion
      if (existingProgress.rows.length > 0) {
          await db.query(
              `UPDATE progress 
              SET 
                  discovered_elements = $1,
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
          await db.query(
              `INSERT INTO progress (
                  user_id,
                  discovered_elements,
                  discovered_categories,
                  achievements,
                  category_progress,
                  coins,
                  timer_progress,
                  last_saved
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
              [
                  userId,
                  JSON.stringify(elementsToSave),
                  discoveredCategories,
                  JSON.stringify(achievementsToSave),
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
      // Traiter la prochaine requête dans la queue s'il y en a
      if (saveQueue[userId] && saveQueue[userId].length > 0) {
        setTimeout(() => processSaveQueue(userId), 300); // petit délai entre les sauvegardes
      }
    }
  }
};

router.post('/update-achievements', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const { achievements } = req.body;
      
      log('debug', 'Mise à jour des achievements', { userId });
      
      // Vérifier immédiatement avant toute opération
      if (!achievements || Object.keys(achievements).length === 0) {
        return res.status(400).json({ 
          message: 'Aucun achievement à mettre à jour' 
        });
      }
  
      // Récupérer rapidement les achievements existants
      const currentProgress = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Parser les achievements existants de manière plus robuste
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
  
      // Fusionner immédiatement les nouveaux achievements
      const updatedAchievements = { 
        ...currentAchievements, 
        ...achievements 
      };
  
      // Sauvegarder immédiatement et de manière atomique
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
      
      // Répondre rapidement
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

// Route pour sauvegarder la progression complète
router.post('/save', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
      const userId = req.user.id;
      log('info', 'Requête de sauvegarde reçue', { userId });
      
      // Créer une promesse qui sera résolue quand la sauvegarde sera traitée
      const savePromise = new Promise((resolve, reject) => {
          if (!saveQueue[userId]) {
              saveQueue[userId] = [];
          }
          
          // Ajouter cette requête à la queue
          saveQueue[userId].push({
              data: req.body,
              resolve,
              reject
          });
          
          // Si c'est la seule requête dans la queue, la traiter immédiatement
          if (saveQueue[userId].length === 1) {
              processSaveQueue(userId);
          }
      });
      
      // Attendre que la sauvegarde soit traitée
      const result = await savePromise;
      res.status(200).json(result);
  } catch (error) {
      log('error', 'Erreur lors de la sauvegarde de la progression', error);
      res.status(500).json({ 
          message: 'Erreur lors de la sauvegarde de la progression',
          error: error.message
      });
  }
});

// Route pour charger la progression
router.get('/load', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
      const userId = req.user.id;
      log('debug', 'Chargement de la progression', { userId });

      // Éléments fondamentaux qui doivent toujours être présents
      const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
      const fundamentalCategory = "Elements Fondamentaux";

      const result = await db.query(
          `SELECT 
              discovered_elements,
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

      if (result.rows.length === 0) {
          log('info', 'Aucune progression trouvée, création d\'une nouvelle entrée avec les valeurs par défaut', { userId });
          
          // Créer un objet category_progress avec Elements Fondamentaux à 100%
          const defaultCategoryProgress = {
              "Elements Fondamentaux": 100
          };
          
          // Créer une nouvelle entrée avec les éléments fondamentaux
          const newProgress = await db.query(
              `INSERT INTO progress (
                  user_id,
                  discovered_elements,
                  discovered_categories,
                  achievements,
                  category_progress,
                  coins,
                  timer_progress,
                  infinite_elements,
                  explorer_elements,
                  timer_elements,
                  last_saved
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
              RETURNING *`,
              [
                  userId,
                  JSON.stringify(fundamentalElements),
                  [fundamentalCategory],
                  JSON.stringify({}),
                  JSON.stringify(defaultCategoryProgress),
                  0,
                  JSON.stringify({
                      completedQuestions: {},
                      unlockedCategories: {},
                      bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
                  }),
                  JSON.stringify(fundamentalElements), // infinite_elements avec les éléments fondamentaux
                  JSON.stringify([]), // explorer_elements
                  JSON.stringify([]) // timer_elements
              ]
          );

          return res.status(200).json({
              discoveredElements: fundamentalElements,
              discoveredCategories: [fundamentalCategory],
              achievements: {},
              categoryProgress: defaultCategoryProgress,
              coins: 0,
              timerProgress: {
                  completedQuestions: {},
                  unlockedCategories: {},
                  bestScores: {
                      Facile: 0,
                      Moyen: 0,
                      Difficile: 0
                  }
              },
              infiniteElements: fundamentalElements,
              explorerElements: [],
              timerElements: [],
              lastSaved: newProgress.rows[0].last_saved
          });
      }

      const progress = result.rows[0];
      log('debug', 'Progression chargée', { 
        userId,
        coins: progress.coins,
        elementsCount: progress.discovered_elements ? 
          (typeof progress.discovered_elements === 'string' ? 
            JSON.parse(progress.discovered_elements).length : progress.discovered_elements.length) : 0
      });

      let parsedProgress = {
          discoveredElements: [],
          discoveredCategories: [],
          achievements: {},
          categoryProgress: {},
          coins: progress.coins || 0,
          timerProgress: {
              completedQuestions: {},
              unlockedCategories: {},
              bestScores: {
                  Facile: 0,
                  Moyen: 0,
                  Difficile: 0
              }
          },
          infiniteElements: [],
          explorerElements: [],
          timerElements: [],
          lastSaved: progress.last_saved
      };

      let elementsUpdated = false;
      let categoriesUpdated = false;
      let categoryProgressUpdated = false;
      let infiniteElementsUpdated = false;

      try {
          // Traitement des éléments découverts
          if (progress.discovered_elements) {
              let elements = typeof progress.discovered_elements === 'string'
                  ? JSON.parse(progress.discovered_elements)
                  : progress.discovered_elements;
              
              // Vérifier si les éléments fondamentaux sont présents, sinon les ajouter
              let missingElements = [];
              fundamentalElements.forEach(element => {
                  if (!elements.includes(element)) {
                      elements.push(element);
                      missingElements.push(element);
                      elementsUpdated = true;
                  }
              });
              
              if (missingElements.length > 0) {
                  log('info', `Ajout des éléments fondamentaux manquants: ${missingElements.join(', ')}`, { userId });
              }
              
              parsedProgress.discoveredElements = elements;
          } else {
              // Si le champ est null ou undefined, utiliser les éléments fondamentaux
              parsedProgress.discoveredElements = fundamentalElements;
              elementsUpdated = true;
          }

          // Traitement des catégories découvertes
          if (progress.discovered_categories && progress.discovered_categories.length > 0) {
              parsedProgress.discoveredCategories = progress.discovered_categories;
              
              // S'assurer que la catégorie "Elements Fondamentaux" est toujours présente
              if (!parsedProgress.discoveredCategories.includes(fundamentalCategory)) {
                  parsedProgress.discoveredCategories.push(fundamentalCategory);
                  categoriesUpdated = true;
                  log('info', `Ajout de la catégorie fondamentale manquante: ${fundamentalCategory}`, { userId });
              }
          } else {
              // Si le champ est null, undefined ou vide, ajouter la catégorie fondamentale
              parsedProgress.discoveredCategories = [fundamentalCategory];
              categoriesUpdated = true;
          }

          // Traitement de la progression des catégories
          if (progress.category_progress) {
              let categoryProgress = typeof progress.category_progress === 'string'
                  ? JSON.parse(progress.category_progress)
                  : progress.category_progress;
              
              // S'assurer que Elements Fondamentaux est toujours à 100%
              if (categoryProgress[fundamentalCategory] !== 100) {
                  categoryProgress[fundamentalCategory] = 100;
                  categoryProgressUpdated = true;
                  log('info', `Mise à jour de la progression des Elements Fondamentaux à 100%`, { userId });
              }
              
              parsedProgress.categoryProgress = categoryProgress;
          } else {
              // Si le champ est null ou undefined, créer un objet avec Elements Fondamentaux à 100%
              parsedProgress.categoryProgress = { [fundamentalCategory]: 100 };
              categoryProgressUpdated = true;
          }

          // Traitement des éléments du mode infini (infinite_elements)
          if (progress.infinite_elements) {
              let infiniteElements = typeof progress.infinite_elements === 'string'
                  ? JSON.parse(progress.infinite_elements)
                  : progress.infinite_elements;
              
              // Vérifier si les éléments fondamentaux sont présents, sinon les ajouter
              fundamentalElements.forEach(element => {
                  if (!infiniteElements.includes(element)) {
                      infiniteElements.push(element);
                      infiniteElementsUpdated = true;
                  }
              });
              
              // Synchroniser avec tous les éléments découverts
              parsedProgress.discoveredElements.forEach(element => {
                  if (!infiniteElements.includes(element)) {
                      infiniteElements.push(element);
                      infiniteElementsUpdated = true;
                  }
              });
              
              parsedProgress.infiniteElements = infiniteElements;
          } else {
              // Si le champ est null, undefined ou vide, utiliser les éléments découverts
              parsedProgress.infiniteElements = [...parsedProgress.discoveredElements];
              infiniteElementsUpdated = true;
          }

          // Traitement des éléments des autres modes
          if (progress.explorer_elements) {
              parsedProgress.explorerElements = typeof progress.explorer_elements === 'string'
                  ? JSON.parse(progress.explorer_elements)
                  : progress.explorer_elements;
          }

          if (progress.timer_elements) {
              parsedProgress.timerElements = typeof progress.timer_elements === 'string'
                  ? JSON.parse(progress.timer_elements)
                  : progress.timer_elements;
          }

          // Mettre à jour la base de données si des changements ont été faits
          if (elementsUpdated || categoriesUpdated || categoryProgressUpdated || infiniteElementsUpdated) {
              log('info', 'Mise à jour des données fondamentales dans la base de données', { userId });
              await db.query(
                  `UPDATE progress 
                   SET discovered_elements = $1, 
                       discovered_categories = $2,
                       category_progress = $3,
                       infinite_elements = $4,
                       last_saved = CURRENT_TIMESTAMP
                   WHERE user_id = $5`,
                  [
                      JSON.stringify(parsedProgress.discoveredElements),
                      parsedProgress.discoveredCategories,
                      JSON.stringify(parsedProgress.categoryProgress),
                      JSON.stringify(parsedProgress.infiniteElements),
                      userId
                  ]
              );
          }

          // Autres traitements (achievements, timerProgress)...
          if (progress.achievements) {
              parsedProgress.achievements = typeof progress.achievements === 'string'
                  ? JSON.parse(progress.achievements)
                  : progress.achievements;
          }

          if (progress.timer_progress) {
              const parsedTimerProgress = typeof progress.timer_progress === 'string'
                  ? JSON.parse(progress.timer_progress)
                  : progress.timer_progress;

              parsedProgress.timerProgress = {
                  completedQuestions: parsedTimerProgress.completedQuestions || {},
                  unlockedCategories: parsedTimerProgress.unlockedCategories || {},
                  bestScores: parsedTimerProgress.bestScores || {
                      Facile: 0,
                      Moyen: 0,
                      Difficile: 0
                  }
              };
          }

          log('debug', 'Progression parsée', {
            coins: parsedProgress.coins,
            elementsCount: parsedProgress.discoveredElements.length,
            infiniteElementsCount: parsedProgress.infiniteElements.length,
            achievementsCount: Object.keys(parsedProgress.achievements).length
          });
      } catch (error) {
          log('error', 'Erreur lors du parsing des données JSON', error);
      }

      res.status(200).json(parsedProgress);

  } catch (error) {
      log('error', 'Erreur lors du chargement de la progression', error);
      res.status(500).json({ 
          message: 'Erreur lors du chargement de la progression',
          error: error.message 
      });
  }
});

router.post('/update-coins', authMiddleware, progressRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const { coins } = req.body;
        
        log('debug', 'Mise à jour des pièces', { userId, coins });
        
        // Vérifier d'abord les pièces existantes
        const currentProgress = await db.query(
            'SELECT coins, last_saved FROM progress WHERE user_id = $1',
            [userId]
        );
        
        log('debug', 'Valeurs actuelles', { 
            currentCoins: currentProgress.rows[0]?.coins,
            lastSaved: currentProgress.rows[0]?.last_saved
        });
        
        // Si aucune progression n'existe, créer une nouvelle entrée
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

router.post('/update-discovered-elements', authMiddleware, progressRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { discoveredElements, gameMode = 'infinite' } = req.body;
    
    log('debug', 'Mise à jour des éléments découverts', { 
      userId, 
      elementsCount: discoveredElements ? discoveredElements.length : 0,
      gameMode
    });
    
    // Éléments fondamentaux qui doivent toujours être présents
    const fundamentalElements = ["Eau", "Feu", "Terre", "Air"];
    const fundamentalCategory = "Elements Fondamentaux";
    
    // Vérifier d'abord si la progression existe
    const currentProgress = await db.query(
      `SELECT 
         discovered_elements, 
         infinite_elements, 
         explorer_elements, 
         timer_elements,
         category_progress
       FROM progress WHERE user_id = $1`,
      [userId]
    );
    
    // S'assurer que les éléments fondamentaux sont inclus
    let elementsToSave = Array.isArray(discoveredElements) ? [...discoveredElements] : [];
    fundamentalElements.forEach(element => {
      if (!elementsToSave.includes(element)) {
        elementsToSave.push(element);
      }
    });
    
    // Si aucune progression n'existe, créer une nouvelle entrée
    if (currentProgress.rows.length === 0) {
      log('info', 'Création nouvelle entrée progress pour éléments découverts', { userId });
      
      // Initialiser les éléments spécifiques au mode de jeu
      let infiniteElements = gameMode === 'infinite' ? elementsToSave : fundamentalElements;
      let explorerElements = gameMode === 'explorer' ? elementsToSave : [];
      let timerElements = gameMode === 'timer' ? elementsToSave : [];
      
      // Catégorie fondamentale à 100%
      const categoryProgress = { [fundamentalCategory]: 100 };
      
      await db.query(
        `INSERT INTO progress (
           user_id, 
           discovered_elements, 
           discovered_categories,
           category_progress,
           infinite_elements,
           explorer_elements,
           timer_elements,
           last_saved
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          userId, 
          JSON.stringify(elementsToSave),
          [fundamentalCategory],
          JSON.stringify(categoryProgress),
          JSON.stringify(infiniteElements),
          JSON.stringify(explorerElements),
          JSON.stringify(timerElements)
        ]
      );
    } else {
      log('debug', 'Mise à jour éléments découverts existants', { userId });
      
      // Récupérer les éléments existants
      let currentDiscoveredElements = currentProgress.rows[0].discovered_elements 
        ? (typeof currentProgress.rows[0].discovered_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].discovered_elements)
           : currentProgress.rows[0].discovered_elements)
        : [];
      
      let currentInfiniteElements = currentProgress.rows[0].infinite_elements
        ? (typeof currentProgress.rows[0].infinite_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].infinite_elements)
           : currentProgress.rows[0].infinite_elements)
        : [];
      
      let currentExplorerElements = currentProgress.rows[0].explorer_elements
        ? (typeof currentProgress.rows[0].explorer_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].explorer_elements)
           : currentProgress.rows[0].explorer_elements)
        : [];
      
      let currentTimerElements = currentProgress.rows[0].timer_elements
        ? (typeof currentProgress.rows[0].timer_elements === 'string'
           ? JSON.parse(currentProgress.rows[0].timer_elements)
           : currentProgress.rows[0].timer_elements)
        : [];
      
      let categoryProgress = currentProgress.rows[0].category_progress
        ? (typeof currentProgress.rows[0].category_progress === 'string'
           ? JSON.parse(currentProgress.rows[0].category_progress)
           : currentProgress.rows[0].category_progress)
        : { [fundamentalCategory]: 100 };
      
      // Fusionner les éléments
      elementsToSave = [...new Set([...currentDiscoveredElements, ...elementsToSave])];
      
      // Mettre à jour les éléments du mode de jeu correspondant
      let infiniteElementsToSave = currentInfiniteElements;
      let explorerElementsToSave = currentExplorerElements;
      let timerElementsToSave = currentTimerElements;
      
      // Synchroniser les éléments selon le mode de jeu
      if (gameMode === 'infinite') {
        infiniteElementsToSave = [...new Set([...currentInfiniteElements, ...elementsToSave])];
      } else if (gameMode === 'explorer') {
        explorerElementsToSave = [...new Set([...currentExplorerElements, ...elementsToSave])];
      } else if (gameMode === 'timer') {
        timerElementsToSave = [...new Set([...currentTimerElements, ...elementsToSave])];
      }
      
      // S'assurer que les éléments fondamentaux sont dans le mode infini
      fundamentalElements.forEach(element => {
        if (!infiniteElementsToSave.includes(element)) {
          infiniteElementsToSave.push(element);
        }
      });
      
      // S'assurer que Elements Fondamentaux est à 100%
      categoryProgress[fundamentalCategory] = 100;
      
      await db.query(
        `UPDATE progress 
         SET 
           discovered_elements = $1,
           category_progress = $2,
           infinite_elements = $3,
           explorer_elements = $4,
           timer_elements = $5,
           last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $6`,
        [
          JSON.stringify(elementsToSave),
          JSON.stringify(categoryProgress),
          JSON.stringify(infiniteElementsToSave),
          JSON.stringify(explorerElementsToSave),
          JSON.stringify(timerElementsToSave),
          userId
        ]
      );
    }

    // Préparation de la réponse
    let responseData = {
      message: 'Éléments découverts mis à jour avec succès',
      discoveredElements: elementsToSave,
      timestamp: new Date().toISOString()
    };
    
    // Ajouter des informations supplémentaires selon le mode
    if (gameMode === 'infinite') {
      responseData.infiniteElements = elementsToSave;
    } else if (gameMode === 'explorer') {
      responseData.explorerElements = elementsToSave;
    } else if (gameMode === 'timer') {
      responseData.timerElements = elementsToSave;
    }
    
    res.status(200).json(responseData);
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des éléments découverts', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour des éléments découverts',
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

// Route pour initialiser/récupérer l'état du mode Explorer
router.get('/explorer/init', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      log('debug', 'Initialisation du mode Explorer', { userId });
      
      // Vérifier si l'utilisateur a déjà des données Explorer
      const userResult = await db.query(
        `SELECT explorer_energy, last_energy_update FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      let energy = 10; // Énergie par défaut
      const maxEnergy = 20; // Énergie maximale
      let nextEnergyIn = 0; // Minutes jusqu'à la prochaine énergie
      
      if (userResult.rows.length > 0) {
        // Si l'utilisateur existe, récupérer son énergie actuelle
        energy = userResult.rows[0].explorer_energy || energy;
        
        // Calculer le temps jusqu'à la prochaine énergie
        const lastUpdate = userResult.rows[0].last_energy_update;
        if (lastUpdate && energy < maxEnergy) {
          const lastUpdateTime = new Date(lastUpdate).getTime();
          const now = new Date().getTime();
          const timeDiff = Math.floor((now - lastUpdateTime) / (1000 * 60)); // Différence en minutes
          
          // Si le temps écoulé est suffisant pour gagner de l'énergie
          if (timeDiff >= 30) {
            const energyToAdd = Math.floor(timeDiff / 30); // Une énergie toutes les 30 minutes
            energy = Math.min(energy + energyToAdd, maxEnergy);
            
            // Mettre à jour l'énergie dans la base de données
            await db.query(
              `UPDATE progress 
               SET explorer_energy = $1, 
                   last_energy_update = CURRENT_TIMESTAMP
               WHERE user_id = $2`,
              [energy, userId]
            );
          }
          
          // Calculer le temps restant jusqu'à la prochaine énergie
          nextEnergyIn = 30 - (timeDiff % 30);
        }
      } else {
        // Si l'utilisateur n'existe pas dans la table progress, le créer
        log('info', 'Création d\'un nouvel utilisateur pour le mode Explorer', { userId });
        await db.query(
          `INSERT INTO progress 
           (user_id, explorer_energy, last_energy_update)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, energy]
        );
      }
      
      // Répondre avec l'état actuel
      res.status(200).json({
        energy: energy,
        max_energy: maxEnergy,
        next_energy_in: nextEnergyIn
      });
    } catch (error) {
      log('error', 'Erreur lors de l\'initialisation du mode Explorer', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'initialisation du mode Explorer',
        error: error.message
      });
    }
});
  
// Route pour compléter une région en mode Explorer
router.post('/explorer/regions/:id/complete', authMiddleware, async (req, res) => {
    try {
      const regionId = req.params.id;
      const userId = req.user.id;
      const { coins = 0, energy = 0, xp = 0 } = req.body;
      
      log('info', `Complétion de la région ${regionId}`, { userId, rewards: { coins, energy, xp } });
      
      // 1. Récupérer l'état actuel de l'utilisateur
      const userProgressResult = await db.query(
        `SELECT coins, explorer_energy FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      let currentCoins = 0;
      let currentEnergy = 0;
      const maxEnergy = 20; // Défini comme constante
      
      if (userProgressResult.rows.length > 0) {
        currentCoins = userProgressResult.rows[0].coins || 0;
        currentEnergy = userProgressResult.rows[0].explorer_energy || 0;
      }
      
      log('debug', 'État actuel avant mise à jour', { currentCoins, currentEnergy });
      
      // 2. Calculer les nouvelles valeurs
      const newCoins = currentCoins + coins;
      const newEnergy = Math.min(currentEnergy + energy, maxEnergy);
      
      log('debug', 'Nouvelles valeurs après calcul', { newCoins, newEnergy });
      
      // 3. Mettre à jour la base de données user_regions
      try {
        // Vérifier si l'entrée existe déjà
        const regionResult = await db.query(
          `SELECT * FROM user_regions WHERE region_id = $1 AND user_id = $2`,
          [regionId, userId]
        );
        
        if (regionResult.rows.length === 0) {
          // Si l'entrée n'existe pas, la créer
          log('info', `Création d'une nouvelle entrée user_regions`, { regionId, userId });
          await db.query(
            `INSERT INTO user_regions 
             (region_id, user_id, visited, completed, progress, last_visited)
             VALUES ($1, $2, true, true, 100, CURRENT_TIMESTAMP)`,
            [regionId, userId]
          );
        } else {
          // Sinon, mettre à jour l'entrée existante
          log('debug', `Mise à jour de l'entrée user_regions`, { regionId, userId });
          await db.query(
            `UPDATE user_regions 
             SET visited = true, 
                 completed = true,
                 progress = 100,
                 last_visited = CURRENT_TIMESTAMP
             WHERE region_id = $1 AND user_id = $2`,
            [regionId, userId]
          );
        }
      } catch (error) {
        log('warn', `Erreur lors de la mise à jour de user_regions`, { error: error.message });
        // Ne pas échouer la requête complètement, on peut encore mettre à jour l'énergie
      }
      
      // 4. Mettre à jour les statistiques (coins, energy) dans la progression
      await db.query(
        `UPDATE progress 
         SET coins = $1, 
             explorer_energy = $2, 
             last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [newCoins, newEnergy, userId]
      );
      
      // 5. Répondre avec les nouvelles valeurs
      res.status(200).json({
        message: 'Région complétée avec succès',
        rewards: {
          coins: newCoins, 
          energy: newEnergy,
          xp: xp
        }
      });
    } catch (error) {
      log('error', 'Erreur lors de la complétion de la région', error);
      res.status(500).json({ 
        message: 'Erreur lors de la complétion de la région',
        error: error.message
      });
    }
});

module.exports = router;