// Les terres nouvelles : expéditions, lieux remarquables, gisements des trouvailles. Extrait de services/world.js (lot
// santé), sans changement.
const crypto = require('crypto');
const db = require('../../config/db');
const map = require('../worldMap');
const crafts = require('../crafts');
const landmarks = require('../landmarks');
const finds = require('../finds');
const pickups = require('../pickups');
const anya = require('../anya');
const { EXPEDITION_COST, chargesAt, effectsOf } = require('./rules');
const { levelsOf, stockOf, zonesOf, depositsOf, foundOf, discoveredOf, craftsOf, placedOf } = require('./reads');
const { migrate } = require('./migrate');
const { presenceOf } = require('./people');
const { bonusesFor, gather, payWith } = require('./produce');

const isKnown = (zone, discovered) => !zone.trip || discovered.has(zone.id);
// Ce qu'emporte une expédition vers ce quartier : { food, wood }
const expeditionCost = zone => Object.fromEntries(Object.entries(EXPEDITION_COST).map(([r, n]) => [r, n * zone.trip]));
// Expédition en route (pas encore revenue), ou null : { zone, ends_at }
async function expeditionOf(userId, conn = db, now = Date.now()) {
    const { rows } = await conn.query('SELECT zone, ends_at FROM world_expeditions WHERE user_id = $1 AND ends_at > $2', [userId, new Date(now)]);
    return rows[0] || null;
}

// Les quartiers du cœur de l'île (map.CORE) pas encore à soi, par leurs noms : les terres alentour restent fermées tant
// qu'il en manque
const coreMissing = zones => map.CORE.filter(id => !zones.has(id)).map(id => map.ZONE_BY_ID[id].name);

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
        const missing = coreMissing(zones);
        if (missing.length) return db.rollback({ status: 403, message: `Les terres alentour s’ouvrent quand le cœur de l’île est à toi. Il te manque : ${missing.join(', ')}.` });
        if (!map.NEIGHBORS[zone.id].some(id => zones.has(id))) return db.rollback({ status: 403, message: 'Une expédition part d’un quartier à toi, vers un quartier voisin.' });
        const cost = expeditionCost(zone);
        // Ce qui attend dans les bâtiments est encaissé d'abord : cela compte pour les provisions
        const { stock: paid, balance } = await payWith(userId, conn, stock);
        if (Object.entries(cost).some(([r, n]) => paid[r] < n)) return db.rollback({ status: 400, message: `Il faut emporter ${cost.food} vivres et ${cost.wood} bûches : joue une Récolte.` });
        const { levels } = await levelsOf(userId, conn);
        const { bonuses, extra } = await bonusesFor(userId, conn);
        const effects = effectsOf(levels, bonuses, extra);
        const charges = chargesAt(stock, effects.maxCharges, now, effects.regenMs);
        if (charges.count < 1) return db.rollback({ status: 409, message: 'Il faut une partie de Récolte en réserve : la prochaine revient bientôt.' });
        await conn.query('UPDATE world_stock SET charges = $2, charges_at = $3, food = food - $4, wood = wood - $5 WHERE user_id = $1',
            [userId, charges.count - 1, new Date(charges.since), cost.food, cost.wood]);
        const endsAt = new Date(now + zone.trip * 3600 * 1000);
        // Heure prise après le verrou de la réserve, comme le départ d'une partie de Récolte (undoItem)
        await conn.query('INSERT INTO world_expeditions (user_id, zone, ends_at, started_at) VALUES ($1, $2, $3, clock_timestamp())', [userId, zone.id, endsAt]);
        return { zone: zone.id, endsAt: endsAt.toISOString(), ...(balance !== undefined ? { coins: balance } : {}) };
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
        const { blessed } = await presenceOf(userId, conn, now);
        const wait = finds.readyIn((await depositsOf(userId, conn)).get(deposit.id), now, blessed ? anya.BLESSING.regrowMs : finds.REGROW_MS);
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

// Ramasse ce que la mer a rendu sur la plage de Brumelune (bible, § 9, étape 4), s'il a repoussé : un peu de bois, de nourriture
// ou de pierre, versé une seule fois (la ligne de stock est verrouillée), gardé comme un gisement (world_deposits).
// { kind, gives } ou { status, message }
async function pickUp(userId, spotId, now = Date.now()) {
    const spot = Object.hasOwn(pickups.SPOT_BY_ID, spotId) ? pickups.SPOT_BY_ID[spotId] : null;
    if (!spot) return { status: 404, message: 'Il n’y a rien à ramasser ici.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(map.zoneAt(spot.x, spot.y))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        // (une annexe ou une création posée sur sa case la cache : rien à ramasser)
        const { rows: covered } = await conn.query(
            `SELECT 1 FROM world_annexes WHERE user_id = $1 AND x = $2 AND y = $3
             UNION ALL SELECT 1 FROM world_crafts WHERE user_id = $1 AND x = $2 AND y = $3 LIMIT 1`, [userId, spot.x, spot.y]);
        if (covered.length) return db.rollback({ status: 404, message: 'Il n’y a rien à ramasser ici.' });
        const wait = finds.readyIn((await depositsOf(userId, conn)).get(spot.id), now, pickups.REGROW_MS);
        if (wait > 0) return db.rollback({ status: 409, message: `La mer en rapportera d’autres : reviens dans ${Math.ceil(wait / 60000)} min.` });
        const { gives } = pickups.KINDS[spot.kind];
        await conn.query('UPDATE world_stock SET stone = stone + $2, wood = wood + $3, water = water + $4, food = food + $5 WHERE user_id = $1',
            [userId, gives.stone || 0, gives.wood || 0, gives.water || 0, gives.food || 0]);
        await conn.query(
            `INSERT INTO world_deposits (user_id, deposit, gathered_at) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, deposit) DO UPDATE SET gathered_at = EXCLUDED.gathered_at`, [userId, spot.id, new Date(now)]);
        return { kind: spot.kind, gives };
    });
}

module.exports = { isKnown, coreMissing, expeditionCost, expeditionOf, startExpedition, findLandmark, craftBonusOf, gatherDeposit, pickUp };
