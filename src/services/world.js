// Le Monde : l'île du joueur, sur une carte commune (worldMap.js) : la Grève ouverte d'office, onze quartiers à acheter
// (écus + chapitre du Livre). Les chantiers se construisent puis évoluent avec un plan découvert dans le Livre et des
// ressources tirées de la Récolte. Les bâtiments de production rapportent ressources et écus, avec leurs annexes
// (annexes.js : champs, filons, viviers… posés autour d'eux) ; les décorations s'achètent et embellissent, sans rien
// produire.
// Tout ce qui compte (stock, quartiers, parties, gains, écus, coffres) est décidé ici, dans des transactions verrouillées.
const crypto = require('crypto');
const db = require('../config/db');
const ledger = require('./ledger');
const harvest = require('./harvest');
const map = require('./worldMap');
const legacy = require('./worldMapV2');
const shop = require('./worldShop');
const quests = require('./quests');
const loot = require('./loot');
const annexes = require('./annexes');
const signs = require('./signs');
const minigames = require('./minigames');
const villagers = require('./villagers');
const visitors = require('./visitors');
const crafts = require('./crafts');
const naming = require('./naming');
const landmarks = require('./landmarks');
const finds = require('./finds');
const players = require('./players');

const SIZE = map.SIZE;
const CAP_HOURS = 8;
const REGEN_MS = 30 * 60 * 1000; // une partie de Récolte revient toutes les 30 minutes
const RUN_TTL_MS = 24 * 3600 * 1000; // une partie non rendue après 24 h est perdue
const RENAME_LEVEL = 3; // un bâtiment se renomme dès son palier III (un quartier, dès qu'il est à soi)
const GAME_TTL_MS = 15 * 60 * 1000; // une partie de mini-jeu non rendue après 15 min est perdue
const GAME_SLACK_MS = 3000; // tolérance d'horloge : un geste ne peut dater de plus tard que la partie elle-même
const CRAFT_TTL_MS = 30 * 60 * 1000; // un assemblage non rendu après 30 min est perdu (rien n'est encore payé)
const MOVES = 15;
// Première Récolte du joueur (le tutoriel de la bible, § 9, étape 2) : un plateau généreux, sans l'eau (le Puits n'est
// pas encore là) et avec des coups en plus ; la configuration est figée dans la partie, le rejeu la suit
const FIRST_RUN_MOVES = 4;
const FIRST_RUN_KINDS = harvest.BASE_KINDS.filter(kind => kind !== 'water');
const RESOURCES = ['stone', 'wood', 'water', 'food'];
// 1 : île 14 × 14 ; 2 : île 20 × 20 (worldMapV2.js) ; 3 : la grande île 48 × 48 ; 4 : la très grande île 96 × 96, dont
// la précédente est le cœur (worldMap.js)
const MAP_VERSION = 4;
// Expédition vers un quartier des terres nouvelles : par heure de voyage, ce qu'elle emporte (et une partie de Récolte)
const EXPEDITION_COST = { food: 10, wood: 5 };
// Ancienne règle (v1) : une décoration rapportait 1 écu par heure ; payée une dernière fois à la migration
const OLD_DECO_RATE = 1;
// Prix d'une décoration selon le chapitre de l'élément posé
const DECO_PRICES = { I: 10, II: 15, III: 25, IV: 40, V: 60, VI: 90, VII: 140 };
// Récolte : 1 écu par tranche de 10 ressources gagnées
const HARVEST_COIN_EVERY = 10;
// Un achat de la boutique s'annule dans les secondes qui suivent (le front montre « Annuler » 4 s ; marge réseau)
const UNDO_SECONDS = 6;
// Hasard des coffres (loot.js) : rand() dans [0, 1), tiré par le serveur
const random = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;

// Chantiers : 7 paliers, un par chapitre du Livre (le palier N demande le chapitre N ouvert), chacun avec son plan
// (élément découvert), son coût en ressources et en écus (dès le palier III) ; l'emprise passe à 3 × 3 au palier IV.
// produce : ressource produite en continu, PRODUCE_PER_LEVEL par heure et par niveau, avec COINS_PER_LEVEL écus.
const CHAPTER_OF_LEVEL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const BOOST_BY_LEVEL = [1, 2, 3, 4, 4, 5, 5, 6]; // multiplicateur de Récolte de la ressource du bâtiment (entier)
const ATELIER_MOVES = [0, 3, 5, 6, 7, 8, 9, 10]; // coups de Récolte en plus selon le niveau de l'Atelier
const PRODUCE_PER_LEVEL = 3; // ressources par heure et par niveau
const COINS_PER_LEVEL = 2; // écus par heure et par niveau
// Noms des ressources dans les textes d'effet : production, Récolte
const WORDS = { stone: ['pierres', 'la pierre'], wood: ['bûches', 'le bois'], water: ['seaux d’eau', 'l’eau'], food: ['vivres', 'la nourriture'] };
const tier = (name, plan, cost, coins = 0) => ({ name, plan, cost, coins });
const SITES = {
    foyer: {
        levels: [
            tier('Feu de camp', null, {}),
            tier('Abri', 'Bois', { wood: 20, stone: 10 }),
            tier('Cabane', 'Cabane', { stone: 40, wood: 30, water: 20 }, 150),
            tier('Maison de l’alchimiste', 'Potion', { stone: 60, wood: 50, water: 30, food: 20 }, 300),
            tier('Tour d’étude', 'Livre', { stone: 100, wood: 90, water: 50, food: 40 }, 600),
            tier('Grande tour', 'Télescope', { stone: 170, wood: 150, water: 90, food: 70 }, 1000),
            tier('Phare de Brume', 'Feu follet', { stone: 300, wood: 240, water: 140, food: 120 }, 1800)
        ]
    },
    carriere: {
        produce: 'stone',
        levels: [
            tier('Fissure', 'Pierre', { wood: 5 }),
            tier('Carrière', 'Marteau', { stone: 30, wood: 20 }),
            tier('Mine', 'Poulie', { wood: 45, stone: 30, food: 15 }, 150),
            tier('Galerie', 'Rails', { wood: 70, stone: 50, water: 20, food: 20 }, 300),
            tier('Puits de mine', 'Fer', { wood: 110, stone: 90, water: 40, food: 40 }, 600),
            tier('Mine de cristal', 'Cristal', { wood: 180, stone: 150, water: 90, food: 60 }, 1000),
            tier('Cité minière', 'Ville', { wood: 300, stone: 250, water: 130, food: 120 }, 1800)
        ]
    },
    bosquet: {
        produce: 'wood',
        levels: [
            tier('Bosquet', 'Arbre', { stone: 5 }),
            tier('Grand bosquet', 'Forêt', { wood: 25, water: 15 }),
            tier('Clairière du bûcheron', 'Bûcheron', { stone: 35, water: 35, food: 20 }, 150),
            tier('Chênaie', 'Chêne', { stone: 60, water: 50, wood: 30, food: 20 }, 300),
            tier('Scierie', 'Menuisier', { stone: 100, wood: 70, water: 70, food: 40 }, 600),
            tier('Exploitation forestière', 'Grue', { stone: 170, wood: 120, water: 110, food: 80 }, 1000),
            tier('Forêt enchantée', 'Fée', { stone: 280, wood: 200, water: 180, food: 140 }, 1800)
        ]
    },
    puits: {
        produce: 'water',
        levels: [
            tier('Puits', 'Puits', { stone: 10 }),
            tier('Fontaine', 'Fontaine', { stone: 30, water: 15 }),
            tier('Lavoir', 'Savon', { stone: 45, wood: 30, food: 15 }, 150),
            tier('Bassin', 'Source', { stone: 70, wood: 50, water: 20, food: 20 }, 300),
            tier('Aqueduc', 'Arche', { stone: 110, wood: 80, water: 50, food: 40 }, 600),
            tier('Moulin à eau', 'Moulin à eau', { stone: 180, wood: 130, water: 90, food: 80 }, 1000),
            tier('Fontaine de jouvence', 'Élixir', { stone: 300, wood: 220, water: 150, food: 130 }, 1800)
        ]
    },
    potager: {
        produce: 'food',
        levels: [
            tier('Potager', 'Plante', { water: 8 }),
            tier('Serre', 'Serre', { wood: 20, water: 25, food: 10 }),
            tier('Verger', 'Pomme', { wood: 35, water: 35, stone: 20 }, 150),
            tier('Ferme', 'Ferme', { wood: 55, water: 55, stone: 30, food: 20 }, 300),
            tier('Moulin', 'Moulin', { wood: 95, water: 90, stone: 55, food: 40 }, 600),
            tier('Domaine', 'Tracteur', { wood: 160, water: 150, stone: 100, food: 70 }, 1000),
            tier('Jardin de la Licorne', 'Licorne', { wood: 270, water: 250, stone: 160, food: 120 }, 1800)
        ]
    },
    atelier: {
        levels: [
            tier('Atelier', 'Four', { stone: 15, wood: 10 }),
            tier('Forge', 'Forge', { stone: 35, wood: 25 }),
            tier('Fonderie', 'Bronze', { stone: 45, wood: 35, water: 10 }, 150),
            tier('Grande forge', 'Acier', { stone: 70, wood: 55, water: 20, food: 15 }, 300),
            tier('Manufacture', 'Forgeron', { stone: 120, wood: 90, water: 40, food: 30 }, 600),
            tier('Usine', 'Usine', { stone: 200, wood: 150, water: 70, food: 60 }, 1000),
            tier('Atelier de l’Alchimiste', 'Alchimie', { stone: 330, wood: 250, water: 120, food: 100 }, 1800)
        ]
    },
    ponton: {
        produce: 'food',
        levels: [
            tier('Ponton', 'Bateau', { wood: 25 }),
            tier('Port de pêche', 'Port', { wood: 40, stone: 15 }),
            tier('Chantier naval', 'Voile', { wood: 50, stone: 25, water: 15 }, 150),
            tier('Grand port', 'Phare', { wood: 80, stone: 45, water: 20, food: 15 }, 300),
            tier('Criée', 'Pêcheur', { wood: 130, stone: 80, water: 40, food: 30 }, 600),
            tier('Port à vapeur', 'Bateau à vapeur', { wood: 220, stone: 130, water: 70, food: 60 }, 1000),
            tier('Port du Kraken', 'Kraken', { wood: 360, stone: 220, water: 120, food: 100 }, 1800)
        ]
    }
};
const BOOSTED = { carriere: 'stone', bosquet: 'wood', puits: 'water', potager: 'food' };

// Ce que fait un palier (texte de la fiche), calculé depuis les règles : jamais en désaccord avec elles
function effectOf(siteId, n) {
    const site = SITES[siteId];
    const grows = n === map.BIG_FROM ? ' Le bâtiment s’agrandit (3 × 3 cases).' : '';
    if (siteId === 'foyer') return `${2 + n} parties de Récolte en réserve.${grows}`;
    if (siteId === 'atelier') return `${ATELIER_MOVES[n]} coups de plus par Récolte.${grows}`;
    const [many] = WORDS[site.produce];
    const made = `${PRODUCE_PER_LEVEL * n} ${many} et ${COINS_PER_LEVEL * n} écus par heure`;
    if (siteId === 'ponton') return `Pêche ${made} ; des poissons à la Récolte${n >= 2 ? ', 2 coups de plus' : ''}.${grows}`;
    return `Produit ${made} ; ${WORDS[site.produce][1]} rapporte ×${BOOST_BY_LEVEL[n]} à la Récolte.${grows}`;
}
for (const [id, site] of Object.entries(SITES)) {
    site.levels.forEach((l, i) => { l.effect = effectOf(id, i + 1); l.chapter = CHAPTER_OF_LEVEL[i]; });
}

const keyOf = cell => cell.y * SIZE + cell.x;

// Écus dus selon l'ancienne règle (décorations) : chaque source compte depuis sa pose ou la dernière récolte, plafonnée
function pendingOf(sources, collectedAt, now = Date.now()) {
    const since = collectedAt ? new Date(collectedAt).getTime() : 0;
    let total = 0;
    for (const source of sources) {
        const start = Math.max(since, new Date(source.placed_at).getTime());
        total += Math.min(CAP_HOURS, Math.max(0, (now - start) / 3600000)) * (source.rate ?? OLD_DECO_RATE);
    }
    return Math.floor(total);
}

// Parties disponibles à l'instant : réserve + parties revenues depuis charges_at, plafonnées
function chargesAt(stock, max, now = Date.now(), regen = REGEN_MS) {
    const since = new Date(stock.charges_at).getTime();
    const ticks = Math.max(0, Math.floor((now - since) / regen));
    if (stock.charges + ticks >= max) return { count: max, since: now };
    return { count: stock.charges + ticks, since: since + ticks * regen };
}

// Effets des bâtiments construits : réserve, coups, tuiles, multiplicateurs de Récolte (BOOST_BY_LEVEL), avec les
// bonus de la boutique (bonuses) et des annexes (extra)
const NO_BONUS = shop.bonusesOf([]);
const NO_ANNEX = annexes.bonusesOf([]);
function effectsOf(levels, bonuses = NO_BONUS, extra = NO_ANNEX) {
    const boosts = {};
    for (const [site, resource] of Object.entries(BOOSTED)) if (levels[site]) boosts[resource] = BOOST_BY_LEVEL[levels[site]];
    const foyer = levels.foyer || 1;
    const atelier = levels.atelier || 0;
    const ponton = levels.ponton || 0;
    return {
        maxCharges: 2 + foyer + bonuses.charges + extra.charges,
        maxMoves: MOVES + ATELIER_MOVES[atelier] + (ponton >= 2 ? 2 : 0) + bonuses.moves + extra.moves,
        kinds: [...harvest.BASE_KINDS, ...(ponton ? ['fish'] : [])],
        boosts,
        regenMs: annexes.regenWith(bonuses.regenMs || REGEN_MS, extra.regenCut)
    };
}

