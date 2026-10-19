// Le Cabinet (services/customization.js) : pièces disponibles, possédées, portées, et achat.
const express = require('express');
const customization = require('../services/customization');
const authMiddleware = require('../middleware/auth');
const { failsWith } = require('../utils/failure');
const T = require('../texts/customization');

const router = express.Router();
router.use(authMiddleware);

router.get('/items', failsWith(T.ITEMS_FAILED), async (req, res) => {
    res.json(await customization.items());
});

router.get('/unlocked', failsWith(T.UNLOCKED_FAILED), async (req, res) => {
    res.json(await customization.owned(req.user.id));
});

router.get('/selections', failsWith(T.SELECTIONS_FAILED), async (req, res) => {
    res.json(await customization.selections(req.user.id));
});

router.post('/selections', failsWith(T.SELECTIONS_SAVE_FAILED), async (req, res) => {
    const { selectedFrame, selectedAvatar } = req.body;
    if (!selectedFrame || !selectedAvatar) return res.status(400).json({ message: T.SELECTION_REQUIRED });
    const done = await customization.select(req.user.id, selectedFrame, selectedAvatar);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ message: T.SELECTIONS_SAVED, ...done });
});

router.post('/purchase', failsWith(T.PURCHASE_FAILED), async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ message: T.ITEM_REQUIRED });
    const done = await customization.purchase(req.user.id, itemId);
    if (done.status) {
        const { status, ...body } = done;
        return res.status(status).json(body);
    }
    res.json({ message: T.ITEM_BOUGHT, ...done });
});

module.exports = router;
