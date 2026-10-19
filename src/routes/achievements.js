// Succès : la liste (publique) et ceux du joueur ; un succès n'est débloqué que si le serveur en vérifie la condition.
const express = require('express');
const achievementService = require('../services/achievementService');
const authMiddleware = require('../middleware/auth');
const { failsWith } = require('../utils/failure');
const T = require('../texts/progress');

const router = express.Router();

router.get('/', failsWith(T.ACHIEVEMENTS_FAILED), async (req, res) => {
    const achievements = await achievementService.getAllAchievements();
    if (!achievements.length) return res.status(404).json({ message: T.NO_ACHIEVEMENT });
    res.json(achievements);
});

// Le client demande une vérification ; seules ses dates de déblocage sont reprises
router.post('/update', authMiddleware, failsWith(T.ACHIEVEMENTS_UPDATE_FAILED), async (req, res) => {
    const { achievements } = req.body;
    if (!achievements || !Object.keys(achievements).length) return res.status(400).json({ message: T.NOTHING_TO_UPDATE });
    res.json(await achievementService.updateUserAchievements(req.user.id, achievements));
});

router.get('/user', authMiddleware, failsWith(T.ACHIEVEMENTS_FAILED), async (req, res) => {
    res.json(await achievementService.getUserAchievements(req.user.id));
});

module.exports = router;
