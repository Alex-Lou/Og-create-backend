// Boutique des ateliers de l'île : outils (bonus), objets vivants (bonus, visibles et animés sur l'île) et skins
// (apparence). Catalogue fixe, prix en écus ; certains articles demandent le niveau 2 du bâtiment.
// Effets : prod = part de production en plus (ressources et écus du bâtiment), coins = écus par heure en plus,
// moves = coups de Récolte en plus, charges = parties en réserve en plus, regenMs = délai de retour d'une partie.

const PROD_CAP = 1; // les bonus de production d'un bâtiment s'additionnent jusqu'à +100 %

const ITEMS = [
    // Potager
    { id: 'pelle', site: 'potager', kind: 'outil', name: 'Pelle', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'arrosoir', site: 'potager', kind: 'outil', name: 'Arrosoir', price: 150, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'poulailler', site: 'potager', kind: 'objet', name: 'Poulailler et ses poules', price: 220, minLevel: 1, effect: { coins: 1 } },
    { id: 'ruche', site: 'potager', kind: 'objet', name: 'Ruche', price: 400, minLevel: 2, effect: { prod: 0.3 } },
    { id: 'cloture-blanche', site: 'potager', kind: 'skin', name: 'Clôture blanche', price: 60, minLevel: 1 },
    { id: 'cloture-pierre', site: 'potager', kind: 'skin', name: 'Muret de pierre', price: 60, minLevel: 1 },
    { id: 'cloture-fleurie', site: 'potager', kind: 'skin', name: 'Clôture fleurie', price: 60, minLevel: 1 },
    // Carrière
    { id: 'pioche', site: 'carriere', kind: 'outil', name: 'Pioche', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'wagonnet', site: 'carriere', kind: 'outil', name: 'Wagonnet', price: 160, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'lanterne-mine', site: 'carriere', kind: 'objet', name: 'Lanterne de mine', price: 120, minLevel: 1, effect: { prod: 0.1 } },
    { id: 'rails', site: 'carriere', kind: 'objet', name: 'Rails et wagonnets', price: 380, minLevel: 2, effect: { prod: 0.3 } },
    { id: 'roche-ocre', site: 'carriere', kind: 'skin', name: 'Roche ocre', price: 80, minLevel: 1 },
    { id: 'roche-granit', site: 'carriere', kind: 'skin', name: 'Granit', price: 80, minLevel: 1 },
    { id: 'roche-cristal', site: 'carriere', kind: 'skin', name: 'Veines de cristal', price: 80, minLevel: 1 },
    // Bosquet
    { id: 'hache', site: 'bosquet', kind: 'outil', name: 'Hache', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'scie', site: 'bosquet', kind: 'outil', name: 'Scie', price: 160, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'nichoir', site: 'bosquet', kind: 'objet', name: 'Nichoir et oiseaux', price: 120, minLevel: 1, effect: { prod: 0.1 } },
    { id: 'charrette', site: 'bosquet', kind: 'objet', name: 'Charrette de bûcheron', price: 380, minLevel: 2, effect: { prod: 0.3 } },
    { id: 'printemps', site: 'bosquet', kind: 'skin', name: 'Printemps fleuri', price: 70, minLevel: 1 },
    { id: 'automne', site: 'bosquet', kind: 'skin', name: 'Automne', price: 70, minLevel: 1 },
    { id: 'givre', site: 'bosquet', kind: 'skin', name: 'Givre', price: 70, minLevel: 1 },
    // Puits
    { id: 'seau-cuivre', site: 'puits', kind: 'outil', name: 'Seau de cuivre', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'poulie', site: 'puits', kind: 'outil', name: 'Poulie', price: 160, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'abreuvoir', site: 'puits', kind: 'objet', name: 'Abreuvoir', price: 120, minLevel: 1, effect: { prod: 0.1 } },
    { id: 'pompe', site: 'puits', kind: 'objet', name: 'Pompe à balancier', price: 380, minLevel: 2, effect: { prod: 0.3 } },
    { id: 'toit-bleu', site: 'puits', kind: 'skin', name: 'Toit bleu', price: 60, minLevel: 1 },
    { id: 'toit-chaume', site: 'puits', kind: 'skin', name: 'Toit de chaume', price: 60, minLevel: 1 },
    { id: 'pierre-blanche', site: 'puits', kind: 'skin', name: 'Pierre blanche', price: 60, minLevel: 1 },
    // Ponton
    { id: 'canne', site: 'ponton', kind: 'outil', name: 'Canne à pêche', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'filet', site: 'ponton', kind: 'outil', name: 'Filet', price: 160, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'casier', site: 'ponton', kind: 'objet', name: 'Casier à crabes', price: 120, minLevel: 1, effect: { prod: 0.1 } },
    { id: 'barque', site: 'ponton', kind: 'objet', name: 'Barque de pêche', price: 380, minLevel: 2, effect: { prod: 0.3 } },
    { id: 'voile-rouge', site: 'ponton', kind: 'skin', name: 'Voile rouge', price: 60, minLevel: 1 },
    { id: 'voile-rayee', site: 'ponton', kind: 'skin', name: 'Voile rayée', price: 60, minLevel: 1 },
    { id: 'voile-bleue', site: 'ponton', kind: 'skin', name: 'Voile bleue', price: 60, minLevel: 1 },
    // Atelier
    { id: 'etabli', site: 'atelier', kind: 'outil', name: 'Établi', price: 150, minLevel: 1, effect: { moves: 1 } },
    { id: 'enclume', site: 'atelier', kind: 'outil', name: 'Enclume', price: 250, minLevel: 1, effect: { moves: 1 } },
    { id: 'soufflet', site: 'atelier', kind: 'objet', name: 'Soufflet de forge', price: 450, minLevel: 2, effect: { moves: 2 } },
    { id: 'enseigne-doree', site: 'atelier', kind: 'skin', name: 'Enseigne dorée', price: 80, minLevel: 1 },
    { id: 'toit-ardoise', site: 'atelier', kind: 'skin', name: 'Toit d’ardoise', price: 80, minLevel: 1 },
    // Foyer
    { id: 'cuisine', site: 'foyer', kind: 'outil', name: 'Cuisine', price: 300, minLevel: 1, effect: { regenMs: 25 * 60 * 1000 } },
    { id: 'lit', site: 'foyer', kind: 'outil', name: 'Lit douillet', price: 450, minLevel: 1, effect: { charges: 1 } },
    { id: 'chat', site: 'foyer', kind: 'objet', name: 'Chat', price: 90, minLevel: 1 },
    { id: 'chien', site: 'foyer', kind: 'objet', name: 'Chien', price: 90, minLevel: 1 },
    { id: 'toit-rouge', site: 'foyer', kind: 'skin', name: 'Toit rouge', price: 70, minLevel: 1 },
    { id: 'toit-bleu-foyer', site: 'foyer', kind: 'skin', name: 'Toit bleu', price: 70, minLevel: 1 },
    { id: 'toit-chaume-foyer', site: 'foyer', kind: 'skin', name: 'Toit de chaume', price: 70, minLevel: 1 }
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item]));