// Production d'un bâtiment et de ses annexes depuis leur pose ou la dernière récolte (plafonnée à CAP_HOURS, plus les
// heures des réserves) : { resource, amount, coins }.
// bonus = { prod: part en plus, coins: écus par heure en plus (boutique de l'atelier), cap: heures en plus (réserve) } ;
// annexList = [{ rate, earn, at }] (annexes.bonusesOf) : ressources et écus par heure en plus, comptés depuis at,
// avec la même part de production en plus que le bâtiment
function productionOf(siteId, level, builtAt, collectedAt, now = Date.now(), bonus = { prod: 0, coins: 0 }, annexList = []) {
    const site = SITES[siteId];
    if (!site.produce || !level) return null;
    const cap = CAP_HOURS + (bonus.cap || 0);
    const collected = collectedAt ? new Date(collectedAt).getTime() : 0;
    const hoursSince = at => Math.min(cap, Math.max(0, (now - Math.max(collected, new Date(at).getTime())) / 3600000));
    const hours = hoursSince(builtAt);
    let amount = hours * PRODUCE_PER_LEVEL * level;
    let coins = hours * COINS_PER_LEVEL * level;
    for (const a of annexList) {
        const h = hoursSince(a.at);
        amount += h * a.rate;
        coins += h * a.earn;
    }
    const boost = 1 + (bonus.prod || 0);
    return {
        resource: site.produce,
        amount: Math.floor(amount * boost + 1e-9),
        coins: Math.floor(coins * boost + hours * (bonus.coins || 0) + 1e-9)
    };
}
// Rendement par heure d'un bâtiment producteur et de ses annexes : { amount, coins }, arrondis au dixième
function perHourOf(level, prod = 0, coins = 0, annexList = []) {
    const boost = 1 + prod;
    const round = n => Math.round(n * 10) / 10;
    const rate = annexList.reduce((sum, a) => sum + a.rate, 0);
    const earn = annexList.reduce((sum, a) => sum + a.earn, 0);
    return { amount: round((PRODUCE_PER_LEVEL * level + rate) * boost), coins: round((COINS_PER_LEVEL * level + earn) * boost + coins) };
}
function productionAll(levels, builtAt, collectedAt, now = Date.now(), bonuses = NO_BONUS, extra = NO_ANNEX) {
    return Object.keys(SITES)
        .map(id => ({
            site: id,
            ...productionOf(id, levels[id] || 0, builtAt[id], collectedAt, now,
                { prod: bonuses.prod[id] || 0, coins: bonuses.coins[id] || 0, cap: extra.cap[id] || 0 }, extra.site[id] || [])
        }))
        .filter(p => p.resource);
}

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
// Un habitant vit sur l'île quand son bâtiment est bâti, dans un quartier à soi
const livesHere = (id, levels, zones) => (levels[id] || 0) >= 1 && zones.has(map.siteZone(id));
// Décorations à reach cases au plus (en tous sens) de l'emprise d'un bâtiment
function decosNear(tiles, siteId, level, reach) {
    const at = map.footprintOf(siteId, level);
    const gap = (v, from, size) => Math.max(from - v, 0, v - (from + size - 1));
    return tiles.filter(t => Math.max(gap(t.x, at.x, at.w), gap(t.y, at.y, at.h)) <= reach).length;
}
// Visiteurs installés (lot 7d), dans l'ordre où ils sont restés : [{ id, seed, site, settled_at }]
async function settlersOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT id, seed, site, settled_at FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL ORDER BY settled_at, id', [userId]);
    return rows;
}
// Identifiant d'un visiteur installé, parmi les habitants : 'v<numéro de sa visite>'
const SETTLER_ID = /^v\d{1,9}$/;
const knownResident = id => Object.hasOwn(villagers.VILLAGERS, id) || SETTLER_ID.test(id);
// La troupe est là dès sa rencontre (bible, § 6.6) : Aster dès le compte, Cannelle après la Récolte du prologue, Rivet
// après la soupe, les quatre dormeurs (SLEEPERS) dès que leur quartier est à soi ; un joueur d'avant la bible garde
// aussi chaque habitant dont le bâtiment est bâti. presence : { veteran, done (quêtes faites, quests.doneOf) }
const SLEEPERS = ['puits', 'bosquet', 'carriere', 'potager'];
function metOf(id, levels, zones, presence) {
    if (presence.veteran && livesHere(id, levels, zones)) return true;
    if (id === 'ponton') return true;
    if (id === 'foyer') return presence.done.has('recolte');
    if (id === 'atelier') return presence.done.has('soupe');
    return zones.has(map.siteZone(id));
}
// Ce qu'il faut pour savoir qui est là : compte d'avant la bible, quêtes faites
async function presenceOf(userId, conn = db) {
    return { veteran: await players.veteranOf(userId, conn), done: quests.doneOf(await claimedOf(userId, conn)) };
}
// Habitants de l'île : la troupe rencontrée (built : son bâtiment est bâti, dans un quartier à soi), puis les
// visiteurs installés, qui travaillent au bâtiment de leur métier : [{ id, name, role, loves, likes, site, built, seed? }]
function residentsOf(levels, zones, settlers, presence) {
    const base = Object.entries(villagers.VILLAGERS).filter(([id]) => metOf(id, levels, zones, presence))
        .map(([id, v]) => ({ id, name: v.name, role: v.role, loves: v.loves, likes: v.likes, site: id, built: livesHere(id, levels, zones) }));
    const settled = settlers.map(row => ({
        id: `v${row.id}`, name: visitors.nameOf(row.seed), role: visitors.ROLES[row.site].role, ...visitors.tastesOf(row.site), site: row.site, built: true, seed: row.seed
    }));
    return [...base, ...settled];
}
// Cannelle a faim en arrivant, pendant le prologue (la quête « soupe » : bible, § 9, étape 3) ; pour les autres, et
// pour un joueur d'avant la bible, on arrive comblé
const hungryOf = (id, presence) => id === 'foyer' && !presence.veteran && !presence.done.has('soupe');
const HUNGRY_AGO = (villagers.NEEDS.manger.hours * 60 + 1) * 60 * 1000;
// Besoins et humeur de chaque habitant à l'instant now : { habitant: { needs, mood, site, built } } (se distraire :
// les créations d'île posées autour du bâtiment où il travaille, une fois ce bâtiment bâti et le prologue fini)
function moodsOf(residents, levels, zones, decor, filled, presence, now = Date.now()) {
    const atelier = livesHere('atelier', levels, zones);
    const prologue = !presence.veteran && !presence.done.has('puits-ondin');
    const out = {};
    for (const { id, site, built } of residents) {
        const rows = hungryOf(id, presence) && !filled[id]?.manger ? { ...filled[id], manger: new Date(now - HUNGRY_AGO) } : filled[id] || {};
        const deco = built && !prologue;
        const needs = villagers.needsOf(rows, deco ? decosNear(decor, site, levels[site], villagers.NEEDS.deco.reach) : 0, atelier, now, { deco });
        out[id] = { needs, mood: villagers.moodOf(needs), site, built };
    }
    return out;
}
// Bonus avec l'humeur des habitants : production du bâtiment où ils travaillent, coups (Atelier), retour des parties
// (Foyer)
function withMoods(bonuses, extra, moods) {
    const prod = { ...bonuses.prod };
    let moves = bonuses.moves;
    let regenCut = extra.regenCut;
    for (const { mood, site, built } of Object.values(moods)) {
        // L'humeur ne joue qu'une fois le bâtiment là (bible, § 6.6)
        if (!built) continue;
        const sign = villagers.moodSign(mood);
        if (SITES[site].produce) prod[site] = (prod[site] || 0) + sign * villagers.MOOD_STEP.prod;
        else if (site === 'atelier') moves += sign * villagers.MOOD_STEP.moves;
        else if (site === 'foyer') regenCut += sign * villagers.MOOD_STEP.regenMs;
    }
    return { bonuses: { ...bonuses, prod, moves }, extra: { ...extra, regenCut } };
}
// Bonus avec ceux des lieux remarquables découverts (lm : landmarks.bonusesOf) : production en plus (après le plafond
// de la boutique), réserve des bâtiments, parties, coups, retour des parties
function withLandmarks({ bonuses, extra }, lm) {
    const prod = { ...bonuses.prod };
    for (const [site, part] of Object.entries(lm.prod)) prod[site] = (prod[site] || 0) + part;
    const cap = { ...extra.cap };
    for (const [site, hours] of Object.entries(lm.cap)) cap[site] = (cap[site] || 0) + hours;
    return {
        bonuses: { ...bonuses, prod },
        extra: { ...extra, cap, charges: extra.charges + lm.charges, moves: extra.moves + lm.moves, regenCut: extra.regenCut + lm.regenCut }
    };
}
// Un habitant arrive comblé (Cannelle, pendant le prologue, affamée : hungryOf) : la première vue de l'île après son
// arrivée inscrit l'heure de ses besoins (ou de celui qui apparaît, travailler avec l'Atelier), une seule fois
async function welcome(userId, moods, filled, presence, now = Date.now()) {
    const fresh = Object.entries(moods).flatMap(([id, m]) => m.needs.filter(n => n.cost && !filled[id]?.[n.id]).map(n => [id, n.id]));
    for (const [villager, need] of fresh) {
        const at = need === 'manger' && hungryOf(villager, presence) ? new Date(now - HUNGRY_AGO) : new Date(now);
        await db.query('INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [userId, villager, need, at]);
    }
}
// Récoltes terminées depuis une date (demande d'un visiteur)
async function runsSince(userId, since, conn = db) {
    const { rows } = await conn.query('SELECT COUNT(*)::int AS n FROM world_runs WHERE user_id = $1 AND finished_at >= $2', [userId, since]);
    return rows[0].n;
}
// Visiteur du moment : celui qui est là, ou un nouveau qui débarque (Ponton bâti, quelques heures après le dernier
// départ). L'arrivée se décide dans une transaction verrouillée : deux vues en même temps n'en font pas venir deux.
// Ligne de world_visitors, ou null
async function visitorNow(userId, now = Date.now()) {
    const lastOf = async conn => (await conn.query('SELECT * FROM world_visitors WHERE user_id = $1 ORDER BY arrived_at DESC LIMIT 1', [userId])).rows[0];
    const here = row => row && !row.settled_at && now < new Date(row.leaves_at).getTime();
    const seen = await lastOf(db);
    if (here(seen)) return seen;
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const last = await lastOf(conn);
        if (here(last)) return last;
        const { levels } = await levelsOf(userId, conn);
        const zones = await zonesOf(userId, conn);
        if (!livesHere('ponton', levels, zones)) return null;
        const gone = last && new Date(last.settled_at || last.leaves_at).getTime();
        if (last && now < gone + visitors.GAP_HOURS * visitors.HOUR_MS) return null;
        const seed = crypto.randomInt(1, 2147483647);
        const v = visitors.visitorOf(seed, Object.keys(visitors.ROLES).filter(id => livesHere(id, levels, zones)), levels.ponton);
        const { rows } = await conn.query(
            'INSERT INTO world_visitors (user_id, seed, site, request, arrived_at, leaves_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, seed, v.site, JSON.stringify(v.request), new Date(now), new Date(now + v.days * 24 * visitors.HOUR_MS)]);
        return rows[0];
    });
}
// Ce que la vue montre d'un visiteur : prénom, métier, demande (et où elle en est), départ, comblé
function visitorView(row, runs, now = Date.now()) {
    if (!row) return null;
    const request = row.request.kind === 'recolter' ? { ...row.request, have: Math.min(row.request.count, runs) } : row.request;
    return {
        id: Number(row.id), seed: row.seed, name: visitors.nameOf(row.seed), site: row.site, role: visitors.ROLES[row.site].role,
        request, leavesIn: Math.max(0, new Date(row.leaves_at).getTime() - now), satisfied: Boolean(row.satisfied_at)
    };
}
// Mini-jeux : réserve de parties de chaque jeu ({ jeu: { plays, plays_at } } ; absent : réserve pleine)
async function gamesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT game, plays, plays_at FROM world_games WHERE user_id = $1', [userId]);
    return Object.fromEntries(rows.map(r => [r.game, r]));
}
// Parties d'un jeu à l'instant now (une de plus toutes les 2 h, 3 au plus) : { count, since }
const playsOf = (row, now) => chargesAt({ charges: row ? row.plays : minigames.PLAYS, charges_at: row ? row.plays_at : now }, minigames.PLAYS, now, minigames.PLAY_REGEN_MS);
// Annexes posées : [{ x, y, annex, built_at }]
async function annexesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT x, y, annex, built_at FROM world_annexes WHERE user_id = $1 ORDER BY built_at, y, x', [userId]);
    return rows;
}
// Bonus de la boutique, des annexes, de l'humeur des habitants et des lieux découverts : { bonuses, extra } (ce que
// lisent effectsOf et productionAll)
async function bonusesFor(userId, conn = db) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const presence = await presenceOf(userId, conn);
    const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
    const moods = moodsOf(residents, levels, zones, placedOf(await craftsOf(userId, conn)), await needRowsOf(userId, conn), presence);
    const mooded = withMoods(shop.bonusesOf(await itemsOf(userId, conn)), annexes.bonusesOf(await annexesOf(userId, conn)), moods);
    return withLandmarks(mooded, landmarks.bonusesOf((await foundOf(userId, conn)).keys()));
}

