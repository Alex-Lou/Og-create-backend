// Qui joue (compte ou invité) et ce qu'il a en main. Seul ce service ajoute un élément découvert :
// le navigateur ne peut jamais écrire lui-même son carnet.
const db = require('../config/db');
const { newToken, isToken, digest } = require('../utils/crypto');
const { verifyAccess, readCookie } = require('./authSession');
const { BASE_ELEMENTS } = require('./recipeBook');

const GUEST_COOKIE = 'oc_guest';
const GUEST_DAYS = 30;

// Sans durée : res.clearCookie doit recevoir les mêmes options, mais pas maxAge (il annulerait l'effacement)
function guestCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api'
    };
}

function readGuestToken(req) {
    const token = readCookie(req, GUEST_COOKIE);
    return isToken(token) ? token : null;
}

// { kind: 'user'|'guest', id, key } ou null
async function resolve(req) {
    const user = verifyAccess(req);
    if (user) return { kind: 'user', id: user.id, key: `u:${user.id}` };
    const token = readGuestToken(req);
    if (!token) return null;
    const { rows } = await db.query(
        'UPDATE guest_players SET last_seen = NOW() WHERE token_hash = $1 RETURNING id',
        [digest(token)]
    );
    return rows.length ? { kind: 'guest', id: rows[0].id, key: `g:${rows[0].id}` } : null;
}

// Nouveau carnet invité ; au passage, les carnets abandonnés sont effacés
async function createGuest(res) {
    await db.query('DELETE FROM guest_players WHERE last_seen < NOW() - make_interval(days => $1)', [GUEST_DAYS]);
    await db.query(`DELETE FROM play_runs WHERE updated_at < NOW() - INTERVAL '2 days'`);
    await db.query(`DELETE FROM book_letters WHERE owner LIKE 'g:%' AND updated_at < NOW() - make_interval(days => $1)`, [GUEST_DAYS]);
    const token = newToken();
    const { rows } = await db.query('INSERT INTO guest_players (token_hash) VALUES ($1) RETURNING id', [digest(token)]);
    res.cookie(GUEST_COOKIE, token, { ...guestCookieOptions(), maxAge: GUEST_DAYS * 24 * 3600 * 1000 });
    return { kind: 'guest', id: rows[0].id, key: `g:${rows[0].id}` };
}

const asList = value => (Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);

// Joueurs d'avant la bible (lot H1, HISTOIRE.md du dépôt front) : comptes créés avant le déploiement du lot. Rien ne
// recule pour eux : le chapitre II leur reste ouvert d'emblée, chaque habitant dont le bâtiment est bâti reste là,
// Cannelle arrive comblée. Un invité n'en est jamais un : le prologue est fait pour lui.
// Le lot H1 a été fusionné le 2026-10-05 à 21:40:27 UTC (PR #80) ; cette date-ci l'accompagne depuis. Ne pas
// l'avancer : un compte créé entre les deux a reçu les anciennes règles dès sa création, et les lui retirer le ferait
// reculer.
const VETERAN_BEFORE = new Date('2026-10-06T06:00:00Z');
async function veteranOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT created_at < $2 AS veteran FROM users WHERE id = $1', [userId, VETERAN_BEFORE]);
    return Boolean(rows[0]?.veteran);
}
const isVeteran = async owner => owner.kind === 'user' && veteranOf(owner.id);
// Le tutoriel de la v6 (bible, § 9 : ramasser, le feu bâti par le joueur, Cannelle attirée par le feu, Rivet après les
// poules) vaut pour les comptes créés à partir de V6_SINCE, juste après sa mise en ligne. Ne pas la reculer : un compte
// créé avant a reçu les anciennes règles (le feu allumé d'office), et les lui retirer le ferait reculer.
const V6_SINCE = new Date('2026-10-08T12:00:00Z');
async function freshOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT created_at >= $2 AS fresh FROM users WHERE id = $1', [userId, V6_SINCE]);
    return Boolean(rows[0]?.fresh);
}
// Une île recommencée (world.restartIsland, une fois par compte) suit les règles de l'île d'un compte neuf, quel que
// soit l'âge du compte : tutoriel de la v6, habitants un à un. Le Grimoire, lui, garde les siennes (isVeteran : le
// chapitre II ouvert d'emblée reste ouvert). Une ligne de world_items, sans donnée nouvelle
const RESTARTED = 'ile:recommencee';
const restartedSql = `EXISTS (SELECT 1 FROM world_items i WHERE i.user_id = users.id AND i.item = '${RESTARTED}')`;
async function islandVeteranOf(userId, conn = db) {
    const { rows } = await conn.query(`SELECT created_at < $2 AND NOT ${restartedSql} AS veteran FROM users WHERE id = $1`, [userId, VETERAN_BEFORE]);
    return Boolean(rows[0]?.veteran);
}
async function islandFreshOf(userId, conn = db) {
    const { rows } = await conn.query(`SELECT created_at >= $2 OR ${restartedSql} AS fresh FROM users WHERE id = $1`, [userId, V6_SINCE]);
    return Boolean(rows[0]?.fresh);
}

