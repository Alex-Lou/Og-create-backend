// services/progressService.js
const db = require('../config/db');
const { log } = require('../utils/logger');
const achievementService = require('./achievementService');

// Constants
const FUNDAMENTAL_ELEMENTS = ["Eau", "Feu", "Terre", "Air"];
const FUNDAMENTAL_CATEGORY = "Elements Fondamentaux";
const DEFAULT_TIMER_PROGRESS = {
  completedQuestions: {},
  unlockedCategories: {},
  bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
};

/**
 * Service de gestion de la progression des joueurs
 */
class ProgressService {
  /**
   * Parse une valeur JSON si c'est une chaîne, sinon retourne la valeur
   * @param {*} value - Valeur à parser
   * @param {*} defaultValue - Valeur par défaut si null ou erreur
   * @returns {*} - Valeur parsée
   */
  static parseJsonValue(value, defaultValue = null) {
    if (value === null || value === undefined) return defaultValue;
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        log('error', 'Erreur de parsing JSON', e);
        return defaultValue;
      }
    }
    
    return value;
  }
  
  /**
   * Récupère la progression complète d'un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {string} gameMode - Mode de jeu ('infinite', 'timer', 'explorer')
   * @returns {Object} - Progression de l'utilisateur
   */
  static async getUserProgress(userId, gameMode = 'infinite') {
    try {
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
      
      if (result.rows.length === 0) {
        return this.createDefaultProgress(userId);
      }
      
      const progress = result.rows[0];
      
      // Pré-calculer les éléments une seule fois
      const allFundamentalElements = [...FUNDAMENTAL_ELEMENTS];
      const elementsByMode = {
        'timer': this.parseJsonValue(progress.timer_elements, []),
        'explorer': this.parseJsonValue(progress.explorer_elements, []),
        'infinite': this.parseJsonValue(progress.infinite_elements, [])
      };
      
      const elements = [
        ...new Set([
          ...allFundamentalElements, 
          ...(elementsByMode[gameMode] || [])
        ])
      ];
      
      // Utiliser le service achievements pour récupérer les achievements
      const mergedAchievements = await achievementService.getUserAchievements(userId);
      
      return {
        discoveredElements: elements,
        discoveredCategories: progress.discovered_categories || [FUNDAMENTAL_CATEGORY],
        achievements: mergedAchievements,
        categoryProgress: this.parseJsonValue(
          progress.category_progress,
          { [FUNDAMENTAL_CATEGORY]: 100 }
        ),
        coins: progress.coins || 0,
        timerProgress: this.parseJsonValue(progress.timer_progress, DEFAULT_TIMER_PROGRESS),
        explorerElements: this.parseJsonValue(progress.explorer_elements, []),
        lastSaved: progress.last_saved
      };
    } catch (error) {
      log('error', 'Erreur lors de la récupération de la progression', error);
      throw error;
    }
  }
  
  /**
   * Crée une progression par défaut pour un nouvel utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @returns {Object} - Progression par défaut
   */
  static async createDefaultProgress(userId) {
    try {
      // Initialiser les valeurs par défaut
      const defaultCategoryProgress = { [FUNDAMENTAL_CATEGORY]: 100 };
      
      // Récupérer les achievements depuis le service centralisé
      const allAchievements = await achievementService.getAllAchievements();
      const defaultAchievements = {};
      
      allAchievements.forEach(achievement => {
        defaultAchievements[achievement.name] = {
          unlocked: false,
          unlockedAt: null
        };
      });
      
      // Insérer la progression par défaut dans la base de données
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
          JSON.stringify(FUNDAMENTAL_ELEMENTS),
          [FUNDAMENTAL_CATEGORY],
          JSON.stringify(defaultAchievements),
          JSON.stringify(defaultCategoryProgress),
          0,
          JSON.stringify(DEFAULT_TIMER_PROGRESS),
          JSON.stringify([]),
          JSON.stringify([])
        ]
      );
      
      const inserted = newProgress.rows[0];
      
      return {
        discoveredElements: FUNDAMENTAL_ELEMENTS,
        discoveredCategories: [FUNDAMENTAL_CATEGORY],
        achievements: defaultAchievements,
        categoryProgress: defaultCategoryProgress,
        coins: 0,
        timerProgress: DEFAULT_TIMER_PROGRESS,
        explorerElements: [],
        lastSaved: inserted.last_saved
      };
    } catch (error) {
      log('error', 'Erreur lors de la création de la progression par défaut', error);
      throw error;
    }
  }
  
  /**
   * Met à jour les éléments découverts par l'utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Array} newElements - Nouveaux éléments à ajouter
   * @param {string} gameMode - Mode de jeu ('infinite', 'timer', 'explorer')
   * @returns {Object} - Résultat de la mise à jour
   */
  static async updateDiscoveredElements(userId, newElements, gameMode = 'infinite') {
    try {
      // S'assurer que newElements est un tableau
      const elementsToAdd = Array.isArray(newElements) ? [...newElements] : [];
      
      // Toujours inclure les éléments fondamentaux
      FUNDAMENTAL_ELEMENTS.forEach(element => {
        if (!elementsToAdd.includes(element)) {
          elementsToAdd.push(element);
        }
      });
      
      // Récupérer la progression existante
      const progressResult = await db.query(
        `SELECT 
           infinite_elements, 
           explorer_elements, 
           timer_elements,
           category_progress
         FROM progress 
         WHERE user_id = $1`,
        [userId]
      );
      
      let currentElements = [];
      let categoryProgress = { [FUNDAMENTAL_CATEGORY]: 100 };
      
      // Si l'utilisateur a déjà une progression
      if (progressResult.rows.length > 0) {
        const progress = progressResult.rows[0];
        
        // Récupérer les éléments actuels selon le mode de jeu
        if (gameMode === 'infinite') {
          currentElements = this.parseJsonValue(progress.infinite_elements, []);
        } else if (gameMode === 'timer') {
          currentElements = this.parseJsonValue(progress.timer_elements, []);
        } else if (gameMode === 'explorer') {
          currentElements = this.parseJsonValue(progress.explorer_elements, []);
        }
        
        // Récupérer la progression des catégories
        categoryProgress = this.parseJsonValue(
          progress.category_progress,
          { [FUNDAMENTAL_CATEGORY]: 100 }
        );
      }
      
      // Fusionner les éléments actuels avec les nouveaux
      const mergedElements = [...new Set([...currentElements, ...elementsToAdd])];
      
      // S'assurer que les éléments fondamentaux sont présents
      FUNDAMENTAL_ELEMENTS.forEach(element => {
        if (!mergedElements.includes(element)) {
          mergedElements.push(element);
        }
      });
      
      // Déterminer les colonnes à mettre à jour selon le mode de jeu
      const columnToUpdate = gameMode === 'timer' 
        ? 'timer_elements' 
        : (gameMode === 'explorer' ? 'explorer_elements' : 'infinite_elements');
      
      // Si l'utilisateur existe déjà dans la table progress
      if (progressResult.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET ${columnToUpdate} = $1,
               category_progress = $2,
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [
            JSON.stringify(mergedElements),
            JSON.stringify({ ...categoryProgress, [FUNDAMENTAL_CATEGORY]: 100 }),
            userId
          ]
        );
      } else {
        // Créer une nouvelle entrée selon le mode de jeu
        const infiniteElements = gameMode === 'infinite' ? mergedElements : FUNDAMENTAL_ELEMENTS;
        const timerElements = gameMode === 'timer' ? mergedElements : [];
        const explorerElements = gameMode === 'explorer' ? mergedElements : [];
        
        await db.query(
          `INSERT INTO progress (
             user_id, 
             discovered_categories,
             category_progress,
             infinite_elements,
             timer_elements,
             explorer_elements,
             last_saved
           ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            userId,
            [FUNDAMENTAL_CATEGORY],
            JSON.stringify({ ...categoryProgress, [FUNDAMENTAL_CATEGORY]: 100 }),
            JSON.stringify(infiniteElements),
            JSON.stringify(timerElements),
            JSON.stringify(explorerElements)
          ]
        );
      }

      // Après avoir mis à jour les éléments, vérifier les achievements
      await achievementService.checkAndUpdateAchievements(userId, mergedElements);
      
      return {
        message: 'Éléments mis à jour avec succès',
        elements: mergedElements,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log('error', 'Erreur lors de la mise à jour des éléments découverts', error);
      throw error;
    }
  }
  
  /**
   * Met à jour la progression du timer pour un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Object} timerProgress - Progression du timer à mettre à jour
   * @returns {Object} - Progression mise à jour
   */
  static async updateTimerProgress(userId, timerProgress) {
    try {
      // Vérifier que les données sont valides
      if (!timerProgress || typeof timerProgress !== 'object') {
        throw new Error('Les données de progression du timer sont invalides');
      }
      
      // Récupérer la progression actuelle du timer
      const result = await db.query(
        'SELECT timer_progress FROM progress WHERE user_id = $1',
        [userId]
      );
      
      let currentTimerProgress = DEFAULT_TIMER_PROGRESS;
      
      if (result.rows.length > 0 && result.rows[0].timer_progress) {
        currentTimerProgress = this.parseJsonValue(result.rows[0].timer_progress, DEFAULT_TIMER_PROGRESS);
      }
      
      // Fusionner les données existantes avec les nouvelles données
      const mergedProgress = {
        completedQuestions: {
          ...currentTimerProgress.completedQuestions || {},
          ...timerProgress.completedQuestions || {}
        },
        unlockedCategories: {
          Facile: [...new Set([
            ...(currentTimerProgress.unlockedCategories?.Facile || []),
            ...(timerProgress.unlockedCategories?.Facile || [])
          ])],
          Moyen: [...new Set([
            ...(currentTimerProgress.unlockedCategories?.Moyen || []),
            ...(timerProgress.unlockedCategories?.Moyen || [])
          ])],
          Difficile: [...new Set([
            ...(currentTimerProgress.unlockedCategories?.Difficile || []),
            ...(timerProgress.unlockedCategories?.Difficile || [])
          ])]
        },
        bestScores: {
          Facile: Math.max(currentTimerProgress.bestScores?.Facile || 0, timerProgress.bestScores?.Facile || 0),
          Moyen: Math.max(currentTimerProgress.bestScores?.Moyen || 0, timerProgress.bestScores?.Moyen || 0),
          Difficile: Math.max(currentTimerProgress.bestScores?.Difficile || 0, timerProgress.bestScores?.Difficile || 0)
        }
      };
      
      // Si l'utilisateur existe déjà dans la table progress
      if (result.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET timer_progress = $1,
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [JSON.stringify(mergedProgress), userId]
        );
      } else {
        // Créer une nouvelle entrée avec les valeurs par défaut
        await db.query(
          `INSERT INTO progress (
             user_id,
             timer_progress,
             infinite_elements,
             timer_elements,
             explorer_elements,
             discovered_categories,
             category_progress,
             last_saved
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            userId,
            JSON.stringify(mergedProgress),
            JSON.stringify(FUNDAMENTAL_ELEMENTS),
            JSON.stringify([]),
            JSON.stringify([]),
            [FUNDAMENTAL_CATEGORY],
            JSON.stringify({ [FUNDAMENTAL_CATEGORY]: 100 })
          ]
        );
      }
      
      return mergedProgress;
    } catch (error) {
      log('error', 'Erreur lors de la mise à jour de la progression du timer', error);
      throw error;
    }
  }
  
  /**
   * Sauvegarde la progression complète de l'utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Object} progressData - Données de progression à sauvegarder
   * @returns {Object} - Résultat de la sauvegarde
   */
  static async saveProgress(userId, progressData) {
    try {
      console.log('Données reçues dans saveProgress:', JSON.stringify(progressData, null, 2));
      
      // Vérifier et formater les données pour éviter les erreurs
      let discoveredElements = Array.isArray(progressData.discoveredElements) 
        ? progressData.discoveredElements 
        : (Array.isArray(progressData.elements) ? progressData.elements : FUNDAMENTAL_ELEMENTS);
      
      let categories = Array.isArray(progressData.discoveredCategories) 
        ? progressData.discoveredCategories 
        : [FUNDAMENTAL_CATEGORY];
      
      // S'assurer que la catégorie fondamentale est toujours incluse
      if (!categories.includes(FUNDAMENTAL_CATEGORY)) {
        categories.push(FUNDAMENTAL_CATEGORY);
      }
      
      // Vérifier et formater categoryProgress
      let catProgress = progressData.categoryProgress;
      if (typeof catProgress !== 'object' || catProgress === null) {
        catProgress = { [FUNDAMENTAL_CATEGORY]: 100 };
      } else if (typeof catProgress === 'string') {
        try {
          catProgress = JSON.parse(catProgress);
        } catch (e) {
          catProgress = { [FUNDAMENTAL_CATEGORY]: 100 };
        }
      }
      // S'assurer que la catégorie fondamentale a toujours une progression de 100%
      catProgress[FUNDAMENTAL_CATEGORY] = 100;
      
      // Vérifier et formater coins
      let userCoins = progressData.coins;
      if (typeof userCoins !== 'number' || isNaN(userCoins)) {
        if (typeof userCoins === 'string') {
          userCoins = parseInt(userCoins);
          if (isNaN(userCoins)) userCoins = 0;
        } else {
          userCoins = 0;
        }
      }
      
      // Vérifier et formater timerProgress
      let timerProgressData = progressData.timerProgress;
      if (typeof timerProgressData !== 'object' || timerProgressData === null) {
        timerProgressData = DEFAULT_TIMER_PROGRESS;
      } else if (typeof timerProgressData === 'string') {
        try {
          timerProgressData = JSON.parse(timerProgressData);
        } catch (e) {
          timerProgressData = DEFAULT_TIMER_PROGRESS;
        }
      }
      
      // S'assurer que timerProgress a la structure attendue
      if (!timerProgressData.completedQuestions) timerProgressData.completedQuestions = {};
      if (!timerProgressData.unlockedCategories) timerProgressData.unlockedCategories = {};
      if (!timerProgressData.bestScores) {
        timerProgressData.bestScores = {
          Facile: 0,
          Moyen: 0,
          Difficile: 0
        };
      } else {
        // S'assurer que tous les niveaux sont présents
        if (typeof timerProgressData.bestScores.Facile !== 'number') timerProgressData.bestScores.Facile = 0;
        if (typeof timerProgressData.bestScores.Moyen !== 'number') timerProgressData.bestScores.Moyen = 0;
        if (typeof timerProgressData.bestScores.Difficile !== 'number') timerProgressData.bestScores.Difficile = 0;
      }
      
      // Déterminer le mode de jeu
      const gameMode = progressData.gameMode || 'infinite';
      
      // Déterminer le nom de colonne pour les éléments selon le mode de jeu
      const columnName = gameMode === 'timer' ? 'timer_elements' : 'infinite_elements';
      
      // Vérifier si l'utilisateur a déjà une entrée dans la table progress
      const existingProgress = await db.query(
        `SELECT id, ${columnName} FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      // Préparer les données à sauvegarder
      let elementsToSave = discoveredElements;
      
      // Si l'utilisateur existe déjà, fusionner les données
      if (existingProgress.rows.length > 0) {
        // Récupérer les éléments existants
        let existingElements = existingProgress.rows[0][columnName];
        if (typeof existingElements === 'string') {
          try {
            existingElements = JSON.parse(existingElements);
          } catch (e) {
            existingElements = [];
          }
        }
        if (!Array.isArray(existingElements)) existingElements = [];
        
        // Fusionner et dédupliquer
        elementsToSave = [...new Set([...existingElements, ...discoveredElements])];
      }
      
      // Gérer les achievements via le service dédié
      let achievements = progressData.achievements || {};
      try {
        await achievementService.updateUserAchievements(userId, achievements);
      } catch (error) {
        console.error('Erreur lors de la mise à jour des achievements:', error);
        // Continuer malgré l'erreur
      }
      
      // Sauvegarder la progression
      if (existingProgress.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET 
             ${columnName} = $1,
             discovered_categories = $2,
             category_progress = $3,
             coins = $4,
             timer_progress = $5,
             last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $6`,
          [
            JSON.stringify(elementsToSave),
            categories,
            JSON.stringify(catProgress),
            userCoins,
            JSON.stringify(timerProgressData),
            userId
          ]
        );
      } else {
        // Créer une nouvelle entrée avec les valeurs par défaut selon le mode de jeu
        const emptyArray = JSON.stringify([]);
        const elementsJson = JSON.stringify(elementsToSave);
        let infiniteElementsValue = gameMode === 'infinite' ? elementsJson : JSON.stringify(FUNDAMENTAL_ELEMENTS);
        let timerElementsValue = gameMode === 'timer' ? elementsJson : emptyArray;
        
        await db.query(
          `INSERT INTO progress (
             user_id,
             infinite_elements,
             timer_elements,
             discovered_categories,
             category_progress,
             coins,
             timer_progress,
             last_saved
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            userId,
            infiniteElementsValue,
            timerElementsValue,
            categories,
            JSON.stringify(catProgress),
            userCoins,
            JSON.stringify(timerProgressData)
          ]
        );
      }
      
      // Vérifier si de nouveaux achievements ont été débloqués
      try {
        await achievementService.checkAndUpdateAchievements(userId, elementsToSave);
      } catch (error) {
        console.error('Erreur lors de la vérification des achievements:', error);
        // Continuer malgré l'erreur
      }
      
      return {
        message: 'Progression sauvegardée avec succès',
        lastSaved: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur détaillée lors de la sauvegarde de la progression:', error);
      log('error', 'Erreur lors de la sauvegarde de la progression', error);
      throw error;
    }
  }
  
  /**
   * Met à jour les éléments du timer pour un utilisateur
   * @param {number} userId - ID de l'utilisateur 
   * @param {Array} elements - Éléments à sauvegarder
   * @returns {Object} - Résultat de la mise à jour
   */
  static async saveTimerElements(userId, elements) {
    try {
      // S'assurer que elements est un tableau
      const elementsToSave = Array.isArray(elements) ? [...elements] : [];
      
      // Récupérer les éléments timer existants
      const existingProgress = await db.query(
        'SELECT timer_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      let mergedElements = [...elementsToSave];
      
      // Si l'utilisateur a déjà des éléments timer
      if (existingProgress.rows.length > 0) {
        const existingElements = this.parseJsonValue(existingProgress.rows[0].timer_elements, []);
        mergedElements = [...new Set([...existingElements, ...elementsToSave])];
      }
      
      // Sauvegarder les éléments timer
      if (existingProgress.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET timer_elements = $1, 
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [JSON.stringify(mergedElements), userId]
        );
      } else {
        // Créer une nouvelle entrée avec les valeurs par défaut
        await db.query(
          `INSERT INTO progress (
             user_id, 
             timer_elements,
             infinite_elements,
             discovered_categories,
             category_progress,
             last_saved
           ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            userId, 
            JSON.stringify(mergedElements),
            JSON.stringify(FUNDAMENTAL_ELEMENTS),
            [FUNDAMENTAL_CATEGORY],
            JSON.stringify({ [FUNDAMENTAL_CATEGORY]: 100 })
          ]
        );
      }
      
      // Vérifier si de nouveaux achievements ont été débloqués
      await achievementService.checkAndUpdateAchievements(userId, mergedElements);
      
      return {
        message: 'Éléments du timer sauvegardés avec succès',
        timerElements: mergedElements,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log('error', 'Erreur lors de la sauvegarde des éléments du timer', error);
      throw error;
    }
  }
}

module.exports = ProgressService;