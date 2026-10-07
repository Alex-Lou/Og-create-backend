// Règles pures de l'île : constantes, chantiers (SITES), effets, production, charges qui reviennent (rien en base).
// Extrait de services/world.js (lot santé), sans changement.
const crypto = require('crypto');
const harvest = require('../harvest');
const map = require('../worldMap');
const shop = require('../worldShop');
const annexes = require('../annexes');

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
// la précédente est le cœur (worldMapV4.js) ; 5 : la grande carte 144 × 144, la v4 à l'échelle × 1,5 (worldMap.js)
const MAP_VERSION = 5;
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

// Unités entières d'une quantité calculée (le 1e-9 absorbe les erreurs de calcul en virgule flottante)
const whole = v => Math.floor(v + 1e-9);
// Production d'un bâtiment et de ses annexes depuis leur pose ou la dernière récolte (plafonnée à CAP_HOURS, plus les
// heures des réserves) : { resource, amount, coins }, en unités entières (exactProductionOf : sans arrondi).
// bonus = { prod: part en plus, coins: écus par heure en plus (boutique de l'atelier), cap: heures en plus (réserve) } ;
// annexList = [{ rate, earn, at }] (annexes.bonusesOf) : ressources et écus par heure en plus, comptés depuis at,
// avec la même part de production en plus que le bâtiment.
// steps = [{ at (ms), prod }] dans l'ordre, quand la part en plus change en cours de route (humeur des habitants) :
// chacune vaut de son heure à la suivante (la première depuis le début) et remplace bonus.prod ; chaque heure produite
// compte avec la part de son moment (la réserve se remplit pendant les cap premières heures)
function productionOf(...args) {
    const made = exactProductionOf(...args);
    return made && { resource: made.resource, amount: whole(made.amount), coins: whole(made.coins) };
}
// Comme productionOf, sans arrondi (des fractions) : ce que gardent les ramassages (cashOf)
function exactProductionOf(siteId, level, builtAt, collectedAt, now = Date.now(), bonus = { prod: 0, coins: 0 }, annexList = [], steps = null) {
    const site = SITES[siteId];
    if (!site.produce || !level) return null;
    const cap = CAP_HOURS + (bonus.cap || 0);
    const collected = collectedAt ? new Date(collectedAt).getTime() : 0;
    const startOf = at => Math.max(collected, new Date(at).getTime());
    const hoursSince = at => Math.min(cap, Math.max(0, (now - startOf(at)) / 3600000));
    const hours = hoursSince(builtAt);
    if (steps) {
        const boosted = at => boostedHours(startOf(at), hoursSince(at), steps);
        const own = boosted(builtAt);
        let amount = own * PRODUCE_PER_LEVEL * level;
        let coins = own * COINS_PER_LEVEL * level;
        for (const a of annexList) {
            const h = boosted(a.at);
            amount += h * a.rate;
            coins += h * a.earn;
        }
        return { resource: site.produce, amount, coins: coins + hours * (bonus.coins || 0) };
    }
    let amount = hours * PRODUCE_PER_LEVEL * level;
    let coins = hours * COINS_PER_LEVEL * level;
    for (const a of annexList) {
        const h = hoursSince(a.at);
        amount += h * a.rate;
        coins += h * a.earn;
    }
    const boost = 1 + (bonus.prod || 0);
    return { resource: site.produce, amount: amount * boost, coins: coins * boost + hours * (bonus.coins || 0) };
}
// Heures de from à from + hours, chacune comptée avec la part en plus de son moment : Σ durée × (1 + part) (steps :
// comme productionOf)
function boostedHours(from, hours, steps) {
    const to = from + hours * 3600000;
    let sum = 0;
    steps.forEach((step, i) => {
        const a = i ? Math.max(from, step.at) : from;
        const b = i + 1 < steps.length ? Math.min(to, steps[i + 1].at) : to;
        if (b > a) sum += (b - a) / 3600000 * (1 + step.prod);
    });
    return sum;
}
// Temps (ms) avant que la réserve d'un bâtiment producteur soit pleine, depuis sa pose ou la dernière récolte (0 :
// pleine, la production attend le ramassage). capHours : CAP_HOURS et les heures des réserves
function fullInOf(builtAt, collectedAt, capHours, now = Date.now()) {
    const start = Math.max(collectedAt ? new Date(collectedAt).getTime() : 0, new Date(builtAt).getTime());
    return Math.max(0, start + capHours * 3600000 - now);
}
// Rendement par heure d'un bâtiment producteur et de ses annexes : { amount, coins }, arrondis au dixième
function perHourOf(level, prod = 0, coins = 0, annexList = []) {
    const boost = 1 + prod;
    const round = n => Math.round(n * 10) / 10;
    const rate = annexList.reduce((sum, a) => sum + a.rate, 0);
    const earn = annexList.reduce((sum, a) => sum + a.earn, 0);
    return { amount: round((PRODUCE_PER_LEVEL * level + rate) * boost), coins: round((COINS_PER_LEVEL * level + earn) * boost + coins) };
}
// Production de tous les bâtiments. steps = [{ at (ms), prod: { bâtiment: part } }] : la part en plus de chacun à
// chaque moment depuis la dernière récolte (people.prodSteps) ; un bâtiment dont la part n'a pas changé compte comme
// avant, avec bonuses.prod. Chacun : { site, resource, amount, coins, exact: { amount, coins } } (exact : sans arrondi)
function productionAll(levels, builtAt, collectedAt, now = Date.now(), bonuses = NO_BONUS, extra = NO_ANNEX, steps = null) {
    return Object.keys(SITES)
        .map(id => {
            const own = steps && steps.map(s => ({ at: s.at, prod: s.prod[id] || 0 }));
            const varies = own && own.some(s => s.prod !== own[0].prod);
            const exact = exactProductionOf(id, levels[id] || 0, builtAt[id], collectedAt, now,
                { prod: bonuses.prod[id] || 0, coins: bonuses.coins[id] || 0, cap: extra.cap[id] || 0 }, extra.site[id] || [], varies ? own : null);
            return exact && {
                site: id, resource: exact.resource, amount: whole(exact.amount), coins: whole(exact.coins),
                exact: { amount: exact.amount, coins: exact.coins }
            };
        })
        .filter(Boolean);
}

