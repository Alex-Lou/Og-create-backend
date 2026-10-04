// Le pendu des pages du Livre, gardé par joueur et par page (owner = 'u:<id>' | 'g:<id>').
// Chaque lettre passe par une transaction sur la ligne verrouillée : un double envoi ne compte pas deux erreurs.
const db = require('../config/db');
const ledger = require('./ledger');
const { judge, solvedBy, failedUntil } = require('./hangman');

const RETRY_PRICE = 20;

// Parties en cours du joueur : { pageId: { letters, revealed, misses, failed_at } }
async function byPage(owner) {
    const { rows } = await db.query('SELECT page_id, letters, revealed, misses, failed_at FROM book_letters WHERE owner = $1', [owner.key]);
    return Object.fromEntries(rows.map(({ page_id: id, ...row }) => [id, row]));
}

// Pose `letter` en `position` (case encore cachée). { row, verdict, solved } ; { blocked: row } si la partie est perdue
// depuis moins de 24 h ; { invalid: true } si la case est déjà visible. first : la page donne la première lettre.
function guess(owner, page, name, position, letter, max, first) {
    return db.transaction(async conn => {
        await conn.query('INSERT INTO book_letters (owner, page_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [owner.key, page]);
        const { rows: [row] } = await conn.query(
            'SELECT letters, revealed, misses, failed_at FROM book_letters WHERE owner = $1 AND page_id = $2 FOR UPDATE', [owner.key, page]);
        if (failedUntil(row)) return { blocked: row };
        const revealed = row.revealed || [];
        if (revealed.includes(position) || (first && position === 0)) return { invalid: true };
        // Échec de la veille : toutes les vies reviennent, les lettres déjà posées restent
        let misses = row.failed_at ? 0 : row.misses;
        let failedAt = null;
        const verdict = judge(name, position, letter);
        const known = row.letters.includes(letter);
        if (verdict === 'hit') revealed.push(position);
        // Une lettre absente ne coûte qu'une fois ; une lettre présente mais mal placée ne coûte rien
        if (verdict === 'miss' && !known) misses++;
        if (misses >= max) failedAt = new Date();
        const letters = known ? row.letters : row.letters + letter;
        const { rows: [saved] } = await conn.query(
            `UPDATE book_letters SET letters = $3, revealed = $4, misses = $5, failed_at = $6, updated_at = NOW()
             WHERE owner = $1 AND page_id = $2 RETURNING letters, revealed, misses, failed_at`,
            [owner.key, page, letters, revealed, misses, failedAt]);
        return { row: saved, verdict, solved: solvedBy(name, revealed, first) };
    });
}

// Rejouer tout de suite une partie perdue, contre des écus (compte). { row, coins } ou { status, message }.
function retry(owner, page) {
    return db.transaction(async conn => {
        const { rows: [row] } = await conn.query(
            'SELECT letters, revealed, misses, failed_at FROM book_letters WHERE owner = $1 AND page_id = $2 FOR UPDATE', [owner.key, page]);
        if (!failedUntil(row)) return { status: 409, message: 'Cette partie n’est pas perdue.' };
        const coins = await ledger.debit(owner.id, RETRY_PRICE, 'pendu', conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${RETRY_PRICE} écus.` });
        const { rows: [saved] } = await conn.query(
            `UPDATE book_letters SET misses = 0, failed_at = NULL, updated_at = NOW()
             WHERE owner = $1 AND page_id = $2 RETURNING letters, revealed, misses, failed_at`, [owner.key, page]);
        return { row: saved, coins };
    });
}

// Page trouvée, ou carnet invité qui rejoint un compte : la partie n'a plus d'usage
async function clear(ownerKey, page = null) {
    if (page) await db.query('DELETE FROM book_letters WHERE owner = $1 AND page_id = $2', [ownerKey, page]);
    else await db.query('DELETE FROM book_letters WHERE owner = $1', [ownerKey]);
}

module.exports = { RETRY_PRICE, byPage, guess, retry, clear };
