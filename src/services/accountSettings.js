// Réglages du compte (Sceau, « Mon compte ») : le profil, le mot de passe, une nouvelle adresse confirmée par un lien,
// la pause (suspendre en gardant tout), la suppression avec sept jours de grâce, et l'export des données (RGPD).
// Se reconnecter lève la pause et annule une suppression prévue (welcomeBack).
const bcrypt = require('bcrypt');
const db = require('../config/db');
const transporter = require('../config/emailConfig');
const accounts = require('./accounts');
const authSession = require('./authSession');
const { newToken, digest } = require('../utils/crypto');
const { log } = require('../utils/logger');

const EMAIL_MINUTES = 60;
const GRACE_DAYS = 7;
const MAIL_MS = Number(process.env.MAIL_TIMEOUT_MS) || 12000;
// Adresse du jeu dans le lien : fixée par la configuration, jamais lue dans la requête
const APP_URL = (process.env.APP_URL || 'https://og-create.onrender.com').replace(/\/$/, '');
// Ce que l'export ne donne jamais : empreintes de mot de passe et de jetons
const SECRET_TABLES = new Set(['auth_sessions', 'password_resets', 'email_changes']);

const userOf = async (userId, conn = db) => (await conn.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0] || null;
const passwordOk = (user, password) => bcrypt.compare(String(password || ''), user.password_hash);

// Ce que montre « Mon compte »
async function profileOf(userId) {
    const user = await userOf(userId);
    if (!user) return null;
    const [{ rows }, named, avatar] = await Promise.all([
        db.query('SELECT new_email FROM email_changes WHERE user_id = $1 AND expires_at > NOW()', [userId]),
        db.query(`SELECT name FROM world_names WHERE user_id = $1 AND target = 'joueur'`, [userId]),
        db.query('SELECT look FROM world_avatars WHERE user_id = $1', [userId])
    ]);
    // Le nom et l'avatar du joueur sur son île (Grimoire, carte d'embarquement) : modifiables par /play/world/player et /avatar
    return {
        name: named.rows[0]?.name || null,
        look: avatar.rows[0]?.look || null,
        email: accounts.isProvisional(user.email) ? null : user.email,
        username: user.username,
        createdAt: user.created_at,
        provisional: accounts.isProvisional(user.email),
        pendingEmail: rows[0]?.new_email || null
    };
}

// Un compte provisoire n'a ni adresse ni mot de passe : il signe d'abord sa page de garde
const SIGN_FIRST = { status: 403, message: 'Signe d’abord la page de garde du Grimoire : ton compte aura alors une adresse et un mot de passe.' };
const WRONG_PASSWORD = { status: 403, message: 'Mot de passe incorrect.' };

// Nouveau mot de passe : l'ancien d'abord ; toutes les sessions sont fermées (l'appelant en rouvre une). { user } ou refus
async function changePassword(userId, current, next) {
    const problem = accounts.passwordProblem(next);
    if (problem) return { status: 400, message: problem };
    const user = await userOf(userId);
    if (!user) return { status: 404, message: 'Compte introuvable.' };
    if (accounts.isProvisional(user.email)) return SIGN_FIRST;
    if (!(await passwordOk(user, current))) return WRONG_PASSWORD;
    return db.transaction(async conn => {
        await accounts.setPassword(userId, next, conn);
        await authSession.revokeAll(userId, conn);
        log('info', 'Mot de passe changé', { userId });
        return { user };
    });
}

// Nouvelle adresse : un lien part vers elle ; elle ne remplace l'ancienne qu'une fois le lien ouvert. {} ou refus
async function requestEmailChange(userId, password, email) {
    const user = await userOf(userId);
    if (!user) return { status: 404, message: 'Compte introuvable.' };
    if (accounts.isProvisional(user.email)) return SIGN_FIRST;
    if (!(await passwordOk(user, password))) return WRONG_PASSWORD;
    if (email.toLowerCase() === user.email.toLowerCase()) return { status: 400, message: 'C’est déjà ton adresse.' };
    const taken = await db.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (taken.rows.length) return { status: 409, message: 'Cette adresse est déjà prise.' };
    const token = newToken();
    await db.query(
        `INSERT INTO email_changes (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))
         ON CONFLICT (user_id) DO UPDATE SET new_email = EXCLUDED.new_email, token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
        [userId, email, digest(token), EMAIL_MINUTES]);
    try {
        // Un serveur de mail qui ne répond pas ne fait pas attendre le joueur (le client abandonne à 20 s)
        let timer;
        const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Serveur de mail muet')), MAIL_MS); });
        await Promise.race([late, transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Brumelune — confirme ta nouvelle adresse',
            text: `Bonjour,\n\nPour que cette adresse devienne celle de ton compte Brumelune, ouvre ce lien (valable ${EMAIL_MINUTES} minutes, une seule fois) :\n${APP_URL}/?email=${token}\n\nSi tu n'as rien demandé, ignore ce message : rien ne change.`
        })]).finally(() => clearTimeout(timer));
    } catch (error) {
        // Le lien ne part pas : la demande n'attend pas pour rien
        await db.query('DELETE FROM email_changes WHERE user_id = $1', [userId]);
        log('error', 'Lien de nouvelle adresse non envoyé', { userId, errorMessage: error.message });
        return { status: 503, message: 'Le mail n’a pas pu partir. Réessaie un peu plus tard.' };
    }
    log('info', 'Lien de nouvelle adresse envoyé', { userId });
    return {};
}

