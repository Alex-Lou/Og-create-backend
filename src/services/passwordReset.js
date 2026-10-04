// Mot de passe oublié : lien à usage unique envoyé par e-mail, valable 30 minutes.
// Seule l'empreinte SHA-256 du jeton est stockée.
const db = require('../config/db');
const transporter = require('../config/emailConfig');
const accounts = require('./accounts');
const authSession = require('./authSession');
const { newToken, digest } = require('../utils/crypto');
const { log } = require('../utils/logger');

const TOKEN_MINUTES = 30;
// Adresse du jeu dans le lien : fixée par la configuration, jamais lue dans la requête
const APP_URL = (process.env.APP_URL || 'https://og-create.onrender.com').replace(/\/$/, '');

// Envoie un lien si un compte existe pour cette adresse (l'appelant répond pareil dans tous les cas)
async function request(email) {
    const { rows } = await db.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (!rows.length) return;
    const user = rows[0];
    const token = newToken();
    // Un seul lien valable à la fois : les précédents sont annulés
    await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
    await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
        [user.id, digest(token), TOKEN_MINUTES]);
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Origins — nouveau mot de passe',
        text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable ${TOKEN_MINUTES} minutes, une seule fois) :\n${APP_URL}/?reset=${token}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.`
    });
    log('info', 'Lien de réinitialisation envoyé', { userId: user.id });
}

// Change le mot de passe si le jeton est valable ; vrai en cas de succès.
// Le jeton est consommé dans la même transaction (un second envoi du lien échoue) et toutes les sessions sont fermées.
function reset(token, password) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', [digest(token)]);
        if (!rows.length) return db.rollback(false);
        const userId = rows[0].user_id;
        await accounts.setPassword(userId, password, conn);
        await authSession.revokeAll(userId, conn);
        log('info', 'Mot de passe réinitialisé', { userId });
        return true;
    });
}

module.exports = { request, reset };
