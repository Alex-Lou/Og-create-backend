// Anya, la déesse de l'île (HISTOIRE.md du dépôt front, § 4.5, § 6.14 et § 8, v6) : la condition de la Révélation,
// les traces, l'errance et la Bénédiction. Tout se déduit des quartiers à soi (et, pour les traces d'avant la v6, des
// expéditions revenues) ; l'errance se tire d'une graine. Seuls la Révélation vue (une fois) et le Souffle se rangent
// dans world_friends (cible TARGET, sans points), sans migration.
const crypto = require('node:crypto');
const map = require('./worldMap');

// Les huit quartiers du cœur (Brumelune est toujours à soi ; les terres lointaines et les îlots ne comptent pas)
const CORE = ['lisiere', 'colline', 'jardins', 'est', 'hauteurs', 'crique', 'foret', 'hameau'];
// Les douze terres lointaines : elles portaient les traces avant la v6
const LANDS = map.ZONES.filter(zone => zone.trip).map(zone => zone.id);
const TARGET = 'anya';
// La Bénédiction : les gisements repoussent en 4 h au lieu de 6 ; l'humeur ne descend plus sous « content »
const BLESSING = { regrowMs: 4 * 3600 * 1000, moodFloor: 'content' };
// Huit traces, une par quartier du cœur libéré, dans l'ordre : la huitième précède la Révélation
const TRACE_COUNT = 8;

// Le cœur de l'île est libéré : les neuf quartiers sont à soi (owned : Set des quartiers)
const awakeOf = owned => CORE.every(id => owned.has(id));

// owned : Set des quartiers à soi ; explored : terres explorées ; revealed : la Révélation a été vue.
// { traces : [1 … n], awake, revealed }. Les traces de la v5 (une par terre explorée) restent acquises, sans aller
// jusqu'à la huitième, qui reste celle de la Révélation : un joueur ne voit jamais son compte baisser
function stateOf(owned, explored = [], revealed = false) {
    const awake = awakeOf(owned);
    const freed = CORE.filter(id => owned.has(id)).length;
    const before = new Set(explored.filter(id => LANDS.includes(id))).size;
    const count = awake ? TRACE_COUNT : Math.min(Math.max(freed, before), TRACE_COUNT - 1);
    return { traces: Array.from({ length: count }, (_, i) => i + 1), awake, revealed: awake && revealed };
}

// L'errance (v6) : une fois révélée, Anya passe deux ou trois jours par semaine (du lundi au dimanche, jours de
// Paris), à l'aube ou au crépuscule. Les jours, le moment et l'endroit se tirent d'une graine (le joueur, la semaine,
// le jour) : rien n'est stocké, et tous les appareils voient le même passage
const SLOTS = ['aube', 'crepuscule'];
const seedOf = (...parts) => crypto.createHash('sha256').update(parts.join(':')).digest();
// Le lundi de la semaine d'un jour 'AAAA-MM-JJ', et le rang du jour (0 : lundi … 6 : dimanche)
function weekOf(day) {
    const date = new Date(`${day}T12:00:00Z`);
    const rank = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - rank);
    return { monday: date.toISOString().slice(0, 10), rank };
}
// Les passages d'une semaine : [{ rank, slot }], dans l'ordre des jours
function visitsOf(userId, monday) {
    const bytes = seedOf('anya', userId, monday);
    const days = [0, 1, 2, 3, 4, 5, 6];
    for (let i = days.length - 1; i > 0; i--) {
        const j = bytes[i] % (i + 1);
        [days[i], days[j]] = [days[j], days[i]];
    }
    return days.slice(0, 2 + (bytes[7] % 2)).sort((a, b) => a - b).map((rank, k) => ({ rank, slot: SLOTS[bytes[8 + k] % 2] }));
}
// Le passage d'un jour (day : 'AAAA-MM-JJ' de Paris), ou null. places : les endroits possibles, dans un ordre stable,
// chacun avec ses cases ([{ cells: [{ x, y }] }]). { slot, x, y }
function visitOn(userId, day, places) {
    const { monday, rank } = weekOf(day);
    const visit = visitsOf(userId, monday).find(v => v.rank === rank);
    const usable = places.filter(place => place.cells.length);
    if (!visit || !usable.length) return null;
    const bytes = seedOf('anya-lieu', userId, day);
    const place = usable[bytes[0] % usable.length];
    const cell = place.cells[bytes[1] % place.cells.length];
    return { slot: visit.slot, x: cell.x, y: cell.y };
}
// Le moment de son passage ce jour-là ('aube' ou 'crepuscule'), ou null (sans chercher où)
const slotOn = (userId, day) => {
    const { monday, rank } = weekOf(day);
    return visitsOf(userId, monday).find(v => v.rank === rank)?.slot || null;
};
// Anya passe-t-elle ce jour-là ?
const visitsOn = (userId, day) => slotOn(userId, day) !== null;

// L'humeur sous la Bénédiction : jamais sous « content »
const blessedMood = mood => (mood === 'triste' ? BLESSING.moodFloor : mood);

module.exports = { CORE, LANDS, TARGET, BLESSING, TRACE_COUNT, SLOTS, awakeOf, stateOf, weekOf, visitsOf, visitOn, slotOn, visitsOn, blessedMood };
