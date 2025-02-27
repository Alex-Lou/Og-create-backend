const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

router.post('/update-achievements', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const { achievements } = req.body;
      
      console.log('=== UPDATE ACHIEVEMENTS DEBUG ===');
      console.log('UserId:', userId);
      console.log('Achievements reçus:', JSON.stringify(achievements, null, 2));
      
      // Vérifier immédiatement avant toute opération
      if (!achievements || Object.keys(achievements).length === 0) {
        return res.status(400).json({ 
          message: 'Aucun achievement à mettre à jour' 
        });
      }
  
      // Récupérer rapidement les achievements existants
      const currentProgress = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Parser les achievements existants de manière plus robuste
      let currentAchievements = {};
      if (currentProgress.rows.length > 0) {
        try {
          currentAchievements = currentProgress.rows[0].achievements 
            ? (typeof currentProgress.rows[0].achievements === 'string' 
                ? JSON.parse(currentProgress.rows[0].achievements) 
                : currentProgress.rows[0].achievements)
            : {};
        } catch (error) {
          console.error('Erreur lors du parsing des achievements existants:', error);
        }
      }
  
      // Fusionner immédiatement les nouveaux achievements
      const updatedAchievements = { 
        ...currentAchievements, 
        ...achievements 
      };
  
      // Sauvegarder immédiatement et de manière atomique
      const updateQuery = `
        UPDATE progress 
        SET 
          achievements = $1, 
          last_saved = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `;
  
      await db.query(updateQuery, [
        JSON.stringify(updatedAchievements), 
        userId
      ]);
      
      // Répondre rapidement
      res.status(200).json({
        message: 'Achievements mis à jour avec succès',
        achievements: updatedAchievements,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des achievements:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la mise à jour des achievements',
        error: error.message 
      });
    }
  });

// Route pour sauvegarder la progression complète
router.post('/save', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Requête /save reçue pour userId:', userId);
        
        // Extraire les données avec valeurs par défaut
        const { 
            discoveredElements = ["Eau", "Feu", "Terre", "Air"], 
            discoveredCategories = ["Elements Fondamentaux"], 
            achievements = {}, 
            categoryProgress = {},
            coins = 0,
            timerProgress = {
                completedQuestions: {},
                unlockedCategories: {},
                bestScores: {
                    Facile: 0,
                    Moyen: 0,
                    Difficile: 0
                }
            }
        } = req.body;
        
        // Vérifier si une entrée existe déjà
        const existingProgress = await db.query(
            'SELECT id, discovered_elements, achievements FROM progress WHERE user_id = $1',
            [userId]
        );
        
        // Préparer les données
        const timerProgressToSave = JSON.stringify(timerProgress || {
            completedQuestions: {},
            unlockedCategories: {},
            bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
        });
        
        // Fusion pour les éléments découverts
        let elementsToSave = discoveredElements;
        let achievementsToSave = achievements;
        
        if (existingProgress.rows.length > 0) {
            // Fusionner les éléments découverts existants
            const existingElements = typeof existingProgress.rows[0].discovered_elements === 'string'
                ? JSON.parse(existingProgress.rows[0].discovered_elements)
                : existingProgress.rows[0].discovered_elements || [];
            
            elementsToSave = [...new Set([...existingElements, ...discoveredElements])];
            
            // Fusionner les achievements existants
            const existingAchievements = typeof existingProgress.rows[0].achievements === 'string'
                ? JSON.parse(existingProgress.rows[0].achievements)
                : existingProgress.rows[0].achievements || {};
            
            achievementsToSave = { ...existingAchievements, ...achievements };
        }
        
        // Mise à jour ou insertion
        if (existingProgress.rows.length > 0) {
            await db.query(
                `UPDATE progress 
                SET 
                    discovered_elements = $1,
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
                    timerProgressToSave,
                    userId
                ]
            );
        } else {
            await db.query(
                `INSERT INTO progress (
                    user_id,
                    discovered_elements,
                    discovered_categories,
                    achievements,
                    category_progress,
                    coins,
                    timer_progress,
                    last_saved
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [
                    userId,
                    JSON.stringify(elementsToSave),
                    discoveredCategories,
                    JSON.stringify(achievementsToSave),
                    JSON.stringify(categoryProgress),
                    coins,
                    timerProgressToSave
                ]
            );
        }
        
        res.status(200).json({
            message: 'Progression sauvegardée avec succès',
            lastSaved: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur détaillée lors de la sauvegarde de la progression:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la sauvegarde de la progression',
            error: error.message
        });
    }
});

