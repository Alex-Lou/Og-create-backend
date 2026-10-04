// Les quêtes de Brume, l'esprit de la brume, mémoire de l'île : une seule chaîne en sept actes (les chapitres du
// Livre), une quête active à la fois. L'avancée se lit dans l'état de l'île et du Livre (rien de plus à suivre) ;
// seule la réclamation s'écrit (world_quests). Fonctions pures, sans base de données.
//
// Objectifs (goal) : tiles (décorations posées), runs (récoltes terminées), stars (découvertes du Livre),
// zone (quartier acheté), level (palier d'un bâtiment). Chaque objectif est atteignable quand sa quête devient
// active : le bâtiment demandé est dans un quartier déjà acheté, le chapitre demandé déjà ouvert.
const QUESTS = [
    { id: 'deco', act: 'I', goal: { kind: 'tiles', need: 1 }, coins: 20, label: 'Pose une décoration sur l’île',
        say: 'Je suis Brume, la mémoire de cette île. La brume l’a recouverte quand le dernier alchimiste est parti. Pose un élément de ton Livre sur une case d’herbe : la vie revient où l’on crée.' },
    { id: 'recolte', act: 'I', goal: { kind: 'runs', need: 1 }, coins: 25, label: 'Termine une Récolte',
        say: 'Une île se bâtit de pierre, de bois et d’eau. Lance une Récolte et rapporte ce que tu trouves.' },
    { id: 'source', act: 'I', goal: { kind: 'zone', zone: 'source' }, coins: 40, label: 'Achète La Source',
        say: 'J’entends de l’eau sous la brume, au nord-ouest. Achète La Source : je la dissiperai pour toi.' },
    { id: 'puits', act: 'II', goal: { kind: 'level', site: 'puits', need: 1 }, coins: 40, label: 'Construis le Puits',
        say: 'Une source ne sert à rien sans puits. Creuse-le, et l’eau ne manquera plus.' },
    { id: 'lisiere', act: 'II', goal: { kind: 'zone', zone: 'lisiere' }, coins: 50, label: 'Achète La Lisière',
        say: 'Plus à l’ouest, des arbres attendent sous la brume. Achète La Lisière.' },
    { id: 'cabane', act: 'II', goal: { kind: 'level', site: 'foyer', need: 2 }, coins: 60, label: 'Bâtis la Cabane',
        say: 'Un feu, c’est bien ; un toit, c’est mieux. Fais de ton Foyer une Cabane.' },
    { id: 'livre5', act: 'III', goal: { kind: 'stars', need: 5 }, coins: 60, label: 'Inscris 5 découvertes au Livre',
        say: 'Ton Livre est la clé de l’île : chaque découverte repousse la brume. Inscris-en cinq, le chapitre III s’ouvrira.' },
    { id: 'colline', act: 'III', goal: { kind: 'zone', zone: 'colline' }, coins: 80, label: 'Achète La Colline',
        say: 'Au nord-est, une falaise cache une fissure. Achète La Colline : la roche a des choses à te dire.' },
    { id: 'mine', act: 'III', goal: { kind: 'level', site: 'carriere', need: 2 }, coins: 90, label: 'Ouvre la Mine',
        say: 'La fissure est devenue carrière. Creuse plus loin : ouvre la Mine.' },
    { id: 'livre12', act: 'IV', goal: { kind: 'stars', need: 12 }, coins: 100, label: 'Inscris 12 découvertes au Livre',
        say: 'Je sens le vivant qui s’éveille. À douze découvertes, le chapitre IV s’ouvrira.' },
    { id: 'jardins', act: 'IV', goal: { kind: 'zone', zone: 'jardins' }, coins: 110, label: 'Achète Les Jardins',
        say: 'La terre noire du nord n’attend que des graines. Achète Les Jardins.' },
    { id: 'serre', act: 'IV', goal: { kind: 'level', site: 'potager', need: 2 }, coins: 120, label: 'Bâtis la Serre',
        say: 'Sous le verre, tout pousse plus vite. Fais de ton Potager une Serre.' },
    { id: 'maison', act: 'V', goal: { kind: 'level', site: 'foyer', need: 3 }, coins: 150, label: 'Bâtis la Maison',
        say: 'Ton île devient un foyer. Bâtis la Maison : on y verra de la lumière la nuit.' },
    { id: 'crique', act: 'V', goal: { kind: 'zone', zone: 'crique' }, coins: 160, label: 'Achète La Crique',
        say: 'Au nord-est, une crique abritée. On dit que des dauphins y viennent quand la brume s’en va.' },
    { id: 'ponton', act: 'V', goal: { kind: 'level', site: 'ponton', need: 1 }, coins: 170, label: 'Construis le Ponton',
        say: 'Un ponton, et la mer devient un chemin. Construis-le dans la crique.' },
    { id: 'livre45', act: 'VI', goal: { kind: 'stars', need: 45 }, coins: 200, label: 'Inscris 45 découvertes au Livre',
        say: 'Le temps reprend son cours. À quarante-cinq découvertes, le chapitre des Âges s’ouvrira.' },
    { id: 'hameau', act: 'VI', goal: { kind: 'zone', zone: 'hameau' }, coins: 220, label: 'Achète Le Hameau',
        say: 'Des toits dorment sous la brume, à l’est. Achète Le Hameau : une baleine passe parfois au large.' },
    { id: 'deco10', act: 'VI', goal: { kind: 'tiles', need: 10 }, coins: 240, label: 'Pose 10 décorations',
        say: 'Une île vit de ce qu’on y pose. Dix décorations, et elle aura ton visage.' },
    { id: 'phare', act: 'VII', goal: { kind: 'zone', zone: 'phare' }, coins: 300, label: 'Achète L’Îlot du Phare',
        say: 'Un îlot, une tour, une lumière éteinte. Achète L’Îlot du Phare : les méduses danseront la nuit.' },
    { id: 'livre70', act: 'VII', goal: { kind: 'stars', need: 70 }, coins: 350, label: 'Inscris 70 découvertes au Livre',
        say: 'Il ne reste qu’un voile : celui des légendes. À soixante-dix découvertes, le dernier chapitre s’ouvrira.' },
    { id: 'legendes', act: 'VII', goal: { kind: 'zone', zone: 'legendes' }, coins: 500, label: 'Achète L’Île des Légendes',
        say: 'Voici la dernière brume, et la plus ancienne. Achète L’Île des Légendes, et je pourrai enfin me reposer.' }
];
// Quand tout est fait
const RESTED = 'La brume s’est levée sur toute l’île. Merci, alchimiste : elle est de nouveau vivante.';

