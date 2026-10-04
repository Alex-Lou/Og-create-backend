// Comptes : inscription, connexion et changement de mot de passe (empreintes bcrypt).
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const BCRYPT_COST = 12;
// Empreinte sans compte associé (même coût), comparée quand l'adresse est inconnue
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const hashPassword = password => bcrypt.hash(password, BCRYPT_COST);

// Nom affiché : début de l'adresse et quatre chiffres
const usernameFor = email => `${email.split('@')[0]}_${Math.floor(Math.random() * 9000) + 1000}`;

// Nouveau compte ; null si l'adresse (ou le nom tiré) est déjà prise
async function register(email, password) {
    const username = usernameFor(email);
    const taken = await db.query('SELECT 1 FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (taken.rows.length) return null;
    const { rows } = await db.query(
        'INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, username',
        [email, await hashPassword(password), username]);
    return rows[0];
}

// Compte dont l'adresse et le mot de passe correspondent, ou null.
// Même travail (bcrypt) que l'adresse existe ou non : la durée ne trahit pas les comptes.
async function login(email, password) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const valid = await bcrypt.compare(String(password), user ? user.password_hash : DUMMY_HASH);
    return user && valid ? user : null;
}

async function setPassword(userId, password, conn = db) {
    await conn.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), userId]);
}

module.exports = { register, login, setPassword };
