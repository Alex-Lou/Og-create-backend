// Butins : le coffre, seule mécanique de récompense de l'île. Chaque source (Récolte, coffre du jour, quête de Brume,
// chapitre du Livre, bouteille à la mer) donne un coffre d'une rareté ; son contenu (un seul lot) est tiré ici, et
// world.js l'applique. Fonctions pures : le hasard arrive en paramètre (rand() dans [0, 1)).
const shop = require('./worldShop');

const RARITIES = ['commun', 'rare', 'epique', 'legendaire'];
const RESOURCES = ['stone', 'wood', 'water', 'food'];
// Récolte : un coffre une fois sur trois (au moins minMoves coups joués) ; une chaîne d'au moins bigChain tuiles le
// rend sûr, et au moins rare
const HARVEST = { chance: 1 / 3, minMoves: 5, bigChain: 8, odds: { commun: 60, rare: 28, epique: 10, legendaire: 2 } };
// Bouteille à la mer : une par tranche de 6 heures (heure de Paris), à ouvrir sur la plage
const BOTTLE = { hours: 6, odds: { commun: 75, rare: 22, epique: 3 } };
// Pièce rare offerte par chaque chapitre du Livre (catalogue de la boutique : { chapitre: article }). Les autres pièces
// rares viennent des coffres légendaires.
const RARES = shop.ITEMS.filter(item => item.rare);
const CHAPTER_RARES = Object.fromEntries(RARES.filter(item => item.chapter).map(item => [item.chapter, item.id]));
// Écus quand il n'y a plus de teinte ou de pièce rare à gagner
const EPIC_COINS = [200, 300];
const LEGEND_COINS = 600;

const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Rareté tirée selon des poids { rareté: poids }
function rarityOf(odds, rand) {
    const total = Object.values(odds).reduce((sum, n) => sum + n, 0);
    let roll = rand() * total;
    for (const rarity of RARITIES) {
        roll -= odds[rarity] || 0;
        if (roll < 0) return rarity;
    }
    return RARITIES.find(r => odds[r]);
}
const atLeast = (rarity, floor) => RARITIES[Math.max(RARITIES.indexOf(rarity), RARITIES.indexOf(floor))];

// Coffre de fin de Récolte : rareté, ou null s'il n'en tombe pas. best : la plus longue chaîne jouée
function harvestChest(moveCount, best, rand) {
    if (moveCount < HARVEST.minMoves) return null;
    const big = best >= HARVEST.bigChain;
    if (!big && rand() >= HARVEST.chance) return null;
    const rarity = rarityOf(HARVEST.odds, rand);
    return big ? atLeast(rarity, 'rare') : rarity;
}

// Coffre du jour selon la série (1 le premier jour) : commun les jours 1 et 2 de chaque semaine, rare du 3 au 6,
// épique le 7e, légendaire tous les 28 jours
function dailyRarity(streak) {
    if (streak % 28 === 0) return 'legendaire';
    if (streak % 7 === 0) return 'epique';
    return streak % 7 >= 3 ? 'rare' : 'commun';
}

// Pièce rare à gagner : celle demandée si elle manque, sinon une pièce des coffres (hors chapitres) d'un bâtiment
// construit, puis de n'importe quel bâtiment, puis n'importe quelle pièce manquante ; null si toutes sont là
const CHAPTER_IDS = new Set(Object.values(CHAPTER_RARES));
function rareFor({ levels, owned }, rand, wanted = null) {
    const missing = RARES.filter(item => !owned.has(item.id));
    if (wanted && missing.some(item => item.id === wanted)) return shop.ITEM_BY_ID[wanted];
    const loose = missing.filter(item => !CHAPTER_IDS.has(item.id));
    const pool = [loose.filter(item => levels[item.site]), loose, missing].find(list => list.length);
    return pool ? pick(rand, pool) : null;
}

// Teinte à gagner : pas encore possédée, pour un bâtiment construit au palier qu'elle demande ; null sinon
function tintFor({ levels, owned }, rand) {
    const pool = shop.ITEMS.filter(item => item.tint && !owned.has(item.id) && (levels[item.site] || 0) >= item.minLevel);
    return pool.length ? pick(rand, pool) : null;
}

const itemPrize = (kind, item) => ({ kind, item: item.id, site: item.site, name: item.name });

// Le lot d'un coffre : { kind: 'coins', amount } | { kind: 'stock', stock: { ressource: n } } |
// { kind: 'tint' | 'rare', item, site, name }. state = { levels, owned: Set des articles } ; wanted : pièce rare promise
function prizeOf(rarity, state, rand, wanted = null) {
    if (rarity === 'legendaire') {
        const rare = rareFor(state, rand, wanted);
        return rare ? itemPrize('rare', rare) : { kind: 'coins', amount: LEGEND_COINS };
    }
    if (rarity === 'epique') {
        const tint = rand() < 0.7 ? tintFor(state, rand) : null;
        return tint ? itemPrize('tint', tint) : { kind: 'coins', amount: between(rand, ...EPIC_COINS) };
    }
    if (rarity === 'rare') {
        if (rand() < 0.5) return { kind: 'coins', amount: between(rand, 50, 90) };
        const first = pick(rand, RESOURCES);
        const second = pick(rand, RESOURCES.filter(r => r !== first));
        return { kind: 'stock', stock: { [first]: between(rand, 25, 40), [second]: between(rand, 25, 40) } };
    }
    if (rand() < 0.5) return { kind: 'coins', amount: between(rand, 15, 30) };
    return { kind: 'stock', stock: { [pick(rand, RESOURCES)]: between(rand, 15, 30) } };
}

// Jour et tranche de la bouteille à l'heure de Paris : { day: 'AAAA-MM-JJ', slot: 0..3 }
const PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
function parisOf(now) {
    const parts = Object.fromEntries(PARIS.formatToParts(new Date(now)).map(p => [p.type, p.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, slot: Math.floor(Number(parts.hour) / BOTTLE.hours) };
}
// La veille d'un jour 'AAAA-MM-JJ'
function dayBefore(day) {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

module.exports = {
    RARITIES, HARVEST, BOTTLE, CHAPTER_RARES, LEGEND_COINS,
    rarityOf, harvestChest, dailyRarity, rareFor, tintFor, prizeOf, parisOf, dayBefore
};