// Ce que rapportent les articles possédés : { prod: { site: part }, coins: { site: écus/h }, moves, charges, regenMs }
function bonusesOf(ownedIds) {
    const out = { prod: {}, coins: {}, moves: 0, charges: 0, regenMs: null };
    for (const id of ownedIds) {
        const item = ITEM_BY_ID[id];
        if (!item || !item.effect) continue;
        const { prod, coins, moves, charges, regenMs } = item.effect;
        if (prod) out.prod[item.site] = Math.min(PROD_CAP, (out.prod[item.site] || 0) + prod);
        if (coins) out.coins[item.site] = (out.coins[item.site] || 0) + coins;
        if (moves) out.moves += moves;
        if (charges) out.charges += charges;
        if (regenMs) out.regenMs = Math.min(out.regenMs ?? regenMs, regenMs);
    }
    return out;
}

// Texte d'effet d'un article, pour la boutique
function effectText(item) {
    const e = item.effect;
    if (!e) return item.kind === 'skin' ? 'Change l’apparence du bâtiment.' : 'Vit sur ton île.';
    if (e.prod) return `+${Math.round(e.prod * 100)} % de production`;
    if (e.coins) return `+${e.coins} écu par heure`;
    if (e.moves) return `+${e.moves} coup${e.moves > 1 ? 's' : ''} par Récolte`;
    if (e.charges) return `+${e.charges} partie de Récolte en réserve`;
    if (e.regenMs) return `Une partie revient toutes les ${Math.round(e.regenMs / 60000)} min`;
    return '';
}

module.exports = { ITEMS, ITEM_BY_ID, PROD_CAP, bonusesOf, effectText };
