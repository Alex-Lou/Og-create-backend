// Le pendu des pages du Livre, gardé par joueur et par page (owner = 'u:<id>' | 'g:<id>').
// Chaque lettre passe par une transaction sur la ligne verrouillée : un double envoi ne compte pas deux erreurs.
const db = require('../config/db');
const ledger = require('./ledger');
const { has, solvedBy, failedUntil } = require('./hangman');

const RETRY_PRICE = 20;

// Parties en cours du joueur : { pageId: { letters, misses, failed_at } }
async function byPage(owner) {
    const { rows } = await db.query('SELECT page_id, letters, misses, failed_at FROM book_letters WHERE owner = $1', [owner.key]);
    return Object.fromEntries(rows.map(({ page_id: id, ...row }) => [id, row]));
}

// Propose une lettre. { row } (état à jour) ou { blocked: row } si la partie est perdue depuis moins de 24 h.
// first : la page donne déjà la première lettre.
function guess(owner, page, name, letter, max, first) {
    return db.transaction(async conn => {
        await conn.query('INSERT INTO book_letters (owner, page_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [owner.key, page]);
        const { rows: [row] } = await conn.query(
            'SELECT letters, misses, failed_at FROM book_letters WHERE owner = $1 AND page_id = $2 FOR UPDATE', [owner.key, page]);
        if (failedUntil(row)) return { blocked: row };
        // Échec de la veille : toutes les vies reviennent, les lettres déjà proposées restent
        let { letters, misses } = row;
        if (row.failed_at) misses = 0;
        let failedAt = null;
        if (!solvedBy(name, letters, first) && !letters.includes(letter)) {
            letters += letter;
            if (!has(name, letter)) misses++;
            if (misses >= max) failedAt = new Date();
        }
        const { rows: [saved] } = await conn.query(
            `UPDATE book_letters SET letters = $3, misses = $4, failed_at = $5, updated_at = NOW()
             WHERE owner = $1 AND page_id = $2 RETURNING letters, misses, failed_at`,
            [owner.key, page, letters, misses, failedAt]);
        return { row: saved };
    });
}

// Rejouer tout de suite une partie perdue, contre des écus (compte). { row, coins } ou { status, message }.
function retry(owner, page) {
    return db.transaction(async conn => {
        const { rows: [row] } = await conn.query(
            'SELECT letters, misses, failed_at FROM book_letters WHERE owner = $1 AND page_id = $2 FOR UPDATE', [owner.key, page]);
        if (!failedUntil(row)) return { status: 409, message: 'Cette partie n’est pas perdue.' };
        const coins = await ledger.debit(owner.id, RETRY_PRICE, 'pendu', conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${RETRY_PRICE} écus.` });
        const { rows: [saved] } = await conn.query(
            `UPDATE book_letters SET misses = 0, failed_at = NULL, updated_at = NOW()
             WHERE owner = $1 AND page_id = $2 RETURNING letters, misses, failed_at`, [owner.key, page]);
        return { row: saved, coins };
    });
}

// Page trouvée, ou carnet invité qui rejoint un compte : la partie n'a plus d'usage
async function clear(ownerKey, page = null) {
    if (page) await db.query('DELETE FROM book_letters WHERE owner = $1 AND page_id = $2', [ownerKey, page]);
    else await db.query('DELETE FROM book_letters WHERE owner = $1', [ownerKey]);
}

module.exports = { RETRY_PRICE, byPage, guess, retry, clear };
