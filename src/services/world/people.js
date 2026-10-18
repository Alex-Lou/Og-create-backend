// Les habitants : qui est là (présence, rencontre), humeurs et besoins, les arrivants ; amitié, besoins comblés,
// arrivants accueillis. Extrait de services/world.js (lot santé) ; les arrivants remplacent les visiteurs (18 oct.).
const crypto = require('crypto');
const db = require('../../config/db');
const ledger = require('../ledger');
const map = require('../worldMap');
const quests = require('../quests');
const loot = require('../loot');
const villagers = require('../villagers');
const visitors = require('../visitors');
const anya = require('../anya');
const { RESOURCES, WORDS, SITES } = require('./rules');
const {
    needRowsOf, settlersOf, levelsOf, stockOf, zonesOf, claimedOf, craftsOf, placedOf, balanceOf, namesOf
} = require('./reads');
const { cleanName } = require('../naming');
const { cleanChoices } = require('../avatarChoices');
const { migrate } = require('./migrate');
const { grant } = require('./chests');
// Encaisser avant un changement d'humeur (produce.js, qui lit déjà ce module : chargé seulement à l'appel)
const gatherBefore = (...args) => require('./produce').gatherBefore(...args);
const gather = (...args) => require('./produce').gather(...args);
const payWith = (...args) => require('./produce').payWith(...args);
const { STATIC, footprintAt, placesOf } = require('./places');
const T = require('../../texts/villagers');

