// Habitants de l'île (lot 6d) : un par bâtiment bâti, plus la cuisinière du Foyer. Chacun a son prénom, ce qu'il adore
// et ce qu'il aime recevoir. L'amitié se gagne en lui parlant (une fois par jour) et en lui offrant des ressources (une
// fois par jour) ; chaque cœur gagné donne une récompense, versée une seule fois (services/world.js). Leurs besoins
// comblés (ou non) font leur humeur, qui change la production de leur bâtiment.
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

// Besoins (lot 7c). Manger et travailler se comblent en donnant des ressources : le besoin tient tant d'heures et se
// renouvelle une fois la moitié écoulée. Travailler n'existe qu'avec l'Atelier bâti (il forge les outils). Se
// distraire demande des décorations autour du bâtiment de l'habitant (tant qu'elles y sont).
const NEEDS = {
    manger: { label: 'Manger', hours: 24, cost: { food: 10 } },
    outils: { label: 'Travailler', hours: 48, cost: { stone: 5, wood: 5 } },
    deco: { label: 'Se distraire', decos: 3, reach: 3 }
};
const FILLABLE = ['manger', 'outils'];
const HOUR_MS = 3600000;
// Humeur selon le nombre de besoins qui manquent : aucun → heureux, un → content, deux ou plus → triste
const MOODS = ['heureux', 'content', 'triste'];
const moodOf = needs => MOODS[Math.min(2, needs.filter(n => !n.met).length)];
const moodSign = mood => (mood === 'heureux' ? 1 : mood === 'triste' ? -1 : 0);
// Effet d'une humeur heureuse (triste : l'inverse) : production du bâtiment ; à l'Atelier, coups par Récolte ; au Foyer,
// retour d'une partie de Récolte (un dixième de ses 30 minutes)
const MOOD_STEP = { prod: 0.1, moves: 2, regenMs: 3 * 60 * 1000 };

// Besoins d'un habitant à l'instant now. filled : { besoin: date où il a été comblé } (absent : il arrive, comblé
// maintenant) ; decos : décorations autour de son bâtiment ; atelier : l'Atelier est bâti.
// [{ id, met, left (ms), refill, cost } | { id: 'deco', met, have, need, reach }]
function needsOf(filled, decos, atelier, now) {
    const out = FILLABLE.filter(id => id !== 'outils' || atelier).map(id => {
        const need = NEEDS[id];
        const at = filled[id] ? new Date(filled[id]).getTime() : now;
        const left = Math.max(0, at + need.hours * HOUR_MS - now);
        return { id, met: left > 0, left, refill: left <= need.hours * HOUR_MS / 2, cost: need.cost };
    });
    const { decos: need, reach } = NEEDS.deco;
    out.push({ id: 'deco', met: decos >= need, have: Math.min(decos, need), need, reach });
    return out;
}

// Ce que fait l'humeur de cet habitant (texte de sa fiche), ou null quand il est content
function moodEffect(siteId, produces, mood) {
    const sign = moodSign(mood);
    if (!sign) return null;
    const plus = sign > 0 ? '+' : '−';
    if (produces) return `${plus}${Math.round(MOOD_STEP.prod * 100)} % de production`;
    if (siteId === 'atelier') return `${plus}${MOOD_STEP.moves} coups par Récolte`;
    return `Une partie de Récolte revient ${MOOD_STEP.regenMs / 60000} min plus ${sign > 0 ? 'vite' : 'lentement'}`;
}

module.exports = {
    VILLAGERS, RESOURCES, LABELS, TALK, GIFT, HEARTS, MAX_POINTS, REWARDS, heartsOf, giftPoints,
    NEEDS, FILLABLE, MOODS, MOOD_STEP, moodOf, moodSign, needsOf, moodEffect
};
