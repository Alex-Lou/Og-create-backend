// Les bêtes de ferme (HISTOIRE.md du dépôt front, § 6.16, v6 ; réglage « petit plus » choisi par l'auteur le 6 octobre
// 2026) : règles pures, sans base. On nourrit une bête depuis sa fiche (2 vivres) ; nourrie, elle est contente un jour
// et remplit sa bulle de nourriture, que l'on ramasse. La bulle garde un jour au plus. Les poules sont celles de
// Marcelle (bible, § 6.16 et étape 8 : sauvées dans leur cage, elles vivent au camp, près du feu) : là dès la cage
// ouverte, sans attendre le Potager ; Réglisse ne pond pas (« Elle juge. »). Les autres bêtes sont celles que le Potager
// montre selon son palier (world/village.js du front) ; les variantes du Bestiaire restent des décors.
// Le coq et la couvée (choix de l'auteur, 14 oct.) : Coquelicot échoue au camp quand le Foyer passe à l'Abri (la cage
// ouverte) ; avec lui, une poulette éclot tous les HATCH_DAYS jours, trois au plus. Poussin GROW_DAYS jours (elle suit
// les poules, on ne la nourrit pas), puis poule : elle pond, moins que ses aînées. Le coq ne pond pas : il veille (la
// nuit, son chant chasse un égaré : services/nights.js).
const HOUR_MS = 3600 * 1000;
const CONTENT_HOURS = 24;
const DAY_MS = CONTENT_HOURS * HOUR_MS;
const FEED_COST = { food: 2 };
// L'espèce est celle du front ; level : le palier du Potager où elle arrive (les poules de Marcelle, camp : à la cage
// ouverte) ; daily : vivres donnés par jour, contente (identifiants des poules gardés : rien ne se perd)
const BEASTS = [
    { id: 'poule-rousse', species: 'hen', name: 'Caramel', camp: true, daily: 4 },
    { id: 'poule-blanche', species: 'hen', name: 'Flocon', camp: true, daily: 4 },
    { id: 'poule-noire', species: 'hen', name: 'Réglisse', camp: true, daily: 0 },
    { id: 'coq', species: 'rooster', name: 'Coquelicot', camp: true, daily: 0, rooster: true },
    { id: 'poulette-muscade', species: 'hen', name: 'Pépite', camp: true, daily: 2, brood: 1 },
    { id: 'poulette-praline', species: 'hen', name: 'Mimosa', camp: true, daily: 2, brood: 2 },
    { id: 'poulette-noisette', species: 'hen', name: 'Coquille', camp: true, daily: 2, brood: 3 },
    { id: 'vache', species: 'cow', name: 'La vache', level: 3, daily: 8 },
    { id: 'mouton', species: 'sheep', name: 'Le mouton', level: 4, daily: 4 },
    { id: 'brebis', species: 'sheep', name: 'La brebis', level: 4, daily: 4 },
    { id: 'cochon', species: 'pig', name: 'Le cochon', level: 5, daily: 6 },
    { id: 'chevre', species: 'goat', name: 'La chèvre', level: 6, daily: 6 }
];
const BEAST_BY_ID = Object.fromEntries(BEASTS.map(b => [b.id, b]));
// Les poules de Marcelle, sorties de la cage
const HENS = BEASTS.filter(b => b.camp && !b.rooster && !b.brood).map(b => b.id);
// Le coq arrive quand le Foyer atteint ce palier (l'Abri) ; une poulette éclot tous les HATCH_DAYS jours, et reste
// poussin GROW_DAYS jours
const COOP_LEVEL = 2;
const HATCH_DAYS = 2;
const GROW_DAYS = 3;
const ms = t => new Date(t).getTime();
// L'instant où une poulette éclot (coqSince : l'arrivée du coq), ou null (pas de coq)
const hatchedAt = (beast, coqSince) => (coqSince === null || coqSince === undefined ? null : ms(coqSince) + beast.brood * HATCH_DAYS * DAY_MS);
// Encore poussin à l'instant now ?
const isChick = (beast, coqSince, now) => Boolean(beast.brood) && now < hatchedAt(beast, coqSince) + GROW_DAYS * DAY_MS;
// Les bêtes de l'île : les poules si la cage est ouverte (freed), le coq et les poulettes écloses s'il est là (coqSince :
// son arrivée, ou null), puis celles du Potager à son palier
function beastsOf(level, freed = false, coqSince = null, now = Date.now()) {
    return BEASTS.filter(b => {
        if (!b.camp) return level >= b.level;
        if (!freed) return false;
        if (b.rooster) return coqSince !== null && coqSince !== undefined;
        if (b.brood) return hatchedAt(b, coqSince) !== null && now >= hatchedAt(b, coqSince);
        return true;
    });
}

// Ce que contient la bulle d'une bête (row : { fed_at, collected_at }) : { amount, collectedAt }. Elle se remplit tant
// que la bête est contente, une unité à la fois ; collectedAt : jusqu'où c'est compté (la part d'une unité en cours
// reste due). Pleine (un jour), elle ne se remplit plus
function readyOf(beast, row, now) {
    if (!beast.daily) return { amount: 0, collectedAt: ms(row.collected_at) };
    const per = DAY_MS / beast.daily;
    const from = ms(row.collected_at);
    const to = Math.min(now, ms(row.fed_at) + DAY_MS);
    const count = Math.max(0, Math.floor((to - from) / per));
    if (count >= beast.daily) return { amount: beast.daily, collectedAt: Math.max(from, to) };
    return { amount: count, collectedAt: from + count * per };
}
// L'état d'une bête à l'instant now (row absent : jamais nourrie) : { fed (contente), left (ms de contentement),
// refill (on peut la nourrir : la moitié du jour écoulée, comme les besoins des camarades), ready (vivres dans sa bulle) }
function stateOf(beast, row, now) {
    if (!row) return { fed: false, left: 0, refill: true, ready: 0 };
    const left = Math.max(0, ms(row.fed_at) + DAY_MS - now);
    return { fed: left > 0, left, refill: left <= DAY_MS / 2, ready: readyOf(beast, row, now).amount };
}
// Nourrir : la bulle est d'abord ramassée ; si la bête était encore contente, ce qui restait d'une unité en cours compte
// encore (sinon, elle repart de maintenant). { amount (ramassé), row: { fed_at, collected_at } }
function feedOf(beast, row, now) {
    if (!row) return { amount: 0, row: { fed_at: now, collected_at: now } };
    const { amount, collectedAt } = readyOf(beast, row, now);
    const content = ms(row.fed_at) + DAY_MS > now;
    return { amount, row: { fed_at: now, collected_at: content ? collectedAt : now } };
}

module.exports = {
    CONTENT_HOURS, DAY_MS, FEED_COST, BEASTS, BEAST_BY_ID, HENS, COOP_LEVEL, HATCH_DAYS, GROW_DAYS,
    beastsOf, hatchedAt, isChick, readyOf, stateOf, feedOf
};
