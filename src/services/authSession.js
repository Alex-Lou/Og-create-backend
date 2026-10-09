// Sessions en cookies httpOnly : le JavaScript du site ne voit jamais un jeton.
// - oc_access  : JWT court (15 min), envoyé sur /api
// - oc_refresh : jeton opaque (32 octets aléatoires), envoyé seulement sur /api/auth, changé à chaque usage.
// En base, seule l'empreinte SHA-256 du jeton de rafraîchissement est gardée (auth_sessions).
// Un jeton déjà remplacé qui revient = vol probable : toute la famille de session est révoquée.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { newToken, isToken, digest } = require('../utils/crypto');

const ACCESS_SECONDS = 15 * 60;
const REFRESH_DAYS = 30;
// Deux onglets qui rafraîchissent en même temps : le second jeton « déjà remplacé » est toléré ce délai
const RACE_SECONDS = Number(process.env.AUTH_RACE_SECONDS ?? 10);

const ACCESS_COOKIE = 'oc_access';
const REFRESH_COOKIE = 'oc_refresh';

function cookieOptions(path, maxAgeMs) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path,
        maxAge: maxAgeMs
    };
}

// Lecture des cookies sans dépendance : « a=1; b=2 »
function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index > 0 && part.slice(0, index).trim() === name) {
            try {
                return decodeURIComponent(part.slice(index + 1).trim());
            } catch {
                return null;
            }
        }
    }
    return null;
}

// Le jeton d'accès porte sa famille de session (sid) : il ne vaut que tant que cette session existe (checkAccess)
function signAccess(user, family) {
    return jwt.sign({ typ: 'access', username: user.username, sid: family }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        subject: String(user.id),
        expiresIn: ACCESS_SECONDS
    });
}

// Vérifie la signature et l'expiration du jeton d'accès du cookie, sans la base ; renvoie { id, username, sid, iat }
// ou null. Suffit pour nommer un joueur (clé de limite de requêtes), pas pour lui ouvrir une route : checkAccess
function verifyAccess(req) {
    const token = readCookie(req, ACCESS_COOKIE);
    if (!token) return null;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (payload.typ !== 'access' || !payload.sub) return null;
        return { id: Number(payload.sub), username: payload.username, sid: payload.sid, iat: payload.iat };
    } catch {
        return null;
    }
}

// Jetons d'avant le sid : acceptés seulement s'ils datent d'avant le démarrage de ce processus (ils expirent seuls
// en 15 min au plus). Personne n'en signe plus : un jeton sans sid plus récent n'est pas valable.
const STARTED_AT = Math.floor(Date.now() / 1000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Jeton d'accès valable ET session toujours ouverte : une déconnexion, un changement de mot de passe, une pause ou une
// suppression du compte (qui ferment les sessions) le coupent tout de suite, sans attendre ses 15 min.
// { id, username } ou null
async function checkAccess(req) {
    const user = verifyAccess(req);
    if (!user) return null;
    if (user.sid === undefined) return user.iat < STARTED_AT ? { id: user.id, username: user.username } : null;
    if (typeof user.sid !== 'string' || !UUID.test(user.sid)) return null;
    const { rows } = await db.query(
        `SELECT 1 FROM auth_sessions
         WHERE family = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [user.sid, user.id]
    );
    return rows.length ? { id: user.id, username: user.username } : null;
}

// Ouvre une session (ou continue une famille existante) et pose les deux cookies
async function issue(res, user, family = crypto.randomUUID(), client = db) {
    const refresh = newToken();
    await client.query(
        `INSERT INTO auth_sessions (user_id, family, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + make_interval(days => $4))`,
        [user.id, family, digest(refresh), REFRESH_DAYS]
    );
    res.cookie(ACCESS_COOKIE, signAccess(user, family), cookieOptions('/api', ACCESS_SECONDS * 1000));
    res.cookie(REFRESH_COOKIE, refresh, cookieOptions('/api/auth', REFRESH_DAYS * 24 * 3600 * 1000));
    return { userId: user.id, username: user.username };
}

function clearCookies(res) {
    res.clearCookie(ACCESS_COOKIE, cookieOptions('/api'));
    res.clearCookie(REFRESH_COOKIE, cookieOptions('/api/auth'));
}

// Échange le jeton de rafraîchissement contre un nouveau. Renvoie { user } ou { error, status }.
async function rotate(req, res) {
    const presented = readCookie(req, REFRESH_COOKIE);
    if (!isToken(presented)) return { status: 401, error: 'Session absente' };

    return db.transaction(async client => {
        const { rows } = await client.query(
            `SELECT s.id, s.family, s.revoked_at, s.expires_at > NOW() AS alive,
                    s.revoked_at > NOW() - make_interval(secs => $2) AS recent, u.id AS user_id, u.username
             FROM auth_sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1 FOR UPDATE OF s`,
            [digest(presented), RACE_SECONDS]
        );
        const session = rows[0];
        if (!session || !session.alive) return db.rollback({ status: 401, error: 'Session expirée' });
        if (session.revoked_at) {
            // Rafraîchissement concurrent d'un autre onglet : le navigateur a déjà le nouveau cookie
            if (session.recent) return db.rollback({ status: 409, error: 'Session déjà renouvelée', code: 'REFRESH_RACE' });
            // Réutilisation d'un ancien jeton : on coupe toute la famille
            await client.query('DELETE FROM auth_sessions WHERE family = $1', [session.family]);
            clearCookies(res);
            return { status: 401, error: 'Session révoquée' };
        }
        await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
        return { user: await issue(res, { id: session.user_id, username: session.username }, session.family, client) };
    });
}

// Déconnexion : la famille du jeton présenté est supprimée, les cookies effacés
async function revoke(req, res) {
    const presented = readCookie(req, REFRESH_COOKIE);
    if (isToken(presented)) {
        await db.query(
            'DELETE FROM auth_sessions WHERE family IN (SELECT family FROM auth_sessions WHERE token_hash = $1)',
            [digest(presented)]
        );
    }
    clearCookies(res);
}

// Toutes les sessions d'un compte (changement de mot de passe)
async function revokeAll(userId, client = db) {
    await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
}

module.exports = { issue, rotate, revoke, revokeAll, verifyAccess, checkAccess, readCookie };
