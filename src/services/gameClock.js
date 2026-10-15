// L'horloge du jeu (choix de l'auteur, 15 oct.) : la même pour tous, détachée de l'heure réelle. Un cycle d'1 h 30 :
// l'aube (5 min), le jour (60 min : le matin, midi, l'après-midi), le crépuscule (5 min), la nuit (20 min). Sur
// l'horloge de l'île : l'aube va de 6 h à 7 h, le jour de 7 h à 19 h, le crépuscule de 19 h à 21 h, la nuit de 21 h à 6 h.
// Elle mène le ciel, la météo, les nuits et Anya ; la production, les besoins et les bouteilles gardent l'heure réelle.
// Le front fait le même calcul (src/world/gameClock.js du dépôt front).
const MINUTE = 60 * 1000;
const CYCLE_MS = 90 * MINUTE;
// Le premier cycle commence à l'aube du 1er janvier 2026 (minuit UTC)
const EPOCH = Date.UTC(2026, 0, 1);
// Les repères du cycle : [minute du cycle, heure de l'île] ; entre deux repères, l'heure avance d'un pas régulier
const ANCHORS = [[0, 6], [5, 7], [65, 19], [70, 21], [90, 30]];
// Où commencent le crépuscule et la nuit dans le cycle (ms)
const DUSK_MS = 65 * MINUTE;
const NIGHT_MS = 70 * MINUTE;

// Le cycle d'un instant (n° depuis EPOCH), et l'instant où il commence (son aube)
const cycleOf = ms => Math.floor((ms - EPOCH) / CYCLE_MS);
const startOf = cycle => EPOCH + cycle * CYCLE_MS;

// L'heure de l'île à la minute m d'un cycle (6 à 30 : après minuit, 24 de plus)
function hourIn(m) {
    for (let k = 1; k < ANCHORS.length; k++) {
        const [m1, h1] = ANCHORS[k];
        const [m0, h0] = ANCHORS[k - 1];
        if (m <= m1) return h0 + ((m - m0) / (m1 - m0)) * (h1 - h0);
    }
    return ANCHORS[ANCHORS.length - 1][1];
}
// Le jour de l'île (n° depuis EPOCH, il change à minuit) et l'heure (0 à 24) d'un instant
function dayHourOf(ms) {
    const cycle = cycleOf(ms);
    const hours = cycle * 24 + hourIn((ms - startOf(cycle)) / MINUTE);
    const day = Math.floor(hours / 24);
    return { day, hour: hours - day * 24 };
}
// La nuit d'un cycle : { start, end } (instants)
const nightOf = cycle => ({ start: startOf(cycle) + NIGHT_MS, end: startOf(cycle + 1) });

module.exports = { MINUTE, CYCLE_MS, EPOCH, ANCHORS, DUSK_MS, NIGHT_MS, cycleOf, startOf, hourIn, dayHourOf, nightOf };
