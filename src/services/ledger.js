// Grand livre des écus : le serveur est seul à fixer le solde.
// Chaque mouvement est inscrit dans coin_ledger ; un gain porte une référence unique
// (question, record, récolte…) et n'est donc versé qu'une fois.
const db = require('../config/db');

// Crédite `amount` pour (reason, ref) si ce gain n'a jamais été versé : { credited, coins }.
// Sans `client`, ouvre sa propre transaction ; sinon s'inscrit dans celle de l'appelant.
async function credit(userId, amount, reason, ref, client = null) {
  if (!client) return db.transaction(conn => credit(userId, amount, reason, ref, conn));
  const entry = await client.query(
    `INSERT INTO coin_ledger (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, reason, ref) DO NOTHING RETURNING id`,
    [userId, amount, reason, String(ref)]
  );
  const credited = entry.rows.length > 0 && amount > 0;
  const { rows } = credited
    ? await client.query('UPDATE progress SET coins = coins + $1 WHERE user_id = $2 RETURNING coins', [amount, userId])
    : await client.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
  return { credited, coins: rows[0]?.coins ?? 0 };
}

// Débite `amount` si le solde suffit. Retourne le nouveau solde, ou null si le solde est insuffisant (rien n'est écrit).
// Sans `client`, ouvre sa propre transaction ; sinon s'inscrit dans celle de l'appelant.
async function debit(userId, amount, reason, client = null) {
  if (!client) return db.transaction(conn => debit(userId, amount, reason, conn));
  const { rows } = await client.query(
    'UPDATE progress SET coins = coins - $1 WHERE user_id = $2 AND coins >= $1 RETURNING coins',
    [amount, userId]
  );
  if (!rows.length) return null;
  await client.query('INSERT INTO coin_ledger (user_id, amount, reason) VALUES ($1, $2, $3)', [userId, -amount, reason]);
  return rows[0].coins;
}

async function balance(userId) {
  const { rows } = await db.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
  return rows[0]?.coins ?? 0;
}

module.exports = { credit, debit, balance };
