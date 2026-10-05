// Visiteurs (lot 7d) : un voyageur arrive en bateau au Ponton et reste 1 à 3 jours avec une demande claire :
// livrer des ressources, ou faire des Récoltes pendant son séjour. Comblé, il remercie en écus. Le suivant arrive
// quelques heures après son départ. Chacun a un métier lié à un bâtiment de l'île : comblé, il peut rester si une
// maison est libre (annexes.js) ; il devient alors un habitant (besoins, humeur, amitié) qui travaille à ce bâtiment.
// Le navigateur dessine son allure d'après sa graine (src/world/villagers.js, personOf) ; ses paroles : src/world/visitors.js.

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
const HOUR_MS = 3600000;
const GAP_HOURS = 4; // entre un départ et l'arrivée suivante
// Demande selon le palier du Ponton : ressources à livrer, Récoltes à faire, écus de remerciement
const AMOUNTS = [0, 20, 30, 40, 55, 70, 90, 110];
const RUNS = [2, 3];
const rewardOf = level => 30 + 15 * level;

// Tirages déterministes d'une graine (entier positif) : k-ième nombre dans [0, 1)
function pick(seed, k) {
    let h = (seed ^ (k * 0x9e3779b9)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
const nameOf = seed => NAMES[Math.floor(pick(seed, 1) * NAMES.length)];
// Goûts d'un visiteur installé (cadeaux) : il adore ce qu'il demandait, aime la ressource suivante
const RESOURCES = ['stone', 'wood', 'water', 'food'];
function tastesOf(site) {
    const loves = ROLES[site].wants;
    return { loves, likes: RESOURCES[(RESOURCES.indexOf(loves) + 1) % RESOURCES.length] };
}

// Nouveau visiteur : graine, bâtiments où il pourrait travailler (bâtis, dans un quartier à soi), palier du Ponton.
// { site, role, days, request: { kind: 'livrer', resource, amount, reward } | { kind: 'recolter', count, reward } }
function visitorOf(seed, sites, ponton) {
    const site = sites[Math.floor(pick(seed, 2) * sites.length)];
    const days = 1 + Math.floor(pick(seed, 3) * 3);
    const reward = rewardOf(ponton);
    const request = pick(seed, 4) < 0.6
        ? { kind: 'livrer', resource: ROLES[site].wants, amount: AMOUNTS[ponton], reward }
        : { kind: 'recolter', count: RUNS[Math.floor(pick(seed, 5) * RUNS.length)], reward };
    return { site, role: ROLES[site].role, days, request };
}

module.exports = { ROLES, NAMES, HOUR_MS, GAP_HOURS, AMOUNTS, RUNS, rewardOf, pick, nameOf, tastesOf, visitorOf };
