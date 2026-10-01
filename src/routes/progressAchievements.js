const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { log } = require('../utils/logger');
const achievementService = require('../services/achievementService');

// Route principale pour récupérer tous les achievements
router.get('/', async (req, res) => {
  try {
    // Utiliser le service pour récupérer tous les achievements
    const achievements = await achievementService.getAllAchievements();
    
    if (achievements.length === 0) {
      return res.status(404).json({ 
        message: 'Aucun achievement trouvé' 
      });
    }
    
    res.status(200).json(achievements);
  } catch (error) {
    log('error', 'Erreur lors de la récupération des achievements', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route pour mettre à jour les achievements de l'utilisateur
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { achievements } = req.body;
    
    log('debug', 'Mise à jour des achievements', { userId });
    
    if (!achievements || Object.keys(achievements).length === 0) {
      return res.status(400).json({ 
        message: 'Aucun achievement à mettre à jour' 
      });
    }

    // Utiliser le service centralisé pour mettre à jour les achievements
    const result = await achievementService.updateUserAchievements(userId, achievements);

    res.status(200).json(result);
  } catch (error) {
    log('error', 'Erreur lors de la mise à jour des achievements', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour des achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route pour vérifier et débloquer les achievements en fonction des éléments découverts
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { discoveredElements } = req.body;
    
    log('debug', 'Vérification des achievements', { userId });
    
    if (!discoveredElements || !Array.isArray(discoveredElements)) {
      return res.status(400).json({ 
        message: 'Liste d\'éléments découverts requise' 
      });
    }

    // Utiliser le service pour vérifier et mettre à jour les achievements
    const result = await achievementService.checkAndUpdateAchievements(userId, discoveredElements);

    res.status(200).json({
      message: 'Achievements vérifiés avec succès',
      newlyUnlocked: result.newlyUnlocked,
      achievements: result.achievements
    });
  } catch (error) {
    log('error', 'Erreur lors de la vérification des achievements', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification des achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route pour récupérer les achievements de l'utilisateur
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Utiliser le service pour récupérer les achievements de l'utilisateur
    const achievements = await achievementService.getUserAchievements(userId);
    
    res.status(200).json(achievements);
  } catch (error) {
    log('error', 'Erreur lors de la récupération des achievements de l\'utilisateur', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;