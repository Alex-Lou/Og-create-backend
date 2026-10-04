// Succès : la liste (publique) et ceux du joueur ; un succès n'est débloqué que si le serveur en vérifie la condition.
const express = require('express');
const achievementService = require('../services/achievementService');
const authMiddleware = require('../middleware/auth');
const { failure } = require('../utils/failure');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const achievements = await achievementService.getAllAchievements();
        if (!achievements.length) return res.status(404).json({ message: 'Aucun achievement trouvé' });
        res.json(achievements);
    } catch (error) {
        failure(res, 'Erreur lors de la récupération des achievements', error);
    }
});

// Le client demande une vérification ; seules ses dates de déblocage sont reprises
router.post('/update', authMiddleware, async (req, res) => {
    const { achievements } = req.body;
    if (!achievements || !Object.keys(achievements).length) return res.status(400).json({ message: 'Aucun achievement à mettre à jour' });
    try {
        res.json(await achievementService.updateUserAchievements(req.user.id, achievements));
    } catch (error) {
        failure(res, 'Erreur lors de la mise à jour des achievements', error);
    }
});

router.get('/user', authMiddleware, async (req, res) => {
    try {
        res.json(await achievementService.getUserAchievements(req.user.id));
    } catch (error) {
        failure(res, 'Erreur lors de la récupération des achievements', error);
    }
});

module.exports = router;
