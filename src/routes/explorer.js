const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Fonction pour calculer l'énergie actuelle en fonction du temps écoulé
function calculateCurrentEnergy(baseEnergy, lastUpdate, maxEnergy = 20) {
  const now = new Date();
  const lastUpdateTime = new Date(lastUpdate);
  
  // Calcul du temps écoulé en minutes
  const minutesElapsed = Math.floor((now - lastUpdateTime) / (1000 * 60));
  
  // Regénération : 1 point d'énergie toutes les 30 minutes
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
      'SELECT energy, last_energy_update FROM progress WHERE user_id = $1',
      [userId]
    );

    // Si aucune progression n'existe, on en crée une avec des valeurs par défaut
    if (result.rows.length === 0) {
      const defaultEnergy = 10;
      const now = new Date();
      const insertResult = await db.query(
        'INSERT INTO progress (user_id, energy, last_energy_update) VALUES ($1, $2, $3) RETURNING energy, last_energy_update',
        [userId, defaultEnergy, now]
      );
      return res.status(200).json({
        energy: insertResult.rows[0].energy,
        last_energy_update: insertResult.rows[0].last_energy_update,
        max_energy: 20,
        next_energy_in: 30 // minutes
      });
    }

    // Calculer l'énergie actuelle basée sur le temps écoulé
    const storedEnergy = result.rows[0].energy;
    const lastUpdate = result.rows[0].last_energy_update;
    const currentEnergy = calculateCurrentEnergy(storedEnergy, lastUpdate);
    
    // Si l'énergie a été régénérée, mettre à jour la base de données
    if (currentEnergy > storedEnergy) {
      const now = new Date();
      await db.query(
        'UPDATE progress SET energy = $1, last_energy_update = $2 WHERE user_id = $3',
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
      max_energy: 20,
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

// Récupérer toutes les régions
router.get('/regions', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, ur.visited, ur.completed, ur.progress, ur.discovered_elements
      FROM explorer_regions r
      LEFT JOIN user_regions ur ON r.id = ur.region_id AND ur.user_id = $1
      ORDER BY r.required_level ASC, r.name ASC
    `, [req.user.id]);
    
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
  const energyCost = 2; // Coût en énergie pour visiter une région
  
  try {
    // Vérifier que la région existe
    const regionResult = await db.query('SELECT * FROM explorer_regions WHERE id = $1', [regionId]);
    if (regionResult.rows.length === 0) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    // Vérifier si la région est débloquée
    if (!regionResult.rows[0].is_default) {
      const parentRegionId = regionResult.rows[0].parent_region_id;
      if (parentRegionId) {
        const parentResult = await db.query(
          'SELECT completed FROM user_regions WHERE user_id = $1 AND region_id = $2',
          [userId, parentRegionId]
        );
        
        if (parentResult.rows.length === 0 || !parentResult.rows[0].completed) {
          return res.status(403).json({ message: "Cette région n'est pas encore débloquée" });
        }
      }
    }
    
    // Vérifier l'énergie disponible
    const progressResult = await db.query('SELECT energy FROM progress WHERE user_id = $1', [userId]);
    if (progressResult.rows.length === 0) {
      return res.status(404).json({ message: "Progression non trouvée" });
    }
    
    const currentEnergy = progressResult.rows[0].energy;
    
    if (currentEnergy < energyCost) {
      return res.status(400).json({ 
        message: "Énergie insuffisante pour explorer cette région",
        energy: currentEnergy
      });
    }
    
    // Débiter l'énergie
    await db.query('UPDATE progress SET energy = energy - $1 WHERE user_id = $2', 
      [energyCost, userId]);
    
    // Enregistrer la visite
    const now = new Date();
    
    // Vérifier si l'utilisateur a déjà visité cette région
    const userRegionResult = await db.query(
      'SELECT * FROM user_regions WHERE user_id = $1 AND region_id = $2',
      [userId, regionId]
    );
    
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
      energy: currentEnergy - energyCost,
      region: regionResult.rows[0]
    });
  } catch (error) {
    console.error("Erreur lors de la visite de la région:", error);
    return res.status(500).json({ 
      message: "Erreur lors de la visite de la région",
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
      SELECT r.*, ur.visited, ur.completed, ur.progress, ur.discovered_elements
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
    
    // Récupérer les éléments déjà découverts
    let discoveredElements = userRegionResult.rows[0].discovered_elements || [];
    
    // Vérifier si l'élément est déjà découvert
    if (discoveredElements.includes(elementName)) {
      return res.status(200).json({ 
        message: "Cet élément a déjà été découvert dans cette région",
        discovered_elements: discoveredElements 
      });
    }
    
    // Ajouter l'élément aux découvertes
    discoveredElements.push(elementName);
    
    // Calculer la progression (% d'éléments découverts sur le total possible)
    const regionResult = await db.query('SELECT unlocked_elements FROM explorer_regions WHERE id = $1', [regionId]);
    const totalElements = regionResult.rows[0].unlocked_elements || [];
    const progress = Math.floor((discoveredElements.length / Math.max(totalElements.length, 1)) * 100);
    
    // Vérifier si la région est complétée (tous les éléments découverts)
    const completed = discoveredElements.length >= totalElements.length && totalElements.length > 0;
    
    // Mettre à jour la progression
    await db.query(`
      UPDATE user_regions
      SET discovered_elements = $1, progress = $2, completed = $3
      WHERE user_id = $4 AND region_id = $5
    `, [discoveredElements, progress, completed, userId, regionId]);
    
    res.status(200).json({
      message: "Élément découvert avec succès",
      discovered_elements: discoveredElements,
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

// Acheter de l'énergie avec des pièces
router.post('/buy-energy', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const energyAmount = req.body.amount || 5;
  const costPerUnit = 10; // 10 pièces par point d'énergie
  const totalCost = energyAmount * costPerUnit;
  
  try {
    // Vérifier si l'utilisateur a assez de pièces
    const progressResult = await db.query('SELECT coins, energy FROM progress WHERE user_id = $1', [userId]);
    
    if (progressResult.rows.length === 0) {
      return res.status(404).json({ message: "Progression non trouvée" });
    }
    
    const userCoins = progressResult.rows[0].coins;
    const currentEnergy = progressResult.rows[0].energy;
    const maxEnergy = 20;
    
    if (userCoins < totalCost) {
      return res.status(400).json({ 
        message: "Vous n'avez pas assez de pièces",
        coins: userCoins,
        cost: totalCost
      });
    }
    
    // Calculer la nouvelle énergie sans dépasser le maximum
    const newEnergy = Math.min(currentEnergy + energyAmount, maxEnergy);
    const actualEnergyAdded = newEnergy - currentEnergy;
    const actualCost = actualEnergyAdded * costPerUnit;
    
    // Mettre à jour l'énergie et les pièces
    await db.query(`
      UPDATE progress
      SET energy = $1, coins = coins - $2
      WHERE user_id = $3
    `, [newEnergy, actualCost, userId]);
    
    res.status(200).json({
      message: "Énergie achetée avec succès",
      energy: newEnergy,
      energy_added: actualEnergyAdded,
      coins_spent: actualCost,
      coins_remaining: userCoins - actualCost
    });
  } catch (error) {
    console.error("Erreur lors de l'achat d'énergie:", error);
    res.status(500).json({
      message: "Erreur lors de l'achat d'énergie",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

module.exports = router;