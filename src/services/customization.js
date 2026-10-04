// Le Cabinet : pièces de sceau (cadres, emblèmes) par défaut, achetées en écus ou méritées par un succès.
const db = require('../config/db');

const DEFAULT_SELECTIONS = { selectedFrame: 'basicCadre.png', selectedAvatar: 'coin.png' };

// Objets possédés : par défaut, achetés, ou mérités par un succès débloqué
const OWNED_ITEMS_SQL = `
    SELECT ci.*
    FROM customization_items ci
    LEFT JOIN user_items ui ON ci.id = ui.item_id AND ui.user_id = $1
    LEFT JOIN progress p ON p.user_id = $1
    WHERE ci.is_default = true
       OR ui.user_id IS NOT NULL
       OR (ci.achievement IS NOT NULL AND (p.achievements -> ci.achievement ->> 'unlocked') = 'true')`;

async function items() {
    return (await db.query('SELECT * FROM customization_items ORDER BY type, price')).rows;
}

async function owned(userId) {
    return (await db.query(OWNED_ITEMS_SQL, [userId])).rows;
}

async function selections(userId) {
    const { rows } = await db.query('SELECT user_customization FROM progress WHERE user_id = $1', [userId]);
    return rows[0]?.user_customization || DEFAULT_SELECTIONS;
}

// Pièces portées : seulement des pièces possédées ; { status, message } en cas de refus
async function select(userId, selectedFrame, selectedAvatar) {
    const paths = (await owned(userId)).map(item => item.image_path);
    if (!paths.includes(selectedFrame) || !paths.includes(selectedAvatar)) {
        return { status: 403, message: 'Vous n\'avez pas déverrouillé ces items' };
    }
    await db.query('UPDATE progress SET user_customization = $1 WHERE user_id = $2', [{ selectedFrame, selectedAvatar }, userId]);
    return { selectedFrame, selectedAvatar };
}

// Achat : déverrouillage et débit dans une même transaction ; le débit n'a lieu que si le solde suffit
// (pas de solde négatif en cas de double clic). { status, message, required? } en cas de refus.
async function purchase(userId, itemId) {
    const { rows } = await db.query('SELECT * FROM customization_items WHERE id = $1', [itemId]);
    const item = rows[0];
    if (!item) return { status: 404, message: 'Item non trouvé' };
    // Une pièce méritée ne s'achète pas
    if (item.achievement) return { status: 403, message: `Cette pièce se mérite : succès « ${item.achievement} »` };
    return db.transaction(async conn => {
        const added = await conn.query(
            'INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT (user_id, item_id) DO NOTHING RETURNING id',
            [userId, itemId]);
        if (!added.rows.length) return db.rollback({ status: 400, message: 'Vous possédez déjà cet item' });
        const debit = await conn.query(
            'UPDATE progress SET coins = coins - $1 WHERE user_id = $2 AND coins >= $1 RETURNING coins',
            [item.price, userId]);
        if (!debit.rows.length) return db.rollback({ status: 400, message: 'Vous n\'avez pas assez de pièces', required: item.price });
        return { item, remainingCoins: debit.rows[0].coins };
    });
}

module.exports = { items, owned, selections, select, purchase };
