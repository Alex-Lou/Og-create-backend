// services/explorerService.js
const db = require('../config/db');
const { log } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Service pour la gestion du mode Explorer du jeu
 */
class ExplorerService {
  /**
   * Calcule l'énergie actuelle en fonction du temps écoulé
   * @param {number} baseEnergy - Énergie de base stockée en DB
   * @param {Date|string} lastUpdate - Date de la dernière mise à jour
   * @param {number} maxEnergy - Énergie maximale
   * @returns {number} - Énergie actuelle
   */
  static calculateCurrentEnergy(baseEnergy, lastUpdate, maxEnergy) {
    const now = new Date();
    const lastUpdateTime = new Date(lastUpdate);
    
    // Calcul du temps écoulé en minutes
    const minutesElapsed = Math.floor((now - lastUpdateTime) / (1000 * 60));
    
    // Regénération : 1 point d'énergie toutes les 30 minutes
    const energyRegained = Math.floor(minutesElapsed / 30);
    
    // Calculer la nouvelle énergie sans dépasser le maximum
    return Math.min(baseEnergy + energyRegained, maxEnergy);
  }

  /**
   * Initialise ou récupère les données du mode Explorer pour un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Données du mode Explorer
   */
  static async initializeExplorer(userId) {
    try {
      // Rechercher les données existantes
      const result = await db.query(
        'SELECT explorer_energy, last_energy_update, max_energy FROM progress WHERE user_id = $1',
        [userId]
      );

      // Si aucune donnée n'existe, en créer une avec des valeurs par défaut
      if (result.rows.length === 0) {
        const defaultEnergy = 10;
        // Récupérer la valeur max_energy depuis les paramètres globaux ou utiliser une valeur par défaut
        const maxEnergyResult = await db.query('SELECT value FROM game_settings WHERE setting_name = $1', ['max_energy']);
        const maxEnergy = maxEnergyResult.rows.length > 0 ? parseInt(maxEnergyResult.rows[0].value) : 20;
        
        const now = new Date();
        const insertResult = await db.query(
          'INSERT INTO progress (user_id, explorer_energy, last_energy_update, max_energy) VALUES ($1, $2, $3, $4) RETURNING explorer_energy, last_energy_update, max_energy',
          [userId, defaultEnergy, now, maxEnergy]
        );
        
        return {
          energy: insertResult.rows[0].explorer_energy,
          last_energy_update: insertResult.rows[0].last_energy_update,
          max_energy: insertResult.rows[0].max_energy,
          next_energy_in: 30
        };
      }

      // Calculer l'énergie actuelle basée sur le temps écoulé
      const storedEnergy = result.rows[0].explorer_energy;
      const lastUpdate = result.rows[0].last_energy_update;
      const maxEnergy = result.rows[0].max_energy || 20;
      const currentEnergy = this.calculateCurrentEnergy(storedEnergy, lastUpdate, maxEnergy);
      
      // Si l'énergie a été régénérée, mettre à jour la base de données
      if (currentEnergy > storedEnergy) {
        const now = new Date();
        await db.query(
          'UPDATE progress SET explorer_energy = $1, last_energy_update = $2 WHERE user_id = $3',
          [currentEnergy, now, userId]
        );
      }
      
      // Calculer le temps restant avant le prochain point d'énergie
      const minutesSinceLastUpdate = Math.floor((new Date() - new Date(lastUpdate)) / (1000 * 60)) % 30;
      const minutesToNextEnergy = 30 - minutesSinceLastUpdate;

      return {
        energy: currentEnergy,
        last_energy_update: lastUpdate,
        max_energy: maxEnergy,
        next_energy_in: minutesToNextEnergy
      };
    } catch (error) {
      log('error', "Erreur lors de l'initialisation du mode Explorer", error);
      throw error;
    }
  }