// Ce que l'état fournit : { tiles, runs, stars, zones: Set, levels: { site: palier } }
const HAVE = {
    tiles: (goal, facts) => facts.tiles,
    runs: (goal, facts) => facts.runs,
    stars: (goal, facts) => facts.stars,
    zone: (goal, facts) => (facts.zones.has(goal.zone) ? 1 : 0),
    level: (goal, facts) => facts.levels[goal.site] || 0
};

// Avancée d'un objectif : { have, need } (have plafonné à need)
function progressOf(goal, facts) {
    const need = goal.need ?? 1;
    return { have: Math.min(need, HAVE[goal.kind](goal, facts)), need };
}

// La quête active (la première de la chaîne pas encore réclamée) vue par le joueur, ou null si tout est fait.
// target : ce que l'objectif désigne sur l'île (un bâtiment ou un quartier), pour y placer Brume
function active(claimed, facts) {
    const step = QUESTS.findIndex(q => !claimed.has(q.id));
    if (step < 0) return null;
    const quest = QUESTS[step];
    const { have, need } = progressOf(quest.goal, facts);
    const { site, zone } = quest.goal;
    return {
        id: quest.id, act: quest.act, step: step + 1, total: QUESTS.length, say: quest.say, label: quest.label,
        coins: quest.coins, have, need, done: have >= need, target: site ? { site } : zone ? { zone } : null
    };
}

// Ce que la vue de l'île montre de Brume : la quête active, ou son dernier mot
function boardOf(claimed, facts) {
    return { quest: active(claimed, facts), done: QUESTS.filter(q => claimed.has(q.id)).length, total: QUESTS.length, rested: RESTED };
}

module.exports = { QUESTS, progressOf, active, boardOf };
