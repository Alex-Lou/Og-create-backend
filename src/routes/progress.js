// routes/progressController.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { log } = require('../utils/logger');
const ProgressService = require('../services/progressService');

// ----------------------------------------
// CONFIGURATION
// ----------------------------------------

// Rate Limiter pour éviter les abus
const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

// File d'attente de sauvegarde pour éviter les conflits
const saveQueue = {};

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
// HELPERS
// ----------------------------------------

/**
 * Traite la file d'attente de sauvegarde pour un utilisateur
 * @param {number} userId - ID de l'utilisateur
 */
const processSaveQueue = async (userId) => {
  if (saveQueue[userId] && saveQueue[userId].length > 0) {
    const { data, resolve, reject } = saveQueue[userId].shift();
    
    try {
      const result = await ProgressService.saveProgress(userId, data);
      resolve(result);
    } catch (error) {
      log('error', 'Erreur lors du traitement de la queue', error);
      reject(error);
    } finally {
      // Traiter le prochain élément de la file d'attente s'il y en a
      if (saveQueue[userId] && saveQueue[userId].length > 0) {
        setTimeout(() => processSaveQueue(userId), 300);
      }
    }
  }
};

// ----------------------------------------
// CONTRÔLEURS
// ----------------------------------------

/**
 * Charge la progression d'un utilisateur
 */
async function loadProgressController(req, res) {
  try {
    const userId = req.user.id;
    const gameMode = req.query.gameMode || 'infinite';
    
    log('debug', 'Chargement de la progression', { userId, gameMode });
    
    const progress = await ProgressService.getUserProgress(userId, gameMode);
    
    return responseHandler.send(res, progress);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement de la progression');
  }
}

/**
 * Sauvegarde la progression d'un utilisateur
 */
async function saveProgressController(req, res) {
  try {
    const userId = req.user.id;
    
    log('info', 'Requête de sauvegarde reçue', { userId });
    
    // Utiliser une file d'attente pour éviter les conflits
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
    return responseHandler.send(res, result);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors de la sauvegarde de la progression');
  }
}

/**
 * Met à jour les éléments découverts par l'utilisateur
 */
async function updateDiscoveredElementsController(req, res) {
  try {
    const userId = req.user.id;
    const { discoveredElements, elements, gameMode = 'infinite' } = req.body;
    
    // Utiliser discoveredElements ou elements selon ce qui est fourni
    const elementsToUpdate = discoveredElements || elements || [];
    
    log('debug', 'Mise à jour des éléments découverts', { 
      userId, 
      elementsCount: elementsToUpdate.length,
      gameMode
    });
    
    const result = await ProgressService.updateDiscoveredElements(
        userId,
        elementsToUpdate,
        gameMode
    );
      
    return responseHandler.send(res, result);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors de la mise à jour des éléments découverts');
  }
  }
  
  /**
   * Met à jour la progression du timer d'un utilisateur
   */
  async function updateTimerProgressController(req, res) {
    try {
      const userId = req.user.id;
      const { timerProgress } = req.body;
      
      log('debug', 'Mise à jour de la progression du timer', { userId });
      
      if (!timerProgress || typeof timerProgress !== 'object') {
        return res.status(400).json({ message: 'La progression du timer est invalide' });
      }
      
      const result = await ProgressService.updateTimerProgress(userId, timerProgress);
      return responseHandler.send(res, {
        message: 'Progression du timer mise à jour avec succès',
        timerProgress: result
      });
    } catch (error) {
      return responseHandler.error(res, error, 'Erreur lors de la mise à jour de la progression du timer');
    }
  }
  
  /**
   * Sauvegarde les éléments du timer pour un utilisateur
   */
  async function saveTimerElementsController(req, res) {
    try {
      const userId = req.user.id;
      const { elements = [] } = req.body;
      
      log('info', 'Sauvegarde des éléments du mode Timer', { 
        userId, 
        elementsCount: elements.length 
      });
      
      const result = await ProgressService.saveTimerElements(userId, elements);
      return responseHandler.send(res, result);
    } catch (error) {
      return responseHandler.error(res, error, 'Erreur lors de la sauvegarde des éléments du timer');
    }
  }
  
  // ----------------------------------------
  // ROUTES
  // ----------------------------------------
  
  // Route pour charger la progression
  router.get('/load', authMiddleware, progressRateLimiter, loadProgressController);
  
  // Route pour sauvegarder la progression complète
  router.post('/save', authMiddleware, progressRateLimiter, saveProgressController);
  
  // Route pour mettre à jour les éléments découverts
  router.post('/update-discovered-elements', authMiddleware, progressRateLimiter, updateDiscoveredElementsController);
  
  // Compatibilité avec le ancien nom (update)
  router.post('/update', authMiddleware, progressRateLimiter, updateDiscoveredElementsController);
  
  // Routes pour le timer
  router.post('/update-timer-progress', authMiddleware, progressRateLimiter, updateTimerProgressController);
  router.post('/save-elements', authMiddleware, progressRateLimiter, saveTimerElementsController);
  
  module.exports = router;