  /**
   * Récupère les régions disponibles pour un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {number|null} mapId - ID de la carte (optionnel)
   * @returns {Promise<Array>} - Liste des régions
   */
  static async getRegions(userId, mapId = null) {
    try {
      const queryParams = mapId ? [userId, mapId] : [userId];
      const mapCondition = mapId ? 'AND r.map_id = $2' : '';
      
      const result = await db.query(`
        SELECT 
          r.*, 
          ur.visited, 
          ur.completed, 
          ur.progress, 
          ur.required_elements, 
          ur.is_boss, 
          ur.boss_defeated
        FROM explorer_regions r
        LEFT JOIN user_regions ur ON r.id = ur.region_id AND ur.user_id = $1
        WHERE 1=1 ${mapCondition}
        ORDER BY r.required_level ASC, r.name ASC
      `, queryParams);
      
      return result.rows;
    } catch (error) {
      log('error', "Erreur lors de la récupération des régions", error);
      throw error;
    }
  }

  /**
   * Récupère les détails d'une région spécifique
   * @param {number} userId - ID de l'utilisateur
   * @param {number} regionId - ID de la région
   * @returns {Promise<Object>} - Détails de la région
   */
  static async getRegionDetails(userId, regionId) {
    try {
      const result = await db.query(`
        SELECT r.*, ur.visited, ur.completed, ur.progress, ur.required_elements, ur.boss_defeated
        FROM explorer_regions r
        LEFT JOIN user_regions ur ON r.id = ur.region_id AND ur.user_id = $1
        WHERE r.id = $2
      `, [userId, regionId]);
      
      if (result.rows.length === 0) {
        throw { status: 404, message: "Région non trouvée" };
      }
      
      return result.rows[0];
    } catch (error) {
      log('error', "Erreur lors de la récupération des détails de la région", error);
      throw error;
    }
  }

  /**
   * Visite une région (consomme de l'énergie)
   * @param {number} userId - ID de l'utilisateur
   * @param {number} regionId - ID de la région
   * @param {number|null} customEnergyCost - Coût en énergie personnalisé (optionnel)
   * @returns {Promise<Object>} - Résultat de la visite
   */
  static async visitRegion(userId, regionId, customEnergyCost = null) {
    try {
      // Vérifier que la région existe et récupérer ses propriétés
      const regionResult = await db.query('SELECT * FROM explorer_regions WHERE id = $1', [regionId]);
      
      if (regionResult.rows.length === 0) {
        throw { status: 404, message: "Région non trouvée" };
      }
      
      const region = regionResult.rows[0];
      
      // Vérifier si l'utilisateur a déjà complété cette région
      const userRegionResult = await db.query(
        'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
        [userId, regionId]
      );
      
      const alreadyCompleted = userRegionResult.rows.length > 0 && userRegionResult.rows[0].completed;
      
      // Si c'est un boss ou une région déjà complétée, on ne consomme pas d'énergie
      if (region.is_boss || alreadyCompleted) {
        const now = new Date();
        
        if (userRegionResult.rows.length === 0) {
          // Première visite
          await db.query(`
            INSERT INTO user_regions (user_id, region_id, visited, last_visited, is_boss)
            VALUES ($1, $2, TRUE, $3, $4)
          `, [userId, regionId, now, region.is_boss]);
        } else {
          // Visite répétée
          await db.query(`
            UPDATE user_regions 
            SET visited = TRUE, last_visited = $3, is_boss = $4
            WHERE user_id = $1 AND region_id = $2
          `, [userId, regionId, now, region.is_boss]);
        }
        
        // Récupérer l'énergie actuelle
        const progressResult = await db.query(
          'SELECT explorer_energy FROM progress WHERE user_id = $1', 
          [userId]
        );
        
        const currentEnergy = progressResult.rows.length > 0 ? progressResult.rows[0].explorer_energy : 0;
        
        const message = alreadyCompleted ? 
          "Région déjà complétée, aucun coût d'énergie appliqué" : 
          (region.is_boss ? "Combat de boss commencé" : "Visite sans coût d'énergie");
        
        return {
          message,
          energy: currentEnergy,
          region,
          alreadyCompleted
        };
      }
      
      // Utiliser le coût d'énergie fourni ou celui de la région
      if (region.energy_cost === undefined || region.energy_cost === null) {
        throw { status: 400, message: "Erreur: Le coût en énergie n'est pas défini pour cette région" };
      }
      
      const energyCost = customEnergyCost !== null ? customEnergyCost : region.energy_cost;
      
      // Vérifier que la région est débloquée
      if (!region.is_default) {
        const parentRegionId = region.parent_region_id;
        if (parentRegionId) {
          const parentResult = await db.query(
            'SELECT completed FROM user_regions WHERE user_id = $1 AND region_id = $2',
            [userId, parentRegionId]
          );
          
          if (parentResult.rows.length === 0 || !parentResult.rows[0].completed) {
            throw { status: 403, message: "Cette région n'est pas encore débloquée" };
          }
        }
      }
      
      // Vérifier l'énergie disponible
      const progressResult = await db.query(
        'SELECT explorer_energy FROM progress WHERE user_id = $1', 
        [userId]
      );
      
      if (progressResult.rows.length === 0) {
        throw { status: 404, message: "Progression non trouvée" };
      }
      
      const currentEnergy = progressResult.rows[0].explorer_energy;
      
      if (currentEnergy < energyCost) {
        throw { 
          status: 400, 
          message: "Énergie insuffisante pour explorer cette région",
          energy: currentEnergy 
        };
      }
      
      // Débiter l'énergie
      const newEnergy = currentEnergy - energyCost;
      
      await db.query(
        'UPDATE progress SET explorer_energy = $1, last_energy_update = CURRENT_TIMESTAMP WHERE user_id = $2', 
        [newEnergy, userId]
      );
      
      // Enregistrer la visite
      const now = new Date();
      
      if (userRegionResult.rows.length === 0) {
        // Première visite
        await db.query(`
          INSERT INTO user_regions (user_id, region_id, visited, last_visited)
          VALUES ($1, $2, TRUE, $3)
        `, [userId, regionId, now]);
      } else {
        // Visite répétée
        await db.query(`
          UPDATE user_regions 
          SET visited = TRUE, last_visited = $3
          WHERE user_id = $1 AND region_id = $2
        `, [userId, regionId, now]);
      }
      
      return {
        message: "Région visitée avec succès",
        energy: newEnergy,
        region,
        alreadyCompleted: false
      };
    } catch (error) {
      log('error', "Erreur lors de la visite de la région", error);
      throw error;
    }
  }