// Route pour charger la progression
router.get('/load', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('=== LOAD PROGRESS DEBUG ===');
        console.log('Chargement pour userId:', userId);
 
        const result = await db.query(
            `SELECT 
                discovered_elements,
                discovered_categories,
                achievements,
                category_progress,
                coins,
                timer_progress,
                last_saved
            FROM progress 
            WHERE user_id = $1`,
            [userId]
        );
 
        if (result.rows.length === 0) {
            console.log('Aucune progression trouvée, renvoi des valeurs par défaut');
            return res.status(200).json({
                discoveredElements: ["Eau", "Feu", "Terre", "Air"],
                discoveredCategories: ["Elements Fondamentaux"],
                achievements: {},
                categoryProgress: {},
                coins: 0,
                timerProgress: {
                    completedQuestions: {},
                    unlockedCategories: {},
                    bestScores: {
                        Facile: 0,
                        Moyen: 0,
                        Difficile: 0
                    }
                },
                lastSaved: null
            });
        }
 
        const progress = result.rows[0];
        console.log('=== Progression chargée pour userId:', userId, ' ===');
        console.log('Coins en BDD:', progress.coins);
        console.log('Dernier enregistrement:', progress.last_saved);
        console.log('Éléments découverts:', progress.discovered_elements);
 
        let parsedProgress = {
            discoveredElements: ["Eau", "Feu", "Terre", "Air"],
            discoveredCategories: ["Elements Fondamentaux"],
            achievements: {},
            categoryProgress: {},
            coins: progress.coins || 0,
            timerProgress: {
                completedQuestions: {},
                unlockedCategories: {},
                bestScores: {
                    Facile: 0,
                    Moyen: 0,
                    Difficile: 0
                }
            },
            lastSaved: progress.last_saved
        };
 
        try {
            if (progress.discovered_elements && progress.discovered_elements !== '{}') {
                parsedProgress.discoveredElements = typeof progress.discovered_elements === 'string'
                    ? JSON.parse(progress.discovered_elements)
                    : progress.discovered_elements;
            }
 
            if (progress.discovered_categories && progress.discovered_categories.length > 0) {
                parsedProgress.discoveredCategories = progress.discovered_categories;
            }
 
            if (progress.achievements) {
                parsedProgress.achievements = typeof progress.achievements === 'string'
                    ? JSON.parse(progress.achievements)
                    : progress.achievements;
            }
 
            if (progress.category_progress) {
                parsedProgress.categoryProgress = typeof progress.category_progress === 'string'
                    ? JSON.parse(progress.category_progress)
                    : progress.category_progress;
            }
 
            if (progress.timer_progress) {
                const parsedTimerProgress = typeof progress.timer_progress === 'string'
                    ? JSON.parse(progress.timer_progress)
                    : progress.timer_progress;
 
                parsedProgress.timerProgress = {
                    completedQuestions: parsedTimerProgress.completedQuestions || {},
                    unlockedCategories: parsedTimerProgress.unlockedCategories || {},
                    bestScores: parsedTimerProgress.bestScores || {
                        Facile: 0,
                        Moyen: 0,
                        Difficile: 0
                    }
                };
            }
 
            console.log('=== Progression parsée ===');
            console.log('Coins après parsing:', parsedProgress.coins);
            console.log('Elements après parsing:', parsedProgress.discoveredElements.length);
            console.log('Achievements après parsing:', Object.keys(parsedProgress.achievements).length);
        } catch (error) {
            console.error('Erreur lors du parsing des données JSON:', error);
        }
 
        res.status(200).json(parsedProgress);
 
    } catch (error) {
        console.error('Erreur lors du chargement de la progression:', error);
        res.status(500).json({ 
            message: 'Erreur lors du chargement de la progression',
            error: error.message 
        });
    }
 });

