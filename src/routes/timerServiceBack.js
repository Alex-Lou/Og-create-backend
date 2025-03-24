const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { log } = require('../utils/logger');

// ----------------------------------------
// CONFIGURATION
// ----------------------------------------

// Rate Limiter pour éviter les abus
const timerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

// Constantes métier
const FUNDAMENTAL_ELEMENTS = ["Eau", "Feu", "Terre", "Air"];
const FUNDAMENTAL_EMOJIS = {
  "Eau": "💧",
  "Feu": "🔥",
  "Terre": "🌎",
  "Air": "💨"
};

// ----------------------------------------
// SERVICES (logique métier)
// ----------------------------------------

const timerProgressService = {
  async getUserTimerProgress(userId) {
    try {
      const result = await db.query(
        `SELECT timer_progress FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return {
          completedQuestions: {},
          unlockedCategories: {},
          bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
        };
      }
      
      try {
        return typeof result.rows[0].timer_progress === 'string'
          ? JSON.parse(result.rows[0].timer_progress)
          : result.rows[0].timer_progress || {};
      } catch (e) {
        log('error', 'Erreur lors du parsing de timer_progress', e);
        return {
          completedQuestions: {},
          unlockedCategories: {},
          bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
        };
      }
    } catch (error) {
      log('error', 'Erreur lors de la récupération de la progression timer', error);
      throw error;
    }
  },
  
  async updateUserTimerProgress(userId, newTimerProgress) {
    try {
      if (!newTimerProgress || typeof newTimerProgress !== 'object') {
        throw new Error('Les données de progression sont invalides');
      }
      
      const existingProgress = await this.getUserTimerProgress(userId);
      
      const mergedProgress = {
        completedQuestions: {
          ...existingProgress.completedQuestions || {},
          ...newTimerProgress.completedQuestions || {}
        },
        unlockedCategories: {
          Facile: [...new Set([
            ...(existingProgress.unlockedCategories?.Facile || []),
            ...(newTimerProgress.unlockedCategories?.Facile || [])
          ])],
          Moyen: [...new Set([
            ...(existingProgress.unlockedCategories?.Moyen || []),
            ...(newTimerProgress.unlockedCategories?.Moyen || [])
          ])],
          Difficile: [...new Set([
            ...(existingProgress.unlockedCategories?.Difficile || []),
            ...(newTimerProgress.unlockedCategories?.Difficile || [])
          ])]
        },
        bestScores: {
          Facile: Math.max(existingProgress.bestScores?.Facile || 0, newTimerProgress.bestScores?.Facile || 0),
          Moyen: Math.max(existingProgress.bestScores?.Moyen || 0, newTimerProgress.bestScores?.Moyen || 0),
          Difficile: Math.max(existingProgress.bestScores?.Difficile || 0, newTimerProgress.bestScores?.Difficile || 0)
        }
      };
      
      const result = await db.query(
        `UPDATE progress 
         SET 
           timer_progress = $1,
           last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING timer_progress`,
        [JSON.stringify(mergedProgress), userId]
      );
      
      return mergedProgress;
    } catch (error) {
      log('error', 'Erreur lors de la mise à jour de la progression timer', error);
      throw error;
    }
  }
};

const timerElementsService = {
  async getUserTimerElements(userId) {
    try {
      const result = await db.query(
        'SELECT timer_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      let timerElements = [...FUNDAMENTAL_ELEMENTS];
      
      if (result.rows.length > 0) {
        try {
          const savedElements = typeof result.rows[0].timer_elements === 'string'
            ? JSON.parse(result.rows[0].timer_elements)
            : result.rows[0].timer_elements || [];
          
          savedElements.forEach(element => {
            if (!timerElements.includes(element)) {
              timerElements.push(element);
            }
          });
        } catch (e) {
          log('error', 'Erreur lors du parsing des éléments du mode Timer', e);
        }
      }
      
      return timerElements;
    } catch (error) {
      log('error', 'Erreur lors de la récupération des éléments timer', error);
      throw error;
    }
  },
  
  async saveUserTimerElements(userId, newElements) {
    try {
      const elementsToAdd = Array.isArray(newElements) ? [...newElements] : [];
      
      const existingElements = await this.getUserTimerElements(userId);
      
      const mergedElements = [...new Set([...existingElements, ...elementsToAdd])];
      
      const existingProgress = await db.query(
        'SELECT timer_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      if (existingProgress.rows.length === 0) {
        await db.query(
          `INSERT INTO progress (
            user_id, 
            timer_elements,
            last_saved
          ) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [
            userId, 
            JSON.stringify(mergedElements)
          ]
        );
      } else {
        await db.query(
          `UPDATE progress 
           SET timer_elements = $1, 
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [JSON.stringify(mergedElements), userId]
        );
      }
      
      return mergedElements;
    } catch (error) {
      log('error', 'Erreur lors de la sauvegarde des éléments timer', error);
      throw error;
    }
  },
  
  async getAllElementEmojis() {
    try {
      const elementEmojis = {...FUNDAMENTAL_EMOJIS};
      
      const result = await db.query(
        'SELECT elements_emojis FROM timer_questions WHERE elements_emojis IS NOT NULL'
      );
      
      result.rows.forEach(row => {
        try {
          if (!row.elements_emojis) return;
          
          const emojisData = typeof row.elements_emojis === 'string'
            ? JSON.parse(row.elements_emojis)
            : row.elements_emojis;
          
          if (emojisData && typeof emojisData === 'object') {
            Object.assign(elementEmojis, emojisData);
          }
        } catch (e) {
          log('error', 'Erreur lors du parsing des emojis depuis timer_questions', e);
        }
      });
      
      return elementEmojis;
    } catch (error) {
      log('error', 'Erreur lors de la récupération des emojis', error);
      throw error;
    }
  },
  
  async getQuestionElements(questionId) {
    try {
      const result = await db.query(
        'SELECT initial_elements, elements_emojis FROM timer_questions WHERE id = $1',
        [questionId]
      );
      
      if (result.rows.length === 0) {
        log('warn', `Question #${questionId} non trouvée`);
        return {
          elements: [...FUNDAMENTAL_ELEMENTS],
          emojis: {...FUNDAMENTAL_EMOJIS}
        };
      }
      
      const row = result.rows[0];
      const questionElements = [...FUNDAMENTAL_ELEMENTS];
      const questionEmojis = {...FUNDAMENTAL_EMOJIS};
      
      try {
        const initialElements = typeof row.initial_elements === 'string'
          ? JSON.parse(row.initial_elements)
          : row.initial_elements;
          
        if (initialElements.required) {
          initialElements.required.forEach(element => {
            if (!questionElements.includes(element)) {
              questionElements.push(element);
            }
          });
        }
        
        if (initialElements.additional) {
          initialElements.additional.forEach(element => {
            if (!questionElements.includes(element)) {
              questionElements.push(element);
            }
          });
        }
        
        if (initialElements.recipes) {
          Object.keys(initialElements.recipes).forEach(result => {
            if (!questionElements.includes(result)) {
              questionElements.push(result);
            }
          });
        }
      } catch (e) {
        log('error', `Erreur de parsing initial_elements pour question ${questionId}:`, e);
      }
      
      try {
        const emojisData = typeof row.elements_emojis === 'string'
          ? JSON.parse(row.elements_emojis)
          : row.elements_emojis || {};
          
        Object.assign(questionEmojis, emojisData);
      } catch (e) {
        log('error', `Erreur de parsing elements_emojis pour question ${questionId}:`, e);
      }
      
      return {
        elements: questionElements,
        emojis: questionEmojis
      };
    } catch (error) {
      log('error', `Erreur lors de la récupération des éléments pour la question #${questionId}`, error);
      throw error;
    }
  },
  
  async getElementsByLevelAndCategory(level, category) {
    try {
      const result = await db.query(
        `SELECT initial_elements, elements_emojis 
         FROM timer_questions 
         WHERE level = $1 AND category = $2`,
        [level, category]
      );
      
      const questionElements = [...FUNDAMENTAL_ELEMENTS];
      const questionEmojis = {...FUNDAMENTAL_EMOJIS};
      
      result.rows.forEach(row => {
        try {
          const initialElements = typeof row.initial_elements === 'string'
            ? JSON.parse(row.initial_elements)
            : row.initial_elements;
          
          if (initialElements.required) {
            initialElements.required.forEach(element => {
              if (!questionElements.includes(element)) {
                questionElements.push(element);
              }
            });
          }
          
          if (initialElements.additional) {
            initialElements.additional.forEach(element => {
              if (!questionElements.includes(element)) {
                questionElements.push(element);
              }
            });
          }
          
          if (initialElements.recipes) {
            Object.keys(initialElements.recipes).forEach(result => {
              if (!questionElements.includes(result)) {
                questionElements.push(result);
              }
            });
          }
          
          const emojisData = typeof row.elements_emojis === 'string'
            ? JSON.parse(row.elements_emojis)
            : row.elements_emojis || {};
          
          Object.assign(questionEmojis, emojisData);
        } catch (e) {
          log('error', `Erreur de parsing pour une question de ${level}/${category}`, e);
        }
      });
      
      return {
        elements: questionElements,
        emojis: questionEmojis
      };
    } catch (error) {
      log('error', `Erreur lors de la récupération des éléments pour ${level}/${category}`, error);
      throw error;
    }
  },
  
  enrichElements(elements, emojis) {
    return elements.map(element => ({
      name: element,
      emoji: emojis[element] || '❓'
    }));
  }
};

