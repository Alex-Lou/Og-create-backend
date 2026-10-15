// La météo de l'île, comme le jeu la montre (src/world/sky.js du front : même graine, mêmes créneaux de 6 h) : le
// temps d'un créneau se déduit de l'instant seul, sans état. Sur l'horloge du jeu (choix de l'auteur, 15 oct. :
// services/gameClock.js, celle des nuits) ; les nuits n'en lisent que la pluie (choix de l'auteur, 14 oct. : sous la
// pluie, le feu de camp porte moins loin)
const clock = require('./gameClock');

const SLOT_H = 6;
const hash = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
};
// Temps de fond d'un jour (fréquences), puis ses voisins quand il tourne (sky.js : ODDS, TURNS)
const ODDS = [['clair', 0.42], ['voile', 0.26], ['brume', 0.14], ['pluie', 0.13], ['orage', 0.05]];
const TURNS = { clair: 'voile', voile: 'pluie', brume: 'clair', pluie: 'voile', orage: 'pluie' };
const RAINY = new Set(['pluie', 'orage']);
function baseOf(day) {
    let r = hash(day, 3);
    for (const [kind, p] of ODDS) {
        if (r < p) return kind;
        r -= p;
    }
    return 'clair';
}
// Temps d'un créneau de 6 h (slot : 0 à 3) du jour day (jours depuis le 1er janvier 2026)
function slotKind(day, slot) {
    const base = baseOf(day);
    return hash(day, 11 + slot) < 0.68 ? base : TURNS[base];
}

// Le temps qu'il fait à un instant (le créneau de 6 h de l'horloge du jeu, sans les transitions que le jeu adoucit), et
// s'il pleut
function kindAt(ms) {
    const { day, hour } = clock.dayHourOf(ms);
    return slotKind(day, Math.floor(hour / SLOT_H));
}
const rainAt = ms => RAINY.has(kindAt(ms));

module.exports = { slotKind, kindAt, rainAt };
