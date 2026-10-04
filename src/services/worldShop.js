// Boutique des ateliers de l'île : outils (bonus), objets vivants (bonus, visibles et animés sur l'île) et skins
// (apparence). Catalogue fixe, prix en écus ; chaque article s'ouvre à un palier du bâtiment (minLevel, de I à VII) :
// les outils aux paliers I et II, les objets aux III et IV, les skins aux I à III, puis un article neuf par palier V,
// VI et VII (outil, objet, objet légendaire). S'y ajoutent les teintes (skins qui recolorent le bâtiment, de I à VII)
// et les pièces rares (skins à accessoire animé, sans prix : elles se trouvent dans les butins).
// Effets : prod = part de production en plus (ressources et écus du bâtiment), coins = écus par heure en plus,
// moves = coups de Récolte en plus, charges = parties en réserve en plus, regenMs = délai de retour d'une partie.

const PROD_CAP = 1; // les bonus de production d'un bâtiment s'additionnent jusqu'à +100 %
const SITE_IDS = ['potager', 'carriere', 'bosquet', 'puits', 'ponton', 'atelier', 'foyer'];

// Teintes : chacune se vend pour chaque bâtiment (« <teinte>-<bâtiment> ») ; le navigateur recolore le dessin
// du bâtiment à tous ses paliers (src/world/tints.js du front, mêmes identifiants)
const TINTS = [
    { id: 'craie', name: 'Craie', minLevel: 1, price: 60 },
    { id: 'sepia', name: 'Sépia', minLevel: 1, price: 60 },
    { id: 'corail', name: 'Corail', minLevel: 2, price: 100 },
    { id: 'ocean', name: 'Océan', minLevel: 2, price: 100 },
    { id: 'emeraude', name: 'Émeraude', minLevel: 3, price: 160 },
    { id: 'lavande', name: 'Lavande', minLevel: 3, price: 160 },
    { id: 'flamboyant', name: 'Flamboyant', minLevel: 4, price: 250 },
    { id: 'sakura', name: 'Sakura', minLevel: 4, price: 250 },
    { id: 'frimas', name: 'Frimas', minLevel: 5, price: 400 },
    { id: 'cristal', name: 'Cristal', minLevel: 5, price: 400 },
    { id: 'nuit-etoilee', name: 'Nuit étoilée', minLevel: 6, price: 600 },
    { id: 'or-royal', name: 'Or royal', minLevel: 7, price: 900 }
];
// Pièces rares : deux par bâtiment, portées à tous les paliers (src/world/rareSprites.js du front)
const RARES = [
    { id: 'papillons', site: 'potager', name: 'Papillons' },
    { id: 'tournesols', site: 'potager', name: 'Tournesols géants' },
    { id: 'filon-or', site: 'carriere', name: 'Filon d’or' },
    { id: 'coeur-lave', site: 'carriere', name: 'Cœur de lave' },
    { id: 'fees', site: 'bosquet', name: 'Lanternes des fées' },
    { id: 'petales', site: 'bosquet', name: 'Pluie de pétales' },
    { id: 'arc-en-ciel', site: 'puits', name: 'Arc-en-ciel' },
    { id: 'nenuphars', site: 'puits', name: 'Nénuphars et libellules' },
    { id: 'pavois', site: 'ponton', name: 'Grand pavois' },
    { id: 'mouettes', site: 'ponton', name: 'Mouettes' },
    { id: 'etincelles', site: 'atelier', name: 'Gerbe d’étincelles' },
    { id: 'engrenages', site: 'atelier', name: 'Engrenages d’or' },
    { id: 'lampions', site: 'foyer', name: 'Lampions de fête' },
    { id: 'lierre', site: 'foyer', name: 'Lierre et lucioles' }
];

