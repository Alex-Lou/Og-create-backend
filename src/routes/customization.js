const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware d'authentification pour toutes les routes
router.use(authMiddleware);

// Récupérer tous les items disponibles
router.get('/items', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM customization_items ORDER BY type, price'
        );
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des items:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des items',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Récupérer les items déverrouillés pour l'utilisateur courant
router.get('/unlocked', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Récupérer les items déverrouillés + les items par défaut
        const result = await db.query(
            `SELECT ci.* 
             FROM customization_items ci
             LEFT JOIN user_items ui ON ci.id = ui.item_id AND ui.user_id = $1
             WHERE ui.user_id IS NOT NULL OR ci.is_default = true`,
            [userId]
        );
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des items déverrouillés:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des items déverrouillés',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Récupérer les sélections actuelles de l'utilisateur
router.get('/selections', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            'SELECT user_customization FROM progress WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0 || !result.rows[0].user_customization) {
            // Valeurs par défaut si aucune personnalisation n'est trouvée
            return res.status(200).json({
                selectedFrame: 'basicCadre.png',
                selectedAvatar: 'coin.png'
            });
        }
        
        res.status(200).json(result.rows[0].user_customization);
    } catch (error) {
        console.error('Erreur lors de la récupération des sélections:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des sélections',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Sauvegarder les sélections de l'utilisateur
router.post('/selections', async (req, res) => {
    try {
        const userId = req.user.id;
        const { selectedFrame, selectedAvatar } = req.body;
        
        if (!selectedFrame || !selectedAvatar) {
            return res.status(400).json({ message: 'Frame et avatar requis' });
        }
        
        // Vérifier que les items sélectionnés sont déverrouillés pour l'utilisateur
        const unlockedItems = await db.query(
            `SELECT ci.image_path 
             FROM customization_items ci
             LEFT JOIN user_items ui ON ci.id = ui.item_id AND ui.user_id = $1
             WHERE (ui.user_id IS NOT NULL OR ci.is_default = true)`,
            [userId]
        );
        
        const unlockedPaths = unlockedItems.rows.map(item => item.image_path);
        
        if (!unlockedPaths.includes(selectedFrame) || !unlockedPaths.includes(selectedAvatar)) {
            return res.status(403).json({ message: 'Vous n\'avez pas déverrouillé ces items' });
        }
        
        // Mettre à jour les sélections
        await db.query(
            `UPDATE progress 
             SET user_customization = $1 
             WHERE user_id = $2`,
            [{ selectedFrame, selectedAvatar }, userId]
        );
        
        res.status(200).json({ 
            message: 'Sélections sauvegardées avec succès',
            selectedFrame,
            selectedAvatar
        });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des sélections:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la sauvegarde des sélections',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Acheter un nouvel item
router.post('/purchase', async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemId } = req.body;
        
        if (!itemId) {
            return res.status(400).json({ message: 'ID de l\'item requis' });
        }
        
        // Récupérer les informations de l'item
        const itemResult = await db.query(
            'SELECT * FROM customization_items WHERE id = $1',
            [itemId]
        );
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ message: 'Item non trouvé' });
        }
        
        const item = itemResult.rows[0];
        
        // Vérifier si l'utilisateur a déjà déverrouillé cet item
        const alreadyUnlocked = await db.query(
            'SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2',
            [userId, itemId]
        );
        
        if (alreadyUnlocked.rows.length > 0) {
            return res.status(400).json({ message: 'Vous possédez déjà cet item' });
        }
        
        // Vérifier si l'utilisateur a assez de pièces
        const progressResult = await db.query(
            'SELECT coins FROM progress WHERE user_id = $1',
            [userId]
        );
        
        if (progressResult.rows.length === 0) {
            return res.status(404).json({ message: 'Progression non trouvée' });
        }
        
        const userCoins = progressResult.rows[0].coins;
        
        if (userCoins < item.price) {
            return res.status(400).json({ 
                message: 'Vous n\'avez pas assez de pièces',
                required: item.price,
                current: userCoins
            });
        }
        
        // Débiter les pièces et déverrouiller l'item (dans une transaction)
        await db.query('BEGIN');
        
        try {
            // Débiter les pièces
            await db.query(
                'UPDATE progress SET coins = coins - $1 WHERE user_id = $2',
                [item.price, userId]
            );
            
            // Déverrouiller l'item
            await db.query(
                'INSERT INTO user_items (user_id, item_id) VALUES ($1, $2)',
                [userId, itemId]
            );
            
            await db.query('COMMIT');
            
            // Récupérer le nouveau solde de pièces
            const newProgressResult = await db.query(
                'SELECT coins FROM progress WHERE user_id = $1',
                [userId]
            );
            
            const newCoins = newProgressResult.rows[0].coins;
            
            res.status(200).json({
                message: 'Item acheté avec succès',
                item,
                remainingCoins: newCoins
            });
        } catch (transactionError) {
            await db.query('ROLLBACK');
            throw transactionError;
        }
    } catch (error) {
        console.error('Erreur lors de l\'achat de l\'item:', error);
        res.status(500).json({ 
            message: 'Erreur lors de l\'achat de l\'item',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

module.exports = router;