async function levelsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT site, level, built_at FROM world_buildings WHERE user_id = $1', [userId]);
    const levels = { foyer: 1 };
    const builtAt = {};
    for (const row of rows) {
        levels[row.site] = row.level;
        builtAt[row.site] = row.built_at;
    }
    return { levels, builtAt };
}

// Ligne de stock du joueur (créée à la première visite, avec une réserve pleine ;
// la dernière récolte d'écus de la v1 est reprise pour ne pas la payer deux fois)
async function stockOf(userId, conn = db, lock = false) {
    await conn.query(
        `INSERT INTO world_stock (user_id, charges, collected_at)
         SELECT $1, 3, (SELECT world_collected_at FROM progress WHERE user_id = $1)
         ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const { rows } = await conn.query(`SELECT * FROM world_stock WHERE user_id = $1${lock ? ' FOR UPDATE' : ''}`, [userId]);
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
async function runsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT COUNT(*)::int AS n FROM world_runs WHERE user_id = $1 AND finished_at IS NOT NULL', [userId]);
    return rows[0].n;
}
// Un nombre lu en base (COUNT)
async function countOf(conn, sql, params) {
    const { rows } = await conn.query(sql, params);
    return rows[0].n;
}
// Ce que lisent les objectifs des quêtes (quests.HAVE) : owned = éléments du Grimoire ; stars = ses découvertes.
// moods : besoins des habitants déjà calculés (la vue de l'île), sinon calculés ici
async function factsOf(userId, owned, stars, conn = db, moods = null) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const placed = placedOf(await craftsOf(userId, conn));
    if (!moods) {
        const presence = await presenceOf(userId, conn);
        const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
        moods = moodsOf(residents, levels, zones, placed, await needRowsOf(userId, conn), presence);
    }
    const friends = await friendsOf(userId, conn);
    const best = Math.max(0, ...Object.values(friends).map(f => f.points));
    return {
        crafts: placed.length, placed: new Set(placed.map(t => t.craft)), runs: await runsOf(userId, conn), stars,
        elements: new Set(owned), zones, levels,
        annexes: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_annexes WHERE user_id = $1', [userId]),
        houses: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_annexes WHERE user_id = $1 AND annex = $2', [userId, 'maison']),
        met: new Set(Object.entries(moods).flatMap(([id, m]) => m.needs.filter(n => n.met).map(n => `${id}:${n.id}`))),
        awake: new Set(Object.entries(friends).filter(([, f]) => f.points > 0).map(([id]) => id)),
        hearts: villagers.heartsOf(best),
        expeditions: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_expeditions WHERE user_id = $1 AND ends_at <= NOW()', [userId]),
        landmarks: new Set((await foundOf(userId, conn)).keys()),
        gathered: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_deposits WHERE user_id = $1', [userId]),
        visitors: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_visitors WHERE user_id = $1 AND satisfied_at IS NOT NULL', [userId]),
        settled: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL', [userId]),
        named: Boolean((await namesOf(userId, conn)).peuple)
    };
}

// Les cibles du fil d'Ariane (bible, § 6.1 à 6.3) : ce que demande la quête active. L'élément à écrire (ou l'une des
// bêtes), le plan du prochain palier du bâtiment demandé (une invention), les savoir-faire de la création demandée ;
// [] sinon. bookPages.arianeOf en tire le chemin le plus court
async function arianeTargets(userId) {
    const quest = quests.currentOf(await claimedOf(userId));
    const goal = quest && quest.goal;
    if (!goal) return [];
    if (goal.kind === 'element') return goal.any || [goal.element];
    if (goal.kind === 'craft') return crafts.CRAFT_BY_ID[goal.craft].elements;
    if (goal.kind !== 'level') return [];
    const level = (await levelsOf(userId)).levels[goal.site] || 0;
    const plan = level < goal.need ? SITES[goal.site].levels[level]?.plan : null;
    return plan ? [plan] : [];
}

// Le tableau de Brume, avec le chapitre encore fermé qu'attend la quête active (un quartier ou un palier d'un
// chapitre pas encore ouvert : le joueur doit d'abord écrire des découvertes). openChapters : Set des chapitres ouverts
function boardWith(claimed, facts, openChapters) {
    const out = quests.boardOf(claimed, facts);
    const quest = out.quest;
    if (!quest || quest.done) return out;
    const { goal } = quests.QUESTS[quest.step - 1];
    const next = goal.kind === 'level' && (facts.levels[goal.site] || 0) === goal.need - 1 ? SITES[goal.site].levels[goal.need - 1] : null;
    const chapter = goal.kind === 'zone' ? map.ZONE_BY_ID[goal.zone].chapter : next?.chapter;
    if (chapter && !openChapters.has(chapter)) quest.chapter = chapter;
    return out;
}
// Brume seule (quête active), sans le reste de l'île : le Grimoire la consulte après une découverte
async function board(userId, owned, stars, openChapters) {
    return boardWith(await claimedOf(userId), await factsOf(userId, owned, stars), openChapters);
}

// Passage aux cartes suivantes, une fois par joueur, au premier passage, verrouillé (deux requêtes ne migrent pas
// deux fois) et d'un seul tenant (tout ou rien) : v1 → v2 → v3 → v4 selon l'île du joueur.
function migrate(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (stock.map_version >= MAP_VERSION) return false;
        if (stock.map_version < 2) await toV2(userId, stock, conn);
        if (stock.map_version < 3) await toV3(userId, conn);
        await toV4(userId, conn);
        await conn.query('UPDATE world_stock SET map_version = $2 WHERE user_id = $1', [userId, MAP_VERSION]);
        return true;
    });
}

// v1 → v2 : les écus encore dus par les décorations (ancienne règle) sont versés, tout ce qui était posé glisse de
// OFFSET cases, et les quartiers où le joueur avait déjà un bâtiment ou une décoration lui sont offerts
async function toV2(userId, stock, conn) {
    const tiles = await tilesOf(userId, conn);
    const { levels, builtAt } = await levelsOf(userId, conn);
    const oldFoyerRate = ((levels.foyer || 1) - 1) * 2;
    const owed = pendingOf([...tiles.map(t => ({ ...t, rate: OLD_DECO_RATE })), ...(oldFoyerRate ? [{ placed_at: builtAt.foyer, rate: oldFoyerRate }] : [])], stock.collected_at);
    if (owed > 0) await ledger.credit(userId, owed, 'monde', 'carte-v2', conn);
    // Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à elle-même pendant la mise à jour
    await conn.query('UPDATE world_tiles SET x = x + 1000, y = y + 1000 WHERE user_id = $1', [userId]);
    await conn.query('UPDATE world_tiles SET x = x - 1000 + $2, y = y - 1000 + $2 WHERE user_id = $1', [userId, legacy.OFFSET]);
    const gifts = new Set();
    Object.keys(levels).forEach(id => { if (SITES[id] && levels[id] && id !== 'foyer') gifts.add(legacy.siteZone(id)); });
    tiles.forEach(t => { const zone = legacy.zoneAt(t.x + legacy.OFFSET, t.y + legacy.OFFSET); if (zone) gifts.add(zone); });
    gifts.delete('coeur');
    for (const zone of gifts) {
        await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, zone]);
    }
    await conn.query('UPDATE world_stock SET collected_at = NOW() WHERE user_id = $1', [userId]);
}

// v2 → v3 (la grande île) : les quartiers achetés restent (mêmes identifiants), les bâtiments gardent leur palier
// (leur place vient de la carte) ; chaque décoration rejoint son quartier, sur une case libre au plus près de son
// panneau, dans l'ordre où elles étaient rangées (de haut en bas, de gauche à droite). Un quartier trop petit
// déborde sur la Grève.
async function toV3(userId, conn) {
    const tiles = await tilesOf(userId, conn);
    if (!tiles.length) return;
    const { levels } = await levelsOf(userId, conn);
    const byZone = new Map();
    for (const tile of tiles) {
        const zone = legacy.zoneAt(tile.x, tile.y) || 'coeur';
        byZone.set(zone, [...(byZone.get(zone) || []), tile]);
    }
    // Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à une case encore occupée
    await conn.query('UPDATE world_tiles SET x = x + 1000, y = y + 1000 WHERE user_id = $1', [userId]);
    const taken = new Set();
    // Cases de la carte v3 : celles du cœur de la carte v4, moins son décalage (toV4 les replace ensuite)
    const v3Spots = zone => map.freeSpots(zone, levels).map(sp => ({ x: sp.x - map.OFFSET.x, y: sp.y - map.OFFSET.y }));
    const spare = v3Spots('coeur');
    for (const [zone, list] of byZone) {
        const spots = [...v3Spots(zone), ...spare];
        for (const tile of list) {
            const spot = spots.find(s => !taken.has(s.y * SIZE + s.x));
            if (!spot) break;
            taken.add(spot.y * SIZE + spot.x);
            await conn.query('UPDATE world_tiles SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, tile.x + 1000, tile.y + 1000, spot.x, spot.y]);
        }
    }
    // Chaque ancien quartier tient dans le nouveau (test/play.test.js) ; les décorations sont ensuite remboursées
    // (refundDecorations, lot 8)
}

// v3 → v4 (la très grande île) : la grande île devient le cœur, posée en map.OFFSET ; tout ce que le joueur y a posé
// (annexes, créations, anciennes décorations) glisse d'autant. Les bâtiments n'ont rien à faire : leur place vient
// de la carte. Décalage en deux temps : la clé (joueur, x, y) ne se heurte jamais à une case encore occupée
async function toV4(userId, conn) {
    const { x, y } = map.OFFSET;
    for (const table of ['world_annexes', 'world_crafts', 'world_tiles']) {
        await conn.query(`UPDATE ${table} SET x = x + 1000, y = y + 1000 WHERE user_id = $1 AND x IS NOT NULL`, [userId]);
        await conn.query(`UPDATE ${table} SET x = x - 1000 + $2, y = y - 1000 + $3 WHERE user_id = $1 AND x IS NOT NULL`, [userId, x, y]);
    }
}

// Quartiers des terres nouvelles déjà découverts (expédition revenue) : Set des identifiants. Les quartiers du cœur
// sont toujours connus
async function discoveredOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query('SELECT zone FROM world_expeditions WHERE user_id = $1 AND ends_at <= $2', [userId, new Date(now)]);
    return new Set(rows.map(r => r.zone));
}
const isKnown = (zone, discovered) => !zone.trip || discovered.has(zone.id);
// Ce qu'emporte une expédition vers ce quartier : { food, wood }
const expeditionCost = zone => Object.fromEntries(Object.entries(EXPEDITION_COST).map(([r, n]) => [r, n * zone.trip]));
// Expédition en route (pas encore revenue), ou null : { zone, ends_at }
async function expeditionOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query('SELECT zone, ends_at FROM world_expeditions WHERE user_id = $1 AND ends_at > $2', [userId, new Date(now)]);
    return rows[0] || null;
}

// Envoie une expédition vers un quartier inconnu des terres nouvelles, voisin d'un quartier à soi : une à la fois ; elle
// emporte des vivres, du bois et une partie de Récolte, et revient après zone.trip heures (le quartier est alors
// découvert : on peut l'acheter). { zone, endsAt } ou { status, message }
async function startExpedition(userId, zoneId, now = Date.now()) {
    const zone = map.ZONE_BY_ID[zoneId];
    if (!zone || !zone.trip) return { status: 404, message: 'Quartier inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if ((await discoveredOf(userId, conn, now)).has(zone.id)) return db.rollback({ status: 409, message: 'Ce quartier est déjà découvert.' });
        const going = await expeditionOf(userId, conn, now);
        if (going) return db.rollback({ status: 409, message: 'Une expédition est déjà en route : attends son retour.' });
        const zones = await zonesOf(userId, conn);
        if (!map.NEIGHBORS[zone.id].some(id => zones.has(id))) return db.rollback({ status: 403, message: 'Une expédition part d’un quartier à toi, vers un quartier voisin.' });
        const cost = expeditionCost(zone);
        if (Object.entries(cost).some(([r, n]) => stock[r] < n)) return db.rollback({ status: 400, message: `Il faut emporter ${cost.food} vivres et ${cost.wood} bûches : joue une Récolte.` });
        const { levels } = await levelsOf(userId, conn);
        const { bonuses, extra } = await bonusesFor(userId, conn);
        const effects = effectsOf(levels, bonuses, extra);
        const charges = chargesAt(stock, effects.maxCharges, now, effects.regenMs);
        if (charges.count < 1) return db.rollback({ status: 409, message: 'Il faut une partie de Récolte en réserve : la prochaine revient bientôt.' });
        await conn.query('UPDATE world_stock SET charges = $2, charges_at = $3, food = food - $4, wood = wood - $5 WHERE user_id = $1',
            [userId, charges.count - 1, new Date(charges.since), cost.food, cost.wood]);
        const endsAt = new Date(now + zone.trip * 3600 * 1000);
        await conn.query('INSERT INTO world_expeditions (user_id, zone, ends_at) VALUES ($1, $2, $3)', [userId, zone.id, endsAt]);
        return { zone: zone.id, endsAt: endsAt.toISOString() };
    });
}

// Découvre un lieu remarquable d'un quartier à soi : une seule fois (même en double clic ; redécouvrir ne fait rien).
// La production en cours est encaissée d'abord (l'effet ne vaut que pour la suite). Son coffre attend alors parmi les
// coffres. { landmark, fresh } ou { status, message }
async function findLandmark(userId, landmarkId, now = Date.now()) {
    const place = Object.hasOwn(landmarks.LANDMARK_BY_ID, landmarkId) ? landmarks.LANDMARK_BY_ID[landmarkId] : null;
    if (!place) return { status: 404, message: 'Lieu inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(place.zone)) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        if ((await foundOf(userId, conn)).has(place.id)) return { landmark: place.id, fresh: false };
        await gather(userId, conn, stock);
        await conn.query('INSERT INTO world_landmarks (user_id, landmark, found_at) VALUES ($1, $2, $3)', [userId, place.id, new Date(now)]);
        return { landmark: place.id, fresh: true };
    });
}

// Trouvailles de plus à chaque ramassage d'un quartier : une par création de climat posée dans ce quartier, plafonnée
const craftBonusOf = (placed, zoneId) => Math.min(finds.CRAFT_BONUS_MAX,
    placed.filter(r => crafts.CRAFT_BY_ID[r.craft]?.place.climate && map.zoneAt(r.x, r.y) === zoneId).length);

// Ramasse un gisement d'un quartier à soi, s'il a repoussé : quelques trouvailles de son climat (plus une par création
// de climat posée dans le quartier), versées une seule fois (même en double clic : la ligne de stock est verrouillée).
// { find, amount } ou { status, message }
async function gatherDeposit(userId, depositId, now = Date.now()) {
    const deposit = Object.hasOwn(finds.DEPOSIT_BY_ID, depositId) ? finds.DEPOSIT_BY_ID[depositId] : null;
    if (!deposit) return { status: 404, message: 'Gisement inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(deposit.zone)) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const wait = finds.readyIn((await depositsOf(userId, conn)).get(deposit.id), now);
        if (wait > 0) return db.rollback({ status: 409, message: `Ce gisement repousse : reviens dans ${Math.ceil(wait / 60000)} min.` });
        const amount = finds.GATHER.min + crypto.randomInt(0, finds.GATHER.max - finds.GATHER.min + 1) + craftBonusOf(placedOf(await craftsOf(userId, conn)), deposit.zone);
        await conn.query(
            `INSERT INTO world_finds (user_id, find, amount) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, find) DO UPDATE SET amount = world_finds.amount + EXCLUDED.amount`, [userId, deposit.find, amount]);
        await conn.query(
            `INSERT INTO world_deposits (user_id, deposit, gathered_at) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, deposit) DO UPDATE SET gathered_at = EXCLUDED.gathered_at`, [userId, deposit.id, new Date(now)]);
        return { find: deposit.find, amount };
    });
}

// Créations d'île (lot 8) : [{ id, craft, x, y }] (x, y vides : en réserve)
async function craftsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT id, craft, x, y FROM world_crafts WHERE user_id = $1 ORDER BY id', [userId]);
    return rows;
}
const placedOf = rows => rows.filter(r => r.x !== null);
// Créations déjà fabriquées, par sorte (posées ou en réserve) : { création: nombre }
const madeOf = rows => rows.reduce((out, r) => ({ ...out, [r.craft]: (out[r.craft] || 0) + 1 }), {});
// Contexte des règles de pose (crafts.spotBlock) : sol, case libre (sur l'île, hors chantier, quartier à soi, ni annexe,
// ni autre création, ni lieu remarquable, ni gisement), emprise d'un bâtiment bâti, créations posées (sauf skip : celle qu'on déplace)
// (cells : les cases libres, calculées une fois pour toutes les créations)
function craftCtx(levels, zones, annexRows, rows, skip = null) {
    const others = placedOf(rows).filter(r => r.id !== skip);
    const busy = new Set([...annexRows.map(keyOf), ...others.map(keyOf)]);
    const open = new Uint8Array(SIZE * SIZE);
    const cells = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (!map.isLand(x, y) || !zones.has(map.zoneAt(x, y)) || busy.has(y * SIZE + x) || map.inFootprint(x, y, levels) || landmarks.isLandmark(x, y) || finds.isDeposit(x, y)) continue;
            open[y * SIZE + x] = 1;
            cells.push({ x, y });
        }
    }
    return {
        ground: map.groundAt,
        climate: (x, y) => map.ZONE_BY_ID[map.zoneAt(x, y)]?.climate,
        free: (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE && open[y * SIZE + x] === 1,
        site: id => (livesHere(id, levels, zones) ? map.footprintOf(id, levels[id]) : null),
        placed: others,
        cells
    };
}
// Cases où cette création peut se poser maintenant (parmi les cases libres)
function craftSpots(c, ctx) {
    return ctx.cells.filter(({ x, y }) => !crafts.spotBlock(c, x, y, ctx)).map(({ x, y }) => ({ x, y }));
}
// Créations posées sur une case qui n'est plus libre (chantier agrandi) : rangées dans la réserve
async function stowCrafts(userId, rows, levels, zones, annexRows) {
    const ctx = craftCtx(levels, zones, annexRows, []);
    const out = placedOf(rows).filter(r => !ctx.free(r.x, r.y));
    if (!out.length) return rows;
    await db.query('UPDATE world_crafts SET x = NULL, y = NULL WHERE user_id = $1 AND id = ANY($2::int[])', [userId, out.map(r => r.id)]);
    return craftsOf(userId);
}
// Questions de l'Épreuve réussies (progress.timer_progress : niveau → catégorie → identifiants)
async function epreuvesOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT timer_progress FROM progress WHERE user_id = $1', [userId]);
    const done = rows[0]?.timer_progress?.completedQuestions || {};
    return Object.values(done).flatMap(cats => Object.values(cats || {})).reduce((n, ids) => n + (Array.isArray(ids) ? ids.length : 0), 0);
}
// Ce que la vue montre des créations d'île : paliers ouverts, catalogue (ce qui manque pour fabriquer, réserve, cases
// où poser ou déplacer une création déjà fabriquée), créations posées
function craftsView(rows, ctx, { owned, stock, open, epreuves, stars = 0, have }, siteName) {
    const made = madeOf(rows);
    return {
        epreuves: { have: epreuves, need: crafts.EPREUVES },
        // Découvertes du Grimoire qui ouvrent le palier I (l'autre clé : les questions de l'Épreuve)
        stars: { have: stars, need: crafts.STARS },
        open: crafts.TIERS.filter(t => open.has(t)),
        catalog: crafts.CRAFTS.map(c => {
            const reserve = rows.filter(r => r.craft === c.id && r.x === null).length;
            return {
                id: c.id, name: c.name, tier: c.tier, cost: c.cost, finds: c.finds, elements: c.elements.map(name => ({ name, have: owned.has(name) })),
                after: c.after, open: open.has(c.tier), made: made[c.id] || 0, reserve, climate: c.place.climate || null,
                block: crafts.blockOf(c, { made, owned, stock, open, have }), place: crafts.placeText(c, siteName),
                spots: made[c.id] ? craftSpots(c, ctx) : []
            };
        }),
        placed: placedOf(rows).map(r => ({ x: r.x, y: r.y, craft: r.craft }))
    };
}

// Coffres déjà ouverts parmi les sources à surveiller : chapitres, quêtes, lieux, jour (et veille), bouteille. Map source → ligne
const { QUEST_CHESTS } = quests;
async function openedOf(userId, now, conn = db) {
    const { day, slot } = loot.parisOf(now);
    const keys = [
        ...Object.keys(loot.CHAPTER_RARES).map(c => `chapitre:${c}`), ...QUEST_CHESTS.map(q => `quete:${q.id}`),
        ...landmarks.LANDMARKS.map(l => `lieu:${l.id}`), `jour:${day}`, `jour:${loot.dayBefore(day)}`, `bouteille:${day}-${slot}`
    ];
    const { rows } = await conn.query('SELECT source, streak FROM world_chests WHERE user_id = $1 AND source = ANY($2)', [userId, keys]);
    return { day, slot, opened: new Map(rows.map(r => [r.source, r])) };
}

// Série du coffre du jour : celle d'hier plus un, sinon 1 (un jour manqué la remet à 1)
const streakOf = (opened, day) => (opened.get(`jour:${loot.dayBefore(day)}`)?.streak || 0) + 1;

// Ce que la vue montre des coffres : ceux qui attendent (chapitres ouverts, quêtes réclamées, lieux découverts), le
// coffre du jour (série, rareté du jour et du lendemain s'il est ouvert, semaine en cours) et la bouteille de la tranche.
// found : lieux découverts (identifiants)
function chestsView({ day, slot, opened }, openChapters, claimed, found) {
    const today = opened.get(`jour:${day}`);
    const streak = today ? today.streak : streakOf(opened, day);
    const first = streak - ((streak - 1) % 7);
    return {
        pending: [
            ...Object.entries(loot.CHAPTER_RARES).filter(([c]) => openChapters.has(c) && !opened.has(`chapitre:${c}`))
                .map(([c]) => ({ source: `chapitre:${c}`, rarity: 'legendaire', label: `Chapitre ${c} du Grimoire` })),
            ...QUEST_CHESTS.filter(q => claimed.has(q.id) && !opened.has(`quete:${q.id}`))
                .map(q => ({ source: `quete:${q.id}`, rarity: q.chest, label: `Quête : ${q.label}` })),
            ...landmarks.LANDMARKS.filter(l => found.has(l.id) && !opened.has(`lieu:${l.id}`))
                .map(l => ({ source: `lieu:${l.id}`, rarity: l.chest, label: `Lieu : ${l.name}` }))
        ],
        daily: {
            available: !today, streak, rarity: loot.dailyRarity(streak), tomorrow: loot.dailyRarity(streak + 1),
            week: Array.from({ length: 7 }, (_, i) => loot.dailyRarity(first + i))
        },
        bottle: { key: `${day}-${slot}`, available: !opened.has(`bouteille:${day}-${slot}`) }
    };
}

// Case où une annexe de ce bâtiment peut se poser (sans compter ce qui l'occupe) : sol constructible du quartier du
// bâtiment, hors des grandes emprises des chantiers et des lieux remarquables, à annexes.REACH cases au plus de la sienne
function annexSpotOk(siteId, x, y) {
    const at = map.SITE_BIG[siteId];
    return Boolean(at) && Number.isInteger(x) && Number.isInteger(y) && map.buildable(x, y) && !map.inSite(x, y) && !landmarks.isLandmark(x, y)
        && map.zoneAt(x, y) === map.siteZone(siteId) && annexes.reachOf(x, y, at) <= annexes.REACH;
}
// Cases libres où poser une annexe de ce bâtiment (taken : clés des cases occupées), des plus proches aux plus lointaines
function annexSpots(siteId, taken) {
    const at = map.SITE_BIG[siteId];
    const spots = [];
    for (let y = at.y - annexes.REACH; y <= at.y + 2 + annexes.REACH; y++) {
        for (let x = at.x - annexes.REACH; x <= at.x + 2 + annexes.REACH; x++) {
            if (annexSpotOk(siteId, x, y) && !taken.has(y * SIZE + x)) spots.push({ x, y, d: annexes.reachOf(x, y, at) });
        }
    }
    return spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y }));
}
// Ce que la fiche d'un bâtiment montre de ses annexes : posées, prochain exemplaire (palier, prix), effet
function annexesView(siteId, rows) {
    const words = WORDS[SITES[siteId].produce] || [];
    return annexes.ANNEXES.filter(a => a.site === siteId).map(a => {
        const built = rows.filter(r => r.annex === a.id).length;
        const max = annexes.maxOf(a);
        return {
            id: a.id, name: a.name, kind: a.kind, max, built, effect: annexes.effectText(a, words, CAP_HOURS), gain: a.effect,
            levels: Array.from({ length: max }, (_, k) => annexes.levelFor(a, k)),
            next: built < max ? { level: annexes.levelFor(a, built), ...annexes.priceOf(a, built) } : null
        };
    });
}

// Vue de l'île pour le navigateur. book = { describe(noms), openChapters: Set des chapitres ouverts, stars, finished }
async function view(userId, owned, book) {
    await migrate(userId);
    const { levels, builtAt } = await levelsOf(userId);
    const items = await itemsOf(userId);
    const skins = await skinsOf(userId);
    const signed = await signsOf(userId);
    const played = await gamesOf(userId);
    const friends = await friendsOf(userId);
    const named = await namesOf(userId);
    const annexRows = await annexesOf(userId);
    const shopBonuses = shop.bonusesOf(items);
    const stock = await stockOf(userId);
    const zones = await zonesOf(userId);
    const annexCells = new Set(annexRows.map(keyOf));
    const craftRows = await stowCrafts(userId, await craftsOf(userId), levels, zones, annexRows);
    const decor = placedOf(craftRows);
    const filled = await needRowsOf(userId);
    const settlers = await settlersOf(userId);
    const presence = await presenceOf(userId);
    const residents = residentsOf(levels, zones, settlers, presence);
    const moods = moodsOf(residents, levels, zones, decor, filled, presence);
    await welcome(userId, moods, filled, presence);
    const found = await foundOf(userId);
    const lmBonuses = landmarks.bonusesOf(found.keys());
    const { bonuses, extra } = withLandmarks(withMoods(shopBonuses, annexes.bonusesOf(annexRows), moods), lmBonuses);
    const effects = effectsOf(levels, bonuses, extra);
    const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
    const taken = new Set([...annexCells, ...decor.map(keyOf)]);
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = book.describe(plans);
    const production = productionAll(levels, builtAt, stock.collected_at, Date.now(), bonuses, extra);
    const sites = Object.entries(SITES).map(([id, site]) => {
        const level = levels[id] || 0;
        const next = site.levels[level];
        const place = map.footprintOf(id, level);
        const zone = map.siteZone(id);
        const made = production.find(p => p.site === id);
        const step = l => ({
            name: l.name, plan: l.plan, planOwned: !l.plan || have.has(l.plan), planEmoji: l.plan ? known[l.plan]?.emoji || null : null,
            cost: l.cost, coins: l.coins, chapter: l.chapter, chapterOpen: book.openChapters.has(l.chapter), effect: l.effect
        });
        return {
            id, x: place.x, y: place.y, w: place.w, h: place.h, level, maxLevel: site.levels.length, zone, locked: !zones.has(zone),
            // Nom choisi par le joueur (dès le palier III), sinon celui du palier
            name: named[`site:${id}`] || (level ? site.levels[level - 1].name : site.levels[0].name),
            baseName: level ? site.levels[level - 1].name : site.levels[0].name,
            renamed: Boolean(named[`site:${id}`]), renameLevel: RENAME_LEVEL,
            effect: level ? site.levels[level - 1].effect : null,
            emoji: level && site.levels[level - 1].plan ? known[site.levels[level - 1].plan]?.emoji || null : null,
            produce: site.produce || null,
            // Boutique de l'atelier : articles (possédés ou non), skin porté, bonus de production
            shop: shop.ITEMS.filter(item => item.site === id).map(item => ({
                id: item.id, kind: item.kind, name: item.name, price: item.price, minLevel: item.minLevel, rare: Boolean(item.rare),
                ...(item.chapter ? { chapter: item.chapter } : {}),
                effect: shop.effectText(item), gain: item.effect || null, owned: items.has(item.id)
            })),
            skin: skins[id] || null,
            // Style de son enseigne (dès le palier V ; la planche de bois tant qu'aucun autre n'est choisi)
            sign: level >= signs.SIGN_LEVEL ? signed.worn[id] || 'bois' : null,
            bonus: Math.round((shopBonuses.prod[id] || 0) * 100),
            // Part de production en plus apportée par les lieux remarquables découverts
            landmarkBonus: Math.round((lmBonuses.prod[id] || 0) * 100),
            // Part de production en plus (ou en moins) selon l'humeur de son habitant
            moodBonus: site.produce ? Object.values(moods).filter(m => m.site === id && m.built).reduce((sum, m) => sum + villagers.moodSign(m.mood), 0) * Math.round(villagers.MOOD_STEP.prod * 100) : 0,
            // Tous les paliers, pour la fiche du bâtiment (atteints, suivant, à venir)
            levels: site.levels.map(step),
            pending: made ? { coins: made.coins, [made.resource]: made.amount } : null,
            // Rendement horaire avec les bonus de la boutique et les annexes (pour la fiche), heures de production gardées
            perHour: site.produce && level ? perHourOf(level, bonuses.prod[id] || 0, bonuses.coins[id] || 0, extra.site[id] || []) : null,
            capHours: CAP_HOURS + (extra.cap[id] || 0),
            // Annexes : catalogue du bâtiment et cases libres où en poser une (dès le palier II)
            annexes: annexesView(id, annexRows),
            spots: level >= 2 && zones.has(zone) ? annexSpots(id, taken) : [],
            next: next ? step(next) : null
        };
    });
    const pendingStock = Object.fromEntries(RESOURCES.map(r => [r, production.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    const claimed = await claimedOf(userId);
    const facts = await factsOf(userId, owned, book.stars ?? 0, db, moods);
    const visiting = await visitorNow(userId);
    const epreuves = await epreuvesOf(userId);
    const discovered = await discoveredOf(userId);
    const going = await expeditionOf(userId);
    const stockFinds = await findsOf(userId);
    const gathered = await depositsOf(userId);
    const veil = map.veiled(new Set(map.ZONES.filter(z => !isKnown(z, discovered)).map(z => z.code)));
    return {
        size: SIZE,
        map: {
            // Calques de la très grande île (relief, sol, quartiers : voir islandData.js et islandOuter.js) ; grid : index
            // des quartiers. Les quartiers encore inconnus n'y montrent que leur côte (worldMap.veiled)
            grid: map.GRID,
            height: veil.height,
            ground: veil.ground,
            region: map.REGION,
            // Un quartier inconnu ne dit ni son nom, ni son climat, ni son prix : seulement s'il peut être exploré
            // (voisin d'un quartier à soi), en combien d'heures, et ce qu'emporte l'expédition
            zones: map.ZONES.map(z => (isKnown(z, discovered) ? {
                id: z.id, name: named[`zone:${z.id}`] || z.name, baseName: z.name, renamed: Boolean(named[`zone:${z.id}`]),
                price: z.price, chapter: z.chapter, code: z.code, anchor: map.ANCHORS[z.id], climate: z.climate, known: true,
                owned: zones.has(z.id), open: !z.chapter || book.openChapters.has(z.chapter)
            } : {
                id: z.id, name: null, code: z.code, anchor: map.ANCHORS[z.id], known: false, owned: false, open: false,
                trip: z.trip, cost: expeditionCost(z), explorable: !going && map.NEIGHBORS[z.id].some(id => zones.has(id))
            }))
        },
        // Lieux remarquables : ceux des quartiers connus (case, nom, ce qu'ils racontent et font, découverts ou non) ;
        // ceux des quartiers inconnus ne disent rien, sinon qu'ils existent
        landmarks: landmarks.LANDMARKS.map(l => (isKnown(map.ZONE_BY_ID[l.zone], discovered) ? {
            id: l.id, name: l.name, zone: l.zone, x: l.x, y: l.y, text: l.text, effect: landmarks.effectText(l), chest: l.chest,
            found: found.has(l.id), foundAt: found.get(l.id) || null
        } : { id: l.id, zone: l.zone, known: false })),
        // Trouvailles de climat (réserve à part) : nom, climat, nombre
        finds: finds.FINDS.map(f => ({ id: f.id, name: f.name, climate: f.climate, amount: stockFinds[f.id] })),
        // Gisements des quartiers connus : case, trouvaille, temps avant de repousser (ms, 0 : prêt), trouvailles de plus
        // grâce aux créations de climat de leur quartier
        deposits: finds.DEPOSITS.filter(d => isKnown(map.ZONE_BY_ID[d.zone], discovered))
            .map(d => ({ id: d.id, zone: d.zone, find: d.find, x: d.x, y: d.y, readyIn: finds.readyIn(gathered.get(d.id)), bonus: craftBonusOf(decor, d.zone) })),
        // Expédition en route : vers quel quartier, retour dans combien de temps (ms)
        expedition: going ? { zone: going.zone, endsIn: Math.max(0, new Date(going.ends_at).getTime() - Date.now()) } : null,
        sites,
        stock: Object.fromEntries(RESOURCES.map(r => [r, stock[r]])),
        charges: { count: charges.count, max: effects.maxCharges, nextIn: charges.count < effects.maxCharges ? Math.max(0, charges.since + effects.regenMs - Date.now()) : null },
        harvest: { maxMoves: effects.maxMoves, kinds: effects.kinds, boosts: effects.boosts, coinEvery: HARVEST_COIN_EVERY },
        rates: { produce: PRODUCE_PER_LEVEL, coins: COINS_PER_LEVEL },
        capHours: CAP_HOURS,
        pending: production.reduce((sum, p) => sum + p.coins, 0),
        pendingStock,
        // Créations d'île : paliers, catalogue, réserve et cases où poser, créations posées
        crafts: craftsView(craftRows, craftCtx(levels, zones, annexRows, craftRows), {
            owned: have, stock, open: crafts.tiersOpen(book.finished || new Set(), epreuves, book.stars ?? 0), epreuves, stars: book.stars ?? 0, have: stockFinds
        }, id => sites.find(site => site.id === id)?.name || id),
        // Habitants (la troupe rencontrée, les visiteurs installés) : prénom, goûts, amitié, déjà vus ou gâtés
        // aujourd'hui ; leurs besoins, leur humeur et ce qu'elle fait ; built : son bâtiment est bâti (sinon il vit au
        // camp, ou dort dans son quartier) ; asleep : un dormeur qu'on n'a pas encore réveillé (bible, § 6.7)
        villagers: (() => {
            const { day } = loot.parisOf(Date.now());
            // Maisons dans l'ordre où elles sont posées : le premier visiteur installé loge dans la première
            const houses = annexRows.filter(r => r.annex === 'maison');
            return residents.map(v => {
                const friend = friends[v.id] || { points: 0 };
                const hearts = villagers.heartsOf(friend.points);
                const { needs, mood } = moods[v.id];
                const produces = Boolean(SITES[v.site].produce);
                const settled = v.seed !== undefined;
                const home = settled ? houses[settlers.findIndex(row => `v${row.id}` === v.id)] : null;
                return {
                    id: v.id, name: v.name, role: v.role, loves: v.loves, likes: v.likes, site: v.site, points: friend.points, hearts,
                    built: v.built, asleep: SLEEPERS.includes(v.id) && !v.built && !friend.points,
                    next: villagers.HEARTS[hearts] ?? null, talked: friend.talked === day, gifted: friend.gifted === day,
                    needs, mood, moodEffect: villagers.moodEffect(v.site, produces, mood), happyEffect: villagers.moodEffect(v.site, produces, 'heureux'),
                    ...(settled ? { seed: v.seed, home: home ? { x: home.x, y: home.y } : null } : {})
                };
            });
        })(),
        // Maisons du Foyer : posées, occupées par des visiteurs installés
        houses: { total: annexRows.filter(r => r.annex === 'maison').length, used: settlers.length },
        friendship: { talk: villagers.TALK, gift: villagers.GIFT, hearts: villagers.HEARTS, rewards: villagers.REWARDS },
        // Visiteur arrivé en bateau au Ponton (ou null) : sa demande, son départ
        visitor: visitorView(visiting, visiting ? await runsSince(userId, visiting.arrived_at) : 0),
        // Besoins : nom, durée et prix de chacun (se distraire : décorations, à tant de cases)
        needs: {
            kinds: Object.fromEntries(Object.entries(villagers.NEEDS).map(([id, n]) => [id, { label: n.label, ...(n.hours ? { hours: n.hours, cost: n.cost } : { decos: n.decos, reach: n.reach }) }]))
        },
        // Mini-jeux des bâtiments : ouverts au palier III, parties en réserve, multiplicateur d'écus du palier
        games: Object.entries(minigames.GAMES).map(([id, game]) => {
            const level = levels[game.site] || 0;
            const plays = playsOf(played[id], Date.now());
            return {
                id, site: game.site, name: game.name, text: game.text, level: minigames.GAME_LEVEL, open: level >= minigames.GAME_LEVEL,
                plays: plays.count, max: minigames.PLAYS, nextIn: plays.count < minigames.PLAYS ? Math.max(0, plays.since + minigames.PLAY_REGEN_MS - Date.now()) : null,
                mult: minigames.multOf(level), cap: Math.round(minigames.CAP * minigames.multOf(level))
            };
        }),
        // Enseignes : le nom écrit dessus, le palier où elles viennent, les styles (offert, acheté ou à acheter)
        signs: {
            name: signed.name, level: signs.SIGN_LEVEL, nameMax: signs.NAME_MAX,
            styles: signs.STYLES.map(st => ({ id: st.id, name: st.name, price: st.price, text: st.text, owned: !st.price || signed.owned.has(st.id) }))
        },
        annexes: annexRows.filter(r => annexes.ANNEX_BY_ID[r.annex]).map(r => ({ x: r.x, y: r.y, annex: r.annex, site: annexes.ANNEX_BY_ID[r.annex].site })),
        // Le nom du peuple (bible, § 6.11), une fois choisi ; le nom du joueur (§ 9, étape 2)
        people: named.peuple || null,
        player: named.joueur || null,
        // Brume, le feu follet : la quête active (ou son dernier mot)
        brume: (() => {
            const out = boardWith(claimed, facts, book.openChapters);
            // Le fil d'Ariane de la quête active : la cible et les pages qui restent (le Grimoire montre la page marquée)
            if (out.quest && !out.quest.done && book.ariane) out.quest.ariane = { target: book.ariane.target, remaining: book.ariane.remaining };
            return out;
        })(),
        // Coffres : en attente, du jour, bouteille à la mer
        chests: chestsView(await openedOf(userId, Date.now()), book.openChapters, claimed, found)
    };
}

// Réclame la récompense de la quête active de Brume : c'est bien elle, son objectif est atteint, versée une seule
// fois (même en double clic). owned : éléments du Grimoire ; stars : ses découvertes. { status, message } si refus
async function claimQuest(userId, questId, owned, stars) {
    await migrate(userId);
    return db.transaction(async conn => {
        const quest = quests.active(await claimedOf(userId, conn), await factsOf(userId, owned, stars, conn));
        if (!quest || quest.id !== questId) return db.rollback({ status: 409, message: 'Ce n’est pas la quête en cours.' });
        if (!quest.done) return db.rollback({ status: 403, message: `Pas encore : ${quest.label.toLowerCase()} (${quest.have}/${quest.need}).` });
        const added = await conn.query('INSERT INTO world_quests (user_id, quest) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING quest', [userId, questId]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Récompense déjà reçue.' });
        const { coins } = await ledger.credit(userId, quest.coins, 'quete', questId, conn);
        return { gained: quest.coins, coins };
    });
}

// Achat d'un quartier : chapitre ouvert, écus débités une fois (même en double clic) ; { status, message } si refus
async function buyZone(userId, zoneId, openChapters) {
    const zone = map.ZONE_BY_ID[zoneId];
    if (!zone || zone.id === 'coeur') return { status: 404, message: 'Quartier inconnu.' };
    await migrate(userId);
    // Inconnu : rien n'en est dit (pas même son chapitre)
    if (!isKnown(zone, await discoveredOf(userId))) return { status: 403, message: 'Envoie d’abord une expédition découvrir ce quartier.' };
    if (zone.chapter && !openChapters.has(zone.chapter)) return { status: 403, message: `Ouvre d’abord le chapitre ${zone.chapter} du Grimoire.` };
    return db.transaction(async conn => {
        const added = await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING zone', [userId, zone.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Ce quartier est déjà à toi.' });
        const coins = await ledger.debit(userId, zone.price, `quartier:${zone.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${zone.price} écus.` });
        return { bought: zone.name, coins };
    });
}

// Construit le palier suivant d'un chantier : chapitre du palier ouvert dans le Livre, plan découvert, ressources,
// écus (débités une seule fois, même en double clic). openChapters : Set des chapitres ouverts.
// Les décorations prises dans une emprise agrandie sont déplacées au prochain affichage (settle). { status, message } si refus
async function build(userId, owned, siteId, openChapters = new Set()) {
    const site = SITES[siteId];
    if (!site) return { status: 404, message: 'Chantier inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(siteId))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const { levels } = await levelsOf(userId, conn);
        const level = levels[siteId] || 0;
        const next = site.levels[level];
        if (!next) return db.rollback({ status: 409, message: 'Ce chantier est déjà achevé.' });
        if (!openChapters.has(next.chapter)) return db.rollback({ status: 403, message: `Ouvre d’abord le chapitre ${next.chapter} du Grimoire.` });
        if (next.plan && !owned.includes(next.plan)) return db.rollback({ status: 403, message: `Il te faut le plan : découvre « ${next.plan} » dans le Grimoire.` });
        const missing = Object.entries(next.cost).filter(([r, n]) => stock[r] < n);
        if (missing.length) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const costs = RESOURCES.map(r => next.cost[r] || 0);
        // Ce que le bâtiment avait produit est encaissé avant l'évolution (sa production repart de zéro)
        await gather(userId, conn, stock);
        let coins;
        if (next.coins) {
            coins = await ledger.debit(userId, next.coins, `chantier:${siteId}:${level + 1}`, conn);
            if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${next.coins} écus.` });
        }
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1', [userId, ...costs]);
        await conn.query(
            `INSERT INTO world_buildings (user_id, site, level) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level, built_at = NOW()`, [userId, siteId, level + 1]);
        return { built: next.name, ...(coins !== undefined ? { coins } : {}) };
    });
}

