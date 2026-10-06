// Comptes : inscription, connexion et changement de mot de passe (empreintes bcrypt).
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const BCRYPT_COST = 12;
// Empreinte sans compte associé (même coût), comparée quand l'adresse est inconnue
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const hashPassword = password => bcrypt.hash(password, BCRYPT_COST);

// Nouveau mot de passe : 8 caractères au moins, sur une ligne ; 72 octets au plus, car bcrypt ne lit que les 72
// premiers (au-delà, la fin ne compterait pas). Les mots de passe déjà choisis ne changent pas. Ce qui ne va pas
// (texte), ou null
const PASSWORD_MAX_BYTES = 72;
function passwordProblem(password) {
    if (typeof password !== 'string' || !/^.{8,}$/.test(password)) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'Mot de passe trop long : 72 caractères au plus (moins avec des accents ou des emojis).';
    return null;
}

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

// Compte provisoire (bible v6, § 9 ; V20) : le tutoriel ouvre l'île avant le compte. Son adresse est réservée et ne
// mène nulle part (« .invalid », RFC 2606) ; son mot de passe, tiré au hasard, n'est connu de personne : seule la
// session de l'appareil l'ouvre. Signer la page de garde (claim) y met la vraie adresse et le vrai mot de passe.
const PROVISIONAL_DOMAIN = 'provisoire.invalid';
const isProvisional = email => typeof email === 'string' && email.endsWith(`@${PROVISIONAL_DOMAIN}`);
async function registerProvisional() {
    const tag = crypto.randomBytes(8).toString('hex');
    const { rows } = await db.query(
        'INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, username',
        [`naufrage-${tag}@${PROVISIONAL_DOMAIN}`, await hashPassword(crypto.randomBytes(24).toString('hex')), `naufrage_${tag}`]);
    return rows[0];
}
async function provisionalOf(userId) {
    const { rows } = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    return rows.length > 0 && isProvisional(rows[0].email);
}

// Signer : le compte provisoire prend l'adresse et le mot de passe du joueur (une seule fois). { user }, ou
// { status, message } si le compte n'est pas provisoire ou si l'adresse est prise
async function claim(userId, email, password) {
    return db.transaction(async conn => {
        const { rows } = await conn.query('SELECT email FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Compte introuvable.' });
        if (!isProvisional(rows[0].email)) return db.rollback({ status: 409, message: 'Ce compte a déjà son adresse.' });
        const username = usernameFor(email);
        const taken = await conn.query('SELECT 1 FROM users WHERE (LOWER(email) = LOWER($1) OR username = $2) AND id <> $3', [email, username, userId]);
        if (taken.rows.length) return db.rollback({ status: 400, message: 'Email ou username déjà utilisé' });
        const updated = await conn.query(
            'UPDATE users SET email = $1, password_hash = $2, username = $3 WHERE id = $4 RETURNING id, email, username',
            [email, await hashPassword(password), username, userId]);
        return { user: updated.rows[0] };
    });
}

// Les comptes provisoires abandonnés (aucune session depuis PROVISIONAL_DAYS jours) s'effacent, avec tout ce qui va
// avec (île, carnet : ON DELETE CASCADE). Au plus une fois par heure, sauf si force ; renvoie le nombre de comptes effacés
const PROVISIONAL_DAYS = 30;
let sweptAt = 0;
async function sweepProvisional({ force = false, now = Date.now() } = {}) {
    if (!force && now - sweptAt < 3600 * 1000) return 0;
    sweptAt = now;
    const { rowCount } = await db.query(
        `DELETE FROM users u WHERE u.email LIKE $1 AND u.created_at < NOW() - make_interval(days => $2)
           AND NOT EXISTS (SELECT 1 FROM auth_sessions s WHERE s.user_id = u.id AND s.created_at > NOW() - make_interval(days => $2))`,
        [`%@${PROVISIONAL_DOMAIN}`, PROVISIONAL_DAYS]);
    return rowCount;
}

module.exports = {
    passwordProblem, register, login, setPassword,
    PROVISIONAL_DAYS, isProvisional, registerProvisional, provisionalOf, claim, sweepProvisional
};
