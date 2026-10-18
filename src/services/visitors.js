// Les arrivants (choix de l'auteur, 18 oct. : ils remplacent les voyageurs de passage du lot 7d) : quatre moments de
// l'histoire font venir chacun un arrivant en bateau au Ponton. Le joueur l'accueille : il compose son allure (l'atelier de
// l'avatar, ou le tirage du jeu), choisit son métier parmi les bâtiments bâtis et son prénom ; il s'installe alors dans
// une maison libre (annexes.js) et devient un habitant (besoins, humeur, amitié) qui travaille à ce bâtiment. Un seul
// attend à la fois ; il ne repart pas. Les visiteurs installés d'avant restent, avec le prénom de leur graine.
// Le navigateur dessine son allure (ses choix, ou celle que sa graine tire : design/personnages/avatar_choix.js, assorti).

// Le métier de chaque bâtiment, et ce qu'un habitant de ce métier aime (cadeaux)
const ROLES = {
    potager: { role: 'Botaniste', wants: 'water' },
    carriere: { role: 'Géologue', wants: 'food' },
    bosquet: { role: 'Ébéniste', wants: 'wood' },
    puits: { role: 'Hydrologue', wants: 'stone' },
    ponton: { role: 'Cartographe', wants: 'food' },
    atelier: { role: 'Orfèvre', wants: 'stone' },
    foyer: { role: 'Poète', wants: 'wood' }
};
const NAMES = [
    'Albane', 'Basile', 'Céleste', 'Désiré', 'Elise', 'Firmin', 'Gabrielle', 'Hector', 'Iris', 'Jules', 'Louison', 'Maël',
    'Noémie', 'Octave', 'Pia', 'Quentin', 'Rosalie', 'Sacha', 'Théo', 'Ursule', 'Victor', 'Yvonne', 'Zélie', 'Armand'
];
// Les moments qui font venir un arrivant, dans l'ordre du récit : le port de pêche de Lorena (Ponton II, acte IV), la
// maison du Foyer (Foyer III, acte V), le peuple nommé (acte V), la Tour (Foyer V, acte VI)
const MOMENTS = ['ponton', 'maison', 'peuple', 'tour'];
// Prénom d'un arrivant : 16 caractères au plus (naming.js)
const NAME_MAX = 16;

// Tirages déterministes d'une graine (entier positif) : k-ième nombre dans [0, 1)
function pick(seed, k) {
    let h = (seed ^ (k * 0x9e3779b9)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
const nameOf = seed => NAMES[Math.floor(pick(seed, 1) * NAMES.length)];
// Goûts d'un habitant venu d'ailleurs (cadeaux) : il adore la ressource de son métier, aime la suivante
const RESOURCES = ['stone', 'wood', 'water', 'food'];
function tastesOf(site) {
    const loves = ROLES[site].wants;
    return { loves, likes: RESOURCES[(RESOURCES.indexOf(loves) + 1) % RESOURCES.length] };
}

// Les moments atteints, dans l'ordre : levels (paliers des bâtiments), named (le peuple a un nom)
function momentsOf({ levels, named }) {
    const reached = { ponton: (levels.ponton || 0) >= 2, maison: (levels.foyer || 0) >= 3, peuple: Boolean(named), tour: (levels.foyer || 0) >= 5 };
    return MOMENTS.filter(m => reached[m]);
}
// Le moment du prochain arrivant à faire venir, ou null : le premier moment atteint qui n'a pas encore le sien (had :
// Set des moments déjà venus). Les visiteurs installés avant les arrivants (legacy : leur nombre) tiennent les premiers
// moments : un joueur ne reçoit jamais plus d'habitants venus d'ailleurs que de moments atteints
function nextMoment(reached, had, legacy) {
    return reached.slice(legacy).find(m => !had.has(m)) || null;
}

module.exports = { ROLES, NAMES, MOMENTS, NAME_MAX, pick, nameOf, tastesOf, momentsOf, nextMoment };