  /**
   * Marque une région comme complétée
   * @param {number} userId - ID de l'utilisateur
   * @param {number} regionId - ID de la région
   * @param {Object} options - Options de complétion
   * @returns {Promise<Object>} - Résultat de la complétion
   */
  static async completeRegion(userId, regionId, options = {}) {
    const { coins = 0, energy, xp = 0, isBossVictory = false, bossId = null, bossRegionId = null } = options;
    
    try {
      // Vérifier si l'utilisateur a déjà visité cette région
      const userRegionResult = await db.query(
        'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
        [userId, regionId]
      );
      
      if (userRegionResult.rows.length === 0 || !userRegionResult.rows[0].visited) {
        throw { status: 403, message: "Vous devez d'abord visiter cette région" };
      }
      
      // Vérifier si la région est déjà complétée
      const alreadyCompleted = userRegionResult.rows.length > 0 && userRegionResult.rows[0].completed;
      
      // Si déjà complétée, mettre à jour mais sans donner de récompenses
      if (alreadyCompleted && !isBossVictory) {
        // Si c'est une région normale déjà complétée, on ne donne pas de récompenses
        await db.query(`
          UPDATE user_regions
          SET completed = TRUE, progress = 100, last_visited = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND region_id = $2
        `, [userId, regionId]);
        
        // Récupérer l'énergie actuelle pour la renvoyer dans la réponse
        const userProgressResult = await db.query(
          `SELECT coins, explorer_energy FROM progress WHERE user_id = $1`,
          [userId]
        );
        
        const currentCoins = userProgressResult.rows.length > 0 ? userProgressResult.rows[0].coins : 0;
        const currentEnergy = userProgressResult.rows.length > 0 ? userProgressResult.rows[0].explorer_energy : 0;
        
        return {
          message: "Région déjà complétée, aucune récompense donnée",
          completed: true,
          rewards: {
            coins: currentCoins,
            energy: currentEnergy,
            energyReward: 0,
            xp: 0
          },
          alreadyCompleted: true
        };
      }
      
      // Récupérer les informations de la région pour obtenir les récompenses dynamiques
      const regionInfoResult = await db.query(
        'SELECT energy_reward, is_boss FROM explorer_regions WHERE id = $1',
        [regionId]
      );
      
      if (regionInfoResult.rows.length === 0) {
        throw { status: 404, message: "Région non trouvée" };
      }
      
      // Valeur par défaut ou valeur spécifiée ou valeur depuis la base de données
      let energyReward = energy;
      if (energyReward === undefined) {
        // Si la région a une valeur energy_reward définie
        if (regionInfoResult.rows[0].energy_reward !== null && regionInfoResult.rows[0].energy_reward !== undefined) {
          energyReward = regionInfoResult.rows[0].energy_reward;
        } else {
          throw { status: 400, message: "Erreur: La récompense en énergie n'est pas définie pour cette région" };
        }
      }
      
      // 1. Récupérer l'état actuel de l'utilisateur
      const userProgressResult = await db.query(
        `SELECT coins, explorer_energy, max_energy FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      let currentCoins = 0;
      let currentEnergy = 0;
      let maxEnergy = 20; // Valeur par défaut au cas où
      
      if (userProgressResult.rows.length > 0) {
        currentCoins = userProgressResult.rows[0].coins || 0;
        currentEnergy = userProgressResult.rows[0].explorer_energy || 0;
        maxEnergy = userProgressResult.rows[0].max_energy || 20;
      } else {
        // Récupérer la valeur max_energy depuis les paramètres globaux
        const maxEnergyResult = await db.query('SELECT value FROM game_settings WHERE setting_name = $1', ['max_energy']);
        if (maxEnergyResult.rows.length > 0) {
          maxEnergy = parseInt(maxEnergyResult.rows[0].value);
        }
      }
      
      // 2. Calculer les nouvelles valeurs
      const newCoins = currentCoins + coins;
      const newEnergy = Math.min(currentEnergy + energyReward, maxEnergy);
      
      // Distinguer les cas entre une victoire de boss, une région de boss, et une région normale
      if (isBossVictory && bossId) {
        // Cas 1: Région normale mais qui a une victoire de boss associée
        await db.query(`
          UPDATE user_regions
          SET completed = TRUE, progress = 100, is_boss = FALSE, boss_defeated = FALSE
          WHERE user_id = $1 AND region_id = $2
        `, [userId, regionId]);
        
        // Traitons maintenant la région du boss elle-même
        let finalBossRegionId = bossRegionId;
        if (!finalBossRegionId) {
          // Chercher la région de boss correspondante si bossRegionId n'est pas fourni
          const bossRegionResult = await db.query(
            'SELECT id FROM explorer_regions WHERE id = $1 OR is_boss = TRUE',
            [bossId]
          );
          
          if (bossRegionResult.rows.length > 0) {
            finalBossRegionId = bossRegionResult.rows[0].id;
          } else {
            throw { status: 404, message: "Région de boss non trouvée" };
          }
        }
        
        // Vérifier si l'entrée existe déjà pour la région du boss
        const bossRegionResult = await db.query(
          'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
          [userId, finalBossRegionId]
        );
        
        if (bossRegionResult.rows.length === 0) {
          // Créer une nouvelle entrée pour la région du boss
          await db.query(`
            INSERT INTO user_regions (user_id, region_id, visited, completed, progress, is_boss, boss_defeated, last_visited)
            VALUES ($1, $2, TRUE, TRUE, 100, TRUE, TRUE, CURRENT_TIMESTAMP)
          `, [userId, finalBossRegionId]);
        } else {
          // Mettre à jour l'entrée existante
          await db.query(`
            UPDATE user_regions
            SET completed = TRUE, progress = 100, is_boss = TRUE, boss_defeated = TRUE
            WHERE user_id = $1 AND region_id = $2
          `, [userId, finalBossRegionId]);
        }
      } else {
        // Vérifier si la région actuelle est une région de boss
        const isBossRegion = regionInfoResult.rows[0].is_boss;
        
        // Cas 2: C'est la région du boss elle-même
        if (isBossRegion) {
          await db.query(`
            UPDATE user_regions
            SET completed = TRUE, progress = 100, is_boss = TRUE, boss_defeated = TRUE
            WHERE user_id = $1 AND region_id = $2
          `, [userId, regionId]);
        } else {
          // Cas 3: C'est une région normale
          await db.query(`
            UPDATE user_regions
            SET completed = TRUE, progress = 100, is_boss = FALSE, boss_defeated = FALSE
            WHERE user_id = $1 AND region_id = $2
          `, [userId, regionId]);
        }
      }
      
      // Mettre à jour les statistiques (coins, energy, xp) uniquement si la région n'était pas déjà complétée
      if (!alreadyCompleted) {
        await db.query(`
          UPDATE progress
          SET coins = $1, explorer_energy = $2, last_energy_update = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `, [newCoins, newEnergy, userId]);
      }
      
      // Vérifier si cela débloque des régions enfants
      const childRegionsResult = await db.query(
        'SELECT id FROM explorer_regions WHERE parent_region_id = $1',
        [regionId]
      );
      
      return {
        message: alreadyCompleted ? "Région déjà complétée, aucune récompense donnée" : "Région complétée avec succès",
        completed: true,
        rewards: {
          coins: alreadyCompleted ? currentCoins : newCoins,
          energy: alreadyCompleted ? currentEnergy : newEnergy,
          energyReward: alreadyCompleted ? 0 : energyReward,
          xp: alreadyCompleted ? 0 : xp
        },
        unlockedRegions: childRegionsResult.rows.map(row => row.id),
        isBossVictory,
        bossDefeated: isBossVictory && regionInfoResult.rows[0].is_boss,
        alreadyCompleted
      };
    } catch (error) {
      log('error', "Erreur lors de la complétion de la région", error);
      throw error;
    }
  }

  /**
   * Marque un élément comme découvert dans une région
   * @param {number} userId - ID de l'utilisateur
   * @param {number} regionId - ID de la région
   * @param {string} elementName - Nom de l'élément
   * @returns {Promise<Object>} - Résultat de la découverte
   */
  static async discoverElement(userId, regionId, elementName) {
    try {
      // Vérifier si l'utilisateur a déjà visité cette région
      const userRegionResult = await db.query(
        'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
        [userId, regionId]
      );
      
      if (userRegionResult.rows.length === 0 || !userRegionResult.rows[0].visited) {
        throw { status: 403, message: "Vous devez d'abord visiter cette région" };
      }
      
      // Récupérer les éléments déjà découverts
      let requiredElements = userRegionResult.rows[0].required_elements || [];
      
      // Vérifier si l'élément est déjà découvert
      if (requiredElements.includes(elementName)) {
        return {
          message: "Cet élément a déjà été découvert dans cette région",
          required_elements: requiredElements
        };
      }
      
      // Ajouter l'élément aux découvertes
      requiredElements.push(elementName);
      
      // Calculer la progression (% d'éléments découverts sur le total possible)
      const regionResult = await db.query('SELECT unlocked_elements FROM explorer_regions WHERE id = $1', [regionId]);
      const totalElements = regionResult.rows[0].unlocked_elements || [];
      const progress = Math.floor((requiredElements.length / Math.max(totalElements.length, 1)) * 100);
      
      // Vérifier si la région est complétée (tous les éléments découverts)
      const completed = requiredElements.length >= totalElements.length && totalElements.length > 0;
      
      // Mettre à jour la progression
      await db.query(`
        UPDATE user_regions
        SET required_elements = $1, progress = $2, completed = $3
        WHERE user_id = $4 AND region_id = $5
      `, [requiredElements, progress, completed, userId, regionId]);
      
      return {
        message: "Élément découvert avec succès",
        required_elements: requiredElements,
        progress,
        completed
      };
    } catch (error) {
      log('error', "Erreur lors de la découverte de l'élément", error);
      throw error;
    }
  }

  /**
   * Achète de l'énergie avec des pièces
   * @param {number} userId - ID de l'utilisateur
   * @param {number} energyAmount - Quantité d'énergie à acheter
   * @returns {Promise<Object>} - Résultat de l'achat
   */
  static async buyEnergy(userId, energyAmount = 5) {
    const costPerUnit = 10; // 10 pièces par point d'énergie
    
    try {
      // Utiliser une transaction pour garantir la cohérence des données
      await db.query('BEGIN');
      
      try {
        // Toujours récupérer les données les plus à jour DANS la transaction
        const progressResult = await db.query(
          'SELECT coins, explorer_energy, max_energy FROM progress WHERE user_id = $1 FOR UPDATE', 
          [userId]
        );
        
        if (progressResult.rows.length === 0) {
          throw { status: 404, message: "Progression non trouvée" };
        }
        
        const userCoins = progressResult.rows[0].coins;
        const currentEnergy = progressResult.rows[0].explorer_energy;
        const maxEnergy = progressResult.rows[0].max_energy || 20;
        
        // Validation 1: Vérifier l'énergie maximale
        if (currentEnergy >= maxEnergy) {
          throw { 
            status: 400, 
            message: "Votre énergie est déjà au maximum",
            energy: currentEnergy,
            max_energy: maxEnergy
          };
        }
        
        // Calcul du coût total
        const totalCost = energyAmount * costPerUnit;
        
        // Validation 2: Vérifier les pièces
        if (userCoins < totalCost) {
          throw { 
            status: 400, 
            message: `Vous n'avez pas assez de pièces ! ${totalCost} pièces sont nécessaires pour acheter ${energyAmount} point(s) d'énergie.`,
            coins: userCoins,
            cost: totalCost
          };
        }
        
        // Calculer la nouvelle énergie sans dépasser le maximum
        const newEnergy = Math.min(currentEnergy + energyAmount, maxEnergy);
        const actualEnergyAdded = newEnergy - currentEnergy;
        const actualCost = actualEnergyAdded * costPerUnit;
        
        // Mettre à jour l'énergie et les pièces
        await db.query(
          'UPDATE progress SET explorer_energy = $1, coins = coins - $2, last_energy_update = NOW() WHERE user_id = $3',
          [newEnergy, actualCost, userId]
        );
        
        await db.query('COMMIT');
        
        return {
          message: `Vous avez acheté ${actualEnergyAdded} point(s) d'énergie pour ${actualCost} pièces.`,
          energy: newEnergy,
          energy_added: actualEnergyAdded,
          coins_spent: actualCost,
          coins_remaining: userCoins - actualCost,
          max_energy: maxEnergy,
          transaction_id: Date.now() // Identifiant unique pour éviter les doublons côté frontend
        };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      log('error', "Erreur lors de l'achat d'énergie", error);
      throw error;
    }
  }

