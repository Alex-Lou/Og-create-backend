const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Route pour sauvegarder un achievement spécifique
router.post('/achievement', authMiddleware, async (req, res) => {
   try {
       const userId = req.user.id;
       const { achievement } = req.body;

       // Vérifier si l'achievement est présent dans la requête
       if (!achievement || !achievement.name) {
           return res.status(400).json({ message: 'Données de succès invalides ou manquantes' });
       }

       // Récupérer la progression existante
       const existingProgress = await db.query(
           'SELECT achievements FROM progress WHERE user_id = $1',
           [userId]
       );

       let currentAchievements = {};

       if (existingProgress.rows.length > 0) {
           try {
               // Convertir les achievements existants en objet
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

       // Ajouter ou mettre à jour l'achievement
       currentAchievements[achievement.name] = {
           unlocked: true,
           unlockedAt: new Date().toISOString()
       };

       // Stocker les achievements mis à jour
       if (existingProgress.rows.length > 0) {
           // Mise à jour des achievements existants
           await db.query(
               `UPDATE progress 
               SET 
                   achievements = $1,
                   last_saved = CURRENT_TIMESTAMP
               WHERE user_id = $2`,
               [JSON.stringify(currentAchievements), userId]
           );
       } else {
           // Création d'une nouvelle progression
           await db.query(
               `INSERT INTO progress (
                   user_id,
                   achievements,
                   discovered_elements,
                   discovered_categories,
                   category_progress,
                   last_saved
               ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
               [
                   userId,
                   JSON.stringify(currentAchievements),
                   JSON.stringify(["Eau", "Feu", "Terre", "Air"]),
                   ["Elements Fondamentaux"],
                   JSON.stringify({})
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
       const { 
           discoveredElements = ["Eau", "Feu", "Terre", "Air"], 
           discoveredCategories = ["Elements Fondamentaux"], 
           achievements = {}, 
           categoryProgress = {} 
       } = req.body;

       // Rechercher si une progression existe déjà
       const existingProgress = await db.query(
           'SELECT id FROM progress WHERE user_id = $1',
           [userId]
       );

       if (existingProgress.rows.length > 0) {
           // Mise à jour de la progression existante
           await db.query(
               `UPDATE progress 
               SET 
                   discovered_elements = $1,
                   discovered_categories = $2,
                   achievements = $3,
                   category_progress = $4,
                   last_saved = CURRENT_TIMESTAMP
               WHERE user_id = $5`,
               [
                   JSON.stringify(discoveredElements),
                   discoveredCategories,
                   JSON.stringify(achievements),
                   JSON.stringify(categoryProgress),
                   userId
               ]
           );
       } else {
           // Création d'une nouvelle progression
           await db.query(
               `INSERT INTO progress (
                   user_id,
                   discovered_elements,
                   discovered_categories,
                   achievements,
                   category_progress,
                   last_saved
               ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
               [
                   userId,
                   JSON.stringify(discoveredElements),
                   discoveredCategories,
                   JSON.stringify(achievements),
                   JSON.stringify(categoryProgress)
               ]
           );
       }

       res.status(200).json({
           message: 'Progression sauvegardée avec succès',
           lastSaved: new Date().toISOString()
       });

   } catch (error) {
       console.error('Erreur lors de la sauvegarde de la progression:', error);
       res.status(500).json({ message: 'Erreur lors de la sauvegarde de la progression' });
   }
});

// Route pour charger la progression
router.get('/load', authMiddleware, async (req, res) => {
   try {
       const userId = req.user.id;

       const result = await db.query(
           `SELECT 
               discovered_elements,
               discovered_categories,
               achievements,
               category_progress,
               last_saved
           FROM progress 
           WHERE user_id = $1`,
           [userId]
       );

       if (result.rows.length === 0) {
           return res.status(200).json({
               discoveredElements: ["Eau", "Feu", "Terre", "Air"],
               discoveredCategories: ["Elements Fondamentaux"],
               achievements: {},
               categoryProgress: {},
               lastSaved: null
           });
       }

       const progress = result.rows[0];
       let parsedProgress = {
           discoveredElements: ["Eau", "Feu", "Terre", "Air"],
           discoveredCategories: ["Elements Fondamentaux"],
           achievements: {},
           categoryProgress: {},
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
       } catch (error) {
           console.error('Erreur lors du parsing des données JSON:', error);
       }

       res.status(200).json(parsedProgress);

   } catch (error) {
       console.error('Erreur lors du chargement de la progression:', error);
       res.status(500).json({ message: 'Erreur lors du chargement de la progression' });
   }
});

module.exports = router;