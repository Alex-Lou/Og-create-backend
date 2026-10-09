// Les nuits de créatures, avec la base (v6, § 6.15 ; règles pures : services/nights.js). Une ligne world_nights par
// joueur, née quand Brume les présente (startNights). Les nuits se règlent au passage suivant (settleNights, appelé par
// migrate), dans l'ordre du temps :
// - la première nuit vient un jour après la présentation ;
// - un seul bâtiment embrumé à la fois : une nuit n'en embrume un que si aucun ne l'est déjà ;
// - Anya, révélée, guérit le bâtiment embrumé le jour de son passage.
// L'île (quartiers, bâtiments, défenses, camarades) compte telle qu'elle est au règlement : au premier passage après la
// nuit, avant tout changement (chaque action passe d'abord par migrate)
const db = require('../../config/db');
const nights = require('../nights');
const anya = require('../anya');
const map = require('../worldMap');
const quests = require('../quests');
const { SITES } = require('./rules');
const { stockOf, levelsOf, zonesOf, craftsOf, placedOf, claimedOf, needRowsOf, settlersOf } = require('./reads');
const { migrate } = require('./migrate');
const { payWith } = require('./produce');
const { presenceOf, residentsOf, moodsOf } = require('./people');
const { placesOf } = require('./places');

// Un jour de grâce entre la présentation et la première nuit
const GRACE_MS = 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const msOf = t => new Date(t).getTime();
const iso = ms => new Date(ms).toISOString();

// L'île telle que la voient les nuits : island (pour nights.planOf), defense, levels, et les bâtiments gardés par un
// camarade content (ou heureux) à un instant (helpersAt)
async function islandOf(userId, conn) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const sites = Object.entries(levels).filter(([id, level]) => level > 0 && SITES[id] && zones.has(map.siteZone(id))).map(([id, level]) => ({ id, level }));
    const acts = quests.actsDoneOf(quests.doneOf(await claimedOf(userId, conn))).length;
    const decor = placedOf(await craftsOf(userId, conn));
    const presence = await presenceOf(userId, conn);
    const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
    const filled = await needRowsOf(userId, conn);
    const { places } = await placesOf(userId, conn);
    const helpersAt = at => new Set(Object.values(moodsOf(residents, levels, zones, decor, filled, presence, at, places))
        .filter(m => m.built && m.mood !== 'triste').map(m => m.site));
    return { island: { owned: zones, sites, acts, places }, defense: nights.defenseOf(decor, levels, places), levels, helpersAt };
}

// Anya révélée : le cœur de l'île libéré, et la Révélation vue (sa ligne world_friends)
async function revealedOf(userId, conn) {
    if (!anya.awakeOf(await zonesOf(userId, conn))) return false;
    const { rows } = await conn.query('SELECT 1 FROM world_friends WHERE user_id = $1 AND villager = $2', [userId, anya.TARGET]);
    return rows.length > 0;
}
// Les instants où Anya est passée dans ]from, to], dans l'ordre (15 jours au plus)
function passagesOf(userId, from, to) {
    const out = [];
    const last = nights.dayOf(to);
    for (let day = nights.dayOf(Math.max(from, to - 15 * DAY_MS)); day <= last; day = nights.nextDay(day)) {
        const slot = anya.slotOn(userId, day);
        const at = slot && nights.parisAt(day, nights.ANYA_HOURS[slot]);
        if (at && at > from && at <= to) out.push(at);
    }
    return out;
}