router.post('/update-coins', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { coins } = req.body;
        
        console.log('=== UPDATE COINS DEBUG ===');
        console.log('UserId:', userId);
        console.log('Nouvelle valeur coins:', coins);
        
        // Vérifier d'abord les pièces existantes
        const currentProgress = await db.query(
            'SELECT coins, last_saved FROM progress WHERE user_id = $1',
            [userId]
        );
        
        console.log('Valeur actuelle en BDD:', currentProgress.rows[0]?.coins);
        console.log('Dernier enregistrement:', currentProgress.rows[0]?.last_saved);
        
        // Si aucune progression n'existe, créer une nouvelle entrée
        if (currentProgress.rows.length === 0) {
            console.log('Création nouvelle entrée progress');
            await db.query(
                `INSERT INTO progress (user_id, coins, last_saved)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)`,
                [userId, coins]
            );
        } else {
            console.log('Mise à jour coins existants');
            await db.query(
                `UPDATE progress 
                 SET coins = $1, last_saved = CURRENT_TIMESTAMP
                 WHERE user_id = $2
                 RETURNING coins, last_saved`,
                [coins, userId]
            ).then(result => {
                console.log('Mise à jour effectuée:', result.rows[0]);
            });
        }

        res.status(200).json({
            message: 'Pièces mises à jour avec succès',
            coins: coins,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des pièces:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour des pièces' });
    }
});


router.post('/update-discovered-elements', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const { discoveredElements } = req.body;
      
      console.log('=== UPDATE DISCOVERED ELEMENTS DEBUG ===');
      console.log('UserId:', userId);
      console.log('Nouveaux éléments découverts:', discoveredElements);
      
      // Vérifier d'abord si la progression existe
      const currentProgress = await db.query(
        'SELECT discovered_elements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Si aucune progression n'existe, créer une nouvelle entrée
      if (currentProgress.rows.length === 0) {
        console.log('Création nouvelle entrée progress pour éléments découverts');
        await db.query(
          `INSERT INTO progress (user_id, discovered_elements, last_saved)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, JSON.stringify(discoveredElements)]
        );
      } else {
        console.log('Mise à jour éléments découverts existants');
        await db.query(
          `UPDATE progress 
           SET discovered_elements = $1, last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2
           RETURNING discovered_elements, last_saved`,
          [JSON.stringify(discoveredElements), userId]
        ).then(result => {
          console.log('Mise à jour effectuée:', result.rows[0]);
        });
      }
  
      res.status(200).json({
        message: 'Éléments découverts mis à jour avec succès',
        discoveredElements: discoveredElements,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des éléments découverts:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour des éléments découverts' });
    }
  });


  router.post('/update-achievements', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const { achievements } = req.body;
      
      console.log('=== UPDATE ACHIEVEMENTS DEBUG ===');
      console.log('UserId:', userId);
      
      // Vérifier d'abord si la progression existe
      const currentProgress = await db.query(
        'SELECT achievements FROM progress WHERE user_id = $1',
        [userId]
      );
      
      // Si aucune progression n'existe, créer une nouvelle entrée
      if (currentProgress.rows.length === 0) {
        console.log('Création nouvelle entrée progress pour achievements');
        await db.query(
          `INSERT INTO progress (user_id, achievements, last_saved)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, JSON.stringify(achievements)]
        );
      } else {
        console.log('Mise à jour achievements existants');
        await db.query(
          `UPDATE progress 
           SET achievements = $1, last_saved = CURRENT_TIMESTAMP
           WHERE user_id = $2
           RETURNING achievements, last_saved`,
          [JSON.stringify(achievements), userId]
        ).then(result => {
          console.log('Mise à jour effectuée:', result.rows[0]);
        });
      }
  
      res.status(200).json({
        message: 'Achievements mis à jour avec succès',
        achievements: achievements,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des achievements:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour des achievements' });
    }
  });

