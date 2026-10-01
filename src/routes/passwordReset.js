// Mot de passe oublié : lien à usage unique envoyé par e-mail, valable 30 minutes.
// Seule l'empreinte SHA-256 du jeton est stockée ; la réponse ne dit jamais si l'adresse existe.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const transporter = require('../config/emailConfig');
const { log } = require('../utils/logger');
const authSession = require('../services/authSession');

const router = express.Router();

const TOKEN_MINUTES = 30;
const MIN_PASSWORD_LENGTH = 8;
// Adresse du jeu dans le lien : fixée par la configuration, jamais lue dans la requête
const APP_URL = (process.env.APP_URL || 'https://og-create.onrender.com').replace(/\/$/, '');
const GENERIC_REPLY = { message: 'Si un compte existe pour cette adresse, un lien vient de lui être envoyé.' };

// Compteurs séparés par adresse IP : demandes de lien (5 / 15 min), changements (10 / 15 min)
const limiter = max => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de demandes, réessaie dans quelques minutes.' }
});

const digest = token => crypto.createHash('sha256').update(token).digest('hex');

router.post('/forgot-password', limiter(5), async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  if (!email || email.length > 255) return res.status(400).json({ message: 'Adresse e-mail requise' });

  try {
    const { rows } = await db.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (rows.length) {
      const user = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      // Un seul lien valable à la fois : les précédents sont annulés
      await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
      await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
        [user.id, digest(token), TOKEN_MINUTES]
      );
      const link = `${APP_URL}/?reset=${token}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Origins — nouveau mot de passe',
        text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable ${TOKEN_MINUTES} minutes, une seule fois) :\n${link}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.`
      });
      log('info', 'Lien de réinitialisation envoyé', { userId: user.id });
    }
  } catch (error) {
    // Même réponse qu'en cas de succès : un échec ne doit pas révéler que l'adresse existe
    log('error', 'Échec de la demande de réinitialisation', { errorMessage: error.message });
  }
  res.status(200).json(GENERIC_REPLY);
});

router.post('/reset-password', limiter(10), async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: 'Lien invalide ou expiré' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return res.status(400).json({ message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Le jeton est consommé dans la même transaction : un second envoi du lien échoue
    const { rows } = await client.query(
      `DELETE FROM password_resets
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING user_id`,
      [digest(token)]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Lien invalide ou expiré' });
    }
    const userId = rows[0].user_id;
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 12), userId]);
    // Toutes les sessions ouvertes sont fermées
    await authSession.revokeAll(userId, client);
    await client.query('COMMIT');
    log('info', 'Mot de passe réinitialisé', { userId });
    res.status(200).json({ message: 'Mot de passe changé. Tu peux te connecter.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    log('error', 'Échec de la réinitialisation', { errorMessage: error.message });
    res.status(500).json({ message: 'Le mot de passe n’a pas pu être changé, réessaie plus tard.' });
  } finally {
    client.release();
  }
});

module.exports = router;
