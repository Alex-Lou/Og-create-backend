// Les habitants : qui est là (présence, rencontre), humeurs et besoins, visiteurs ; amitié, besoins comblés, visiteurs
// satisfaits et installés. Extrait de services/world.js (lot santé), sans changement.
const crypto = require('crypto');
const db = require('../../config/db');
const ledger = require('../ledger');
const map = require('../worldMap');
const quests = require('../quests');
const loot = require('../loot');
const villagers = require('../villagers');
const visitors = require('../visitors');
const players = require('../players');
const anya = require('../anya');
const { RESOURCES, WORDS, SITES } = require('./rules');
const {
    needRowsOf, settlersOf, levelsOf, stockOf, zonesOf, claimedOf, craftsOf, placedOf, balanceOf, PLAYED
} = require('./reads');
const { migrate } = require('./migrate');
const { grant } = require('./chests');
// Encaisser avant un changement d'humeur (produce.js, qui lit déjà ce module : chargé seulement à l'appel)
const gatherBefore = (...args) => require('./produce').gatherBefore(...args);
const gather = (...args) => require('./produce').gather(...args);
const payWith = (...args) => require('./produce').payWith(...args);

// Un habitant vit sur l'île quand son bâtiment est bâti, dans un quartier à soi
const livesHere = (id, levels, zones) => (levels[id] || 0) >= 1 && zones.has(map.siteZone(id));
// Décorations à reach cases au plus (en tous sens) de l'emprise d'un bâtiment
function decosNear(tiles, siteId, level, reach) {
    const at = map.footprintOf(siteId, level);
    const gap = (v, from, size) => Math.max(from - v, 0, v - (from + size - 1));
    return tiles.filter(t => Math.max(gap(t.x, at.x, at.w), gap(t.y, at.y, at.h)) <= reach).length;
}
// Identifiant d'un visiteur installé, parmi les habitants : 'v<numéro de sa visite>'
const SETTLER_ID = /^v\d{1,9}$/;
const knownResident = id => Object.hasOwn(villagers.VILLAGERS, id) || SETTLER_ID.test(id);
// La troupe est là dès sa rencontre (bible, § 6.6), un personnage à la fois. Pour une île neuve, Aster arrive après le
// feu et ouvre la Récolte ; Cannelle attend que cette leçon soit terminée, puis Rivet arrive après les poules. Avant la
// v6 : Aster dès le compte, Cannelle après la Récolte, Rivet après la soupe, gardés tels quels. Les quatre dormeurs
// (SLEEPERS) apparaissent dès que leur quartier
// est à soi ; un joueur d'avant la bible garde aussi chaque habitant dont le bâtiment est bâti. presence : { veteran,
// fresh, done (quêtes faites, quests.doneOf) }
const SLEEPERS = ['puits', 'bosquet', 'carriere', 'potager'];
function metOf(id, levels, zones, presence) {
    if (presence.veteran && livesHere(id, levels, zones)) return true;
    if (id === 'ponton') return !presence.fresh || presence.done.has('feu');
    if (id === 'foyer') return presence.done.has('recolte');
    if (id === 'atelier') return presence.done.has(presence.fresh ? 'poules' : 'soupe');
    return zones.has(map.siteZone(id));
}
// Ce qu'il faut pour savoir qui est là : compte d'avant la bible, quêtes faites ; et la Bénédiction d'Anya (le cœur de
// l'île libéré : l'humeur ne descend plus sous « content »)
async function presenceOf(userId, conn = db) {
    const blessed = anya.awakeOf(await zonesOf(userId, conn));
    return { veteran: await players.islandVeteranOf(userId, conn), fresh: await players.islandFreshOf(userId, conn), done: quests.doneOf(await claimedOf(userId, conn)), blessed };
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
// productionAll. island = { levels, zones, settlers, presence, decor, filled, blights } ; base = { bonuses, extra } de
// la boutique et des annexes ; lm : landmarks.bonusesOf
function prodSteps(island, base, lm, collectedAt, now) {
    const { levels, zones, settlers, presence, decor, filled, blights } = island;
    const residents = residentsOf(levels, zones, settlers, presence);
    const from = collectedAt ? new Date(collectedAt).getTime() : 0;
    const times = [...new Set([...moodTimes(filled, from, now), ...blightTimes(blights, from, now)])].sort((a, b) => a - b);
    return times.map(at => {
        const moods = moodsOf(residents, levels, zones, decor, filled, presence, at);
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
// Récoltes terminées depuis une date, en jouant au moins un coup (demande d'un visiteur)
async function runsSince(userId, since, conn = db) {
    const { rows } = await conn.query(`SELECT COUNT(*)::int AS n FROM world_runs WHERE user_id = $1 AND finished_at >= $2 AND ${PLAYED}`, [userId, since]);
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
        const villager = residentsOf(levels, await zonesOf(userId, conn), await settlersOf(userId, conn), await presenceOf(userId, conn, now)).find(r => r.id === villagerId);
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
            // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour le cadeau
            const { stock: paid } = await payWith(userId, conn, stock);
            if (paid[resource] < villagers.GIFT.cost) return db.rollback({ status: 400, message: `Il te faut ${villagers.GIFT.cost} ${villagers.LABELS[resource]} pour ce cadeau.` });
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
        const locked = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const zones = await zonesOf(userId, conn);
        const presence = await presenceOf(userId, conn, now);
        const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
        const moods = moodsOf(residents, levels, zones, placedOf(await craftsOf(userId, conn)), await needRowsOf(userId, conn), presence, now);
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
        return { filled, ...(coins !== undefined ? { coins } : {}) };
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
            // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour la livraison
            const { stock: paid } = await payWith(userId, conn, stock);
            if (paid[r.resource] < r.amount) return db.rollback({ status: 400, message: `Il te faut ${r.amount} ${WORDS[r.resource][0]}.` });
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
        const stock = await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT * FROM world_visitors WHERE id = $1 AND user_id = $2 FOR UPDATE', [visitorId, userId]);
        const row = rows[0];
        if (!row || row.settled_at || now >= new Date(row.leaves_at).getTime()) return db.rollback({ status: 404, message: 'Ce visiteur est déjà reparti.' });
        const name = visitors.nameOf(row.seed);
        if (!row.satisfied_at) return db.rollback({ status: 403, message: `Comble d’abord la demande de ${name}.` });
        const houses = await housesOf(userId, conn);
        if (houses.used >= houses.total) return db.rollback({ status: 409, message: 'Aucune maison libre : pose une Maison près du Foyer (annexes du Foyer).' });
        // Son humeur ne compte qu'à partir d'aujourd'hui : ce qui a été produit avant est encaissé d'abord
        const coins = await gatherBefore(userId, conn, stock, island => ({ ...island, settlers: [...island.settlers, row] }));
        await conn.query('UPDATE world_visitors SET settled_at = $2 WHERE id = $1', [visitorId, new Date(now)]);
        return { settled: name, ...(coins !== undefined ? { coins } : {}) };
    });
}

module.exports = {
    livesHere, decosNear, SETTLER_ID, knownResident, SLEEPERS, metOf, presenceOf, residentsOf, hungryOf, HUNGRY_AGO,
    moodsOf, withMoods, withLandmarks, withBlights, moodTimes, prodSteps, sameSteps, runsSince, visitorNow, visitorView,
    friendRewards, befriend, fillNeeds, satisfyVisitor, housesOf, settleVisitor
};
