// Lectures de l'état d'un joueur en base (et deux écritures simples : stock, trouvailles), dans la transaction de
// l'appelant ou non. Extrait de services/world.js (lot santé), sans changement.
const db = require('../../config/db');
const quests = require('../quests');
const loot = require('../loot');
const signs = require('../signs');
const finds = require('../finds');
const players = require('../players');

async function itemsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT item FROM world_items WHERE user_id = $1', [userId]);
    return new Set(rows.map(r => r.item));
}
async function skinsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT site, skin FROM world_skins WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.site, r.skin]));
}
// Enseignes : nom écrit dessus (choisi, ou tiré de l'identifiant), styles achetés, style porté par bâtiment
async function signsOf(userId, conn = db) {
    const named = await conn.query('SELECT name FROM world_sign_names WHERE user_id = $1', [userId]);
    const name = named.rows.length ? named.rows[0].name
        : signs.defaultName((await conn.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0]?.username);
    const bought = await conn.query('SELECT style FROM world_sign_styles WHERE user_id = $1', [userId]);
    const worn = await conn.query('SELECT site, style FROM world_signs WHERE user_id = $1', [userId]);
    return { name, owned: new Set(bought.rows.map(r => r.style)), worn: Object.fromEntries(worn.rows.map(r => [r.site, r.style])) };
}
// Noms choisis par le joueur : { 'site:<id>' | 'zone:<id>': nom }
async function namesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT target, name FROM world_names WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.target, r.name]));
}
// L'avatar du joueur : ses choix s'il l'a composé (un objet), sinon son exemple de la bibliothèque (« avatar-03 »), ou
// null s'il n'en a pas encore choisi
async function avatarOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT look, choices FROM world_avatars WHERE user_id = $1', [userId]);
    return rows[0] ? rows[0].choices || rows[0].look : null;
}
// Amitié des habitants : { habitant: { points, talked, gifted } } (jours 'AAAA-MM-JJ', heure de Paris)
async function friendsOf(userId, conn = db) {
    const { rows } = await conn.query(
        `SELECT villager, points, to_char(talked_on, 'YYYY-MM-DD') AS talked, to_char(gifted_on, 'YYYY-MM-DD') AS gifted
         FROM world_friends WHERE user_id = $1`, [userId]);
    return Object.fromEntries(rows.map(r => [r.villager, r]));
}
// Besoins comblés des habitants : { habitant: { besoin: filled_at } }
async function needRowsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT villager, need, filled_at FROM world_needs WHERE user_id = $1', [userId]);
    const out = {};
    for (const r of rows) (out[r.villager] = out[r.villager] || {})[r.need] = r.filled_at;
    return out;
}
// Visiteurs installés (lot 7d), dans l'ordre où ils sont restés : [{ id, seed, site, settled_at }]
async function settlersOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT id, seed, site, settled_at FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL ORDER BY settled_at, id', [userId]);
    return rows;
}
// Mini-jeux : réserve de parties de chaque jeu ({ jeu: { plays, plays_at } } ; absent : réserve pleine)
async function gamesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT game, plays, plays_at FROM world_games WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.game, r]));
}
// Annexes posées : [{ x, y, annex, built_at, flip, look }] (flip : en miroir ; look : couleur choisie, ou null)
async function annexesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, annex, built_at, flip, look FROM world_annexes WHERE user_id = $1 ORDER BY built_at, y, x', [userId]);
    return rows;
}

// Paliers des bâtiments. Le feu de camp (le Foyer au palier I) est allumé d'office, sans ligne, pour un compte d'avant
// la v6 et pour qui a déjà passé sa quête ; un nouveau compte le bâtit (bible, § 9, étape 5 : quête « feu »)
async function levelsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT site, level, built_at FROM world_buildings WHERE user_id = $1', [userId]);
    const levels = { foyer: 0 };
    const builtAt = {};
    for (const row of rows) {
        levels[row.site] = row.level;
        builtAt[row.site] = row.built_at;
    }
    if (!levels.foyer && (await fireLitOf(userId, conn))) levels.foyer = 1;
    return { levels, builtAt };
}
async function fireLitOf(userId, conn) {
    const mode = await players.islandModeFor(userId, conn);
    if (!mode.fresh) return true;
    const { rows } = await conn.query('SELECT quest FROM world_quests WHERE user_id = $1', [userId]);
    return quests.doneOf(new Set(rows.map(row => row.quest))).has('feu');
}

// Ligne de stock du joueur (créée à la première visite, avec une réserve pleine ;
// la dernière récolte d'écus de la v1 est reprise pour ne pas la payer deux fois). Une île qui naît ainsi part de ses
// seuls sentiers (world/paths.js : la marque « ile:sentiers »)
async function stockOf(userId, conn = db, lock = false) {
    const read = () => conn.query(`SELECT * FROM world_stock WHERE user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId]);
    // (la ligne existe presque toujours : on ne tente de la créer que si elle manque)
    const first = await read();
    if (first.rows.length) return first.rows[0];
    const born = await conn.query(
        `INSERT INTO world_stock (user_id, charges, collected_at)
         SELECT $1, 3, (SELECT world_collected_at FROM progress WHERE user_id = $1)
         ON CONFLICT (user_id) DO NOTHING RETURNING user_id`, [userId]);
    if (born.rows.length) await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, 'ile:sentiers', 'ile') ON CONFLICT DO NOTHING`, [userId]);
    const { rows } = await read();
    return rows[0];
}

