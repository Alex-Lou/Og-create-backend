const db = require('../config/db');
const { log } = require('../utils/logger');
const { isConditionMet } = require('../utils/achievementCondition');

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
   * Recalcule les succès d'un joueur depuis ses découvertes enregistrées (mode Infini).
   * Le client ne fait que demander une vérification : un succès n'est débloqué que si sa
   * condition est remplie côté serveur. `claimed` sert seulement à garder la date affichée.
   * @param {number} userId
   * @param {Object} claimed - { "<nom>": { unlockedAt } } envoyés par le client (facultatif)
   * @returns {{ achievements: Object, newlyUnlocked: Array }}
   */
  static async syncAchievements(userId, claimed = {}) {
    if (!userId) throw new Error('ID utilisateur requis');
    const { rows } = await db.query('SELECT achievements, infinite_elements FROM progress WHERE user_id = $1', [userId]);
    if (!rows.length) return { achievements: {}, newlyUnlocked: [] };

    const current = this.parseJsonValue(rows[0].achievements, {});
    const discovered = this.parseJsonValue(rows[0].infinite_elements, []);
    const updated = { ...current };
    const newlyUnlocked = [];
    for (const achievement of await this.getAllAchievements()) {
      if (updated[achievement.name]?.unlocked || !isConditionMet(achievement.condition, discovered)) continue;
      const claimedAt = Date.parse(claimed?.[achievement.name]?.unlockedAt);
      const unlockedAt = Number.isNaN(claimedAt) || claimedAt > Date.now() ? new Date().toISOString() : new Date(claimedAt).toISOString();
      updated[achievement.name] = { unlocked: true, unlockedAt };
      newlyUnlocked.push({ ...achievement, unlockedAt });
    }
    if (newlyUnlocked.length) {
      await db.query('UPDATE progress SET achievements = $1, last_saved = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(updated), userId]);
    }
    return { achievements: updated, newlyUnlocked };
  }

  // Compatibilité des routes existantes : les deux recalculent depuis le serveur
  static async checkAndUpdateAchievements(userId) {
    return this.syncAchievements(userId);
  }

  static async updateUserAchievements(userId, achievements) {
    const result = await this.syncAchievements(userId, achievements);
    return { message: 'Succès vérifiés', ...result, timestamp: new Date().toISOString() };
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