// Route pour mettre à jour la progression du timer uniquement
router.post('/update-timer-progress', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { timerProgress } = req.body;
        
        console.log('Route /update-timer-progress appelée');
        console.log('userId:', userId);
        console.log('Request body complet:', req.body);
        console.log('Timer Progress reçu:', JSON.stringify(timerProgress, null, 2));

        if (!timerProgress || typeof timerProgress !== 'object') {
            console.log('ERREUR : Progression du timer invalide');
            return res.status(400).json({ message: 'La progression du timer est invalide' });
        }

        // Vérification plus détaillée de la structure
        const safeTimerProgress = {
            completedQuestions: timerProgress.completedQuestions || {},
            unlockedCategories: timerProgress.unlockedCategories || {},
            bestScores: {
                Facile: timerProgress.bestScores?.Facile || 0,
                Moyen: timerProgress.bestScores?.Moyen || 0,
                Difficile: timerProgress.bestScores?.Difficile || 0
            }
        };

        console.log('Timer Progress à sauvegarder:', JSON.stringify(safeTimerProgress, null, 2));

        const result = await db.query(
            `UPDATE progress 
            SET 
                timer_progress = $1,
                last_saved = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING timer_progress`,
            [JSON.stringify(safeTimerProgress), userId]
        );

        console.log('Mise à jour effectuée, données retournées:', result.rows[0]);

        res.status(200).json({
            message: 'Progression du timer mise à jour avec succès',
            timerProgress: safeTimerProgress
        });
    } catch (error) {
        console.error('ERREUR lors de la mise à jour:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la mise à jour de la progression du timer',
            error: error.message 
        });
    }
});


 // Route pour initialiser/récupérer l'état du mode Explorer
router.get('/explorer/init', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Vérifier si l'utilisateur a déjà des données Explorer
      const userResult = await db.query(
        `SELECT explorer_energy, last_energy_update FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      let energy = 10; // Énergie par défaut
      const maxEnergy = 20; // Énergie maximale
      let nextEnergyIn = 0; // Minutes jusqu'à la prochaine énergie
      
      if (userResult.rows.length > 0) {
        // Si l'utilisateur existe, récupérer son énergie actuelle
        energy = userResult.rows[0].explorer_energy || energy;
        
        // Calculer le temps jusqu'à la prochaine énergie
        const lastUpdate = userResult.rows[0].last_energy_update;
        if (lastUpdate && energy < maxEnergy) {
          const lastUpdateTime = new Date(lastUpdate).getTime();
          const now = new Date().getTime();
          const timeDiff = Math.floor((now - lastUpdateTime) / (1000 * 60)); // Différence en minutes
          
          // Si le temps écoulé est suffisant pour gagner de l'énergie
          if (timeDiff >= 30) {
            const energyToAdd = Math.floor(timeDiff / 30); // Une énergie toutes les 30 minutes
            energy = Math.min(energy + energyToAdd, maxEnergy);
            
            // Mettre à jour l'énergie dans la base de données
            await db.query(
              `UPDATE progress 
               SET explorer_energy = $1, 
                   last_energy_update = CURRENT_TIMESTAMP
               WHERE user_id = $2`,
              [energy, userId]
            );
          }
          
          // Calculer le temps restant jusqu'à la prochaine énergie
          nextEnergyIn = 30 - (timeDiff % 30);
        }
      } else {
        // Si l'utilisateur n'existe pas dans la table progress, le créer
        await db.query(
          `INSERT INTO progress 
           (user_id, explorer_energy, last_energy_update)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, energy]
        );
      }
      
      // Répondre avec l'état actuel
      res.status(200).json({
        energy: energy,
        max_energy: maxEnergy,
        next_energy_in: nextEnergyIn
      });
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du mode Explorer:', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'initialisation du mode Explorer',
        error: error.message
      });
    }
  });
  
 // Route pour compléter une région en mode Explorer
