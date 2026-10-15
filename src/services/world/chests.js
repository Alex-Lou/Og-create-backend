// Les coffres : du jour, bouteilles, chapitres, quêtes, lieux ; ce que la vue en montre, leur ouverture. Extrait de
// services/world.js (lot santé), sans changement.
const db = require('../../config/db');
const ledger = require('../ledger');
const quests = require('../quests');
const loot = require('../loot');
const landmarks = require('../landmarks');
const { random, RESOURCES, WATER_KEY, withWater } = require('./rules');
const { itemsOf, levelsOf, stockOf, foundOf, claimedOf, helianeOfUser, addStock, balanceOf, writtenOf, LOCK_PREFIX } = require('./reads');
const { migrate } = require('./migrate');
const T = require('../../texts/chests');
const { OPEN_CHAPTER_FIRST } = require('../../texts/world');

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

// La mer ne rend rien pendant le tutoriel (choix de l'auteur, 12 oct.) : la première bouteille s'échoue une fois le
// chemin du Puits tracé et réclamé, la dernière étape du tutoriel ; Hermine la présente sur l'île. Ensuite, une par tranche
const ASHORE_AFTER = 'chemin';
const ashoreOf = claimed => quests.doneOf(claimed).has(ASHORE_AFTER);

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
                .map(([c]) => ({ source: `chapitre:${c}`, rarity: 'legendaire', label: T.LABELS.chapter(c) })),
            ...QUEST_CHESTS.filter(q => claimed.has(q.id) && !opened.has(`quete:${q.id}`))
                .map(q => ({ source: `quete:${q.id}`, rarity: q.chest, label: T.LABELS.quest(q.label) })),
            ...landmarks.LANDMARKS.filter(l => found.has(l.id) && !opened.has(`lieu:${l.id}`))
                .map(l => ({ source: `lieu:${l.id}`, rarity: l.chest, label: T.LABELS.landmark(l.name) }))
        ],
        daily: {
            available: !today, streak, rarity: loot.dailyRarity(streak), tomorrow: loot.dailyRarity(streak + 1),
            week: Array.from({ length: 7 }, (_, i) => loot.dailyRarity(first + i))
        },
        bottle: { key: `${day}-${slot}`, available: ashoreOf(claimed) && !opened.has(`bouteille:${day}-${slot}`) }
    };
}

// Donne un coffre, une seule fois par source (même en double clic) : tire son lot selon l'île, l'applique (écus au
// grand livre, ressources au stock, teinte ou pièce rare à la collection) et l'inscrit. Dans la transaction de
// l'appelant, ligne de stock verrouillée. { source, rarity, prize }, ou null si ce coffre est déjà ouvert
async function grant(userId, source, rarity, conn, { wanted = null, streak = null } = {}) {
    const resources = withWater(RESOURCES, await writtenOf(userId, WATER_KEY, conn));
    const prize = loot.prizeOf(rarity, { levels: (await levelsOf(userId, conn)).levels, owned: await itemsOf(userId, conn), resources }, random, wanted);
    const added = await conn.query(
        `INSERT INTO world_chests (user_id, source, rarity, prize, streak) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING source`, [userId, source, rarity, JSON.stringify(prize), streak]);
    if (!added.rows.length) return null;
    if (prize.kind === 'coins') await ledger.credit(userId, prize.amount, 'butin', source, conn);
    if (prize.kind === 'stock') await addStock(userId, prize.stock, conn);
    if (prize.item) await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'butin') ON CONFLICT DO NOTHING`, [userId, prize.item]);
    return { source, rarity, prize };
}

// La caisse d'un personnage, échouée près du camp (choix de l'auteur, 11 oct.) : elle s'ouvre une fois, le jour de son
// arrivée (after : la quête faite avant), et donne toujours la même chose : des ressources, et ce qu'elle garde (keepsakes,
// ce que le coffre montre). Celle d'Hermine : sa longue-vue, son filet, son carnet de quart (le plan de son Ponton)
// crafts : des créations prêtes, mises en réserve (les piquets de l'enclos du camp : la quête des clôtures)
const CRATES = {
    aster: {
        after: 'nuit',
        prize: { kind: 'stock', stock: { wood: 5 }, keepsakes: T.HERMINE_KEEPSAKES(quests.ENCLOS, quests.ENCLOS_DOORS) },
        crafts: { cloture: quests.ENCLOS, porte: quests.ENCLOS_DOORS },
        // (ses portes ont leur verrou : une ligne de world_items « verrou:<id> », comme une porte verrouillée à l'établi)
        locked: new Set(['porte'])
    }
};
async function openCrate(userId, id) {
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (!quests.doneOf(await claimedOf(userId, conn)).has(CRATES[id].after)) return db.rollback({ status: 403, message: T.CRATE_NOT_YET });
        const { prize } = CRATES[id];
        const added = await conn.query(
            `INSERT INTO world_chests (user_id, source, rarity, prize) VALUES ($1, $2, 'commun', $3) ON CONFLICT DO NOTHING RETURNING source`,
            [userId, `caisse:${id}`, JSON.stringify(prize)]);
        if (!added.rows.length) return db.rollback({ status: 409, message: T.CRATE_OPEN });
        await addStock(userId, prize.stock, conn);
        for (const [craft, n] of Object.entries(CRATES[id].crafts || {})) {
            for (let i = 0; i < n; i++) {
                const { rows: [row] } = await conn.query('INSERT INTO world_crafts (user_id, craft) VALUES ($1, $2) RETURNING id', [userId, craft]);
                if (CRATES[id].locked && CRATES[id].locked.has(craft)) {
                    await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'verrou')`, [userId, `${LOCK_PREFIX}${row.id}`]);
                }
            }
        }
        return { chest: { source: `caisse:${id}`, rarity: 'commun', prize }, coins: await balanceOf(userId, conn) };
    });
}

