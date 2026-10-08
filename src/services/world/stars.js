// Les étoiles des jeux à grille (services/levels.js) : une ligne de world_items par étoile gagnée,
// « etoile:<jeu>:<niveau>:<rang> » (source 'etoile'), sans donnée nouvelle. La ligne dit que le bonus de cette étoile
// a été versé : une étoile ne se gagne, et ne paie, qu'une fois. « Recommencer l'île » efface les étoiles : leurs
// bonus se regagnent (le registre des écus les distingue : « :bis »).
const ledger = require('../ledger');
const levels = require('../levels');
const players = require('../players');

const PREFIX = 'etoile:';

// Les étoiles de chaque niveau, par jeu : { recolte: [30 nombres, 0 à 3], filon: […], cueillette: […] }
async function starsOf(userId, conn) {
    const out = Object.fromEntries(levels.GAMES.map(g => [g, Array(levels.LEVELS).fill(0)]));
    const { rows } = await conn.query('SELECT item FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${PREFIX}%`]);
    for (const { item } of rows) {
        const [, game, n, k] = item.split(':');
        const level = Number(n), rank = Number(k);
        if (out[game] && levels.isLevel(level) && rank >= 1 && rank <= 3) out[game][level - 1] = Math.max(out[game][level - 1], rank);
    }
    return out;
}

// Les étoiles d'une partie sur ce niveau : celles qui n'étaient pas encore gagnées s'inscrivent ; leur bonus (au plus
// room écus : le plafond de la partie) est versé. { before, stars (le meilleur du niveau), bonus (versé) }
async function award(userId, game, n, stars, room, conn) {
    const before = (await starsOf(userId, conn))[game][n - 1];
    if (stars <= before) return { before, stars: before, bonus: 0 };
    const ranks = Array.from({ length: stars - before }, (_, i) => before + i + 1);
    const { rows } = await conn.query(
        `INSERT INTO world_items (user_id, item, source) SELECT $1, unnest($2::text[]), 'etoile' ON CONFLICT DO NOTHING RETURNING item`,
        [userId, ranks.map(k => `${PREFIX}${game}:${n}:${k}`)]);
    // (seules les étoiles vraiment inscrites ici paient : deux parties rendues ensemble ne paient pas deux fois)
    const won = rows.map(r => Number(r.item.split(':')[3])).sort((a, b) => a - b);
    const again = (await conn.query(`SELECT 1 FROM world_items WHERE user_id = $1 AND item = $2`, [userId, players.RESTARTED])).rows.length > 0;
    let left = Math.max(0, room);
    let bonus = 0;
    for (const k of won) {
        const amount = Math.min(levels.STAR_BONUS[k - 1], left);
        left -= amount;
        if (amount > 0) {
            await ledger.credit(userId, amount, 'etoile', `${game}:${n}:${k}${again ? ':bis' : ''}`, conn);
            bonus += amount;
        }
    }
    return { before, stars: Math.max(before, stars), bonus };
}

module.exports = { PREFIX, starsOf, award };