const responseHandler = {
  send(res, data, status = 200) {
    return res.status(status).json(data);
  },
  
  error(res, error, message = 'Une erreur est survenue') {
    const status = error.status || 500;
    const errorDetails = process.env.NODE_ENV === 'development' ? error.message : null;
    
    log('error', message, error);
    
    return res.status(status).json({
      success: false,
      message,
      errorDetails
    });
  }
};

async function saveElementsController(req, res) {
  try {
    const userId = req.user.id;
    const { elements = [] } = req.body;
    
    log('info', 'Sauvegarde des éléments du mode Timer', { 
      userId, 
      elementsCount: elements.length 
    });
    
    const savedElements = await timerElementsService.saveUserTimerElements(userId, elements);
    
    return responseHandler.send(res, {
      message: 'Éléments du mode Timer sauvegardés avec succès',
      timerElements: savedElements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors de la sauvegarde des éléments du mode Timer');
  }
}

async function updateTimerProgressController(req, res) {
  try {
    const userId = req.user.id;
    const { timerProgress } = req.body;
    
    log('debug', 'Mise à jour de la progression du timer', { userId });
    
    if (!timerProgress || typeof timerProgress !== 'object') {
      return res.status(400).json({ message: 'La progression du timer est invalide' });
    }
    
    const updatedProgress = await timerProgressService.updateUserTimerProgress(userId, timerProgress);
    
    return responseHandler.send(res, {
      message: 'Progression du timer mise à jour avec succès',
      timerProgress: updatedProgress
    });
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors de la mise à jour de la progression du timer');
  }
}

async function loadProgressController(req, res) {
  try {
    const userId = req.user.id;
    const timerProgress = await timerProgressService.getUserTimerProgress(userId);
    
    return responseHandler.send(res, timerProgress);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement de la progression');
  }
}

async function loadElementsController(req, res) {
  try {
    const userId = req.user.id;
    
    const questionId = req.query.questionId;
    const level = req.query.level;
    const category = req.query.category;
    
    log('debug', 'Chargement des éléments du mode Timer', { 
      userId, 
      questionId, 
      level, 
      category 
    });
    
    let timerElements;
    let elementEmojis;
    
    // Si un ID de question est fourni, charger ses éléments spécifiques
    if (questionId) {
      const questionData = await timerElementsService.getQuestionElements(questionId);
      timerElements = questionData.elements;
      elementEmojis = questionData.emojis;
    } 
    // Sinon, filtrer les questions selon le niveau et la catégorie
    else if (level && category) {
      const filteredQuestionData = await timerElementsService.getElementsByLevelAndCategory(level, category);
      timerElements = filteredQuestionData.elements;
      elementEmojis = filteredQuestionData.emojis;
    } 
    // Si aucun filtre, charger tous les éléments
    else {
      timerElements = await timerElementsService.getUserTimerElements(userId);
      elementEmojis = await timerElementsService.getAllElementEmojis();
    }
    
    // Log pour débogage
    log('debug', `Nombres d'emojis chargés: ${Object.keys(elementEmojis).length}`);
    log('debug', `Nombres d'éléments chargés: ${timerElements.length}`);
    
    // Créer la liste enrichie des éléments
    const enrichedTimerElements = timerElementsService.enrichElements(timerElements, elementEmojis);
    
    return responseHandler.send(res, {
      timerElements,
      enrichedTimerElements,
      elementEmojis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement des éléments du mode Timer');
  }
}

// ----------------------------------------
// ROUTES
// ----------------------------------------

// Route pour sauvegarder les éléments découverts
router.post('/save-elements', authMiddleware, timerRateLimiter, saveElementsController);

// Route pour mettre à jour la progression
router.post('/update-timer-progress', authMiddleware, updateTimerProgressController);

// Route pour charger la progression
router.get('/load-progress', authMiddleware, loadProgressController);

// Route pour charger les éléments disponibles
router.get('/load-elements', authMiddleware, timerRateLimiter, loadElementsController);

module.exports = router;