const ITEMS = [
    // Potager
    { id: 'pelle', site: 'potager', kind: 'outil', name: 'Pelle', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'arrosoir', site: 'potager', kind: 'outil', name: 'Arrosoir', price: 150, minLevel: 2, effect: { prod: 0.2 } },
    { id: 'poulailler', site: 'potager', kind: 'objet', name: 'Poulailler et ses poules', price: 220, minLevel: 3, effect: { coins: 1 } },
    { id: 'ruche', site: 'potager', kind: 'objet', name: 'Ruche', price: 400, minLevel: 4, effect: { prod: 0.3 } },
    { id: 'brouette', site: 'potager', kind: 'outil', name: 'Brouette', price: 700, minLevel: 5, effect: { prod: 0.3 } },
    { id: 'epouvantail', site: 'potager', kind: 'objet', name: 'Épouvantail', price: 1300, minLevel: 6, effect: { coins: 3 } },
    { id: 'citrouille', site: 'potager', kind: 'objet', name: 'Citrouille enchantée', price: 2400, minLevel: 7, effect: { coins: 5 } },
    { id: 'cloture-blanche', site: 'potager', kind: 'skin', name: 'Clôture blanche', price: 60, minLevel: 1 },
    { id: 'cloture-pierre', site: 'potager', kind: 'skin', name: 'Muret de pierre', price: 60, minLevel: 2 },
    { id: 'cloture-fleurie', site: 'potager', kind: 'skin', name: 'Clôture fleurie', price: 60, minLevel: 3 },
    // Carrière
    { id: 'pioche', site: 'carriere', kind: 'outil', name: 'Pioche', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'wagonnet', site: 'carriere', kind: 'outil', name: 'Wagonnet', price: 160, minLevel: 2, effect: { prod: 0.2 } },
    { id: 'lanterne-mine', site: 'carriere', kind: 'objet', name: 'Lanterne de mine', price: 120, minLevel: 3, effect: { prod: 0.1 } },
    { id: 'rails', site: 'carriere', kind: 'objet', name: 'Rails et wagonnets', price: 380, minLevel: 4, effect: { prod: 0.3 } },
    { id: 'casque', site: 'carriere', kind: 'outil', name: 'Casque de mineur', price: 700, minLevel: 5, effect: { prod: 0.2 } },
    { id: 'geode', site: 'carriere', kind: 'objet', name: 'Géode', price: 1300, minLevel: 6, effect: { coins: 3 } },
    { id: 'golem', site: 'carriere', kind: 'objet', name: 'Golem de pierre', price: 2400, minLevel: 7, effect: { coins: 5 } },
    { id: 'roche-ocre', site: 'carriere', kind: 'skin', name: 'Roche ocre', price: 80, minLevel: 1 },
    { id: 'roche-granit', site: 'carriere', kind: 'skin', name: 'Granit', price: 80, minLevel: 2 },
    { id: 'roche-cristal', site: 'carriere', kind: 'skin', name: 'Veines de cristal', price: 80, minLevel: 3 },
    // Bosquet
    { id: 'hache', site: 'bosquet', kind: 'outil', name: 'Hache', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'scie', site: 'bosquet', kind: 'outil', name: 'Scie', price: 160, minLevel: 2, effect: { prod: 0.2 } },
    { id: 'nichoir', site: 'bosquet', kind: 'objet', name: 'Nichoir et oiseaux', price: 120, minLevel: 3, effect: { prod: 0.1 } },
    { id: 'charrette', site: 'bosquet', kind: 'objet', name: 'Charrette de bûcheron', price: 380, minLevel: 4, effect: { prod: 0.3 } },
    { id: 'passe-partout', site: 'bosquet', kind: 'outil', name: 'Scie passe-partout', price: 700, minLevel: 5, effect: { prod: 0.2 } },
    { id: 'ecureuil', site: 'bosquet', kind: 'objet', name: 'Écureuil', price: 1300, minLevel: 6, effect: { coins: 3 } },
    { id: 'cerf', site: 'bosquet', kind: 'objet', name: 'Cerf blanc', price: 2400, minLevel: 7, effect: { coins: 5 } },
    { id: 'printemps', site: 'bosquet', kind: 'skin', name: 'Printemps fleuri', price: 70, minLevel: 1 },
    { id: 'automne', site: 'bosquet', kind: 'skin', name: 'Automne', price: 70, minLevel: 2 },
    { id: 'givre', site: 'bosquet', kind: 'skin', name: 'Givre', price: 70, minLevel: 3 },
    // Puits
    { id: 'seau-cuivre', site: 'puits', kind: 'outil', name: 'Seau de cuivre', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'poulie', site: 'puits', kind: 'outil', name: 'Poulie', price: 160, minLevel: 2, effect: { prod: 0.2 } },
    { id: 'abreuvoir', site: 'puits', kind: 'objet', name: 'Abreuvoir', price: 120, minLevel: 3, effect: { prod: 0.1 } },
    { id: 'pompe', site: 'puits', kind: 'objet', name: 'Pompe à balancier', price: 380, minLevel: 4, effect: { prod: 0.3 } },
    { id: 'sourcier', site: 'puits', kind: 'outil', name: 'Baguette de sourcier', price: 700, minLevel: 5, effect: { prod: 0.2 } },
    { id: 'canards', site: 'puits', kind: 'objet', name: 'Canards', price: 1300, minLevel: 6, effect: { coins: 3 } },
    { id: 'naiade', site: 'puits', kind: 'objet', name: 'Statue de la naïade', price: 2400, minLevel: 7, effect: { coins: 5 } },
    { id: 'toit-bleu', site: 'puits', kind: 'skin', name: 'Toit bleu', price: 60, minLevel: 1 },
    { id: 'toit-chaume', site: 'puits', kind: 'skin', name: 'Toit de chaume', price: 60, minLevel: 2 },
    { id: 'pierre-blanche', site: 'puits', kind: 'skin', name: 'Pierre blanche', price: 60, minLevel: 3 },
    // Ponton
    { id: 'canne', site: 'ponton', kind: 'outil', name: 'Canne à pêche', price: 80, minLevel: 1, effect: { prod: 0.2 } },
    { id: 'filet', site: 'ponton', kind: 'outil', name: 'Filet', price: 160, minLevel: 2, effect: { prod: 0.2 } },
    { id: 'casier', site: 'ponton', kind: 'objet', name: 'Casier à crabes', price: 120, minLevel: 3, effect: { prod: 0.1 } },
    { id: 'barque', site: 'ponton', kind: 'objet', name: 'Barque de pêche', price: 380, minLevel: 4, effect: { prod: 0.3 } },
    { id: 'harpon', site: 'ponton', kind: 'outil', name: 'Harpon', price: 700, minLevel: 5, effect: { prod: 0.2 } },
    { id: 'pelican', site: 'ponton', kind: 'objet', name: 'Pélican', price: 1300, minLevel: 6, effect: { coins: 3 } },
    { id: 'sirene', site: 'ponton', kind: 'objet', name: 'Sirène', price: 2400, minLevel: 7, effect: { coins: 5 } },
    { id: 'voile-rouge', site: 'ponton', kind: 'skin', name: 'Voile rouge', price: 60, minLevel: 1 },
    { id: 'voile-rayee', site: 'ponton', kind: 'skin', name: 'Voile rayée', price: 60, minLevel: 2 },
    { id: 'voile-bleue', site: 'ponton', kind: 'skin', name: 'Voile bleue', price: 60, minLevel: 3 },
    // Atelier
    { id: 'etabli', site: 'atelier', kind: 'outil', name: 'Établi', price: 150, minLevel: 1, effect: { moves: 1 } },
    { id: 'enclume', site: 'atelier', kind: 'outil', name: 'Enclume', price: 250, minLevel: 2, effect: { moves: 1 } },
    { id: 'soufflet', site: 'atelier', kind: 'objet', name: 'Soufflet de forge', price: 450, minLevel: 3, effect: { moves: 2 } },
    { id: 'marteau-pilon', site: 'atelier', kind: 'outil', name: 'Marteau-pilon', price: 700, minLevel: 5, effect: { moves: 1 } },
    { id: 'automate', site: 'atelier', kind: 'objet', name: 'Automate', price: 1300, minLevel: 6, effect: { moves: 2 } },
    { id: 'athanor', site: 'atelier', kind: 'objet', name: 'Athanor d’or', price: 2400, minLevel: 7, effect: { moves: 2 } },
    { id: 'enseigne-doree', site: 'atelier', kind: 'skin', name: 'Enseigne dorée', price: 80, minLevel: 1 },
    { id: 'toit-ardoise', site: 'atelier', kind: 'skin', name: 'Toit d’ardoise', price: 80, minLevel: 2 },
    // Foyer
    { id: 'cuisine', site: 'foyer', kind: 'outil', name: 'Cuisine', price: 300, minLevel: 1, effect: { regenMs: 25 * 60 * 1000 } },
    { id: 'lit', site: 'foyer', kind: 'outil', name: 'Lit douillet', price: 450, minLevel: 2, effect: { charges: 1 } },
    { id: 'chat', site: 'foyer', kind: 'objet', name: 'Chat', price: 90, minLevel: 1 },
    { id: 'chien', site: 'foyer', kind: 'objet', name: 'Chien', price: 90, minLevel: 1 },
    { id: 'sablier', site: 'foyer', kind: 'outil', name: 'Sablier', price: 700, minLevel: 5, effect: { regenMs: 20 * 60 * 1000 } },
    { id: 'hibou', site: 'foyer', kind: 'objet', name: 'Hibou', price: 1300, minLevel: 6, effect: { charges: 1 } },
    { id: 'grimoire', site: 'foyer', kind: 'objet', name: 'Grimoire volant', price: 2400, minLevel: 7, effect: { charges: 1 } },
    { id: 'toit-rouge', site: 'foyer', kind: 'skin', name: 'Toit rouge', price: 70, minLevel: 2 },
    { id: 'toit-bleu-foyer', site: 'foyer', kind: 'skin', name: 'Toit bleu', price: 70, minLevel: 3 },
    { id: 'toit-chaume-foyer', site: 'foyer', kind: 'skin', name: 'Toit de chaume', price: 70, minLevel: 4 },
    ...TINTS.flatMap(t => SITE_IDS.map(site => ({ id: `${t.id}-${site}`, site, kind: 'skin', name: t.name, price: t.price, minLevel: t.minLevel, tint: true }))),
    ...RARES.map(rare => ({ ...rare, kind: 'skin', price: null, minLevel: 1, rare: true }))
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
    if (item.rare) return 'Pièce rare : elle se trouve dans les butins.';
    if (item.tint) return 'Recolore le bâtiment, à tous ses paliers.';
    if (!e) return item.kind === 'skin' ? 'Change l’apparence du bâtiment.' : 'Vit sur ton île.';
    if (e.prod) return `+${Math.round(e.prod * 100)} % de production`;
    if (e.coins) return `+${e.coins} écu${e.coins > 1 ? 's' : ''} par heure`;
    if (e.moves) return `+${e.moves} coup${e.moves > 1 ? 's' : ''} par Récolte`;
    if (e.charges) return `+${e.charges} partie de Récolte en réserve`;
    if (e.regenMs) return `Une partie revient toutes les ${Math.round(e.regenMs / 60000)} min`;
    return '';
}

module.exports = { ITEMS, ITEM_BY_ID, PROD_CAP, bonusesOf, effectText };
