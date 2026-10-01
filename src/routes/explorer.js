const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const ledger = require('../services/ledger');
const expedition = require('../services/expedition');

// Fonction pour calculer l'énergie actuelle en fonction du temps écoulé
function calculateCurrentEnergy(baseEnergy, lastUpdate, maxEnergy) {
  const now = new Date();
  const lastUpdateTime = new Date(lastUpdate);
  
  // Calcul du temps écoulé en minutes
  const minutesElapsed = Math.floor((now - lastUpdateTime) / (1000 * 60));
  
  // Regénération : 1 point d'énergie toutes les 30 minutes (valeur fixe comme demandé)
  const energyRegained = Math.floor(minutesElapsed / 30);
  
  // Calculer la nouvelle énergie sans dépasser le maximum
  return Math.min(baseEnergy + energyRegained, maxEnergy);
}


// Route d'initialisation du mode Explorer
router.get('/init', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    // On cherche la progression existante pour l'utilisateur
    const result = await db.query(
      'SELECT explorer_energy, last_energy_update, max_energy FROM progress WHERE user_id = $1',
      [userId]
    );

    // Si aucune progression n'existe, on en crée une avec des valeurs par défaut
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
      return res.status(200).json({
        energy: insertResult.rows[0].explorer_energy,
        last_energy_update: insertResult.rows[0].last_energy_update,
        max_energy: insertResult.rows[0].max_energy,
        next_energy_in: 30 // minutes - Ce paramètre est volontairement laissé à 30 minutes comme demandé
      });
    }

    // Calculer l'énergie actuelle basée sur le temps écoulé
    const storedEnergy = result.rows[0].explorer_energy;
    const lastUpdate = result.rows[0].last_energy_update;
    // Utiliser la valeur max_energy de la base de données ou la valeur par défaut si non définie
    const maxEnergy = result.rows[0].max_energy || 20;
    const currentEnergy = calculateCurrentEnergy(storedEnergy, lastUpdate, maxEnergy);
    
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

    // Renvoyer les données calculées
    return res.status(200).json({
      energy: currentEnergy,
      last_energy_update: lastUpdate,
      max_energy: maxEnergy,
      next_energy_in: minutesToNextEnergy
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation du mode Explorer:", error);
    return res.status(500).json({
      message: "Erreur lors de l'initialisation du mode Explorer",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.get('/regions', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const mapId = req.query.mapId || null; // Accepter null pour toutes les régions
  
  try {
    const queryParams = mapId ? [userId, mapId] : [userId];
    const mapCondition = mapId ? 'AND r.map_id = $2' : '';
    
    const result = await db.query(`
      SELECT 
        r.id, r.name, r.description, r.image_path, r.is_default, r.required_level, r.parent_region_id,
        r.position_x, r.position_y, r.is_boss, r.energy_cost, r.energy_reward, r.map_id, r.coin_reward,
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
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erreur lors de la récupération des régions:", error);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des régions",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Visiter une région (consomme de l'énergie)
router.post('/visit/:regionId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const regionId = req.params.regionId;
  
  try {
    // Vérifier que la région existe et récupérer ses propriétés
    const regionResult = await db.query(
      'SELECT * FROM explorer_regions WHERE id = $1', 
      [regionId]
    );
    
    if (regionResult.rows.length === 0) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    const region = regionResult.rows[0];
    
    // Vérifier si l'utilisateur a déjà complété cette région
    const userRegionResult = await db.query(
      'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
      [userId, regionId]
    );
    
    const alreadyCompleted = userRegionResult.rows.length > 0 && userRegionResult.rows[0].completed;

    // Une région (gardien compris) ne s'ouvre qu'une fois sa région parente achevée
    if (!alreadyCompleted && !region.is_default && region.parent_region_id) {
      const parentResult = await db.query(
        'SELECT completed FROM user_regions WHERE user_id = $1 AND region_id = $2',
        [userId, region.parent_region_id]
      );
      if (parentResult.rows.length === 0 || !parentResult.rows[0].completed) {
        return res.status(403).json({ message: "Cette région n'est pas encore débloquée" });
      }
    }
    
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
      
      return res.status(200).json({
        message: message,
        energy: currentEnergy,
        region: region,
        alreadyCompleted: alreadyCompleted
      });
    }
    
    // Utiliser le coût d'énergie fourni ou celui de la région
    // On supprime le hardcoding du coût par défaut, et on s'assure qu'il y a toujours une valeur
    if (region.energy_cost === undefined || region.energy_cost === null) {
      return res.status(400).json({ 
        message: "Erreur: Le coût en énergie n'est pas défini pour cette région",
        region: region.name
      });
    }
    // Coût fixé par la région ; débit en une seule requête, seulement si l'énergie suffit
    const energyCost = region.energy_cost;
    const debit = await db.query(
      `UPDATE progress SET explorer_energy = explorer_energy - $1, last_energy_update = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND explorer_energy >= $1 RETURNING explorer_energy`,
      [energyCost, userId]
    );
    if (debit.rows.length === 0) {
      const progressResult = await db.query('SELECT explorer_energy FROM progress WHERE user_id = $1', [userId]);
      if (progressResult.rows.length === 0) return res.status(404).json({ message: "Progression non trouvée" });
      return res.status(400).json({
        message: "Énergie insuffisante pour explorer cette région",
        energy: progressResult.rows[0].explorer_energy
      });
    }
    const newEnergy = debit.rows[0].explorer_energy;
    
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
    
    // Retourner l'énergie restante et les informations de la région
    return res.status(200).json({
      message: "Région visitée avec succès",
      energy: newEnergy,
      region: region,
      alreadyCompleted: false
    });
  } catch (error) {
    console.error("Erreur lors de la visite de la région:", error);
    return res.status(500).json({ 
      message: "Erreur lors de la visite de la région",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route pour marquer une région comme complétée
router.post('/complete/:regionId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const regionId = req.params.regionId;
  // Récompenses lues en base : le corps de la requête ne dit que quel défi a été relevé
  const isBossVictory = req.body.isBossVictory === true;
  
  try {
    // Vérifier si l'utilisateur a déjà visité cette région
    const userRegionResult = await db.query(
      'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
      [userId, regionId]
    );
    
    if (userRegionResult.rows.length === 0 || !userRegionResult.rows[0].visited) {
      return res.status(403).json({ message: "Vous devez d'abord visiter cette région" });
    }

    // Le défi doit avoir été relevé dans la partie suivie par le serveur (éléments créés, gardien vaincu)
    if (!(await expedition.solved(userId, regionId))) {
      return res.status(403).json({ message: "Le défi de cette région n'est pas relevé" });
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
      
      return res.status(200).json({
        message: "Région déjà complétée, aucune récompense donnée",
        completed: true,
        rewards: {
          coins: currentCoins,
          energy: currentEnergy,
          energyReward: 0,
          xp: 0
        },
        alreadyCompleted: true
      });
    }
    
    // Récupérer les informations de la région pour obtenir les récompenses dynamiques
    const regionInfoResult = await db.query(
      'SELECT energy_reward, coin_reward, is_boss FROM explorer_regions WHERE id = $1',
      [regionId]
    );
    
    if (regionInfoResult.rows.length === 0) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    // Une victoire sur un gardien se déclare sur la région du gardien elle-même
    if (isBossVictory && !regionInfoResult.rows[0].is_boss) {
      return res.status(400).json({ message: "Cette région n'a pas de gardien" });
    }
    const bossRegionId = isBossVictory ? regionId : null;
    const energyReward = regionInfoResult.rows[0].energy_reward;
    // Écus de la région, ou du gardien vaincu (fixés plus bas une fois sa région connue)
    let coinReward = regionInfoResult.rows[0].coin_reward;
    let coinRef = `region:${regionId}`;
    
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
    
    console.log('Avant mise à jour - currentCoins:', currentCoins, 'currentEnergy:', currentEnergy);
    
    // 2. Calculer la nouvelle énergie (les écus passent par le grand livre)
    const newEnergy = Math.min(currentEnergy + energyReward, maxEnergy);
    
    console.log('Après mise à jour - newEnergy:', newEnergy, 'energyReward:', energyReward);
    
    // Distinguer les cas entre une victoire de boss, une région de boss, et une région normale
    if (isBossVictory) {
      // Cas 1: victoire sur le gardien de cette région
      await db.query(`
        UPDATE user_regions
        SET completed = TRUE, progress = 100, is_boss = FALSE, boss_defeated = FALSE
        WHERE user_id = $1 AND region_id = $2
      `, [userId, regionId]);
      
      // Vérifier si l'entrée existe déjà pour la région du boss
      const bossRegionResult = await db.query(
        'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
        [userId, bossRegionId]
      );
      
      if (bossRegionResult.rows.length === 0) {
        // Créer une nouvelle entrée pour la région du boss
        await db.query(`
          INSERT INTO user_regions (user_id, region_id, visited, completed, progress, is_boss, boss_defeated, last_visited)
          VALUES ($1, $2, TRUE, TRUE, 100, TRUE, TRUE, CURRENT_TIMESTAMP)
        `, [userId, bossRegionId]);
      } else {
        // Mettre à jour l'entrée existante
        await db.query(`
          UPDATE user_regions
          SET completed = TRUE, progress = 100, is_boss = TRUE, boss_defeated = TRUE
          WHERE user_id = $1 AND region_id = $2
        `, [userId, bossRegionId]);
      }
      
      const bossReward = await db.query('SELECT coin_reward FROM explorer_regions WHERE id = $1', [bossRegionId]);
      coinReward = bossReward.rows[0]?.coin_reward ?? 0;
      coinRef = `boss:${bossRegionId}`;
      console.log(`Région du boss (${bossRegionId}) marquée comme vaincue`);
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
    
    // Énergie et écus uniquement à la première réussite ; le grand livre refuse un second versement
    let newCoins = currentCoins;
    if (!alreadyCompleted) {
      await db.query(
        'UPDATE progress SET explorer_energy = $1, last_energy_update = CURRENT_TIMESTAMP WHERE user_id = $2',
        [newEnergy, userId]
      );
    }
    if (!alreadyCompleted || isBossVictory) {
      newCoins = (await ledger.credit(userId, coinReward, 'explorer', coinRef)).coins;
    }
    
    // Vérifier si cela débloque des régions enfants
    const childRegionsResult = await db.query(
      'SELECT id FROM explorer_regions WHERE parent_region_id = $1',
      [regionId]
    );
    
    res.status(200).json({
      message: alreadyCompleted ? "Région déjà complétée, aucune récompense donnée" : "Région complétée avec succès",
      completed: true,
      rewards: {
        coins: alreadyCompleted ? currentCoins : newCoins,
        energy: alreadyCompleted ? currentEnergy : newEnergy,
        energyReward: alreadyCompleted ? 0 : energyReward,
        xp: 0
      },
      unlockedRegions: childRegionsResult.rows.map(row => row.id),
      isBossVictory: isBossVictory,
      bossDefeated: isBossVictory && regionInfoResult.rows[0].is_boss,
      alreadyCompleted: alreadyCompleted
    });
  } catch (error) {
    console.error("Erreur lors de la complétion de la région:", error);
    res.status(500).json({
      message: "Erreur lors de la complétion de la région",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Récupérer les détails d'une région spécifique
router.get('/regions/:regionId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const regionId = req.params.regionId;
  
  try {
    const result = await db.query(`
      SELECT r.id, r.name, r.description, r.image_path, r.is_default, r.required_level, r.parent_region_id,
             r.position_x, r.position_y, r.is_boss, r.energy_cost, r.energy_reward, r.map_id, r.coin_reward,
             ur.visited, ur.completed, ur.progress, ur.required_elements, ur.boss_defeated
      FROM explorer_regions r
      LEFT JOIN user_regions ur ON r.id = ur.region_id AND ur.user_id = $1
      WHERE r.id = $2
    `, [userId, regionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erreur lors de la récupération des détails de la région:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des détails de la région",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Marquer un élément comme découvert dans une région
router.post('/discover/:regionId/:elementName', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const regionId = req.params.regionId;
  const elementName = req.params.elementName;
  
  try {
    // Vérifier si l'utilisateur a déjà visité cette région
    const userRegionResult = await db.query(
      'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
      [userId, regionId]
    );
    
    if (userRegionResult.rows.length === 0 || !userRegionResult.rows[0].visited) {
      return res.status(403).json({ message: "Vous devez d'abord visiter cette région" });
    }
    
    if (!(await expedition.holds(userId, regionId, elementName))) {
      return res.status(403).json({ message: "Cet élément n'a pas été créé dans cette région" });
    }

    // Récupérer les éléments déjà découverts
    let requiredElements = userRegionResult.rows[0].required_elements || [];
    
    // Vérifier si l'élément est déjà découvert
    if (requiredElements.includes(elementName)) {
      return res.status(200).json({ 
        message: "Cet élément a déjà été découvert dans cette région",
        required_elements: requiredElements 
      });
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
    
    res.status(200).json({
      message: "Élément découvert avec succès",
      required_elements: requiredElements,
      progress,
      completed
    });
  } catch (error) {
    console.error("Erreur lors de la découverte de l'élément:", error);
    res.status(500).json({
      message: "Erreur lors de la découverte de l'élément",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Acheter de l'énergie avec des pièces : quantité validée, débit et énergie dans une vraie transaction
const ENERGY_PRICE = 10; // pièces par point d'énergie
router.post('/buy-energy', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const energyAmount = req.body.amount === undefined ? 5 : Number(req.body.amount);
  if (!Number.isInteger(energyAmount) || energyAmount < 1 || energyAmount > 100) {
    return res.status(400).json({ message: "Quantité d'énergie invalide" });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const progressResult = await client.query(
      'SELECT coins, explorer_energy, max_energy FROM progress WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    if (progressResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Progression non trouvée" });
    }
    const { coins: userCoins, explorer_energy: currentEnergy } = progressResult.rows[0];
    const maxEnergy = progressResult.rows[0].max_energy || 20;
    if (currentEnergy >= maxEnergy) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: "Votre énergie est déjà au maximum", energy: currentEnergy, max_energy: maxEnergy });
    }
    // On ne paie que l'énergie réellement ajoutée (sans dépasser le maximum)
    const actualEnergyAdded = Math.min(energyAmount, maxEnergy - currentEnergy);
    const actualCost = actualEnergyAdded * ENERGY_PRICE;
    if (userCoins < actualCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Vous n'avez pas assez de pièces ! ${actualCost} pièces sont nécessaires pour acheter ${actualEnergyAdded} point(s) d'énergie.`,
        coins: userCoins,
        cost: actualCost
      });
    }
    const updated = await client.query(
      `UPDATE progress SET explorer_energy = explorer_energy + $1, coins = coins - $2, last_energy_update = NOW()
       WHERE user_id = $3 RETURNING coins, explorer_energy`,
      [actualEnergyAdded, actualCost, userId]
    );
    await client.query('INSERT INTO coin_ledger (user_id, amount, reason) VALUES ($1, $2, $3)', [userId, -actualCost, 'energy']);
    await client.query('COMMIT');
    res.status(200).json({
      message: `Vous avez acheté ${actualEnergyAdded} point(s) d'énergie pour ${actualCost} pièces.`,
      energy: updated.rows[0].explorer_energy,
      energy_added: actualEnergyAdded,
      coins_spent: actualCost,
      coins_remaining: updated.rows[0].coins,
      max_energy: maxEnergy,
      transaction_id: Date.now() // Identifiant unique pour éviter les doublons côté frontend
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Erreur lors de l'achat d'énergie:", error);
    res.status(500).json({
      message: "Erreur lors de l'achat d'énergie",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  } finally {
    client.release();
  }
});

// Route pour synchroniser les régions depuis le fichier JSON
router.post('/sync-regions', authMiddleware, async (req, res) => {
  // Cette route devrait être limitée aux administrateurs
  try {
    // 1. Lire le fichier JSON
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../public/data/regionChallenges.json');
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
    
    res.status(200).json({
      message: "Synchronisation des régions réussie",
      regionsCount: regionsData.regions.length
    });
  } catch (error) {
    console.error("Erreur lors de la synchronisation des régions:", error);
    res.status(500).json({
      message: "Erreur lors de la synchronisation des régions",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});


// Route pour synchroniser les éléments découverts par les utilisateurs
router.post('/sync-discovered-elements', authMiddleware, async (req, res) => {
  // Cette route devrait idéalement être limitée aux administrateurs
  try {
    const { syncUserDiscoveredElements } = require('../initRegions');
    await syncUserDiscoveredElements();
    
    res.status(200).json({
      message: "Synchronisation des éléments découverts réussie"
    });
  } catch (error) {
    console.error("Erreur lors de la synchronisation des éléments découverts:", error);
    res.status(500).json({
      message: "Erreur lors de la synchronisation des éléments découverts",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});


router.post('/abandon/:regionId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const regionId = req.params.regionId;
  const requestedCost = Number(req.body.energyCost) || 0;
  
  try {
    // Vérifier si la région existe
    const regionResult = await db.query(
      'SELECT * FROM explorer_regions WHERE id = $1', 
      [regionId]
    );
    
    if (regionResult.rows.length === 0) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    const region = regionResult.rows[0];
    const energyCost = Math.max(0, Math.min(Math.floor(requestedCost), region.energy_cost));
    
    // Si c'est un boss, pas de coût d'énergie
    if (region.is_boss) {
      return res.status(200).json({ 
        message: "Abandon sans coût d'énergie",
        region: region,
        energy: req.user.energy
      });
    }
    
    // Vérifier l'état actuel de l'énergie
    const progressResult = await db.query(
      'SELECT explorer_energy FROM progress WHERE user_id = $1', 
      [userId]
    );
    
    if (progressResult.rows.length === 0) {
      return res.status(404).json({ message: "Progression non trouvée" });
    }
    
    const currentEnergy = progressResult.rows[0].explorer_energy;
    
    // Pénalité d'abandon : jamais plus que le coût de la région, en une seule requête
    if (energyCost > 0) {
      const { rows } = await db.query(
        `UPDATE progress SET explorer_energy = GREATEST(0, explorer_energy - $1), last_energy_update = CURRENT_TIMESTAMP
         WHERE user_id = $2 RETURNING explorer_energy`,
        [energyCost, userId]
      );
      return res.status(200).json({
        message: "Défi abandonné avec déduction d'énergie",
        energy: rows[0].explorer_energy,
        energyCost: energyCost,
        region: region
      });
    } else {
      // Si aucun coût n'est spécifié, ne pas déduire d'énergie
      return res.status(200).json({
        message: "Défi abandonné sans déduction d'énergie",
        energy: currentEnergy,
        region: region
      });
    }
  } catch (error) {
    console.error("Erreur lors de l'abandon du défi:", error);
    return res.status(500).json({ 
      message: "Erreur lors de l'abandon du défi",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});


module.exports = router;