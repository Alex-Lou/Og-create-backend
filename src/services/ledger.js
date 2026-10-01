// Grand livre des écus : le serveur est seul à fixer le solde.
// Chaque mouvement est inscrit dans coin_ledger ; un gain porte une référence unique
// (question, région, record…) et n'est donc versé qu'une fois.
const db = require('../config/db');

// Crédite `amount` pour (reason, ref) si ce gain n'a jamais été versé.
// Retourne { credited, coins } ; à appeler hors transaction ou avec un client déjà en transaction.
async function credit(userId, amount, reason, ref, client = null) {
  const own = !client;
  const conn = client || await db.pool.connect();
  try {
    if (own) await conn.query('BEGIN');
    const entry = await conn.query(
      `INSERT INTO coin_ledger (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, reason, ref) DO NOTHING RETURNING id`,
      [userId, amount, reason, String(ref)]
    );
    const credited = entry.rows.length > 0 && amount > 0;
    const { rows } = credited
      ? await conn.query('UPDATE progress SET coins = coins + $1 WHERE user_id = $2 RETURNING coins', [amount, userId])
      : await conn.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
    if (own) await conn.query('COMMIT');
    return { credited, coins: rows[0]?.coins ?? 0 };
  } catch (error) {
    if (own) await conn.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (own) conn.release();
  }
}

// Débite `amount` si le solde suffit. Retourne le nouveau solde, ou null si le solde est insuffisant.
async function debit(userId, amount, reason) {
  const conn = await db.pool.connect();
  try {
    await conn.query('BEGIN');
    const { rows } = await conn.query(
      'UPDATE progress SET coins = coins - $1 WHERE user_id = $2 AND coins >= $1 RETURNING coins',
      [amount, userId]
    );
    if (!rows.length) {
      await conn.query('ROLLBACK');
      return null;
    }
    await conn.query('INSERT INTO coin_ledger (user_id, amount, reason) VALUES ($1, $2, $3)', [userId, -amount, reason]);
    await conn.query('COMMIT');
    return rows[0].coins;
  } catch (error) {
    await conn.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

async function balance(userId) {
  const { rows } = await db.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
  return rows[0]?.coins ?? 0;
}

module.exports = { credit, debit, balance };
