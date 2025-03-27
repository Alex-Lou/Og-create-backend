const db = require('../config/db');
const { log } = require('../utils/logger');

/**
 * Service de gestion des achievements
 */
class AchievementService {
  // Cache pour stocker les achievements
  static cache = {
    achievements: null,
    timestamp: null,
    duration: 5 * 60 * 1000  // 5 minutes en millisecondes
  };

  /**
   * Récupère tous les achievements depuis la base de données
   * @returns {Array} Liste des achievements
   */
  static async getAllAchievements() {
    try {
      // Vérifier si les achievements sont en cache et si le cache est valide
      const now = Date.now();
      if (this.cache.achievements && this.cache.timestamp && 
          (now - this.cache.timestamp < this.cache.duration)) {
        log('debug', 'Utilisation des achievements en cache');
        return this.cache.achievements;
      }

      log('debug', 'Récupération des achievements depuis la base de données');
      
      const result = await db.query(
        'SELECT id, name, description, unlocked, condition, image FROM achievements_list ORDER BY id'
      );
      
      if (result.rows.length === 0) {
        log('warn', 'Aucun achievement trouvé dans la base de données');
        return [];
      }
      
      // Mettre à jour le cache
      this.cache.achievements = result.rows;
      this.cache.timestamp = now;
      
      return result.rows;
    } catch (error) {
      log('error', 'Erreur lors de la récupération des achievements', error);
      throw error;
    }
  }

  /**
   * Récupère les achievements spécifiques à un utilisateur (débloqués ou non)
   * @param {number} userId - ID de l'utilisateur
   * @returns {Object} - Achievements de l'utilisateur
   */
  static async getUserAchievements(userId) {
    try {
      // Récupérer les achievements de l'utilisateur depuis la base de données
      const userProgressResult = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Récupérer tous les achievements
      const allAchievements = await this.getAllAchievements();
      
      let userAchievements = {};
      
      // Si l'utilisateur a des achievements enregistrés
      if (userProgressResult.rows.length > 0 && userProgressResult.rows[0].achievements) {
        userAchievements = this.parseJsonValue(userProgressResult.rows[0].achievements, {});
      }
      
      // Fusionner les achievements de l'utilisateur avec la liste complète
      const mergedAchievements = {};
      
      // Pour chaque achievement, vérifier s'il est débloqué
      for (const achievement of allAchievements) {
        const achievementName = achievement.name;
        const userAchievement = userAchievements[achievementName];
        
        mergedAchievements[achievementName] = {
          ...achievement,
          unlocked: userAchievement ? userAchievement.unlocked || false : false,
          unlockedAt: userAchievement ? userAchievement.unlockedAt || null : null
        };
      }
      
      return mergedAchievements;
    } catch (error) {
      log('error', 'Erreur lors de la récupération des achievements de l\'utilisateur', error);
      throw error;
    }
  }