// Règle les nuits finies depuis le dernier passage, dans la transaction de migrate (stock : la ligne world_stock,
// verrouillée). Les pannes et les passages d'Anya s'appliquent dans l'ordre du temps ; les fenêtres déjà comptées à la
// récolte s'effacent
async function settleNights(userId, conn, stock, now = Date.now()) {
    const { rows: [row] } = await conn.query('SELECT started_at, seen_until, blights, repelled FROM world_nights WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!row) return;
    const first = msOf(row.started_at) + GRACE_MS;
    const seen = msOf(row.seen_until);
    const due = nights.endedBetween(Math.max(seen, first), now).filter(night => nights.boundsOf(night).start >= first);
    const blights = row.blights.map(b => ({ ...b }));
    const collected = stock.collected_at ? msOf(stock.collected_at) : 0;
    const spent = b => b.until && msOf(b.until) <= collected;
    if (!due.length && !blights.some(b => !b.until || spent(b))) return;
    const events = [];
    if (due.length) {
        const { island, defense, helpersAt } = await islandOf(userId, conn);
        for (const night of due) {
            const repelled = new Set(row.repelled.night === night ? row.repelled.ids : []);
            const { panne } = nights.outcomeOf(nights.planOf(userId, night, island), defense, helpersAt(nights.boundsOf(night).end), repelled);
            if (panne) events.push(panne);
        }
    }
    if (await revealedOf(userId, conn)) passagesOf(userId, seen, now).forEach(at => events.push({ at, anya: true }));
    for (const event of events.sort((a, b) => a.at - b.at)) {
        const blighted = blights.find(b => !b.until);
        if (event.anya) {
            if (blighted) Object.assign(blighted, { until: iso(event.at), by: 'anya' });
        } else if (!blighted) {
            blights.push({ site: event.site, since: iso(event.at), until: null });
        }
    }
    const kept = blights.filter(b => !spent(b));
    // (gardés un jour après leur nuit : le bilan de Brume au matin les compte)
    const repelled = row.repelled.night && nights.boundsOf(row.repelled.night).end + DAY_MS > now ? row.repelled : {};
    await conn.query('UPDATE world_nights SET seen_until = $2, blights = $3, repelled = $4 WHERE user_id = $1',
        [userId, iso(Math.max(seen, now)), JSON.stringify(kept), JSON.stringify(repelled)]);
}

// Brume présente les nuits (une fois ; la première vient un jour après) : { startedAt }
async function startNights(userId) {
    await db.query('INSERT INTO world_nights (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const { rows: [row] } = await db.query('SELECT started_at FROM world_nights WHERE user_id = $1', [userId]);
    return { startedAt: row.started_at };
}

// Repousser un égaré d'un toucher : la nuit, sur son chemin (sorti de la brume, pas encore arrêté ni arrivé), une fois.
// { id, night } ou { status, message }
async function repelCreature(userId, id, now = Date.now()) {
    await migrate(userId);
    return db.transaction(async conn => {
        const { rows: [row] } = await conn.query('SELECT started_at, repelled FROM world_nights WHERE user_id = $1 FOR UPDATE', [userId]);
        const night = nights.nightAt(now);
        if (!night) return db.rollback({ status: 409, message: 'Il fait jour : aucun égaré dehors.' });
        if (!row || nights.boundsOf(night).start < msOf(row.started_at) + GRACE_MS) return db.rollback({ status: 409, message: 'Aucun égaré cette nuit.' });
        const { island, defense } = await islandOf(userId, conn);
        const creature = nights.planOf(userId, night, island).find(c => c.id === id);
        if (!creature) return db.rollback({ status: 404, message: 'Égaré introuvable.' });
        const ids = row.repelled.night === night ? row.repelled.ids : [];
        if (ids.includes(id)) return db.rollback({ status: 409, message: 'Celui-là boude déjà dans la brume.' });
        const { step } = nights.fateOf(creature, defense);
        if (now < creature.at || now >= creature.at + step * nights.MS_PER_CELL) return db.rollback({ status: 409, message: 'Cet égaré n’est pas sur le chemin.' });
        await conn.query('UPDATE world_nights SET repelled = $2 WHERE user_id = $1', [userId, JSON.stringify({ night, ids: [...ids, id] })]);
        return { id, night };
    });
}

// Réparer le bâtiment embrumé, depuis sa fiche : un peu de pierre ou de bois (nights.repairOf), pris au stock.
// { site, cost } ou { status, message }
const NAMES = { stone: 'pierres', wood: 'bois' };
async function repairSite(userId, site, now = Date.now()) {
    if (!Object.hasOwn(SITES, site)) return { status: 404, message: 'Bâtiment inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { rows: [row] } = await conn.query('SELECT blights FROM world_nights WHERE user_id = $1 FOR UPDATE', [userId]);
        const blights = row ? row.blights : [];
        const blight = blights.find(b => b.site === site && !b.until);
        if (!blight) return db.rollback({ status: 409, message: 'Ce bâtiment n’est pas embrumé.' });
        const { levels } = await levelsOf(userId, conn);
        const cost = nights.repairOf(site, levels[site] || 1);
        // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour payer
        const { stock: paid, balance } = await payWith(userId, conn, stock);
        if (paid[cost.resource] < cost.amount) return db.rollback({ status: 400, message: `Il te faut ${cost.amount} ${NAMES[cost.resource]} pour réparer.` });
        await conn.query(`UPDATE world_stock SET ${cost.resource} = ${cost.resource} - $2 WHERE user_id = $1`, [userId, cost.amount]);
        Object.assign(blight, { until: iso(now), by: 'reparation' });
        await conn.query('UPDATE world_nights SET blights = $2 WHERE user_id = $1', [userId, JSON.stringify(blights)]);
        return { site, cost, ...(balance !== undefined ? { coins: balance } : {}) };
    });
}

// Ce que le front montre : { started: false }, ou { started, first (instant de la première nuit possible), now,
// night: { id, start, end } (la nuit en cours ou la prochaine), creatures: [{ id, site, path, at, arrives, end, step }]
// (leur sort avec l'île d'à présent), panne (le bâtiment que la nuit embrumerait, ou null), blight: { site, since,
// repair: { resource, amount } } | null, last : le bilan de la dernière nuit finie (lastOf) }
// Le bilan de la dernière nuit finie (Brume le dit au matin) : { id, counts: { luciole, barre, camarade, touche,
// arrive }, panne (le bâtiment qu'elle a embrumé, ou null) }, ou null avant la première nuit
function lastOf(userId, row, first, { island, defense, helpersAt }, now) {
    const night = nights.endedBetween(now - 2 * DAY_MS, now).pop();
    if (!night) return null;
    const { start, end } = nights.boundsOf(night);
    if (start < first) return null;
    const repelled = new Set(row.repelled.night === night ? row.repelled.ids : []);
    const { fates } = nights.outcomeOf(nights.planOf(userId, night, island), defense, helpersAt(end), repelled);
    const counts = { luciole: 0, barre: 0, camarade: 0, touche: 0, arrive: 0 };
    for (const fate of Object.values(fates)) counts[fate.end] += 1;
    const blight = row.blights.find(b => msOf(b.since) >= start && msOf(b.since) <= end);
    return { id: night, counts, panne: blight ? blight.site : null };
}

async function nightsView(userId, conn = db, now = Date.now()) {
    const { rows: [row] } = await conn.query('SELECT started_at, blights, repelled FROM world_nights WHERE user_id = $1', [userId]);
    if (!row) return { started: false };
    const first = msOf(row.started_at) + GRACE_MS;
    const night = nights.nightNear(now);
    const { start, end } = nights.boundsOf(night);
    const seen = await islandOf(userId, conn);
    const { island, defense, levels, helpersAt } = seen;
    const active = row.blights.find(b => !b.until);
    const blight = active ? { site: active.site, since: msOf(active.since), repair: nights.repairOf(active.site, levels[active.site] || 1) } : null;
    const last = lastOf(userId, row, first, seen, now);
    if (start < first) return { started: true, first, now, night: { id: night, start, end }, creatures: [], panne: null, blight, last };
    const plan = nights.planOf(userId, night, island);
    const repelled = new Set(row.repelled.night === night ? row.repelled.ids : []);
    const { fates, panne } = nights.outcomeOf(plan, defense, helpersAt(end), repelled);
    return {
        started: true, first, now, night: { id: night, start, end },
        creatures: plan.map(c => ({ ...c, ...fates[c.id] })), panne: blight ? null : panne, blight, last
    };
}

module.exports = { GRACE_MS, settleNights, startNights, repelCreature, repairSite, nightsView };