// Nouvelle partie de Récolte : une partie de la réserve, une graine, la configuration figée de l'île
function startRun(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const { bonuses, extra } = await bonusesFor(userId, conn);
        const effects = effectsOf(levels, bonuses, extra);
        const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
        if (charges.count < 1) return db.rollback({ status: 409, message: 'Plus de partie en réserve : la prochaine revient bientôt.' });
        await conn.query('UPDATE world_stock SET charges = $2, charges_at = $3 WHERE user_id = $1', [userId, charges.count - 1, new Date(charges.since)]);
        const seed = crypto.randomInt(1, 2147483647);
        const first = !(await conn.query('SELECT 1 FROM world_runs WHERE user_id = $1 LIMIT 1', [userId])).rows.length;
        const { boosts } = effects;
        const kinds = first ? FIRST_RUN_KINDS : effects.kinds;
        const maxMoves = effects.maxMoves + (first ? FIRST_RUN_MOVES : 0);
        const { rows } = await conn.query(
            'INSERT INTO world_runs (user_id, seed, config) VALUES ($1, $2, $3) RETURNING id',
            [userId, seed, JSON.stringify({ kinds, maxMoves, boosts })]);
        return { run: { id: Number(rows[0].id), seed, kinds, maxMoves, boosts } };
    });
}