// Un habitant vit sur l'île quand son bâtiment est bâti, dans un quartier à soi
const livesHere = (id, levels, zones) => (levels[id] || 0) >= 1 && zones.has(map.siteZone(id));
// Décorations à reach cases au plus (en tous sens) de l'emprise d'un bâtiment (où qu'il soit : places)
function decosNear(tiles, siteId, level, reach, places = STATIC) {
    const at = footprintAt(places, siteId, level);
    const gap = (v, from, size) => Math.max(from - v, 0, v - (from + size - 1));
    return tiles.filter(t => Math.max(gap(t.x, at.x, at.w), gap(t.y, at.y, at.h)) <= reach).length;
}
// Identifiant d'un visiteur installé, parmi les habitants : 'v<numéro de sa visite>'
const SETTLER_ID = /^v\d{1,9}$/;
const knownResident = id => Object.hasOwn(villagers.VILLAGERS, id) || SETTLER_ID.test(id);
// La troupe est là dès sa rencontre (bible, § 6.6), un personnage par jour : Lorena après la première nuit, Agathe
// après la deuxième, Nathan après la troisième (après les poules), Léo après la quatrième (choix de l'auteur, 13 oct. :
// jamais le même jour que Nathan). Les quatre dormeurs
// (SLEEPERS) apparaissent dès que leur quartier est à soi. presence : { done (quêtes faites, quests.doneOf), blessed }
const SLEEPERS = ['puits', 'bosquet', 'carriere', 'potager'];
function metOf(id, levels, zones, presence) {
    if (id === 'ponton') return presence.done.has('nuit');
    if (id === 'foyer') return presence.done.has('veille');
    if (id === 'atelier') return presence.done.has('nuit-cannelle');
    if (id === 'puits') return presence.done.has('nuit-rivet');
    return zones.has(map.siteZone(id));
}
// Ce qu'il faut pour savoir qui est là : les quêtes faites ; et la Bénédiction d'Anya (le cœur de l'île libéré :
// l'humeur ne descend plus sous « content »)
async function presenceOf(userId, conn = db) {
    const blessed = anya.awakeOf(await zonesOf(userId, conn));
    return { done: quests.doneOf(await claimedOf(userId, conn)), blessed };
}
// Quand chacun est arrivé sur l'île (le journal de l'île : il n'écrit d'un camarade qu'à partir de son arrivée ; choix
// de l'auteur, 16 oct.) : { habitant: ms }. La date de la quête qui le fait venir (metOf), celle de l'achat du quartier
// d'un dormeur, et, pour qui dormait, son réveil (WAKE_PREFIX : retenu au premier bavardage, world_items) : la plus
// tardive. Un camarade réveillé avant que son réveil soit retenu compte depuis son arrivée
const ARRIVAL_QUESTS = { ponton: 'nuit', foyer: 'veille', atelier: 'nuit-cannelle', puits: 'nuit-rivet' };
const WAKE_PREFIX = 'reveil:';
async function arrivalsOf(userId, conn = db) {
    const [quests, zones, woke] = await Promise.all([
        conn.query('SELECT quest, claimed_at FROM world_quests WHERE user_id = $1 AND quest = ANY($2)', [userId, Object.values(ARRIVAL_QUESTS)]),
        conn.query('SELECT zone, bought_at FROM world_zones WHERE user_id = $1', [userId]),
        conn.query('SELECT item, bought_at FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${WAKE_PREFIX}%`])
    ]);
    const questAt = new Map(quests.rows.map(r => [r.quest, new Date(r.claimed_at).getTime()]));
    const zoneAt = new Map(zones.rows.map(r => [r.zone, new Date(r.bought_at).getTime()]));
    const wokeAt = new Map(woke.rows.map(r => [r.item.slice(WAKE_PREFIX.length), new Date(r.bought_at).getTime()]));
    const out = {};
    for (const id of Object.keys(villagers.VILLAGERS)) {
        const met = ARRIVAL_QUESTS[id] ? questAt.get(ARRIVAL_QUESTS[id]) : zoneAt.get(map.siteZone(id));
        if (met !== undefined) out[id] = Math.max(met, wokeAt.get(id) || 0);
    }
    return out;
}
// Habitants de l'île : la troupe rencontrée (built : son bâtiment est bâti, dans un quartier à soi), puis les
// arrivants accueillis (et les visiteurs installés d'avant), qui travaillent au bâtiment de leur métier :
// [{ id, name, role, loves, likes, site, built, seed?, look? }] (look : ses choix d'allure, ou null : celle de sa graine)
function residentsOf(levels, zones, settlers, presence) {
    const base = Object.entries(villagers.VILLAGERS).filter(([id]) => metOf(id, levels, zones, presence))
        .map(([id, v]) => ({ id, name: v.name, role: v.role, loves: v.loves, likes: v.likes, site: id, built: livesHere(id, levels, zones) }));
    const settled = settlers.map(row => ({
        id: `v${row.id}`, name: row.name || visitors.nameOf(row.seed), role: visitors.ROLES[row.site].role, ...visitors.tastesOf(row.site), site: row.site,
        built: true, seed: row.seed, look: row.look || null
    }));
    return [...base, ...settled];
}
// Agathe a faim en arrivant, pendant le prologue (la quête « soupe » : bible, § 9, étape 3) ; les autres arrivent
// comblés
const hungryOf = (id, presence) => id === 'foyer' && !presence.done.has('soupe');
const HUNGRY_AGO = (villagers.NEEDS.manger.hours * 60 + 1) * 60 * 1000;
// Besoins et humeur de chaque habitant à l'instant now : { habitant: { needs, mood, site, built } } (se distraire :
// les créations d'île posées autour du bâtiment où il travaille, une fois ce bâtiment bâti et le prologue fini)
// (places : où sont les bâtiments, world/places.js)
function moodsOf(residents, levels, zones, decor, filled, presence, now = Date.now(), places = STATIC) {
    const atelier = livesHere('atelier', levels, zones);
    const prologue = !presence.done.has('puits-ondin');
    const out = {};
    for (const { id, site, built } of residents) {
        const rows = hungryOf(id, presence) && !filled[id]?.manger ? { ...filled[id], manger: new Date(now - HUNGRY_AGO) } : filled[id] || {};
        const deco = built && !prologue;
        const needs = villagers.needsOf(rows, deco ? decosNear(decor, site, levels[site], villagers.NEEDS.deco.reach, places) : 0, atelier, now, { deco });
        const mood = villagers.moodOf(needs);
        out[id] = { needs, mood: presence.blessed ? anya.blessedMood(mood) : mood, site, built };
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
// Instants où l'humeur change d'elle-même de from à to (ms) : l'échéance de chaque besoin comblé (manger, outils).
// from d'abord, puis les échéances dans l'ordre
function moodTimes(filled, from, to) {
    const ends = new Set();
    for (const rows of Object.values(filled)) {
        for (const need of villagers.FILLABLE) {
            const end = rows[need] ? new Date(rows[need]).getTime() + villagers.NEEDS[need].hours * 3600000 : NaN;
            if (end > from && end < to) ends.add(end);
        }
    }
    return [from, ...[...ends].sort((a, b) => a - b)];
}
// Un bâtiment embrumé par un égaré (world/nights.js) ne produit plus, annexes comprises, jusqu'à sa réparation : sa part
// de production vaut −1 (productionOf compte chaque heure × (1 + part)). blights : [{ site, since, until }] (until :
// null tant qu'il n'est pas réparé). bonuses : { prod, … } ; at : l'instant
function withBlights(bonuses, blights = [], at = Date.now()) {
    const out = blights.filter(b => new Date(b.since).getTime() <= at && (!b.until || at < new Date(b.until).getTime()));
    if (!out.length) return bonuses;
    const prod = { ...bonuses.prod };
    out.forEach(b => { prod[b.site] = -1; });
    return { ...bonuses, prod };
}
// Les instants où une panne commence ou finit, dans ]from, to[
const blightTimes = (blights = [], from, to) => blights.flatMap(b => [b.since, b.until].filter(Boolean).map(t => new Date(t).getTime()))
    .filter(t => t > from && t < to);

// La part de production en plus de chaque bâtiment depuis la dernière récolte, à chaque instant où elle change d'elle-même
// (l'humeur, à l'échéance d'un besoin : moodTimes ; une panne qui commence ou finit) : [{ at, prod }] pour
// productionAll. island = { levels, zones, settlers, presence, decor, filled, blights, places } ; base = { bonuses, extra } de
// la boutique et des annexes ; lm : landmarks.bonusesOf
function prodSteps(island, base, lm, collectedAt, now) {
    const { levels, zones, settlers, presence, decor, filled, blights, places } = island;
    const residents = residentsOf(levels, zones, settlers, presence);
    const from = collectedAt ? new Date(collectedAt).getTime() : 0;
    const times = [...new Set([...moodTimes(filled, from, now), ...blightTimes(blights, from, now)])].sort((a, b) => a - b);
    return times.map(at => {
        const moods = moodsOf(residents, levels, zones, decor, filled, presence, at, places);
        return { at, prod: withBlights(withLandmarks(withMoods(base.bonuses, base.extra, moods), lm).bonuses, blights, at).prod };
    });
}
// Même part de production en plus pour chaque bâtiment à chaque instant (deux suites de prodSteps sur la même fenêtre)
function sameSteps(a, b) {
    const at = (steps, t) => steps.filter(s => s.at <= t).pop() || steps[0];
    return [...a, ...b].every(({ at: t }) => {
        const pa = at(a, t).prod;
        const pb = at(b, t).prod;
        return Object.keys({ ...pa, ...pb }).every(site => (pa[site] || 0) === (pb[site] || 0));
    });
}
// L'arrivant du moment : celui qui attend au Ponton, ou celui qu'un moment du récit fait venir (visitors.js : momentsOf ;
// le Ponton bâti, dans un quartier à soi). Il vient dans une transaction verrouillée : deux vues en même temps n'en font
// pas venir deux (et l'index idx_world_visitors_moment n'en garde qu'un par moment). Ligne de world_visitors, ou null
async function arrivalNow(userId, now = Date.now()) {
    const waitingOf = async conn => (await conn.query(
        'SELECT * FROM world_visitors WHERE user_id = $1 AND moment IS NOT NULL AND settled_at IS NULL ORDER BY arrived_at LIMIT 1', [userId])).rows[0];
    // Le prochain moment à faire venir, ou null
    const dueOf = async conn => {
        const [{ levels }, zones, names, rows] = await Promise.all([levelsOf(userId, conn), zonesOf(userId, conn), namesOf(userId, conn),
            conn.query('SELECT moment FROM world_visitors WHERE user_id = $1 AND (moment IS NOT NULL OR settled_at IS NOT NULL)', [userId])]);
        if (!livesHere('ponton', levels, zones)) return null;
        const had = new Set(rows.rows.filter(r => r.moment).map(r => r.moment));
        const legacy = rows.rows.filter(r => !r.moment).length;
        return visitors.nextMoment(visitors.momentsOf({ levels, named: names.peuple }), had, legacy);
    };
    const seen = await waitingOf(db);
    if (seen) return seen;
    if (!(await dueOf(db))) return null;
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const waiting = await waitingOf(conn);
        if (waiting) return waiting;
        const moment = await dueOf(conn);
        if (!moment) return null;
        const { rows } = await conn.query(
            `INSERT INTO world_visitors (user_id, seed, moment, arrived_at) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, moment) WHERE moment IS NOT NULL DO NOTHING RETURNING *`,
            [userId, crypto.randomInt(1, 2147483647), moment, new Date(now)]);
        return rows[0] || null;
    });
}
// Ce que la vue montre de l'arrivant qui attend : son moment, sa graine (l'allure que le jeu lui tire), un prénom
// proposé, et les métiers qu'il peut prendre (les bâtiments bâtis, dans un quartier à soi) ; ou null
function arrivalView(row, levels, zones) {
    if (!row) return null;
    return {
        id: Number(row.id), moment: row.moment, seed: row.seed, name: visitors.nameOf(row.seed), nameMax: visitors.NAME_MAX,
        roles: Object.entries(visitors.ROLES).filter(([site]) => livesHere(site, levels, zones)).map(([site, r]) => ({ site, role: r.role }))
    };
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
    if (!knownResident(villagerId)) return { status: 404, message: T.VILLAGER_UNKNOWN };
    if (resource !== null && !villagers.RESOURCES.includes(resource)) return { status: 400, message: T.GIFT_INVALID };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const villager = residentsOf(levels, await zonesOf(userId, conn), await settlersOf(userId, conn), await presenceOf(userId, conn, now)).find(r => r.id === villagerId);
        if (!villager) {
            const base = villagers.VILLAGERS[villagerId];
            return db.rollback(base ? { status: 403, message: T.NOT_HERE_YET(base.name) } : { status: 404, message: T.VILLAGER_UNKNOWN });
        }
        const { day } = loot.parisOf(now);
        const { rows } = await conn.query(
            `SELECT points, to_char(talked_on, 'YYYY-MM-DD') AS talked, to_char(gifted_on, 'YYYY-MM-DD') AS gifted
             FROM world_friends WHERE user_id = $1 AND villager = $2`, [userId, villagerId]);
        const friend = rows[0] || { points: 0 };
        let gained;
        if (resource === null) {
            if (friend.talked === day) return db.rollback({ status: 409, message: T.ALREADY_TALKED(villager.name) });
            gained = villagers.TALK;
        } else {
            if (friend.gifted === day) return db.rollback({ status: 409, message: T.ALREADY_GIFTED(villager.name) });
            // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour le cadeau
            const { stock: paid } = await payWith(userId, conn, stock);
            if (paid[resource] < villagers.GIFT.cost) return db.rollback({ status: 400, message: T.GIFT_COST(villagers.GIFT.cost, villagers.LABELS[resource]) });
            // resource est l'une des quatre colonnes du stock (liste fermée ci-dessus)
            await conn.query(`UPDATE world_stock SET ${resource} = ${resource} - $2 WHERE user_id = $1`, [userId, villagers.GIFT.cost]);
            gained = villagers.giftPoints(villager, resource);
        }
        const points = Math.min(villagers.MAX_POINTS, friend.points + gained);
        // (un dormeur qu'on réveille : son réveil est retenu, le journal de l'île l'écrit à partir de là ; arrivalsOf)
        if (SLEEPERS.includes(villagerId) && !friend.points) {
            await conn.query('INSERT INTO world_items (user_id, item, bought_at, source) VALUES ($1, $2, to_timestamp($3 / 1000.0), $4) ON CONFLICT DO NOTHING', [userId, `${WAKE_PREFIX}${villagerId}`, now, 'ile']);
        }
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
        if (!knownResident(villager)) return { status: 404, message: T.VILLAGER_UNKNOWN };
        if (!villagers.FILLABLE.includes(need)) return { status: 400, message: T.NEED_UNKNOWN };
    }
    await migrate(userId);
    return db.transaction(async conn => {
        const locked = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const zones = await zonesOf(userId, conn);
        const presence = await presenceOf(userId, conn, now);
        const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
        const moods = moodsOf(residents, levels, zones, placedOf(await craftsOf(userId, conn)), await needRowsOf(userId, conn), presence, now, (await placesOf(userId, conn)).places);
        const wanted = targets || Object.entries(moods).flatMap(([villager, m]) => m.needs.filter(n => n.cost).map(n => ({ villager, need: n.id })));
        // Ce qui a été produit est encaissé d'abord, avec l'humeur d'avant : cela compte pour payer ; le stock le comprend
        const { balance } = await gather(userId, conn, locked);
        const coins = balance ?? undefined;
        const stock = await stockOf(userId, conn);
        const spent = Object.fromEntries(RESOURCES.map(r => [r, 0]));
        const filled = [];
        let short = false;
        for (const { villager, need } of wanted) {
            const who = residents.find(r => r.id === villager);
            const name = who ? who.name : villagers.VILLAGERS[villager]?.name;
            const state = moods[villager]?.needs.find(n => n.id === need);
            let refusal = null;
            if (!who) refusal = name ? { status: 403, message: T.NOT_HERE_YET(name) } : { status: 404, message: T.VILLAGER_UNKNOWN };
            else if (!state) refusal = { status: 403, message: T.WORKSHOP_FIRST };
            else if (!state.refill) refusal = { status: 409, message: T.NO_NEED_YET(name) };
            else if (Object.entries(state.cost).some(([r, n]) => stock[r] - spent[r] < n)) {
                short = true;
                refusal = { status: 400, message: T.NEED_COST(Object.entries(state.cost).map(([r, n]) => `${n} ${WORDS[r][0]}`)) };
            }
            if (refusal && targets) return db.rollback(refusal);
            if (refusal) continue;
            for (const [r, n] of Object.entries(state.cost)) spent[r] += n;
            filled.push({ villager, need });
        }
        if (!filled.length) {
            return db.rollback(short ? { status: 400, message: T.NEEDS_SHORT }
                : { status: 409, message: T.NOBODY_NEEDS });
        }
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1',
            [userId, spent.stone, spent.wood, spent.water, spent.food]);
        for (const { villager, need } of filled) {
            await conn.query(
                `INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, villager, need) DO UPDATE SET filled_at = EXCLUDED.filled_at`, [userId, villager, need, new Date(now)]);
        }
        return { filled, ...(coins !== undefined ? { coins } : {}) };
    });
}