// Carnet de l'Infini
async function elements(owner) {
    if (owner.kind === 'user') {
        await db.query('INSERT INTO progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [owner.id]);
        const { rows } = await db.query('SELECT infinite_elements FROM progress WHERE user_id = $1', [owner.id]);
        return [...new Set([...BASE_ELEMENTS, ...asList(rows[0]?.infinite_elements)])];
    }
    const { rows } = await db.query('SELECT elements FROM guest_players WHERE id = $1', [owner.id]);
    return [...new Set([...BASE_ELEMENTS, ...asList(rows[0]?.elements)])];
}

// Ajoute un élément au carnet ; vrai s'il était nouveau (une seule écriture gagne en cas de course)
async function addElement(owner, name) {
    const { rowCount } = owner.kind === 'user'
        ? await db.query(
            `UPDATE progress SET infinite_elements = infinite_elements || to_jsonb($2::text)
             WHERE user_id = $1 AND NOT infinite_elements ? $2`, [owner.id, name])
        : await db.query(
            `UPDATE guest_players SET elements = elements || to_jsonb($2::text)
             WHERE id = $1 AND NOT elements ? $2`, [owner.id, name]);
    return rowCount > 0;
}

// Partie en cours de l'Épreuve (services/trial.js)
async function getRun(owner, mode) {
    const { rows } = await db.query('SELECT context, inventory, free_jokers FROM play_runs WHERE owner = $1 AND mode = $2', [owner.key, mode]);
    return rows[0] ? { context: rows[0].context, inventory: asList(rows[0].inventory), freeJokers: rows[0].free_jokers } : null;
}

async function addToRun(owner, mode, name) {
    const { rowCount } = await db.query(
        `UPDATE play_runs SET inventory = inventory || to_jsonb($3::text), updated_at = NOW()
         WHERE owner = $1 AND mode = $2 AND NOT inventory ? $3`, [owner.key, mode, name]);
    return rowCount > 0;
}

// Joker offert : décompte atomique, renvoie le reste ou null s'il n'y en a plus
async function takeFreeJoker(owner) {
    const { rows } = await db.query(
        `UPDATE play_runs SET free_jokers = free_jokers - 1
         WHERE owner = $1 AND mode = 'timer' AND free_jokers > 0 RETURNING free_jokers`, [owner.key]);
    return rows.length ? rows[0].free_jokers : null;
}

// Connexion ou inscription : les découvertes de l'invité (vérifiées par le serveur) rejoignent le compte
async function adoptGuest(req, res, userId) {
    const token = readGuestToken(req);
    if (!token) return;
    const { rows } = await db.query('DELETE FROM guest_players WHERE token_hash = $1 RETURNING id, elements', [digest(token)]);
    res.clearCookie(GUEST_COOKIE, guestCookieOptions());
    if (!rows.length) return;
    await db.query(`DELETE FROM play_runs WHERE owner = $1`, [`g:${rows[0].id}`]);
    await db.query(`DELETE FROM book_letters WHERE owner = $1`, [`g:${rows[0].id}`]);
    await db.query('INSERT INTO progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    await db.query(
        `UPDATE progress SET infinite_elements = (
           SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(infinite_elements || $2::jsonb) AS value
         ) WHERE user_id = $1`,
        [userId, JSON.stringify(asList(rows[0].elements))]
    );
}

module.exports = { VETERAN_BEFORE, veteranOf, isVeteran, V6_SINCE, freshOf, RESTARTED, islandVeteranOf, islandFreshOf, resolve, createGuest, elements, addElement, getRun, addToRun, takeFreeJoker, adoptGuest };