  /**
   * Vérifie et met à jour les achievements débloqués par l'utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Array} discoveredElements - Éléments découverts par l'utilisateur
   * @returns {Object} - Achievements mis à jour et liste de nouveaux achievements débloqués
   */
  static async checkAndUpdateAchievements(userId, discoveredElements) {
    try {
      // Vérifier les entrées
      if (!userId) {
        throw new Error('ID utilisateur requis');
      }
      
      if (!discoveredElements || !Array.isArray(discoveredElements)) {
        discoveredElements = [];
      }
      
      // Récupérer tous les achievements
      const allAchievements = await this.getAllAchievements();
      
      // Récupérer les achievements actuels de l'utilisateur
      const currentProgress = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      let currentAchievements = {};
      if (currentProgress.rows.length > 0) {
        currentAchievements = this.parseJsonValue(currentProgress.rows[0].achievements, {});
      }
      
      // Créer un contexte d'évaluation pour les conditions
      const evaluationContext = {
        discoveredElements: discoveredElements || [],
        elementsCount: discoveredElements ? discoveredElements.length : 0,
        hasElement: (element) => Array.isArray(discoveredElements) && discoveredElements.includes(element),
        hasAllElements: (elements) => {
          if (!Array.isArray(elements) || !Array.isArray(discoveredElements)) return false;
          return elements.every(element => discoveredElements.includes(element));
        },
        hasAnyElement: (elements) => {
          if (!Array.isArray(elements) || !Array.isArray(discoveredElements)) return false;
          return elements.some(element => discoveredElements.includes(element));
        }
      };
      
      const updatedAchievements = { ...currentAchievements };
      const newlyUnlocked = [];
      
      // Vérifier chaque achievement
      for (const achievement of allAchievements) {
        const achievementName = achievement.name;
        const currentStatus = currentAchievements[achievementName] || { unlocked: false, unlockedAt: null };
        
        // Si l'achievement est déjà débloqué, passer au suivant
        if (currentStatus.unlocked) {
          continue;
        }
        
        // Vérifier que la condition est définie et non vide
        if (!achievement.condition || typeof achievement.condition !== 'string' || achievement.condition.trim() === '') {
          continue;
        }
        
        // Évaluer la condition (méthode alternative plus sûre)
        let isUnlocked = false;
        
        try {
          // MÉTHODE ALTERNATIVE: Utiliser une évaluation manuelle plus simple
          // Cela évite les problèmes de syntaxe dans les conditions
          
          // Quelques exemples de conditions simples que nous pouvons gérer
          const condition = achievement.condition.trim().toLowerCase();
          
          if (condition.includes('discoveredelements.length') || condition.includes('elementcount')) {
            // Condition basée sur le nombre d'éléments découverts
            const requiredCount = 
              parseInt(condition.match(/\d+/)?.[0]) || 
              parseInt(condition.match(/\>=\s*(\d+)/)?.[1]) || 
              parseInt(condition.match(/\>\s*(\d+)/)?.[1]) || 
              50; // Valeur par défaut si on ne peut pas extraire un nombre
            
            isUnlocked = discoveredElements.length >= requiredCount;
          }
          else if (condition.includes('includes(')) {
            // Condition basée sur un élément spécifique
            // Extraire les noms entre guillemets
            const matches = condition.match(/'([^']+)'|"([^"]+)"/g);
            if (matches && matches.length > 0) {
              const requiredElements = matches.map(m => 
                m.replace(/['"]/g, '') // Supprimer les guillemets
              );
              
              if (condition.includes('every') || condition.includes('all')) {
                // Tous les éléments doivent être présents
                isUnlocked = requiredElements.every(el => 
                  discoveredElements.includes(el)
                );
              } else {
                // Au moins un élément doit être présent
                isUnlocked = requiredElements.some(el => 
                  discoveredElements.includes(el)
                );
              }
            }
          }
          else if (condition.includes('haselement(')) {
            // Utiliser notre fonction hasElement
            const match = condition.match(/haselement\(['"](.*?)['"]/) || 
                          condition.match(/haselement\((.*?)\)/);
            if (match && match[1]) {
              isUnlocked = evaluationContext.hasElement(match[1]);
            }
          }
          else {
            // Si nous ne pouvons pas analyser la condition manuellement, 
            // essayer l'ancienne méthode en masquant les erreurs
            try {
              const correctedCondition = achievement.condition
                .replace(/\bdiscoveredElements\b/g, 'ctx.discoveredElements')
                .replace(/\binclude\(/g, 'includes(')
                .replace(/\bincludes\(/g, 'includes(')
                .replace(/\belementsCount\b/g, 'ctx.elementsCount');
              
              // Simplifier l'évaluation
              const fn = new Function('ctx', `
                try {
                  return Boolean(${correctedCondition});
                } catch(e) {
                  return false;
                }
              `);
              
              isUnlocked = fn(evaluationContext);
            } catch (innerError) {
              // Ignorer silencieusement cette erreur
            }
          }
        } catch (error) {
          // Ne pas afficher ces erreurs pour réduire le bruit dans les logs
          continue;
        }
        
        // Si la condition est remplie, débloquer l'achievement
        if (isUnlocked) {
          const timestamp = new Date().toISOString();
          updatedAchievements[achievementName] = {
            unlocked: true,
            unlockedAt: timestamp
          };
          
          newlyUnlocked.push({
            ...achievement,
            unlockedAt: timestamp
          });
        }
      }
      
      // Si des achievements ont été débloqués, mettre à jour la base de données
      if (newlyUnlocked.length > 0) {
        // Mise à jour des achievements
        if (currentProgress.rows.length > 0) {
          await db.query(
            `UPDATE progress 
             SET achievements = $1, 
                 last_saved = CURRENT_TIMESTAMP
             WHERE user_id = $2`,
            [JSON.stringify(updatedAchievements), userId]
          );
        } else {
          // Créer une nouvelle entrée si l'utilisateur n'existe pas
          await db.query(
            `INSERT INTO progress (
               user_id, 
               achievements,
               last_saved
             ) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [userId, JSON.stringify(updatedAchievements)]
          );
        }
      }
      
      return {
        achievements: updatedAchievements,
        newlyUnlocked
      };
    } catch (error) {
      // Erreur plus générale - simplement retourner un résultat vide
      return {
        achievements: {},
        newlyUnlocked: []
      };
    }
  }

  /**
   * Met à jour directement les achievements de l'utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Object} achievements - Achievements à mettre à jour
   * @returns {Object} - Achievements mis à jour
   */
  static async updateUserAchievements(userId, achievements) {
    try {
      if (!userId) {
        throw new Error('ID utilisateur requis');
      }
      
      if (!achievements || Object.keys(achievements).length === 0) {
        console.log('Aucun achievement à mettre à jour');
        return {
          message: 'Aucun achievement à mettre à jour',
          achievements: {},
          timestamp: new Date().toISOString()
        };
      }
      
      // Récupérer les achievements actuels
      const currentProgress = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      let currentAchievements = {};
      if (currentProgress.rows.length > 0) {
        currentAchievements = this.parseJsonValue(currentProgress.rows[0].achievements, {});
      }
      
      // Fusionner les achievements
      const updatedAchievements = { 
        ...currentAchievements, 
        ...achievements 
      };
      
      // Mise à jour dans la base de données
      if (currentProgress.rows.length > 0) {
        await db.query(
          `UPDATE progress 
           SET achievements = $1, 
               last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [JSON.stringify(updatedAchievements), userId]
        );
      } else {
        await db.query(
          `INSERT INTO progress (
             user_id, 
             achievements,
             last_saved
           ) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, JSON.stringify(updatedAchievements)]
        );
      }
      
      return {
        message: 'Achievements mis à jour avec succès',
        achievements: updatedAchievements,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log('error', 'Erreur lors de la mise à jour des achievements', error);
      throw error;
    }
  }

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
   * Invalide le cache des achievements
   */
  static invalidateCache() {
    this.cache.achievements = null;
    this.cache.timestamp = null;
    log('debug', 'Cache des achievements invalidé');
  }
}

module.exports = AchievementService;