// Ce que vaut la production de tous les bâtiments (productionAll), avec ce qui restait du dernier ramassage (carry :
// { coins, stone, wood, water, food }, des fractions) : { coins, stock: { ressource: n }, carry }, en unités entières ;
// carry, ce qui reste à verser au ramassage suivant ; made : un bâtiment a produit quelque chose depuis le dernier
// ramassage. Rien ne se perd à l'arrondi
function cashOf(production, carry = {}) {
    const keys = ['coins', ...RESOURCES];
    const exact = Object.fromEntries(keys.map(k => [k, Number(carry && carry[k]) || 0]));
    for (const p of production) {
        exact.coins += p.exact.coins;
        exact[p.resource] += p.exact.amount;
    }
    const left = v => Math.max(0, Math.round((v - whole(v)) * 1e6) / 1e6);
    return {
        coins: whole(exact.coins),
        stock: Object.fromEntries(RESOURCES.map(r => [r, whole(exact[r])])),
        carry: Object.fromEntries(keys.map(k => [k, left(exact[k])])),
        made: production.some(p => p.exact.amount > 0 || p.exact.coins > 0)
    };
}

module.exports = {
    SIZE, CAP_HOURS, REGEN_MS, RUN_TTL_MS, RENAME_LEVEL, GAME_TTL_MS, GAME_SLACK_MS, CRAFT_TTL_MS, MOVES,
    FIRST_RUN_MOVES, FIRST_RUN_KINDS, RESOURCES, MAP_VERSION, EXPEDITION_COST, OLD_DECO_RATE, DECO_PRICES,
    HARVEST_COIN_EVERY, UNDO_SECONDS, random, CHAPTER_OF_LEVEL, BOOST_BY_LEVEL, ATELIER_MOVES, PRODUCE_PER_LEVEL,
    COINS_PER_LEVEL, WORDS, tier, SITES, BOOSTED, effectOf, keyOf, pendingOf, chargesAt, NO_BONUS, NO_ANNEX, effectsOf,
    productionOf, boostedHours, fullInOf, perHourOf, productionAll, cashOf
};