async function tilesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, element, placed_at FROM world_tiles WHERE user_id = $1 ORDER BY y, x', [userId]);
    return rows;
}

async function zonesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT zone FROM world_zones WHERE user_id = $1', [userId]);
    return new Set(['coeur', ...rows.map(r => r.zone)]);
}
// Trouvailles de climat en réserve : { trouvaille: nombre } (toutes, 0 par défaut)
async function findsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT find, amount FROM world_finds WHERE user_id = $1', [userId]);
    const have = Object.fromEntries(rows.map(r => [r.find, r.amount]));
    return Object.fromEntries(finds.FINDS.map(f => [f.id, have[f.id] || 0]));
}
// Dépense des trouvailles (déjà vérifiées, dans la transaction de l'appelant) : { trouvaille: nombre }
async function spendFinds(userId, spent, conn) {
    for (const [find, n] of Object.entries(spent)) {
        if (n) await conn.query('UPDATE world_finds SET amount = amount - $3 WHERE user_id = $1 AND find = $2', [userId, find, n]);
    }
}
// Gisements déjà ramassés : Map identifiant → date du dernier ramassage
async function depositsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT deposit, gathered_at FROM world_deposits WHERE user_id = $1', [userId]);
    return new Map(rows.map(r => [r.deposit, r.gathered_at]));
}
// Bâtiments embrumés par les égarés (world/nights.js) : [{ site, since, until }] (until : null tant qu'il n'est pas réparé)
async function blightsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT blights FROM world_nights WHERE user_id = $1', [userId]);
    return rows[0]?.blights || [];
}
// Lieux remarquables découverts : Map identifiant → date de la découverte
async function foundOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT landmark, found_at FROM world_landmarks WHERE user_id = $1', [userId]);
    return new Map(rows.map(r => [r.landmark, r.found_at]));
}

// Quêtes de Brume réclamées, et récoltes terminées (objectifs des quêtes)
async function claimedOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT quest FROM world_quests WHERE user_id = $1', [userId]);
    return new Set(rows.map(r => r.quest));
}
// Les mots d'Héliane (loot.helianeOf) : déduits des quêtes réclamées et des bouteilles ouvertes, avec leurs heures
async function helianeOfUser(userId, conn = db) {
    const claimed = await conn.query('SELECT quest, claimed_at FROM world_quests WHERE user_id = $1', [userId]);
    const bottles = await conn.query(`SELECT opened_at FROM world_chests WHERE user_id = $1 AND source LIKE 'bouteille:%'`, [userId]);
    const starts = quests.actStartsOf(claimed.rows.map(r => ({ quest: r.quest, at: r.claimed_at.getTime() })));
    return loot.helianeOf(starts, bottles.rows.map(r => r.opened_at.getTime()));
}
// Récoltes terminées en jouant au moins un coup (une partie rendue avant ce relevé, sans played, compte)
const PLAYED = `COALESCE((config->>'played')::int, 1) > 0`;
async function runsOf(userId, conn = db) {
    const { rows } = await conn.query(`SELECT COUNT(*)::int AS n FROM world_runs WHERE user_id = $1 AND finished_at IS NOT NULL AND ${PLAYED}`, [userId]);
    return rows[0].n;
}
// Un nombre lu en base (COUNT)
async function countOf(conn, sql, params) {
    const { rows } = await conn.query(sql, params);
    return rows[0].n;
}

// Quartiers des terres nouvelles déjà découverts (expédition revenue) : Set des identifiants. Les quartiers du cœur
// sont toujours connus
async function discoveredOf(userId, conn = db, now = Date.now()) {
    return new Set(await exploredOf(userId, conn, now));
}
// Les mêmes, dans l'ordre de leur retour (les traces d'Anya)
async function exploredOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query('SELECT zone FROM world_expeditions WHERE user_id = $1 AND ends_at <= $2 ORDER BY ends_at, zone', [userId, new Date(now)]);
    return rows.map(r => r.zone);
}

// Créations d'île (lot 8) : [{ id, craft, x, y, flip }] (x, y vides : en réserve ; flip : posée en miroir)
async function craftsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT id, craft, x, y, flip FROM world_crafts WHERE user_id = $1 ORDER BY id', [userId]);
    return rows;
}
const placedOf = rows => rows.filter(r => r.x !== null);
// Créations déjà fabriquées, par sorte (posées ou en réserve) : { création: nombre }
const madeOf = rows => rows.reduce((out, r) => ({ ...out, [r.craft]: (out[r.craft] || 0) + 1 }), {});

// Ajoute des ressources au stock (ligne verrouillée par l'appelant)
function addStock(userId, add, conn) {
    const n = r => add[r] || 0;
    return conn.query('UPDATE world_stock SET stone = stone + $2, wood = wood + $3, water = water + $4, food = food + $5 WHERE user_id = $1',
        [userId, n('stone'), n('wood'), n('water'), n('food')]);
}
async function balanceOf(userId, conn) {
    const { rows } = await conn.query('SELECT coins FROM progress WHERE user_id = $1', [userId]);
    return rows[0]?.coins ?? 0;
}

module.exports = {
    itemsOf, skinsOf, signsOf, namesOf, avatarOf, friendsOf, needRowsOf, settlersOf, gamesOf, annexesOf, levelsOf, stockOf,
    tilesOf, zonesOf, findsOf, spendFinds, depositsOf, blightsOf, foundOf, claimedOf, helianeOfUser, runsOf, countOf,
    discoveredOf, exploredOf, craftsOf, placedOf, madeOf, addStock, balanceOf, PLAYED
};