// Fin de partie : le serveur rejoue les coups ; la partie ne se rend qu'une fois, même refusée
function finishRun(userId, runId, moves) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'SELECT seed, config, created_at FROM world_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cette partie est déjà rendue.' });
        await conn.query('UPDATE world_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { seed, config, created_at: createdAt } = rows[0];
        const played = Date.now() - new Date(createdAt).getTime() > RUN_TTL_MS
            ? { ok: false, error: 'Partie expirée' }
            : harvest.replay(seed, config.kinds, moves, config.maxMoves, config.boosts);
        if (!played.ok) return { status: 400, message: `Partie refusée : ${played.error.toLowerCase()}.` };
        await stockOf(userId, conn, true);
        const g = played.gains;
        await addStock(userId, g, conn);
        // Et des écus : 1 par tranche de 10 ressources gagnées, versés une seule fois pour cette partie
        const earned = Math.floor((g.stone + g.wood + g.water + g.food) / HARVEST_COIN_EVERY);
        if (earned > 0) await ledger.credit(userId, earned, 'recolte', runId, conn);
        // Parfois un coffre (sûr avec une grande chaîne)
        const rarity = loot.harvestChest(moves.length, Math.max(0, ...moves.map(path => path.length)), random);
        const chest = rarity ? await grant(userId, `recolte:${runId}`, rarity, conn) : null;
        // coins : le solde (écus de la partie et du coffre compris)
        return { gains: g, earned, coins: await balanceOf(userId, conn), chest };
    });
}

