// Les bêtes de ferme (HISTOIRE.md du dépôt front, § 6.16, v6 ; réglage « petit plus » choisi par l'auteur le 6 octobre
// 2026) : règles pures, sans base. On nourrit une bête depuis sa fiche (2 vivres) ; nourrie, elle est contente un jour
// et remplit sa bulle de nourriture, que l'on ramasse. La bulle garde un jour au plus. Les poules sont celles de
// Cannelle (bible, § 6.16 et étape 8 : sauvées dans leur cage, elles vivent au camp, près du feu) : là dès la cage
// ouverte, sans attendre le Potager ; Madame ne pond pas (« Elle juge. »). Les autres bêtes sont celles que le Potager
// montre selon son palier (world/village.js du front) ; les variantes du Bestiaire restent des décors.
const HOUR_MS = 3600 * 1000;
const CONTENT_HOURS = 24;
const DAY_MS = CONTENT_HOURS * HOUR_MS;
const FEED_COST = { food: 2 };
// L'espèce est celle du front ; level : le palier du Potager où elle arrive (les poules de Cannelle, camp : à la cage
// ouverte) ; daily : vivres donnés par jour, contente (identifiants des poules gardés : rien ne se perd)
const BEASTS = [
    { id: 'poule-rousse', species: 'hen', name: 'Paprika', camp: true, daily: 4 },
    { id: 'poule-blanche', species: 'hen', name: 'Brioche', camp: true, daily: 4 },
    { id: 'poule-noire', species: 'hen', name: 'Madame', camp: true, daily: 0 },
    { id: 'vache', species: 'cow', name: 'La vache', level: 3, daily: 8 },
    { id: 'mouton', species: 'sheep', name: 'Le mouton', level: 4, daily: 4 },
    { id: 'brebis', species: 'sheep', name: 'La brebis', level: 4, daily: 4 },
    { id: 'cochon', species: 'pig', name: 'Le cochon', level: 5, daily: 6 },
    { id: 'chevre', species: 'goat', name: 'La chèvre', level: 6, daily: 6 }
];
const BEAST_BY_ID = Object.fromEntries(BEASTS.map(b => [b.id, b]));
// Les poules de Cannelle
const HENS = BEASTS.filter(b => b.camp).map(b => b.id);
// Les bêtes de l'île : les poules si la cage est ouverte (freed), puis celles du Potager à son palier
const beastsOf = (level, freed = false) => BEASTS.filter(b => (b.camp ? freed : level >= b.level));
const ms = t => new Date(t).getTime();

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

module.exports = { CONTENT_HOURS, DAY_MS, FEED_COST, BEASTS, BEAST_BY_ID, HENS, beastsOf, readyOf, stateOf, feedOf };
