// Le Cabinet (services/customization.js) : pièces disponibles, possédées, portées, et achat.
const express = require('express');
const customization = require('../services/customization');
const authMiddleware = require('../middleware/auth');
const { failure } = require('../utils/failure');

const router = express.Router();
router.use(authMiddleware);

router.get('/items', async (req, res) => {
    try {
        res.json(await customization.items());
    } catch (error) {
        failure(res, 'Erreur lors de la récupération des items', error);
    }
});

router.get('/unlocked', async (req, res) => {
    try {
        res.json(await customization.owned(req.user.id));
    } catch (error) {
        failure(res, 'Erreur lors de la récupération des items déverrouillés', error);
    }
});

router.get('/selections', async (req, res) => {
    try {
        res.json(await customization.selections(req.user.id));
    } catch (error) {
        failure(res, 'Erreur lors de la récupération des sélections', error);
    }
});

router.post('/selections', async (req, res) => {
    const { selectedFrame, selectedAvatar } = req.body;
    if (!selectedFrame || !selectedAvatar) return res.status(400).json({ message: 'Frame et avatar requis' });
    try {
        const done = await customization.select(req.user.id, selectedFrame, selectedAvatar);
        if (done.status) return res.status(done.status).json({ message: done.message });
        res.json({ message: 'Sélections sauvegardées avec succès', ...done });
    } catch (error) {
        failure(res, 'Erreur lors de la sauvegarde des sélections', error);
    }
});

router.post('/purchase', async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ message: 'ID de l\'item requis' });
    try {
        const done = await customization.purchase(req.user.id, itemId);
        if (done.status) {
            const { status, ...body } = done;
            return res.status(status).json(body);
        }
        res.json({ message: 'Item acheté avec succès', ...done });
    } catch (error) {
        failure(res, 'Erreur lors de l\'achat de l\'item', error);
    }
});

module.exports = router;