// Nouvelle partie d'un mini-jeu (bâtiment au palier III ou plus) : une partie de sa réserve, une graine. { run } ou
// { status, message }
async function startGame(userId, gameId) {
    const game = minigames.GAMES[gameId];
    if (!game) return { status: 404, message: 'Mini-jeu inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const level = (await levelsOf(userId, conn)).levels[game.site] || 0;
        if (level < minigames.GAME_LEVEL) return db.rollback({ status: 403, message: `${game.name} : au palier III du bâtiment.` });
        const now = Date.now();
        const plays = playsOf((await gamesOf(userId, conn))[gameId], now);
        if (plays.count < 1) return db.rollback({ status: 409, message: 'Plus de partie en réserve : la prochaine revient bientôt.' });
        await conn.query(`INSERT INTO world_games (user_id, game, plays, plays_at) VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, game) DO UPDATE SET plays = EXCLUDED.plays, plays_at = EXCLUDED.plays_at`, [userId, gameId, plays.count - 1, new Date(plays.since)]);
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_game_runs (user_id, game, seed, level) VALUES ($1, $2, $3, $4) RETURNING id', [userId, gameId, seed, level]);
        return { run: { id: Number(rows[0].id), game: gameId, seed, level } };
    });
}

// Fin d'une partie de mini-jeu : le serveur rejoue les gestes et verse les écus (une seule fois : la partie se rend
// une fois, même refusée). { earned, raw, detail, coins } ou { status, message }
function finishGame(userId, runId, input) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'SELECT game, seed, level, created_at FROM world_game_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cette partie est déjà rendue.' });
        await conn.query('UPDATE world_game_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { game, seed, level, created_at: createdAt } = rows[0];
        const elapsed = Date.now() - new Date(createdAt).getTime();
        if (elapsed > GAME_TTL_MS) return { status: 400, message: 'Partie refusée : partie expirée.' };
        const played = minigames.replay(game, seed, input);
        if (!played.ok) return { status: 400, message: `Partie refusée : ${played.error}.` };
        if (played.last > elapsed + GAME_SLACK_MS) return { status: 400, message: 'Partie refusée : partie trop rapide.' };
        const earned = minigames.earnedOf(played.raw, level);
        if (earned > 0) await ledger.credit(userId, earned, `jeu:${game}`, runId, conn);
        return { earned, raw: played.raw, detail: played.detail, coins: await balanceOf(userId, conn) };
    });
}

// Récompenses des cœurs gagnés de from (exclu) à to (inclus), versées une seule fois chacune (ami:<habitant>:<cœur>),
// dans la transaction de l'appelant : [{ level, kind: 'coins', amount } | { level, kind: 'chest', chest }]
async function friendRewards(userId, villagerId, from, to, conn) {
    const out = [];
    for (let level = from + 1; level <= to; level++) {
        const reward = villagers.REWARDS[level - 1];
        const ref = `ami:${villagerId}:${level}`;
        if (reward.kind === 'coins') {
            const done = await ledger.credit(userId, reward.amount, 'ami', ref, conn);
            if (done.credited) out.push({ level, kind: 'coins', amount: reward.amount });
        } else {
            const chest = await grant(userId, ref, reward.rarity, conn);
            if (chest) out.push({ level, kind: 'chest', chest });
        }
    }
    return out;
}

// Amitié d'un habitant (son bâtiment bâti, dans un quartier à soi) : lui parler (resource null) ou lui offrir des
// ressources, chacun une fois par jour (heure de Paris). Points d'amitié, puis les récompenses des cœurs gagnés.
// { gained, points, hearts, rewards, coins } ou { status, message }
async function befriend(userId, villagerId, resource = null, now = Date.now()) {
    if (!knownResident(villagerId)) return { status: 404, message: 'Habitant inconnu.' };
    if (resource !== null && !villagers.RESOURCES.includes(resource)) return { status: 400, message: 'Cadeau invalide.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const villager = residentsOf(levels, await zonesOf(userId, conn), await settlersOf(userId, conn), await presenceOf(userId, conn)).find(r => r.id === villagerId);
        if (!villager) {
            const base = villagers.VILLAGERS[villagerId];
            return db.rollback(base ? { status: 403, message: `${base.name} n’habite pas encore ton île.` } : { status: 404, message: 'Habitant inconnu.' });
        }
        const { day } = loot.parisOf(now);
        const { rows } = await conn.query(
            `SELECT points, to_char(talked_on, 'YYYY-MM-DD') AS talked, to_char(gifted_on, 'YYYY-MM-DD') AS gifted
             FROM world_friends WHERE user_id = $1 AND villager = $2`, [userId, villagerId]);
        const friend = rows[0] || { points: 0 };
        let gained;
        if (resource === null) {
            if (friend.talked === day) return db.rollback({ status: 409, message: `Vous avez déjà bavardé aujourd’hui : ${villager.name} t’attend demain.` });
            gained = villagers.TALK;
        } else {
            if (friend.gifted === day) return db.rollback({ status: 409, message: `${villager.name} a déjà reçu un cadeau aujourd’hui.` });
            if (stock[resource] < villagers.GIFT.cost) return db.rollback({ status: 400, message: `Il te faut ${villagers.GIFT.cost} ${villagers.LABELS[resource]} pour ce cadeau.` });
            // resource est l'une des quatre colonnes du stock (liste fermée ci-dessus)
            await conn.query(`UPDATE world_stock SET ${resource} = ${resource} - $2 WHERE user_id = $1`, [userId, villagers.GIFT.cost]);
            gained = villagers.giftPoints(villager, resource);
        }
        const points = Math.min(villagers.MAX_POINTS, friend.points + gained);
        await conn.query(
            `INSERT INTO world_friends (user_id, villager, points, talked_on, gifted_on) VALUES ($1, $2, $3, $4::date, $5::date)
             ON CONFLICT (user_id, villager) DO UPDATE SET points = EXCLUDED.points,
                 talked_on = COALESCE(EXCLUDED.talked_on, world_friends.talked_on), gifted_on = COALESCE(EXCLUDED.gifted_on, world_friends.gifted_on)`,
            [userId, villagerId, points, resource === null ? day : null, resource === null ? null : day]);
        const hearts = villagers.heartsOf(points);
        const rewards = await friendRewards(userId, villagerId, villagers.heartsOf(friend.points), hearts, conn);
        return { gained: points - friend.points, points, hearts, rewards, coins: await balanceOf(userId, conn) };
    });
}

// Combler des besoins avec les ressources du stock (manger, travailler), une fois la moitié du besoin écoulée.
// targets : [{ villager, need }], refusés au premier qui coince ; ou null : tout ce qui peut l'être, habitant après
// habitant, tant que le stock suffit. { filled: [{ villager, need }] } ou { status, message }
async function fillNeeds(userId, targets = null, now = Date.now()) {
    for (const { villager, need } of targets || []) {
        if (!knownResident(villager)) return { status: 404, message: 'Habitant inconnu.' };
        if (!villagers.FILLABLE.includes(need)) return { status: 400, message: 'Besoin inconnu.' };
    }
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const zones = await zonesOf(userId, conn);
        const presence = await presenceOf(userId, conn);
        const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
        const moods = moodsOf(residents, levels, zones, placedOf(await craftsOf(userId, conn)), await needRowsOf(userId, conn), presence, now);
        const wanted = targets || Object.entries(moods).flatMap(([villager, m]) => m.needs.filter(n => n.cost).map(n => ({ villager, need: n.id })));
        const spent = Object.fromEntries(RESOURCES.map(r => [r, 0]));
        const filled = [];
        let short = false;
        for (const { villager, need } of wanted) {
            const who = residents.find(r => r.id === villager);
            const name = who ? who.name : villagers.VILLAGERS[villager]?.name;
            const state = moods[villager]?.needs.find(n => n.id === need);
            let refusal = null;
            if (!who) refusal = name ? { status: 403, message: `${name} n’habite pas encore ton île.` } : { status: 404, message: 'Habitant inconnu.' };
            else if (!state) refusal = { status: 403, message: 'Bâtis d’abord l’Atelier : c’est lui qui forge les outils.' };
            else if (!state.refill) refusal = { status: 409, message: `${name} n’en a pas encore besoin.` };
            else if (Object.entries(state.cost).some(([r, n]) => stock[r] - spent[r] < n)) {
                short = true;
                refusal = { status: 400, message: `Il te faut ${Object.entries(state.cost).map(([r, n]) => `${n} ${WORDS[r][0]}`).join(' et ')}.` };
            }
            if (refusal && targets) return db.rollback(refusal);
            if (refusal) continue;
            for (const [r, n] of Object.entries(state.cost)) spent[r] += n;
            filled.push({ villager, need });
        }
        if (!filled.length) {
            return db.rollback(short ? { status: 400, message: 'Il te manque des ressources pour combler leurs besoins : joue une Récolte.' }
                : { status: 409, message: 'Personne n’a besoin de rien pour l’instant.' });
        }
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, spent.stone, spent.wood, spent.water, spent.food]);
        for (const { villager, need } of filled) {
            await conn.query(
                `INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, villager, need) DO UPDATE SET filled_at = EXCLUDED.filled_at`, [userId, villager, need, new Date(now)]);
        }
        return { filled };
    });
}

