const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Route pour sauvegarder un achievement spécifique
router.post('/achievement', authMiddleware, async (req, res) => {
   try {
       const userId = req.user.id;
       const { achievement } = req.body;
       console.log('Achievement reçu:', achievement);

       if (!achievement || !achievement.name) {
           return res.status(400).json({ message: 'Données de succès invalides ou manquantes' });
       }

       const existingProgress = await db.query(
           'SELECT achievements FROM progress WHERE user_id = $1',
           [userId]
       );

       let currentAchievements = {};

       if (existingProgress.rows.length > 0) {
           try {
               currentAchievements = existingProgress.rows[0].achievements 
                   ? (typeof existingProgress.rows[0].achievements === 'string' 
                       ? JSON.parse(existingProgress.rows[0].achievements) 
                       : existingProgress.rows[0].achievements)
                   : {};
           } catch (error) {
               console.error('Erreur lors du parsing des achievements existants:', error);
               currentAchievements = {};
           }
       }

       currentAchievements[achievement.name] = {
           unlocked: true,
           unlockedAt: new Date().toISOString()
       };

       if (existingProgress.rows.length > 0) {
           await db.query(
               `UPDATE progress 
               SET 
                   achievements = $1,
                   last_saved = CURRENT_TIMESTAMP
               WHERE user_id = $2`,
               [JSON.stringify(currentAchievements), userId]
           );
       } else {
           await db.query(
               `INSERT INTO progress (
                   user_id,
                   achievements,
                   discovered_elements,
                   discovered_categories,
                   category_progress,
                   coins,
                   timer_progress,
                   last_saved
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
               [
                   userId,
                   JSON.stringify(currentAchievements),
                   JSON.stringify(["Eau", "Feu", "Terre", "Air"]),
                   ["Elements Fondamentaux"],
                   JSON.stringify({}),
                   0,
                   JSON.stringify({
                       completedQuestions: {},
                       unlockedCategories: {},
                       bestScores: {
                           Facile: 0,
                           Moyen: 0,
                           Difficile: 0
                       }
                   })
               ]
           );
       }

       res.status(200).json({
           message: 'Achievement sauvegardé avec succès',
           achievements: currentAchievements
       });

   } catch (error) {
       console.error('Erreur lors de la sauvegarde de l\'achievement:', error);
       res.status(500).json({ message: 'Erreur lors de la sauvegarde de l\'achievement' });
   }
});

// Route pour sauvegarder la progression complète
router.post('/save', authMiddleware, async (req, res) => {
   try {
       const userId = req.user.id;
       console.log('Requête /save reçue pour userId:', userId);
       console.log('Corps de la requête:', req.body);

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

       console.log('Données extraites:', {
           discoveredElements,
           discoveredCategories,
           achievements,
           categoryProgress,
           coins,
           timerProgress
       });

       const existingProgress = await db.query(
           'SELECT id FROM progress WHERE user_id = $1',
           [userId]
       );

       const timerProgressToSave = JSON.stringify(timerProgress || {
           completedQuestions: {},
           unlockedCategories: {},
           bestScores: { Facile: 0, Moyen: 0, Difficile: 0 }
       });

       console.log('Timer Progress à sauvegarder:', timerProgressToSave);

       if (existingProgress.rows.length > 0) {
           console.log('Mise à jour de la progression existante');
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
                   JSON.stringify(discoveredElements),
                   discoveredCategories,
                   JSON.stringify(achievements),
                   JSON.stringify(categoryProgress),
                   coins,
                   timerProgressToSave,
                   userId
               ]
           );
       } else {
           console.log('Création d\'une nouvelle progression');
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
                   JSON.stringify(discoveredElements),
                   discoveredCategories,
                   JSON.stringify(achievements),
                   JSON.stringify(categoryProgress),
                   coins,
                   timerProgressToSave
               ]
           );
       }

       console.log('Sauvegarde réussie');
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

module.exports = router;