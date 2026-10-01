const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware d'authentification pour toutes les routes
router.use(authMiddleware);

// Objets possédés : par défaut, achetés, ou mérités par un succès débloqué
const OWNED_ITEMS_SQL = `
    SELECT ci.*
    FROM customization_items ci
    LEFT JOIN user_items ui ON ci.id = ui.item_id AND ui.user_id = $1
    LEFT JOIN progress p ON p.user_id = $1
    WHERE ci.is_default = true
       OR ui.user_id IS NOT NULL
       OR (ci.achievement IS NOT NULL AND (p.achievements -> ci.achievement ->> 'unlocked') = 'true')`;

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
        
        const result = await db.query(OWNED_ITEMS_SQL, [userId]);
        
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
        const unlockedItems = await db.query(OWNED_ITEMS_SQL, [userId]);
        
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

        // Une pièce méritée ne s'achète pas
        if (item.achievement) {
            return res.status(403).json({ message: `Cette pièce se mérite : succès « ${item.achievement} »` });
        }

        // Débit et déverrouillage sur une seule connexion, dans une transaction ;
        // le débit n'a lieu que si le solde suffit (pas de solde négatif en cas de double clic)
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const owned = await client.query(
                'INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT (user_id, item_id) DO NOTHING RETURNING id',
                [userId, itemId]
            );
            if (owned.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Vous possédez déjà cet item' });
            }
            const debit = await client.query(
                'UPDATE progress SET coins = coins - $1 WHERE user_id = $2 AND coins >= $1 RETURNING coins',
                [item.price, userId]
            );
            if (debit.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Vous n\'avez pas assez de pièces', required: item.price });
            }
            await client.query('COMMIT');
            res.status(200).json({
                message: 'Item acheté avec succès',
                item,
                remainingCoins: debit.rows[0].coins
            });
        } catch (transactionError) {
            await client.query('ROLLBACK').catch(() => {});
            throw transactionError;
        } finally {
            client.release();
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