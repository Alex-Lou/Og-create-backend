// Fichier: routes/timerService.js
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
  // Récupère la progression timer d'un utilisateur
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
  
  // Met à jour la progression timer d'un utilisateur
  async updateUserTimerProgress(userId, newTimerProgress) {
    try {
      // Vérifier que les données sont valides
      if (!newTimerProgress || typeof newTimerProgress !== 'object') {
        throw new Error('Les données de progression sont invalides');
      }
      
      // Récupérer les données existantes de la progression
      const existingProgress = await this.getUserTimerProgress(userId);
      
      // Fusionner les données existantes avec les nouvelles données
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
      
      // Enregistrer dans la base de données
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
  // Récupère les éléments du timer pour un utilisateur
  async getUserTimerElements(userId) {
    try {
      const result = await db.query(
        'SELECT timer_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Éléments fondamentaux toujours disponibles
      let timerElements = [...FUNDAMENTAL_ELEMENTS];
      
      // Ajouter les éléments sauvegardés de l'utilisateur
      if (result.rows.length > 0) {
        try {
          const savedElements = typeof result.rows[0].timer_elements === 'string'
            ? JSON.parse(result.rows[0].timer_elements)
            : result.rows[0].timer_elements || [];
          
          // Fusionner sans dupliquer
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
  
  // Sauvegarde les éléments du timer pour un utilisateur
  async saveUserTimerElements(userId, newElements) {
    try {
      // Valider les éléments reçus
      const elementsToAdd = Array.isArray(newElements) ? [...newElements] : [];
      
      // Récupérer les éléments existants
      const existingElements = await this.getUserTimerElements(userId);
      
      // Fusionner sans dupliquer
      const mergedElements = [...new Set([...existingElements, ...elementsToAdd])];
      
      // Vérifier si l'utilisateur a déjà une entrée dans la table progress
      const existingProgress = await db.query(
        'SELECT timer_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Enregistrer dans la base de données
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
  
  // Récupère les emojis pour tous les éléments
  async getAllElementEmojis() {
    try {
      // Commencer avec les emojis fondamentaux
      const elementEmojis = {...FUNDAMENTAL_EMOJIS};
      
      // Récupérer tous les emojis des questions
      const result = await db.query(
        'SELECT elements_emojis FROM timer_questions WHERE elements_emojis IS NOT NULL'
      );
      
      // Parcourir tous les enregistrements
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
  
  // Récupère les éléments spécifiques à une question
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
      
      // Récupérer les éléments spécifiques à cette question
      try {
        const initialElements = typeof row.initial_elements === 'string'
          ? JSON.parse(row.initial_elements)
          : row.initial_elements;
          
        // Extraire les éléments requis et additionnels
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
        
        // Si nous avons des recettes, inclure les résultats possibles
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
      
      // Récupérer les emojis spécifiques à cette question
      try {
        const emojisData = typeof row.elements_emojis === 'string'
          ? JSON.parse(row.elements_emojis)
          : row.elements_emojis || {};
          
        // Ajouter ces emojis au mapping
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
  
  // Génère la liste enrichie des éléments (avec emojis)
  enrichElements(elements, emojis) {
    return elements.map(element => ({
      name: element,
      emoji: emojis[element] || '❓' // Emoji par défaut si non trouvé
    }));
  }
};

// ----------------------------------------
// GESTIONNAIRE DE RÉPONSES STANDARDISÉ
// ----------------------------------------

const responseHandler = {
  // Envoyer une réponse standard
  send(res, data, status = 200) {
    return res.status(status).json(data);
  },
  
  // Gérer les erreurs de manière cohérente
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

// ----------------------------------------
// CONTRÔLEURS
// ----------------------------------------

// Contrôleur pour sauvegarder les éléments découverts par l'utilisateur
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

// Contrôleur pour mettre à jour la progression du timer
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

// Contrôleur pour charger la progression du timer
async function loadProgressController(req, res) {
  try {
    const userId = req.user.id;
    const timerProgress = await timerProgressService.getUserTimerProgress(userId);
    
    return responseHandler.send(res, timerProgress);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement de la progression');
  }
}

// Contrôleur pour charger les éléments disponibles
async function loadElementsController(req, res) {
  try {
    const userId = req.user.id;
    // Récupérer l'ID de la question actuelle (envoyé en query parameter)
    const questionId = req.query.questionId;
    
    log('debug', 'Chargement des éléments du mode Timer', { userId, questionId });
    
    let timerElements;
    let elementEmojis;
    
    // Si un ID de question est fourni, ne récupérer que les éléments de cette question
    if (questionId) {
      const questionData = await timerElementsService.getQuestionElements(questionId);
      timerElements = questionData.elements;
      elementEmojis = questionData.emojis;
    } else {
      // Sinon, récupérer tous les éléments de l'utilisateur
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