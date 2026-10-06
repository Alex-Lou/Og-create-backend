// Les coffres : du jour, bouteilles, chapitres, quêtes, lieux ; ce que la vue en montre, leur ouverture. Extrait de
// services/world.js (lot santé), sans changement.
const db = require('../../config/db');
const ledger = require('../ledger');
const quests = require('../quests');
const loot = require('../loot');
const landmarks = require('../landmarks');
const { random } = require('./rules');
const { itemsOf, levelsOf, stockOf, foundOf, claimedOf, helianeOfUser, addStock, balanceOf } = require('./reads');
const { migrate } = require('./migrate');

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
        if (!chests.length) return db.rollback({ status: 409, message: 'Aucun coffre à ouvrir.' });
        return { chests, coins: await balanceOf(userId, conn) };
    });
}

module.exports = { QUEST_CHESTS, openedOf, streakOf, chestsView, grant, openChest, grantSource, bottleOf, openAll };