  /**
   * Abandonne un défi dans une région
   * @param {number} userId - ID de l'utilisateur
   * @param {number} regionId - ID de la région
   * @param {number} energyCost - Coût en énergie de l'abandon
   * @returns {Promise<Object>} - Résultat de l'abandon
   */
  static async abandonChallenge(userId, regionId, energyCost = 0) {
    try {
      // Vérifier si la région existe
      const regionResult = await db.query(
        'SELECT * FROM explorer_regions WHERE id = $1', 
        [regionId]
      );
      
      if (regionResult.rows.length === 0) {
        throw { status: 404, message: "Région non trouvée" };
      }
      
      const region = regionResult.rows[0];
      
      // Si c'est un boss, pas de coût d'énergie
      if (region.is_boss) {
        return {
          message: "Abandon sans coût d'énergie",
          region: region,
          energy: null // On ne connaît pas l'énergie ici
        };
      }
      
// Vérifier l'état actuel de l'énergie
const progressResult = await db.query(
  'SELECT explorer_energy FROM progress WHERE user_id = $1', 
  [userId]
);

if (progressResult.rows.length === 0) {
  throw { status: 404, message: "Progression non trouvée" };
}

const currentEnergy = progressResult.rows[0].explorer_energy;

// Déduire l'énergie si un coût valide est fourni
if (energyCost > 0) {
  // S'assurer que l'énergie ne devient pas négative
  const newEnergy = Math.max(0, currentEnergy - energyCost);
  
  // Utiliser une transaction pour garantir la cohérence des données
  await db.query('BEGIN');
  
  try {
    await db.query(
      'UPDATE progress SET explorer_energy = $1, last_energy_update = CURRENT_TIMESTAMP WHERE user_id = $2', 
      [newEnergy, userId]
    );
    
    await db.query('COMMIT');
    
    return {
      message: "Défi abandonné avec déduction d'énergie",
      energy: newEnergy,
      energyCost: energyCost,
      region: region
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
} else {
  // Si aucun coût n'est spécifié, ne pas déduire d'énergie
  return {
    message: "Défi abandonné sans déduction d'énergie",
    energy: currentEnergy,
    region: region
  };
}
} catch (error) {
log('error', "Erreur lors de l'abandon du défi", error);
throw error;
}
}

/**
* Synchronise les régions depuis le fichier JSON
* @returns {Promise<Object>} - Résultat de la synchronisation
*/
static async syncRegionsFromFile() {
try {
// 1. Lire le fichier JSON
const jsonPath = path.join(process.cwd(), 'public/data/regionChallenges.json');
const regionsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 2. Synchroniser toutes les régions (normales et boss)
for (const region of regionsData.regions) {
  // Vérifier si la région existe déjà
  const existingRegion = await db.query(
    'SELECT id FROM explorer_regions WHERE id = $1',
    [region.id]
  );
  
  // Préparer les éléments requis et disponibles
  const requiredElements = region.requiredElements || [];
  const availableElements = region.availableElements || [];
  
  // Déterminer si c'est un boss
  const isBoss = region.is_boss || false;
  
  // Choix de l'image: pour un boss, utiliser bossImage, sinon background
  const imagePath = isBoss ? region.bossImage : region.background;
  
  // Récupérer les coûts et récompenses d'énergie
  const energyCost = isBoss ? 0 : (region.energyCost || 2);
  const energyReward = region.energyReward || (isBoss ? 10 : 5);
  
  if (existingRegion.rows.length === 0) {
    // Si la région n'existe pas, l'insérer
    await db.query(`
      INSERT INTO explorer_regions (
        id, name, description, image_path, is_default, required_level, 
        parent_region_id, required_elements, unlocked_elements, 
        position_x, position_y, is_boss, energy_cost, energy_reward, map_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
    `, [
      region.id,
      region.name,
      region.description || '',
      imagePath || null,
      region.is_default || false,
      region.id, // Utiliser l'ID comme niveau requis par défaut
      region.parent_region_id || null,
      requiredElements,
      availableElements,
      region.position_x || 50,
      region.position_y || 50,
      isBoss,
      energyCost,
      energyReward,
      region.map_id // Nouvelle ligne pour map_id
    ]);
  } else {
    // Si la région existe, la mettre à jour
    await db.query(`
      UPDATE explorer_regions SET
        name = $2,
        description = $3,
        image_path = $4,
        is_default = $5,
        required_level = $6,
        parent_region_id = $7,
        required_elements = $8,
        unlocked_elements = $9,
        position_x = $10,
        position_y = $11,
        is_boss = $12,
        energy_cost = $13,
        energy_reward = $14,
        map_id = $15
      WHERE id = $1
    `, [
      region.id,
      region.name,
      region.description || '',
      imagePath || null,
      region.is_default || false,
      region.id, // Utiliser l'ID comme niveau requis par défaut
      region.parent_region_id || null,
      requiredElements,
      availableElements,
      region.position_x || 50,
      region.position_y || 50,
      isBoss,
      energyCost,
      energyReward,
      region.map_id // Nouvelle ligne pour map_id
    ]);
  }
}

return {
  message: "Synchronisation des régions réussie",
  regionsCount: regionsData.regions.length
};
} catch (error) {
log('error', "Erreur lors de la synchronisation des régions", error);
throw error;
}
}
}

module.exports = ExplorerService;