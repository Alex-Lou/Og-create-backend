// services/progressService.js
const db = require('../config/db');
const { log } = require('../utils/logger');

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
      
      // Mise en cache des achievements pour éviter des requêtes répétées
      const userAchievements = this.parseJsonValue(progress.achievements, {});
      const cachedAchievements = await this.getCachedAchievements();
      
      const mergedAchievements = Object.fromEntries(
        cachedAchievements.map(achievement => [
          achievement.name, 
          userAchievements[achievement.name] || { unlocked: false, unlockedAt: null }
        ])
      );
      
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
  
  // Mise en cache persistant des achievements
  static cachedAchievements = null;
  static async getCachedAchievements() {
    if (!this.cachedAchievements) {
      this.cachedAchievements = await this.fetchAchievementsFromDB();
    }
    return this.cachedAchievements;
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
      
      // Charger les achievements et les initialiser comme non débloqués
      const allAchievements = await this.fetchAchievementsFromDB();
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
      const {
        gameMode = 'infinite',
        elements = FUNDAMENTAL_ELEMENTS,
        discoveredCategories = [FUNDAMENTAL_CATEGORY],
        achievements = {},
        categoryProgress = { [FUNDAMENTAL_CATEGORY]: 100 },
        coins = 0,
        timerProgress = DEFAULT_TIMER_PROGRESS
      } = progressData;
      
      // Déterminer le nom de colonne pour les éléments selon le mode de jeu
      const columnName = gameMode === 'timer' ? 'timer_elements' : 'infinite_elements';
      
      // Vérifier si l'utilisateur a déjà une entrée dans la table progress
      const existingProgress = await db.query(
        `SELECT id, ${columnName}, achievements FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      // Préparer les données à sauvegarder
      let elementsToSave = elements;
      let achievementsToSave = achievements;
      
      // Si l'utilisateur existe déjà, fusionner les données
      if (existingProgress.rows.length > 0) {
        const existingElements = this.parseJsonValue(existingProgress.rows[0][columnName], []);
        elementsToSave = [...new Set([...existingElements, ...elements])];
        
        const existingAchievements = this.parseJsonValue(existingProgress.rows[0].achievements, {});
        achievementsToSave = { ...existingAchievements, ...achievements };
      }
      
      // Sauvegarder la progression
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
            JSON.stringify(timerProgress),
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
            JSON.stringify(achievementsToSave),
            JSON.stringify(categoryProgress),
            coins,
            JSON.stringify(timerProgress)
          ]
        );
      }
      
      return {
        message: 'Progression sauvegardée avec succès',
        lastSaved: new Date().toISOString()
      };
    } catch (error) {
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
  
  /**
   * Récupère tous les achievements depuis la base de données
   * @returns {Array} - Liste des achievements
   */
  static async fetchAchievementsFromDB() {
    try {
      log('debug', 'Récupération des achievements depuis la base de données');
      
      const result = await db.query(
        'SELECT id, name, description, unlocked, condition, image FROM achievements_list ORDER BY id'
      );
      
      if (result.rows.length === 0) {
        log('warn', 'Aucun achievement trouvé dans la base de données');
        return [];
      }
      
      return result.rows;
    } catch (error) {
      log('error', 'Erreur lors de la récupération des achievements', error);
      return [];
    }
  }
  
  /**
   * Fusionne les achievements de l'utilisateur avec ceux de la base de données
   * @param {Object} userAchievements - Achievements de l'utilisateur
   * @returns {Object} - Achievements fusionnés
   */
  static async mergeAchievementsWithUserProgress(userAchievements) {
    try {
      // Récupérer tous les achievements depuis la BD
      const allAchievements = await this.fetchAchievementsFromDB();
      
      // Convertir les achievements de l'utilisateur en format attendu par le frontend
      const formattedAchievements = {};
      
      // Pour chaque achievement de la BD, vérifier s'il est débloqué dans les données de l'utilisateur
      for (const achievement of allAchievements) {
        const achievementKey = achievement.name;
        const userAchievement = userAchievements[achievementKey];
        
        // Si l'utilisateur a débloqué cet achievement, utiliser ses données
        if (userAchievement && userAchievement.unlocked) {
          formattedAchievements[achievementKey] = {
            unlocked: true,
            unlockedAt: userAchievement.unlockedAt || new Date().toISOString()
          };
        } else {
          // Sinon, utiliser les données par défaut
          formattedAchievements[achievementKey] = {
            unlocked: false,
            unlockedAt: null
          };
        }
      }
      
      return formattedAchievements;
    } catch (error) {
      log('error', 'Erreur lors de la fusion des achievements', error);
      return userAchievements || {};
    }
  }
}

module.exports = ProgressService;