// Maisons du Foyer posées et occupées : { total, used }
async function housesOf(userId, conn) {
    const { rows } = await conn.query(
        `SELECT (SELECT COUNT(*)::int FROM world_annexes WHERE user_id = $1 AND annex = 'maison') AS total,
                (SELECT COUNT(*)::int FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL) AS used`, [userId]);
    return rows[0];
}
// Accueillir l'arrivant qui attend au Ponton : son métier (un bâtiment bâti, dans un quartier à soi), son prénom (mêmes
// règles que les autres noms, NAME_MAX), son allure (ses choix, vérifiés comme ceux de l'avatar, sans rien de gagné à
// la boutique ni aux coffres : avatarChoices.js) ; il prend une maison libre et devient habitant (pour toujours).
// { settled: prénom, coins? } ou { status, message }
async function welcomeArrival(userId, arrivalId, { site, name, look } = {}, now = Date.now()) {
    await migrate(userId);
    const named = cleanName(name, visitors.NAME_MAX);
    if (!named) return { status: 400, message: T.ARRIVAL_NAME };
    const chosen = cleanChoices(look);
    if (chosen.status) return chosen;
    if (typeof site !== 'string' || !Object.hasOwn(visitors.ROLES, site)) return { status: 400, message: T.ARRIVAL_SITE };
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT * FROM world_visitors WHERE id = $1 AND user_id = $2 AND moment IS NOT NULL FOR UPDATE', [arrivalId, userId]);
        const row = rows[0];
        if (!row || row.settled_at) return db.rollback({ status: 404, message: T.ARRIVAL_GONE });
        const [{ levels }, zones] = await Promise.all([levelsOf(userId, conn), zonesOf(userId, conn)]);
        if (!livesHere(site, levels, zones)) return db.rollback({ status: 403, message: T.ARRIVAL_SITE });
        const houses = await housesOf(userId, conn);
        if (houses.used >= houses.total) return db.rollback({ status: 409, message: T.NO_FREE_HOUSE });
        // Son humeur ne compte qu'à partir d'aujourd'hui : ce qui a été produit avant est encaissé d'abord
        const settler = { ...row, site, name: named, look: chosen.choices };
        const coins = await gatherBefore(userId, conn, stock, island => ({ ...island, settlers: [...island.settlers, settler] }));
        await conn.query('UPDATE world_visitors SET site = $2, name = $3, look = $4, settled_at = $5 WHERE id = $1',
            [arrivalId, site, named, JSON.stringify(chosen.choices), new Date(now)]);
        return { settled: named, ...(coins !== undefined ? { coins } : {}) };
    });
}

module.exports = {
    livesHere, decosNear, SETTLER_ID, knownResident, SLEEPERS, metOf, presenceOf, arrivalsOf, WAKE_PREFIX, residentsOf, hungryOf, HUNGRY_AGO,
    moodsOf, withMoods, withLandmarks, withBlights, moodTimes, prodSteps, sameSteps, arrivalNow, arrivalView,
    friendRewards, befriend, fillNeeds, housesOf, welcomeArrival
};
