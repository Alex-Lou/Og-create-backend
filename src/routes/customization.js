// Le Cabinet (services/customization.js) : pièces disponibles, possédées, portées, et achat.
const express = require('express');
const customization = require('../services/customization');
const authMiddleware = require('../middleware/auth');
const { failure } = require('../utils/failure');
const T = require('../texts/customization');

const router = express.Router();
router.use(authMiddleware);

router.get('/items', async (req, res) => {
    try {
        res.json(await customization.items());
    } catch (error) {
        failure(res, T.ITEMS_FAILED, error);
    }
});

router.get('/unlocked', async (req, res) => {
    try {
        res.json(await customization.owned(req.user.id));
    } catch (error) {
        failure(res, T.UNLOCKED_FAILED, error);
    }
});

router.get('/selections', async (req, res) => {
    try {
        res.json(await customization.selections(req.user.id));
    } catch (error) {
        failure(res, T.SELECTIONS_FAILED, error);
    }
});

router.post('/selections', async (req, res) => {
    const { selectedFrame, selectedAvatar } = req.body;
    if (!selectedFrame || !selectedAvatar) return res.status(400).json({ message: T.SELECTION_REQUIRED });
    try {
        const done = await customization.select(req.user.id, selectedFrame, selectedAvatar);
        if (done.status) return res.status(done.status).json({ message: done.message });
        res.json({ message: T.SELECTIONS_SAVED, ...done });
    } catch (error) {
        failure(res, T.SELECTIONS_SAVE_FAILED, error);
    }
});

router.post('/purchase', async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ message: T.ITEM_REQUIRED });
    try {
        const done = await customization.purchase(req.user.id, itemId);
        if (done.status) {
            const { status, ...body } = done;
            return res.status(status).json(body);
        }
        res.json({ message: T.ITEM_BOUGHT, ...done });
    } catch (error) {
        failure(res, T.PURCHASE_FAILED, error);
    }
});

module.exports = router;