// Le lien ouvert : l'adresse change (une fois ; si elle a été prise entre-temps, refus). { email } ou refus
function confirmEmailChange(token) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'DELETE FROM email_changes WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id, new_email', [digest(token)]);
        if (!rows.length) return db.rollback({ status: 400, message: 'Lien invalide ou expiré.' });
        const { user_id: userId, new_email: email } = rows[0];
        const taken = await conn.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2', [email, userId]);
        if (taken.rows.length) return { status: 409, message: 'Cette adresse a été prise entre-temps.' };
        await conn.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
        log('info', 'Adresse changée', { userId });
        return { email };
    });
}

// En pause : l'île est gardée telle quelle, aucun mail ne part ; toutes les sessions sont fermées
async function suspend(userId) {
    const user = await userOf(userId);
    if (!user) return { status: 404, message: 'Compte introuvable.' };
    if (accounts.isProvisional(user.email)) return SIGN_FIRST;
    await db.transaction(async conn => {
        await conn.query('UPDATE users SET suspended_at = NOW() WHERE id = $1', [userId]);
        await authSession.revokeAll(userId, conn);
    });
    log('info', 'Compte suspendu', { userId });
    return {};
}

// Suppression prévue dans GRACE_DAYS jours (mot de passe d'abord) ; toutes les sessions sont fermées. { deleteAt } ou refus
async function scheduleDeletion(userId, password) {
    const user = await userOf(userId);
    if (!user) return { status: 404, message: 'Compte introuvable.' };
    if (accounts.isProvisional(user.email)) return SIGN_FIRST;
    if (!(await passwordOk(user, password))) return WRONG_PASSWORD;
    const deleteAt = await db.transaction(async conn => {
        const { rows } = await conn.query(
            'UPDATE users SET delete_at = NOW() + make_interval(days => $2) WHERE id = $1 RETURNING delete_at', [userId, GRACE_DAYS]);
        await authSession.revokeAll(userId, conn);
        return rows[0].delete_at;
    });
    log('info', 'Suppression du compte prévue', { userId });
    return { deleteAt };
}

// Retour d'un joueur (connexion) : la pause est levée, une suppression prévue est annulée. 'suspendu', 'suppression' ou
// null (rien à dire)
async function welcomeBack(userId) {
    const { rows } = await db.query(
        `UPDATE users u SET suspended_at = NULL, delete_at = NULL FROM users old
         WHERE u.id = $1 AND old.id = u.id AND (old.suspended_at IS NOT NULL OR old.delete_at IS NOT NULL)
         RETURNING old.suspended_at, old.delete_at`, [userId]);
    if (!rows.length) return null;
    log('info', 'Retour d’un compte en pause ou en partance', { userId });
    return rows[0].delete_at ? 'suppression' : 'suspendu';
}

// Les comptes dont la grâce est passée s'effacent, avec tout ce qui va avec (ON DELETE CASCADE). Nombre effacé
async function sweepDeleted() {
    const { rowCount } = await db.query('DELETE FROM users WHERE delete_at IS NOT NULL AND delete_at <= NOW()');
    if (rowCount) log('info', 'Comptes supprimés après leur délai de grâce', { count: rowCount });
    return rowCount;
}

// Tout ce que le jeu garde sur le joueur : son compte (sans empreinte) et ses lignes de chaque table à user_id
async function exportOf(userId) {
    const user = await userOf(userId);
    if (!user) return null;
    const { password_hash: _hash, ...account } = user;
    const { rows: tables } = await db.query(
        `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'user_id'
         ORDER BY table_name`);
    const data = {};
    for (const { table_name: name } of tables) {
        if (SECRET_TABLES.has(name) || !/^[a-z_]+$/.test(name)) continue;
        const { rows } = await db.query(`SELECT * FROM ${name} WHERE user_id = $1`, [userId]);
        if (rows.length) data[name] = rows;
    }
    return { exportedAt: new Date().toISOString(), account, data };
}

module.exports = {
    GRACE_DAYS, profileOf, changePassword, requestEmailChange, confirmEmailChange, suspend, scheduleDeletion, welcomeBack,
    sweepDeleted, exportOf
};