// Combler la demande du visiteur : livrer les ressources (prises au stock) ou avoir fait ses Récoltes depuis son
// arrivée ; il remercie en écus, une seule fois. { reward, coins } ou { status, message }
async function satisfyVisitor(userId, visitorId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT * FROM world_visitors WHERE id = $1 AND user_id = $2 FOR UPDATE', [visitorId, userId]);
        const row = rows[0];
        if (!row || now >= new Date(row.leaves_at).getTime()) return db.rollback({ status: 404, message: 'Ce visiteur est déjà reparti.' });
        const name = visitors.nameOf(row.seed);
        if (row.satisfied_at) return db.rollback({ status: 409, message: `${name} a déjà ce qu’il lui faut. Merci encore !` });
        const r = row.request;
        if (r.kind === 'livrer') {
            if (!RESOURCES.includes(r.resource)) return db.rollback({ status: 400, message: 'Demande invalide.' });
            if (stock[r.resource] < r.amount) return db.rollback({ status: 400, message: `Il te faut ${r.amount} ${WORDS[r.resource][0]}.` });
            // r.resource est l'une des quatre colonnes du stock (vérifié ci-dessus)
            await conn.query(`UPDATE world_stock SET ${r.resource} = ${r.resource} - $2 WHERE user_id = $1`, [userId, r.amount]);
        } else {
            const left = r.count - await runsSince(userId, row.arrived_at, conn);
            if (left > 0) return db.rollback({ status: 403, message: `Encore ${left} Récolte${left > 1 ? 's' : ''} à faire pour ${name}.` });
        }
        await conn.query('UPDATE world_visitors SET satisfied_at = $2 WHERE id = $1', [visitorId, new Date(now)]);
        const { coins } = await ledger.credit(userId, r.reward, 'visiteur', String(visitorId), conn);
        return { reward: r.reward, coins };
    });
}

// Maisons du Foyer posées et occupées : { total, used }
async function housesOf(userId, conn) {
    const { rows } = await conn.query(
        `SELECT (SELECT COUNT(*)::int FROM world_annexes WHERE user_id = $1 AND annex = 'maison') AS total,
                (SELECT COUNT(*)::int FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL) AS used`, [userId]);
    return rows[0];
}
// Un visiteur comblé reste sur l'île : il prend une maison libre et devient habitant (pour toujours).
// { settled: prénom } ou { status, message }
async function settleVisitor(userId, visitorId, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT * FROM world_visitors WHERE id = $1 AND user_id = $2 FOR UPDATE', [visitorId, userId]);
        const row = rows[0];
        if (!row || row.settled_at || now >= new Date(row.leaves_at).getTime()) return db.rollback({ status: 404, message: 'Ce visiteur est déjà reparti.' });
        const name = visitors.nameOf(row.seed);
        if (!row.satisfied_at) return db.rollback({ status: 403, message: `Comble d’abord la demande de ${name}.` });
        const houses = await housesOf(userId, conn);
        if (houses.used >= houses.total) return db.rollback({ status: 409, message: 'Aucune maison libre : pose une Maison près du Foyer (annexes du Foyer).' });
        await conn.query('UPDATE world_visitors SET settled_at = $2 WHERE id = $1', [visitorId, new Date(now)]);
        return { settled: name };
    });
}

// Décorations de l'ancienne règle (éléments du Livre posés n'importe où) : remboursées au prix payé, une seule fois,
// puis retirées de l'île (lot 8). priceOf(élément) : prix selon son chapitre. { count, coins, balance } (count 0 : rien
// à faire ; balance : solde après remboursement)
async function refundDecorations(userId, priceOf) {
    const seen = await db.query('SELECT 1 FROM world_tiles WHERE user_id = $1 LIMIT 1', [userId]);
    if (!seen.rows.length) return { count: 0, coins: 0 };
    // Les cartes d'avant d'abord : leur passage paie encore les écus dus par les décorations
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!rows.length) return { count: 0, coins: 0 };
        const coins = rows.reduce((sum, r) => sum + (priceOf(r.element) || 0), 0);
        if (coins > 0) await ledger.credit(userId, coins, 'remboursement', 'decorations', conn);
        await conn.query('DELETE FROM world_tiles WHERE user_id = $1', [userId]);
        return { count: rows.length, coins, balance: await balanceOf(userId, conn) };
    });
}

// Assemblage d'une création : palier ouvert, celles d'avant déjà fabriquées, savoir-faire du Livre, ressources. Une
// graine, les pièces à poser (rien n'est payé avant la réussite). owned : éléments du Livre ; finished : chapitres
// finis. { run: { id, craft, shape, pieces, turned } } ou { status, message }
async function startCraft(userId, craftId, owned, finished, stars = 0) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: 'Création inconnue.' };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const open = crafts.tiersOpen(finished, await epreuvesOf(userId, conn), stars);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock, open, have: await findsOf(userId, conn) });
        if (block) return db.rollback({ status: 403, message: block });
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_craft_runs (user_id, craft, seed) VALUES ($1, $2, $3) RETURNING id', [userId, craftId, seed]);
        return { run: { id: Number(rows[0].id), craft: c.id, shape: c.shape, pieces: crafts.piecesOf(c.shape, seed, c.tier), turned: crafts.TURNED[c.tier] } };
    });
}

// Fin d'un assemblage : le serveur vérifie que les pièces couvrent le gabarit, puis prend les ressources et met la
// création en réserve. L'assemblage ne se rend qu'une fois, même refusé. { made, craft } ou { status, message }
function finishCraft(userId, runId, layout, owned, finished, stars = 0) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query(
            'SELECT craft, seed, created_at FROM world_craft_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cet assemblage est déjà rendu.' });
        await conn.query('UPDATE world_craft_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { craft: craftId, seed, created_at: createdAt } = rows[0];
        const c = crafts.CRAFT_BY_ID[craftId];
        if (Date.now() - new Date(createdAt).getTime() > CRAFT_TTL_MS) return { status: 400, message: 'Assemblage refusé : temps écoulé.' };
        const done = crafts.check(c.shape, crafts.piecesOf(c.shape, seed, c.tier), layout);
        if (!done.ok) return { status: 400, message: `Assemblage refusé : ${done.error}.` };
        // Entre le début et la fin, le stock ou le Livre ont pu changer
        const open = crafts.tiersOpen(finished, await epreuvesOf(userId, conn), stars);
        const block = crafts.blockOf(c, { made: madeOf(await craftsOf(userId, conn)), owned: new Set(owned), stock, open, have: await findsOf(userId, conn) });
        if (block) return { status: 409, message: block };
        const n = r => c.cost[r] || 0;
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, n('stone'), n('wood'), n('water'), n('food')]);
        await spendFinds(userId, c.finds, conn);
        await conn.query('INSERT INTO world_crafts (user_id, craft) VALUES ($1, $2)', [userId, craftId]);
        return { made: c.name, craft: c.id };
    });
}

// Pose une création de la réserve sur une case permise par sa règle. { } ou { status, message }
async function placeCraft(userId, craftId, x, y) {
    if (!Object.hasOwn(crafts.CRAFT_BY_ID, craftId)) return { status: 404, message: 'Création inconnue.' };
    const c = crafts.CRAFT_BY_ID[craftId];
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.craft === craftId && r.x === null);
        if (!row) return db.rollback({ status: 409, message: `Pas de « ${c.name} » en réserve : fabrique d’abord cette création.` });
        const { levels } = await levelsOf(userId, conn);
        const block = crafts.spotBlock(c, x, y, craftCtx(levels, await zonesOf(userId, conn), await annexesOf(userId, conn), rows));
        if (block) return db.rollback({ status: 400, message: block });
        await conn.query('UPDATE world_crafts SET x = $2, y = $3 WHERE id = $1', [row.id, x, y]);
        return {};
    });
}

// Déplace une création posée vers une autre case permise (gratuit). { } ou { status, message }
async function moveCraft(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const rows = await craftsOf(userId, conn);
        const row = rows.find(r => r.x === x && r.y === y);
        if (!row) return db.rollback({ status: 404, message: 'Aucune création sur cette case.' });
        const { levels } = await levelsOf(userId, conn);
        const block = crafts.spotBlock(crafts.CRAFT_BY_ID[row.craft], toX, toY, craftCtx(levels, await zonesOf(userId, conn), await annexesOf(userId, conn), rows, row.id));
        if (block) return db.rollback({ status: 400, message: block });
        await conn.query('UPDATE world_crafts SET x = $2, y = $3 WHERE id = $1', [row.id, toX, toY]);
        return {};
    });
}

// Range une création posée dans la réserve (elle se repose plus tard, sans rien payer). { } ou { status, message }
async function storeCraft(userId, x, y) {
    await migrate(userId);
    const { rows } = await db.query('UPDATE world_crafts SET x = NULL, y = NULL WHERE user_id = $1 AND x = $2 AND y = $3 RETURNING id', [userId, x, y]);
    return rows.length ? {} : { status: 404, message: 'Aucune création sur cette case.' };
}

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

