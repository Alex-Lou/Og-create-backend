// Le Monde : l'île du joueur. Chaque élément découvert peut y être posé une fois, sur une case libre.
// Chaque objet posé produit des écus (RATE par heure), dans un réservoir plein en CAP_HOURS heures.
// La récolte se fait dans une transaction qui verrouille la ligne du joueur : elle n'est jamais payée deux fois.
const db = require('../config/db');
const ledger = require('./ledger');

const RATE = 1; // écus par heure et par objet
const CAP_HOURS = 8;

// L'île s'agrandit avec les découvertes (hors 4 éléments de base)
const GROWTH = [[0, 6], [40, 7], [80, 8], [150, 9], [250, 10]];
function sizeFor(discoveries) {
    return GROWTH.reduce((size, [need, value]) => (discoveries >= need ? value : size), GROWTH[0][1]);
}

// Écus en attente : chaque objet compte depuis sa pose ou la dernière récolte, réservoir plafonné
function pendingOf(tiles, collectedAt, now = Date.now()) {
    const since = collectedAt ? new Date(collectedAt).getTime() : 0;
    let hours = 0;
    for (const tile of tiles) {
        const start = Math.max(since, new Date(tile.placed_at).getTime());
        hours += Math.min(CAP_HOURS, Math.max(0, (now - start) / 3600000));
    }
    return Math.floor(hours * RATE);
}

async function tilesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, element, placed_at FROM world_tiles WHERE user_id = $1 ORDER BY y, x', [userId]);
    return rows;
}
async function collectedAtOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT world_collected_at FROM progress WHERE user_id = $1', [userId]);
    return rows[0]?.world_collected_at || null;
}

// Vue de l'île pour le navigateur (describe ajoute glyphe et famille de chaque objet)
async function view(userId, discoveries, describe) {
    const tiles = await tilesOf(userId);
    const known = describe(tiles.map(t => t.element));
    return {
        size: sizeFor(discoveries),
        rate: RATE,
        capHours: CAP_HOURS,
        pending: pendingOf(tiles, await collectedAtOf(userId)),
        tiles: tiles.map(t => ({ x: t.x, y: t.y, element: t.element, ...(known[t.element] || {}) }))
    };
}

// Pose (ou déplace) un élément possédé sur une case libre ; { status, message } en cas de refus
async function place(userId, owned, element, x, y) {
    const discoveries = owned.length - 4;
    const size = sizeFor(discoveries);
    if (!owned.includes(element)) return { status: 403, message: 'Cet élément n’est pas dans ton carnet.' };
    if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < size)) return { status: 400, message: 'Case hors de l’île.' };
    const conn = await db.pool.connect();
    try {
        await conn.query('BEGIN');
        const occupied = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
        if (occupied.rows.length && occupied.rows[0].element !== element) {
            await conn.query('ROLLBACK');
            return { status: 409, message: 'Cette case est déjà occupée.' };
        }
        // Déjà posé ailleurs : on le déplace (sa production continue), sinon on le pose
        const moved = await conn.query('UPDATE world_tiles SET x = $3, y = $4 WHERE user_id = $1 AND element = $2 RETURNING element', [userId, element, x, y]);
        if (!moved.rows.length) {
            await conn.query('INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, $2, $3, $4)', [userId, x, y, element]);
        }
        await conn.query('COMMIT');
        return {};
    } catch (error) {
        await conn.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        conn.release();
    }
}

async function remove(userId, x, y) {
    await db.query('DELETE FROM world_tiles WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
}

// Récolte : { gained, coins }
async function collect(userId) {
    const conn = await db.pool.connect();
    try {
        await conn.query('BEGIN');
        const { rows } = await conn.query('SELECT world_collected_at FROM progress WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!rows.length) {
            await conn.query('ROLLBACK');
            return { gained: 0, coins: 0 };
        }
        const now = new Date();
        const gained = pendingOf(await tilesOf(userId, conn), rows[0].world_collected_at, now.getTime());
        if (!gained) {
            await conn.query('ROLLBACK');
            return { gained: 0, coins: await ledger.balance(userId) };
        }
        await conn.query('UPDATE progress SET world_collected_at = $2 WHERE user_id = $1', [userId, now]);
        const { coins } = await ledger.credit(userId, gained, 'monde', now.toISOString(), conn);
        await conn.query('COMMIT');
        return { gained, coins };
    } catch (error) {
        await conn.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { RATE, CAP_HOURS, sizeFor, pendingOf, view, place, remove, collect };
