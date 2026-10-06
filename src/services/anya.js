// Anya, l'Âme de l'Île (HISTOIRE.md du dépôt front, § 4.5, § 6.14 et § 8) : la condition de la Révélation, les traces
// et la Bénédiction. Tout se déduit des quartiers à soi et des expéditions revenues. Seuls la Révélation vue (une fois)
// et le Souffle du jour se rangent dans world_friends (cible TARGET, sans points), sans migration.
const map = require('./worldMap');

// Les neuf quartiers du cœur (la Grève est toujours à soi ; les îlots ne comptent pas)
const CORE = ['source', 'lisiere', 'colline', 'jardins', 'est', 'hauteurs', 'crique', 'foret', 'hameau'];
// Les douze terres nouvelles : une trace chacune, au retour de leur expédition
const LANDS = map.ZONES.filter(zone => zone.trip).map(zone => zone.id);
const TARGET = 'anya';
// La Bénédiction : les gisements repoussent en 4 h au lieu de 6 ; l'humeur ne descend plus sous « content »
const BLESSING = { regrowMs: 4 * 3600 * 1000, moodFloor: 'content' };

// owned : Set des quartiers à soi ; explored : terres explorées, dans l'ordre de leur retour ; revealed : la Révélation
// a été vue. { traces, awake (toute l'île principale est découverte), revealed }
function stateOf(owned, explored, revealed = false) {
    const traces = [...new Set(explored)].filter(id => LANDS.includes(id));
    const awake = LANDS.every(id => traces.includes(id)) && CORE.every(id => owned.has(id));
    return { traces, awake, revealed: awake && revealed };
}

// L'humeur sous la Bénédiction : jamais sous « content »
const blessedMood = mood => (mood === 'triste' ? BLESSING.moodFloor : mood);

module.exports = { CORE, LANDS, TARGET, BLESSING, stateOf, blessedMood };
