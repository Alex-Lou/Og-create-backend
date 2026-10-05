// Habitants de l'île (lot 6d) : un par bâtiment bâti, plus la cuisinière du Foyer. Chacun a son prénom, ce qu'il adore
// et ce qu'il aime recevoir. L'amitié se gagne en lui parlant (une fois par jour) et en lui offrant des ressources (une
// fois par jour) ; chaque cœur gagné donne une récompense, versée une seule fois (services/world.js).
// Le navigateur dessine les habitants et leurs paroles (src/world/village.js, src/world/friends.js : mêmes identifiants).

const VILLAGERS = {
    potager: { name: 'Rose', role: 'Jardinière', loves: 'water', likes: 'food' },
    carriere: { name: 'Gaspard', role: 'Mineur', loves: 'food', likes: 'wood' },
    bosquet: { name: 'Léonie', role: 'Bûcheronne', loves: 'food', likes: 'water' },
    puits: { name: 'Anatole', role: 'Porteur d’eau', loves: 'wood', likes: 'stone' },
    ponton: { name: 'Marine', role: 'Pêcheuse', loves: 'wood', likes: 'food' },
    atelier: { name: 'Ferdinand', role: 'Forgeron', loves: 'stone', likes: 'wood' },
    foyer: { name: 'Paulette', role: 'Cuisinière', loves: 'food', likes: 'water' }
};
const RESOURCES = ['stone', 'wood', 'water', 'food'];
const LABELS = { stone: 'pierre', wood: 'bois', water: 'eau', food: 'nourriture' };
const TALK = 8;
const GIFT = { cost: 15, loves: 30, likes: 15, other: 6 };
// Points d'amitié pour chaque cœur (1 à 5)
const HEARTS = [30, 80, 150, 250, 400];
const MAX_POINTS = HEARTS[HEARTS.length - 1];
// Récompense de chaque cœur : écus, ou un coffre de cette rareté
const REWARDS = [
    { kind: 'coins', amount: 40 },
    { kind: 'chest', rarity: 'rare' },
    { kind: 'coins', amount: 120 },
    { kind: 'chest', rarity: 'epique' },
    { kind: 'chest', rarity: 'legendaire' }
];

// Cœurs pour tant de points (0 à 5)
const heartsOf = points => HEARTS.filter(n => points >= n).length;
// Points gagnés par un cadeau de cette ressource
const giftPoints = (villager, resource) => (resource === villager.loves ? GIFT.loves : resource === villager.likes ? GIFT.likes : GIFT.other);

module.exports = { VILLAGERS, RESOURCES, LABELS, TALK, GIFT, HEARTS, MAX_POINTS, REWARDS, heartsOf, giftPoints };