router.post('/explorer/regions/:id/complete', authMiddleware, async (req, res) => {
    try {
      const regionId = req.params.id;
      const userId = req.user.id;
      const { coins = 0, energy = 0, xp = 0 } = req.body;
      
      console.log(`Complétion de la région ${regionId} pour l'utilisateur ${userId}`);
      console.log('Récompenses:', { coins, energy, xp });
      
      // 1. Récupérer l'état actuel de l'utilisateur
      const userProgressResult = await db.query(
        `SELECT coins, explorer_energy FROM progress WHERE user_id = $1`,
        [userId]
      );
      
      let currentCoins = 0;
      let currentEnergy = 0;
      const maxEnergy = 20; // Défini comme constante
      
      if (userProgressResult.rows.length > 0) {
        currentCoins = userProgressResult.rows[0].coins || 0;
        currentEnergy = userProgressResult.rows[0].explorer_energy || 0;
      }
      
      console.log('Avant mise à jour - currentCoins:', currentCoins, 'currentEnergy:', currentEnergy);
      
      // 2. Calculer les nouvelles valeurs
      const newCoins = currentCoins + coins;
      const newEnergy = Math.min(currentEnergy + energy, maxEnergy);
      
      console.log('Après mise à jour - newCoins:', newCoins, 'newEnergy:', newEnergy);
      
      // 3. Mettre à jour la base de données user_regions
      try {
        // Vérifier si l'entrée existe déjà
        const regionResult = await db.query(
          `SELECT * FROM user_regions WHERE region_id = $1 AND user_id = $2`,
          [regionId, userId]
        );
        
        if (regionResult.rows.length === 0) {
          // Si l'entrée n'existe pas, la créer
          console.log(`Création d'une nouvelle entrée user_regions pour la région ${regionId}`);
          await db.query(
            `INSERT INTO user_regions 
             (region_id, user_id, visited, completed, progress, last_visited)
             VALUES ($1, $2, true, true, 100, CURRENT_TIMESTAMP)`,
            [regionId, userId]
          );
        } else {
          // Sinon, mettre à jour l'entrée existante
          console.log(`Mise à jour de l'entrée user_regions pour la région ${regionId}`);
          await db.query(
            `UPDATE user_regions 
             SET visited = true, 
                 completed = true,
                 progress = 100,
                 last_visited = CURRENT_TIMESTAMP
             WHERE region_id = $1 AND user_id = $2`,
            [regionId, userId]
          );
        }
      } catch (error) {
        console.error(`⚠️ Erreur lors de la mise à jour de user_regions: ${error.message}`);
        // Ne pas échouer la requête complètement, on peut encore mettre à jour l'énergie
      }
      
      // 4. Mettre à jour les statistiques (coins, energy) dans la progression
      await db.query(
        `UPDATE progress 
         SET coins = $1, 
             explorer_energy = $2, 
             last_saved = CURRENT_TIMESTAMP
         WHERE user_id = $3
         RETURNING coins, explorer_energy`,
        [newCoins, newEnergy, userId]
      ).then(result => {
        console.log('Mise à jour des statistiques effectuée:', result.rows[0]);
      });
      
      // 5. Répondre avec les nouvelles valeurs
      res.status(200).json({
        message: 'Région complétée avec succès',
        rewards: {
          coins: newCoins, 
          energy: newEnergy,
          xp: xp
        }
      });
    } catch (error) {
      console.error('Erreur lors de la complétion de la région:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la complétion de la région',
        error: error.message
      });
    }
  });

module.exports = router;