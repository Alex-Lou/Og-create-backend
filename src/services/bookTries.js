// Le Livre : mélanges ratés sur une page à portée, comptés une fois chacun (compte seulement).
// Après quelques essais différents (barème du chapitre), l'encre de cette page est offerte ; la trace s'efface quand la page est trouvée.
const db = require('../config/db');

// Note l'essai (un même mélange ne compte qu'une fois) ; renvoie le nombre d'essais ratés sur la page
async function record(userId, page, combo) {
    await db.query(
        'INSERT INTO book_tries (user_id, page_id, combo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, page, combo]);
    return misses(userId, page);
}

async function misses(userId, page) {
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM book_tries WHERE user_id = $1 AND page_id = $2', [userId, page]);
    return rows[0].n;
}

// Essais ratés de chaque page : { pageId: n }
async function missesByPage(userId) {
    const { rows } = await db.query('SELECT page_id, COUNT(*)::int AS n FROM book_tries WHERE user_id = $1 GROUP BY page_id', [userId]);
    return Object.fromEntries(rows.map(r => [r.page_id, r.n]));
}

async function clear(userId, page) {
    await db.query('DELETE FROM book_tries WHERE user_id = $1 AND page_id = $2', [userId, page]);
}

module.exports = { record, misses, missesByPage, clear };
