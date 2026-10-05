// Annexes : constructions que le joueur pose lui-même autour d'un bâtiment, sur une case libre du quartier du
// bâtiment, à REACH cases au plus de sa grande emprise (3 × 3). Trois par bâtiment :
// - une petite annexe au palier II (jusqu'à 3 exemplaires pour les bâtiments qui produisent, ouverts aux paliers
//   II, III et V ; le coût double à chaque exemplaire) ;
// - une réserve au palier IV ;
// - une grande annexe au palier VI.
// Effets : rate = ressources par heure en plus et earn = écus par heure en plus (production du bâtiment, comptée
// depuis la pose, avec les bonus de production de la boutique) ; cap = heures de production gardées en plus ;
// charges, regenCut, moves : réserve, retour d'une partie, coups de Récolte (comme la boutique).
// Fonctions pures, sans base de données.

const REACH = 2;
const SMALL_LEVELS = [2, 3, 5]; // palier du bâtiment qui ouvre chaque exemplaire d'une petite annexe
const SMALL_COINS = [100, 250, 600];
const KIND_LEVEL = { reserve: 4, grand: 6 };
const KIND_COINS = { reserve: 400, grand: 1200 };
const REGEN_FLOOR_MS = 10 * 60 * 1000; // une partie ne revient jamais en moins de 10 minutes

// Effets types des bâtiments qui produisent
const SMALL = { rate: 3, earn: 2 };
const RESERVE = { cap: 4 };
const GRAND = { rate: 8, earn: 6 };

const annex = (id, site, kind, name, cost, effect) => ({ id, site, kind, name, cost, effect });
const ANNEXES = [
    annex('champ', 'potager', 'small', 'Champ', { wood: 20, water: 20 }, SMALL),
    annex('grenier', 'potager', 'reserve', 'Grenier', { wood: 90, stone: 60 }, RESERVE),
    annex('enclos', 'potager', 'grand', 'Enclos', { wood: 160, food: 80, stone: 60 }, GRAND),
    annex('filon', 'carriere', 'small', 'Filon', { wood: 25, food: 15 }, SMALL),
    annex('depot', 'carriere', 'reserve', 'Dépôt de pierres', { wood: 80, stone: 70 }, RESERVE),
    annex('taille', 'carriere', 'grand', 'Taille de pierre', { stone: 150, wood: 100, water: 50 }, GRAND),
    annex('coupe', 'bosquet', 'small', 'Coupe', { stone: 20, food: 20 }, SMALL),
    annex('remise', 'bosquet', 'reserve', 'Remise à bois', { wood: 90, stone: 60 }, RESERVE),
    annex('pepiniere', 'bosquet', 'grand', 'Pépinière', { water: 140, wood: 100, stone: 60 }, GRAND),
    annex('citerne', 'puits', 'small', 'Citerne', { stone: 25, wood: 15 }, SMALL),
    annex('reservoir', 'puits', 'reserve', 'Réservoir', { stone: 100, wood: 50 }, RESERVE),
    annex('eolienne', 'puits', 'grand', 'Éolienne de pompage', { wood: 150, stone: 100, water: 50 }, GRAND),
    annex('vivier', 'ponton', 'small', 'Vivier', { stone: 20, water: 20 }, SMALL),
    annex('fumoir', 'ponton', 'reserve', 'Fumoir', { wood: 90, stone: 60 }, RESERVE),
    annex('huitres', 'ponton', 'grand', 'Parc à huîtres', { stone: 120, water: 120, wood: 60 }, { rate: 4, earn: 10 }),
    annex('jardin', 'foyer', 'small', 'Jardin d’herbes', { water: 30, food: 30 }, { charges: 1 }),
    annex('four', 'foyer', 'reserve', 'Four à pain', { stone: 90, wood: 60 }, { regenCut: 5 * 60 * 1000 }),
    annex('belvedere', 'foyer', 'grand', 'Belvédère', { stone: 150, wood: 150 }, { charges: 1 }),
    annex('charbon', 'atelier', 'small', 'Tas de charbon', { wood: 40, stone: 20 }, { moves: 1 }),
    annex('hangar', 'atelier', 'reserve', 'Hangar', { wood: 90, stone: 60 }, { moves: 1 }),
    annex('fourneau', 'atelier', 'grand', 'Haut fourneau', { stone: 180, wood: 80, water: 40 }, { moves: 2 })
];
const ANNEX_BY_ID = Object.fromEntries(ANNEXES.map(a => [a.id, a]));

// Exemplaires possibles : 3 pour la petite annexe d'un bâtiment qui produit (rate), sinon 1
const maxOf = a => (a.kind === 'small' && a.effect.rate ? SMALL_LEVELS.length : 1);
// Palier du bâtiment qui ouvre l'exemplaire n° copy (0, 1, 2)
const levelFor = (a, copy) => (a.kind === 'small' ? SMALL_LEVELS[copy] : KIND_LEVEL[a.kind]);
// Prix de l'exemplaire n° copy : { cost, coins } ; le coût en ressources double à chaque exemplaire
function priceOf(a, copy) {
    if (a.kind !== 'small') return { cost: { ...a.cost }, coins: KIND_COINS[a.kind] };
    const factor = 2 ** copy;
    return { cost: Object.fromEntries(Object.entries(a.cost).map(([r, n]) => [r, n * factor])), coins: SMALL_COINS[copy] };
}

// Ce que rapportent les annexes posées ([{ annex, built_at }]) :
// { site: { siteId: [{ rate, earn, at }] }, cap: { siteId: heures }, charges, moves, regenCut }
function bonusesOf(rows) {
    const out = { site: {}, cap: {}, charges: 0, moves: 0, regenCut: 0 };
    for (const row of rows) {
        const a = ANNEX_BY_ID[row.annex];
        if (!a) continue;
        const { rate, earn, cap, charges, moves, regenCut } = a.effect;
        if (rate || earn) (out.site[a.site] = out.site[a.site] || []).push({ rate: rate || 0, earn: earn || 0, at: row.built_at });
        if (cap) out.cap[a.site] = (out.cap[a.site] || 0) + cap;
        out.charges += charges || 0;
        out.moves += moves || 0;
        out.regenCut += regenCut || 0;
    }
    return out;
}

// Délai de retour d'une partie, annexes comprises (jamais sous REGEN_FLOOR_MS)
const regenWith = (regenMs, cut) => Math.max(REGEN_FLOOR_MS, regenMs - cut);

// Texte d'effet d'une annexe ; words = [pluriel de la ressource du bâtiment] ; capHours = heures gardées sans réserve
function effectText(a, words, capHours) {
    const e = a.effect;
    if (e.rate) return `+${e.rate} ${words[0]} et +${e.earn} écus par heure`;
    if (e.cap) return `Garde ${capHours + e.cap} h de production au lieu de ${capHours}`;
    if (e.charges) return `+${e.charges} partie de Récolte en réserve`;
    if (e.regenCut) return `Une partie revient ${Math.round(e.regenCut / 60000)} min plus vite`;
    if (e.moves) return `+${e.moves} coup${e.moves > 1 ? 's' : ''} par Récolte`;
    return '';
}

// Distance (en cases, diagonales comprises) entre une case et la grande emprise 3 × 3 dont le coin est at
const reachOf = (x, y, at) => Math.max(at.x - x, 0, x - (at.x + 2), at.y - y, 0, y - (at.y + 2));

module.exports = { REACH, ANNEXES, ANNEX_BY_ID, maxOf, levelFor, priceOf, bonusesOf, regenWith, effectText, reachOf };