// Donne un coffre, une seule fois par source (même en double clic) : tire son lot selon l'île, l'applique (écus au
// grand livre, ressources au stock, teinte ou pièce rare à la collection) et l'inscrit. Dans la transaction de
// l'appelant, ligne de stock verrouillée. { source, rarity, prize }, ou null si ce coffre est déjà ouvert
async function grant(userId, source, rarity, conn, { wanted = null, streak = null } = {}) {
    const prize = loot.prizeOf(rarity, { levels: (await levelsOf(userId, conn)).levels, owned: await itemsOf(userId, conn) }, random, wanted);
    const added = await conn.query(
        `INSERT INTO world_chests (user_id, source, rarity, prize, streak) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING source`, [userId, source, rarity, JSON.stringify(prize), streak]);
    if (!added.rows.length) return null;
    if (prize.kind === 'coins') await ledger.credit(userId, prize.amount, 'butin', source, conn);
    if (prize.kind === 'stock') await addStock(userId, prize.stock, conn);
    if (prize.item) await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'butin') ON CONFLICT DO NOTHING`, [userId, prize.item]);
    return { source, rarity, prize };
}

// Ouvre un coffre qui attend : 'jour' (série), 'bouteille' (tranche de 6 h), 'chapitre:<id>' (chapitre ouvert, sa
// pièce rare), 'quete:<id>' (quête réclamée qui en donne un), 'lieu:<id>' (lieu remarquable découvert).
// openChapters : Set des chapitres ouverts. { chest, coins } ou { status, message } si refus
async function openChest(userId, source, openChapters, now = Date.now()) {
    const [kind, id] = source.split(':');
    const chapter = kind === 'chapitre' ? loot.CHAPTER_RARES[id] : null;
    const quest = kind === 'quete' ? QUEST_CHESTS.find(q => q.id === id) : null;
    const place = kind === 'lieu' && Object.hasOwn(landmarks.LANDMARK_BY_ID, id) ? landmarks.LANDMARK_BY_ID[id] : null;
    if (!['jour', 'bouteille'].includes(source) && !chapter && !quest && !place) return { status: 404, message: 'Coffre inconnu.' };
    if (chapter && !openChapters.has(id)) return { status: 403, message: `Ouvre d’abord le chapitre ${id} du Grimoire.` };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { day, slot, opened } = await openedOf(userId, now, conn);
        if (quest && !(await claimedOf(userId, conn)).has(quest.id)) return db.rollback({ status: 403, message: 'Réclame d’abord cette quête de Brume.' });
        if (place && !(await foundOf(userId, conn)).has(place.id)) return db.rollback({ status: 403, message: 'Découvre d’abord ce lieu sur l’île.' });
        const chest = await grantSource(userId, source, { day, slot, opened }, conn);
        if (!chest) return db.rollback({ status: 409, message: source === 'bouteille' ? 'La prochaine bouteille n’est pas encore arrivée.' : 'Ce coffre est déjà ouvert.' });
        return { chest, coins: await balanceOf(userId, conn) };
    });
}

// Tire et donne le coffre d'une source déjà validée ('jour', 'bouteille', 'chapitre:<id>', 'quete:<id>', 'lieu:<id>'),
// dans la transaction : sa clé et sa rareté selon le jour, la tranche et la série. null s'il est déjà ouvert
function grantSource(userId, source, { day, slot, opened }, conn) {
    if (source === 'jour') {
        const streak = streakOf(opened, day);
        return grant(userId, `jour:${day}`, loot.dailyRarity(streak), conn, { streak });
    }
    if (source === 'bouteille') return grant(userId, `bouteille:${day}-${slot}`, loot.rarityOf(loot.BOTTLE.odds, random), conn);
    const [kind, id] = source.split(':');
    if (kind === 'lieu') return grant(userId, source, landmarks.LANDMARK_BY_ID[id].chest, conn);
    const chapter = kind === 'chapitre' ? loot.CHAPTER_RARES[id] : null;
    return grant(userId, source, chapter ? 'legendaire' : QUEST_CHESTS.find(q => q.id === id).chest, conn, { wanted: chapter });
}

// « Tout ouvrir » : tout ce qui attend (coffre du jour, chapitres ouverts, quêtes réclamées, lieux découverts, bouteille), dans une seule
// transaction. La liste est celle que montre la vue, établie ici sous verrou, jamais reçue du client.
// { chests, coins } ou { status, message } s'il n'y a rien à ouvrir
async function openAll(userId, openChapters, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const state = await openedOf(userId, now, conn);
        const { daily, pending, bottle } = chestsView(state, openChapters, await claimedOf(userId, conn), new Set((await foundOf(userId, conn)).keys()));
        const sources = [...(daily.available ? ['jour'] : []), ...pending.map(c => c.source), ...(bottle.available ? ['bouteille'] : [])];
        const chests = [];
        for (const source of sources) {
            const chest = await grantSource(userId, source, state, conn);
            if (chest) chests.push(chest);
        }
        if (!chests.length) return db.rollback({ status: 409, message: 'Aucun coffre à ouvrir.' });
        return { chests, coins: await balanceOf(userId, conn) };
    });
}

// Annexe posée sur cette case (ligne verrouillée), ou null
async function annexAt(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT annex FROM world_annexes WHERE user_id = $1 AND x = $2 AND y = $3 FOR UPDATE', [userId, x, y]);
    return rows[0] || null;
}
// Case déjà prise par une création d'île ou une annexe
async function cellTaken(userId, x, y, conn) {
    const { rows } = await conn.query('SELECT 1 FROM world_crafts WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y]);
    return rows.length > 0 || Boolean(await annexAt(userId, x, y, conn));
}
const SPOT_MESSAGE = 'Une annexe se pose sur une case libre du quartier, à deux cases au plus de son bâtiment.';

// Pose l'exemplaire suivant d'une annexe : bâtiment construit au palier voulu dans un quartier possédé, case libre
// autorisée, ressources et écus débités une seule fois (ligne de stock verrouillée : deux poses ne se croisent pas).
// La production en cours est encaissée d'abord (l'annexe produit à partir de sa pose). { status, message } si refus
async function placeAnnex(userId, annexId, x, y) {
    const a = annexes.ANNEX_BY_ID[annexId];
    if (!a) return { status: 404, message: 'Annexe inconnue.' };
    if (!annexSpotOk(a.site, x, y)) return { status: 400, message: SPOT_MESSAGE };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const level = levels[a.site] || 0;
        if (!level || !(await zonesOf(userId, conn)).has(map.siteZone(a.site))) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        const copy = (await annexesOf(userId, conn)).filter(r => r.annex === a.id).length;
        if (copy >= annexes.maxOf(a)) return db.rollback({ status: 409, message: annexes.maxOf(a) > 1 ? 'Tous les exemplaires de cette annexe sont posés.' : 'Cette annexe est déjà posée.' });
        const need = annexes.levelFor(a, copy);
        if (level < need) return db.rollback({ status: 403, message: `Il faut le palier ${CHAPTER_OF_LEVEL[need - 1]} de ce bâtiment.` });
        if (await cellTaken(userId, x, y, conn)) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        const { cost, coins: price, finds: spent } = annexes.priceOf(a, copy);
        if (Object.entries(cost).some(([r, n]) => stock[r] < n)) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const have = await findsOf(userId, conn);
        const short = Object.entries(spent).find(([f, n]) => have[f] < n);
        if (short) return db.rollback({ status: 400, message: `Il te faut ${short[1]} ${finds.FIND_BY_ID[short[0]].name.toLowerCase()} : ramasses-en sur les gisements de son climat.` });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, price, `annexe:${a.id}:${copy + 1}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${price} écus.` });
        await spendFinds(userId, spent, conn);
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, ...RESOURCES.map(r => cost[r] || 0)]);
        await conn.query('INSERT INTO world_annexes (user_id, x, y, annex) VALUES ($1, $2, $3, $4)', [userId, x, y, a.id]);
        return { built: a.name, coins };
    });
}

// Déplace gratuitement une annexe vers une autre case libre autorisée pour son bâtiment (sa production continue)
async function moveAnnex(userId, x, y, toX, toY) {
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const found = await annexAt(userId, x, y, conn);
        if (!found) return db.rollback({ status: 404, message: 'Aucune annexe sur cette case.' });
        const a = annexes.ANNEX_BY_ID[found.annex];
        if (!a || !annexSpotOk(a.site, toX, toY)) return db.rollback({ status: 400, message: SPOT_MESSAGE });
        if (x === toX && y === toY) return {};
        if (await cellTaken(userId, toX, toY, conn)) return db.rollback({ status: 409, message: 'Cette case est déjà occupée.' });
        await conn.query('UPDATE world_annexes SET x = $4, y = $5 WHERE user_id = $1 AND x = $2 AND y = $3', [userId, x, y, toX, toY]);
        return {};
    });
}

// Achat d'un article de la boutique d'un atelier : bâtiment construit (au niveau demandé) dans un quartier possédé,
// écus débités une seule fois. La production en cours est encaissée d'abord (le bonus ne vaut que pour la suite).
async function buyItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 403, message: 'Cette pièce rare ne s’achète pas : elle se trouve dans les butins.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(item.site)) || !(levels[item.site] || 0)) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        if (levels[item.site] < item.minLevel) return db.rollback({ status: 403, message: `Il faut le palier ${CHAPTER_OF_LEVEL[item.minLevel - 1]} de ce bâtiment.` });
        const added = await conn.query('INSERT INTO world_items (user_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item', [userId, item.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Tu l’as déjà.' });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, item.price, `boutique:${item.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${item.price} écus.` });
        // Un skin acheté est porté tout de suite
        if (item.kind === 'skin') {
            await conn.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
                ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, item.site, item.id]);
        }
        return { bought: item.name, coins };
    });
}

// Annulation d'un achat de la boutique juste après (achat en un toucher) : l'article est rendu, ses écus remboursés
// une seule fois (même en double clic), son skin retiré s'il était porté. Un article gagné dans un coffre ne se rend
// pas. { status, message } si refus ou trop tard
async function undoItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 409, message: 'Une pièce rare ne se rend pas.' };
    return db.transaction(async conn => {
        // La production jusqu'ici compte encore avec l'article
        await gather(userId, conn, await stockOf(userId, conn, true));
        const removed = await conn.query(
            `DELETE FROM world_items WHERE user_id = $1 AND item = $2 AND source = 'boutique' AND bought_at > NOW() - make_interval(secs => $3) RETURNING bought_at`,
            [userId, item.id, UNDO_SECONDS]);
        if (!removed.rows.length) return db.rollback({ status: 409, message: 'Trop tard pour annuler cet achat.' });
        await conn.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2 AND skin = $3', [userId, item.site, item.id]);
        const { coins } = await ledger.credit(userId, item.price, 'boutique-annulee', `${item.id}:${removed.rows[0].bought_at.getTime()}`, conn);
        return { undone: item.name, coins };
    });
}

// Skin porté par un bâtiment : un skin possédé de ce bâtiment, ou aucun (apparence d'origine)
async function chooseSkin(userId, siteId, skinId) {
    if (!SITES[siteId]) return { status: 404, message: 'Bâtiment inconnu.' };
    if (!skinId) {
        await db.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2', [userId, siteId]);
        return {};
    }
    const item = shop.ITEM_BY_ID[skinId];
    if (!item || item.kind !== 'skin' || item.site !== siteId) return { status: 400, message: 'Ce skin ne va pas sur ce bâtiment.' };
    if (!(await itemsOf(userId)).has(skinId)) return { status: 403, message: item.rare ? 'Trouve d’abord cette pièce rare dans les butins.' : 'Achète d’abord ce skin.' };
    await db.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, siteId, skinId]);
    return {};
}

// Le nom du peuple (bible, § 6.11 ; la quête « peuple » de l'acte V) : même règle que les autres noms, rangé dans
// world_names sous la cible 'peuple' ; il peut changer, jamais s'effacer. { name } ou { status, message }
async function namePeople(userId, raw) {
    const name = naming.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    await db.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, 'peuple', $2)
        ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return { name };
}

// Le nom du joueur (bible, § 9, étape 2 : « écris-le dans le Grimoire ») : même règle que les autres noms, rangé dans
// world_names sous la cible 'joueur' ; il peut changer, jamais s'effacer. { name } ou { status, message }
async function namePlayer(userId, raw) {
    const name = naming.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    await db.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, 'joueur', $2)
        ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return { name };
}

// Nom d'un bâtiment (dès son palier III) ou d'un quartier à soi ; un nom vide rend celui d'origine.
// kind : 'site' | 'zone'. { status, message } si refus
async function rename(userId, kind, id, raw) {
    const known = kind === 'site' ? Boolean(SITES[id]) : kind === 'zone' && map.ZONES.some(z => z.id === id);
    if (!known) return { status: 404, message: kind === 'zone' ? 'Quartier inconnu.' : 'Bâtiment inconnu.' };
    const reset = !String(raw ?? '').trim();
    const name = reset ? null : naming.cleanName(raw);
    if (!reset && !name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (kind === 'site') {
            const site = SITES[id];
            if (((await levelsOf(userId, conn)).levels[id] || 0) < RENAME_LEVEL) return db.rollback({ status: 403, message: 'Un bâtiment se renomme dès son palier III.' });
            if (!(await zonesOf(userId, conn)).has(map.siteZone(id))) return db.rollback({ status: 403, message: `${site.levels[0].name} : achète d’abord son quartier.` });
        } else if (!(await zonesOf(userId, conn)).has(id)) {
            return db.rollback({ status: 403, message: 'Achète d’abord ce quartier pour le renommer.' });
        }
        const target = `${kind}:${id}`;
        if (reset) await conn.query('DELETE FROM world_names WHERE user_id = $1 AND target = $2', [userId, target]);
        else await conn.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, target, name]);
        return {};
    });
}

// Nom écrit sur les enseignes de l'île. { status, message } si le nom ne convient pas
async function nameSigns(userId, raw) {
    const name = signs.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${signs.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await db.query(`INSERT INTO world_sign_names (user_id, name) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return {};
}

// Style de l'enseigne d'un bâtiment au palier V ou plus : acheté au passage s'il ne l'est pas encore (payé une seule
// fois, même en double clic), puis porté. { coins } après un achat, {} sinon, ou { status, message } si refus
async function chooseSign(userId, siteId, styleId) {
    if (!SITES[siteId]) return { status: 404, message: 'Bâtiment inconnu.' };
    const style = signs.STYLE_BY_ID[styleId];
    if (!style) return { status: 404, message: 'Style d’enseigne inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (((await levelsOf(userId, conn)).levels[siteId] || 0) < signs.SIGN_LEVEL) return db.rollback({ status: 403, message: 'L’enseigne vient au palier V du bâtiment.' });
        let coins;
        if (style.price) {
            const bought = await conn.query('INSERT INTO world_sign_styles (user_id, style) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING style', [userId, style.id]);
            if (bought.rows.length) {
                coins = await ledger.debit(userId, style.price, 'enseigne', conn);
                if (coins === null) return db.rollback({ status: 400, message: `Ce style coûte ${style.price} écus.` });
            }
        }
        await conn.query(`INSERT INTO world_signs (user_id, site, style) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, site) DO UPDATE SET style = EXCLUDED.style`, [userId, siteId, style.id]);
        return coins === undefined ? {} : { coins };
    });
}

// Encaisse la production des bâtiments (écus au grand livre, ressources au stock) dans la transaction de l'appelant
async function gather(userId, conn, stock) {
    const { levels, builtAt } = await levelsOf(userId, conn);
    const now = new Date();
    const { bonuses, extra } = await bonusesFor(userId, conn);
    const made = productionAll(levels, builtAt, stock.collected_at, now.getTime(), bonuses, extra);
    const coins = made.reduce((sum, p) => sum + p.coins, 0);
    const got = Object.fromEntries(RESOURCES.map(r => [r, made.filter(p => p.resource === r).reduce((sum, p) => sum + p.amount, 0)]));
    if (!coins && RESOURCES.every(r => !got[r])) return { gained: 0, stock: got, balance: null };
    await conn.query('UPDATE world_stock SET collected_at = $2, stone = stone + $3, wood = wood + $4, water = water + $5, food = food + $6 WHERE user_id = $1',
        [userId, now, got.stone, got.wood, got.water, got.food]);
    const { coins: balance } = await ledger.credit(userId, coins, 'monde', now.toISOString(), conn);
    return { gained: coins, stock: got, balance };
}

// Récolte de la production des bâtiments : { gained, stock, coins }
async function collect(userId) {
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const done = await gather(userId, conn, stock);
        if (!done.gained && RESOURCES.every(r => !done.stock[r])) return db.rollback({ gained: 0, stock: done.stock, coins: await ledger.balance(userId) });
        return { gained: done.gained, stock: done.stock, coins: done.balance };
    });
}

module.exports = {
    SIZE, CAP_HOURS, REGEN_MS, DECO_PRICES, SITES, effectOf, pendingOf, chargesAt, effectsOf, productionOf,
    view, build, buyZone, buyItem, undoItem, chooseSkin, startRun, finishRun, collect, migrate, claimQuest, board, openChest, openAll,
    placeAnnex, moveAnnex, annexSpotOk, nameSigns, chooseSign, startGame, finishGame, befriend, fillNeeds, satisfyVisitor, settleVisitor, rename, namePeople, namePlayer, arianeTargets,
    refundDecorations, startCraft, finishCraft, placeCraft, moveCraft, storeCraft, startExpedition, findLandmark, gatherDeposit
};