// Ouvre un coffre qui attend : 'jour' (série), 'bouteille' (tranche de 6 h), 'chapitre:<id>' (chapitre ouvert, sa
// pièce rare), 'quete:<id>' (quête réclamée qui en donne un), 'lieu:<id>' (lieu remarquable découvert), 'caisse:<id>'
// (la caisse d'un personnage : CRATES).
// openChapters : Set des chapitres ouverts. { chest, coins } ou { status, message } si refus
async function openChest(userId, source, openChapters, now = Date.now()) {
    const [kind, id] = source.split(':');
    if (kind === 'caisse') {
        if (!Object.hasOwn(CRATES, id)) return { status: 404, message: T.CHEST_UNKNOWN };
        await migrate(userId);
        return openCrate(userId, id);
    }
    const chapter = kind === 'chapitre' ? loot.CHAPTER_RARES[id] : null;
    const quest = kind === 'quete' ? QUEST_CHESTS.find(q => q.id === id) : null;
    const place = kind === 'lieu' && Object.hasOwn(landmarks.LANDMARK_BY_ID, id) ? landmarks.LANDMARK_BY_ID[id] : null;
    if (!['jour', 'bouteille'].includes(source) && !chapter && !quest && !place) return { status: 404, message: T.CHEST_UNKNOWN };
    if (chapter && !openChapters.has(id)) return { status: 403, message: OPEN_CHAPTER_FIRST(id) };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { day, slot, opened } = await openedOf(userId, now, conn);
        if (quest && !(await claimedOf(userId, conn)).has(quest.id)) return db.rollback({ status: 403, message: T.CLAIM_QUEST_FIRST });
        if (place && !(await foundOf(userId, conn)).has(place.id)) return db.rollback({ status: 403, message: T.FIND_PLACE_FIRST });
        if (source === 'bouteille' && !ashoreOf(await claimedOf(userId, conn))) return db.rollback({ status: 403, message: T.SEA_EMPTY });
        const chest = await grantSource(userId, source, { day, slot, opened }, conn);
        if (!chest) return db.rollback({ status: 409, message: source === 'bouteille' ? T.BOTTLE_NOT_YET : T.CHEST_OPEN });
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
    if (source === 'bouteille') return bottleOf(userId, `bouteille:${day}-${slot}`, conn);
    const [kind, id] = source.split(':');
    if (kind === 'lieu') return grant(userId, source, landmarks.LANDMARK_BY_ID[id].chest, conn);
    const chapter = kind === 'chapitre' ? loot.CHAPTER_RARES[id] : null;
    return grant(userId, source, chapter ? 'legendaire' : QUEST_CHESTS.find(q => q.id === id).chest, conn, { wanted: chapter });
}

// Une bouteille à la mer : la première ouverte pendant un acte porte son mot d'histoire (story : l'acte)
async function bottleOf(userId, source, conn) {
    const { next } = await helianeOfUser(userId, conn);
    const chest = await grant(userId, source, loot.rarityOf(loot.BOTTLE.odds, random), conn);
    return chest && next ? { ...chest, story: next } : chest;
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
        if (!chests.length) return db.rollback({ status: 409, message: T.NO_CHEST });
        return { chests, coins: await balanceOf(userId, conn) };
    });
}

module.exports = { QUEST_CHESTS, CRATES, openedOf, streakOf, chestsView, grant, openChest, grantSource, bottleOf, openAll };
