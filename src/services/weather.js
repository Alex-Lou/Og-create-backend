// La météo de l'île, comme le jeu la montre (src/world/sky.js du front : même graine, mêmes créneaux de 6 h) : le
// temps d'un créneau se déduit de la date seule, sans état. Ici, à l'heure de Paris (celle des nuits : nights.js) ;
// les nuits n'en lisent que la pluie (choix de l'auteur, 14 oct. : sous la pluie, le feu de camp porte moins loin)
const DAY_MS = 86400000;
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

// L'heure de Paris d'un instant, lue comme une date UTC (ses champs sont ceux de Paris)
const PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
function parisOf(ms) {
    const p = Object.fromEntries(PARIS.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
    return { day: Math.round((Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - Date.UTC(2026, 0, 1)) / DAY_MS), hour: Number(p.hour) };
}
// Le temps qu'il fait à un instant (le créneau, sans les transitions que le jeu adoucit), et s'il pleut
function kindAt(ms) {
    const { day, hour } = parisOf(ms);
    return slotKind(day, Math.floor(hour / SLOT_H));
}
const rainAt = ms => RAINY.has(kindAt(ms));

module.exports = { slotKind, kindAt, rainAt };
