// Les quêtes de Brume, le feu follet qui garde le Grimoire : une seule chaîne, du prologue (le naufrage de
// l'Hirondelle, acte T) aux sept actes (les chapitres du Grimoire), une quête active à la fois. C'est la chaîne de la
// bible (HISTOIRE.md du dépôt front, § 9 et § 10). L'avancée se lit dans l'état de l'île et du Grimoire (rien de plus
// à suivre) ; seule la réclamation s'écrit (world_quests). Fonctions pures, sans base de données.
//
// Objectifs (goal) et ce qu'ils lisent (facts, réunis par services/world.js) :
// - crafts : créations d'île posées ; craft : une création précise posée ; runs : Récoltes terminées ;
// - stars : découvertes du Grimoire ; element : un élément écrit (ou l'un de any : une bête du Bestiaire) ;
// - zone : quartier à soi ; level : palier d'un bâtiment ; annex : annexes posées ; house : maisons posées ;
// - need : un besoin (what) d'un habitant comblé, en ce moment ou depuis l'ouverture de la quête ;
// - wake : un habitant réveillé (amitié > 0) ; heart : un cœur ;
// - expedition : expéditions revenues ; landmark : lieux découverts (ou un lieu précis) ; gather : gisements ramassés ;
// - pickup : trouvailles de la plage de Brumelune ramassées (bois flotté, galets, coquillages : services/pickups.js) ;
// - hens : poules d’Agathe nourries et encore rassasiées ; crate : la caisse d'un personnage ouverte (world/chests.js) ;
// - settle : habitants venus d'ailleurs (arrivants accueillis, visiteurs installés d'avant) ; name : le peuple a un nom.
// chest : la dernière quête des actes donne aussi un coffre de cette rareté (loot.js), à ouvrir une fois réclamée.
//
// Joueurs d'avant la chaîne de la bible : une quête placée avant la plus avancée déjà réclamée compte comme faite
// (sans récompense) ; les anciennes quêtes (LEGACY) se rangent à leur place dans la nouvelle chaîne, et leurs coffres
// encore fermés restent dus. Un joueur ne recule donc jamais.

const { QUEST_TEXTS, LEGACY_LABELS, PHARE_GOAL } = require('../texts/quests');

// Les bêtes du Bestiaire (éléments du Grimoire, § 1.2 de la bible)
const BEASTS = ['Poisson', 'Méduse', 'Grenouille', 'Oiseau', 'Tortue', 'Papillon', 'Poule', 'Luciole', 'Abeille', 'Hibou', 'Renard',
    'Hérisson', 'Écureuil', 'Cerf', 'Vache', 'Cochon', 'Chèvre', 'Dauphin', 'Baleine', 'Mouton', 'Chat', 'Chien'];

// (son titre et ce qu'en dit Brume : texts/quests.js)
const q = (id, act, goal, coins, chest) => ({ id, act, goal, coins, ...QUEST_TEXTS[id], ...(chest ? { chest } : {}) });
// Les piquets de la barrière du nord, en travers du passage des égarés, à deux cases du Feu (choix de l'auteur, 19 oct. :
// une barrière, pas un enclos ; un hameau, pas un silo)
const BARRIER = 7;
const QUESTS = [
    // Prologue : Brume accompagne une action à la fois jusqu'à la première nuit. Lorena ouvre ensuite sa propre leçon
    // par la Récolte.
    q('pages', 'T', { kind: 'element', element: 'Vent' }, 20),
    q('ramasser', 'T', { kind: 'pickup', need: 3 }, 10),
    // Le premier feu est réellement bâti avec les trouvailles ; c'est le Foyer au palier I.
    q('feu', 'T', { kind: 'level', site: 'foyer', need: 1 }, 15),
    // La première nuit (choix de l'auteur, 9 oct.) : seul avec Brume, sans personne d'autre, avant l'arrivée de Lorena au
    // matin. Une étape de respiration, sans écus : on explore, puis on dort (world.sleep).
    q('nuit', 'T', { kind: 'sleep', site: 'foyer' }, 0),
    // Le jour de Lorena (choix de l'auteur, 11 oct. : un vrai parcours, pas expédié) : sa scène au réveil, sa caisse
    // échouée (world/chests.js : CRATES), sa Récolte, son Ponton (le palier I, sans plan ni quartier sur une île du
    // tutoriel : son carnet de quart en tient lieu, world.js : tutorialPonton), puis sa longue-vue au couchant
    q('caisse', 'T', { kind: 'crate', crate: 'aster' }, 10),
    q('recolte', 'T', { kind: 'runs', need: 1 }, 15),
    q('premier-ponton', 'T', { kind: 'level', site: 'ponton', need: 1 }, 15),
    // (le premier chemin, entre son camp et le nôtre : se rapprocher pour s'entraider ; les premières pierres offertes,
    // world/paths.js : FREE)
    q('chemin-aster', 'T', { kind: 'link', from: 'ponton', to: 'foyer' }, 15),
    // La deuxième nuit (choix de l'auteur, 10 oct. : un personnage par jour) : la journée de Lorena finit autour du feu ;
    // Agathe arrivera au matin
    q('veille', 'T', { kind: 'sleep', site: 'foyer' }, 0),
    q('soupe', 'T', { kind: 'need', villager: 'foyer', what: 'manger' }, 15),
    // Le jour d’Agathe (choix de l'auteur, 11 oct.) : la cage de ses poules arrive par la mer, au bout de la plage ; on
    // l'ouvre, on attrape les poules (le jeu), on les nourrit toutes les trois ; puis leur poulailler, sa leçon à elle
    // (poser une annexe) ; et la troisième nuit, avant Nathan. (Les œufs viendront plus tard, avec le coq.)
    q('cage', 'T', { kind: 'cage' }, 10),
    q('poules', 'T', { kind: 'hens', need: 3 }, 10),
    q('poulailler', 'T', { kind: 'coop' }, 15),
    // L'abri d’Agathe (choix de l'auteur, 13 oct.) : son coin passe des débris à l'abri (payé : world/shelters.js)
    q('abri-cannelle', 'T', { kind: 'shelter', who: 'cannelle', villager: 'foyer' }, 15),
    q('nuit-cannelle', 'T', { kind: 'sleep', site: 'foyer' }, 0),
    // (il s'installe d'abord dans son coin : son abri, bâti et payé comme celui d’Agathe, world/shelters.js ; choix de
    // l'auteur, 18 oct. : la lanterne attendra l'électricité. L'identifiant « deco » reste : LEGACY, creations.js)
    q('deco', 'T', { kind: 'shelter', who: 'rivet', villager: 'atelier' }, 15),
    // La barrière du nord (choix de l'auteur, 19 oct. ; au jour de Nathan depuis le 26 oct., avec ses torches : les
    // défenses qu'on fabrique, et le jour d’Agathe allégé) : la nuit d'avant, le Dormeur, que la lumière n'arrête pas,
    // est venu dormir contre le feu, et les poules filent vers la brume ; ses piquets, dans la caisse de Lorena
    // (world/chests.js, CRATES) ; une clôture barre la route d'un égaré (nights.js)
    q('barriere', 'T', { kind: 'craft', craft: 'cloture', need: BARRIER }, 15),
    // (ses trois torches, une par côté d'où venaient les égarés de la veillée : choix de l'auteur, 13 oct.)
    q('torches-rivet', 'T', { kind: 'craft', craft: 'torche', need: 3 }, 15),
    // (son premier outil, choix de l'auteur, 18 oct. : la Canne à pêche de la boutique du Ponton, qui produit plus)
    q('outil-rivet', 'T', { kind: 'item', item: 'canne' }, 15),
    // La quatrième nuit (choix de l'auteur, 13 oct. : chaque personnage son jour, le suivant quand le joueur choisit de
    // dormir) : le jour de Nathan finit autour du feu ; Léo sera trouvé au matin
    q('nuit-rivet', 'T', { kind: 'sleep', site: 'foyer' }, 0),
    q('eveil-ondin', 'T', { kind: 'wake', villager: 'puits' }, 10),
    q('souvenir-ondin', 'T', { kind: 'element', element: 'Pluie' }, 20),
    q('puits-ondin', 'T', { kind: 'level', site: 'puits', need: 1 }, 40, 'rare'),
    // Acte I : la Vie et la lumière (Maerys). D'abord le premier chemin (choix de l'auteur, 8 oct. : l'île neuve n'a que
    // son sentier ; ses cases offertes le paient)
    q('chemin', 'I', { kind: 'link', from: 'puits', to: 'foyer' }, 15),
    q('lisiere', 'I', { kind: 'zone', zone: 'lisiere' }, 50),
    q('eveil-sylve', 'I', { kind: 'wake', villager: 'bosquet' }, 10),
    q('vie', 'I', { kind: 'element', element: 'Vie' }, 40),
    q('souvenir-sylve', 'I', { kind: 'element', element: 'Arbre' }, 20),
    q('bosquet', 'I', { kind: 'level', site: 'bosquet', need: 1 }, 40),
    q('lumiere', 'I', { kind: 'element', element: 'Lumière' }, 40),
    q('lanterne', 'I', { kind: 'craft', craft: 'lanterne' }, 60, 'rare'),
    // Acte II : la matière, s'abriter (Robby)
    q('colline', 'II', { kind: 'zone', zone: 'colline' }, 80),
    q('eveil-galet', 'II', { kind: 'wake', villager: 'carriere' }, 10),
    q('souvenir-galet', 'II', { kind: 'element', element: 'Pierre' }, 20),
    q('carriere', 'II', { kind: 'level', site: 'carriere', need: 1 }, 40),
    q('bois', 'II', { kind: 'element', element: 'Bois' }, 40),
    q('cabane', 'II', { kind: 'level', site: 'foyer', need: 2 }, 70, 'rare'),
    // Acte III : se nourrir, explorer (Maggy, la forge de Nathan)
    // L'annexe vient après l'Abri : il faut un bâtiment au palier II (bible, mises à jour du lot H1)
    q('annexe', 'III', { kind: 'annex', need: 1 }, 50),
    q('jardins', 'III', { kind: 'zone', zone: 'jardins' }, 110),
    q('eveil-melisse', 'III', { kind: 'wake', villager: 'potager' }, 10),
    q('potager', 'III', { kind: 'level', site: 'potager', need: 1 }, 50),
    q('faubourg', 'III', { kind: 'zone', zone: 'est' }, 120),
    q('atelier', 'III', { kind: 'level', site: 'atelier', need: 1 }, 60),
    q('etoile', 'III', { kind: 'element', element: 'Étoile' }, 50),
    q('hauteurs', 'III', { kind: 'zone', zone: 'hauteurs' }, 60),
    q('expedition', 'III', { kind: 'expedition', need: 1 }, 60),
    q('ruine', 'III', { kind: 'landmark', need: 1 }, 60),
    q('village', 'III', { kind: 'element', element: 'Village' }, 80, 'epique'),
    // Acte IV : le vivant, s'ouvrir aux autres (Lorena reprend la mer, les bêtes, les voyageurs)
    q('crique', 'IV', { kind: 'zone', zone: 'crique' }, 160),
    q('souvenir-aster', 'IV', { kind: 'element', element: 'Bateau' }, 30),
    // (le Ponton I se bâtit au jour de Lorena : l'acte IV en fait un port de pêche, choix de l'auteur, 11 oct.)
    q('ponton-aster', 'IV', { kind: 'level', site: 'ponton', need: 2 }, 80),
    q('bete', 'IV', { kind: 'element', any: BEASTS }, 50),
    // (la maison d'abord : le premier arrivant vient au Ponton II et s'installe dans une maison libre ; choix de l'auteur,
    // 18 oct.)
    q('une-maison', 'IV', { kind: 'house', need: 1 }, 100),
    q('voyageur', 'IV', { kind: 'settle', need: 1 }, 80),
    q('coeur', 'IV', { kind: 'heart', need: 1 }, 60),
    q('trouvaille', 'IV', { kind: 'gather', need: 1 }, 60),
    q('serre', 'IV', { kind: 'level', site: 'potager', need: 2 }, 120, 'epique'),
    // Acte V : le foyer, se nommer (les voyageurs restent, le goût d’Agathe)
    q('maison', 'V', { kind: 'level', site: 'foyer', need: 3 }, 150),
    q('installe', 'V', { kind: 'settle', need: 2 }, 120),
    q('hameau', 'V', { kind: 'zone', zone: 'hameau' }, 220),
    // (le Remède, et non la Potion des Légendes : la clé de la Maison de l'alchimiste, choix de l'auteur, 12 oct.)
    q('potion', 'V', { kind: 'element', element: 'Remède' }, 80),
    q('alchimiste', 'V', { kind: 'level', site: 'foyer', need: 4 }, 200),
    q('peuple', 'V', { kind: 'name' }, 100, 'legendaire'),
    // Acte VI : les âges, se souvenir (les Anciens, la clé du phare, le Phénix)
    q('phare', 'VI', { kind: 'zone', zone: 'phare' }, 300),
    q('ecriture', 'VI', { kind: 'element', element: 'Écriture' }, 100),
    q('cle', 'VI', { kind: 'landmark', landmark: 'menhirs' }, 100),
    q('tour', 'VI', { kind: 'level', site: 'foyer', need: 5 }, 250),
    q('civilisation', 'VI', { kind: 'element', element: 'Civilisation' }, 150),
    q('phenix', 'VI', { kind: 'element', element: 'Phénix' }, 200, 'legendaire'),
    // Acte VII : les légendes, guider (le Passeur, la recette de Brume, le Phare)
    q('ile-legendes', 'VII', { kind: 'zone', zone: 'legendes' }, 300),
    q('feu-follet', 'VII', { kind: 'element', element: 'Feu follet' }, 200),
    q('phare-brume', 'VII', { kind: 'level', site: 'foyer', need: 7 }, 500, 'legendaire')
];
const INDEX = new Map(QUESTS.map((quest, i) => [quest.id, i]));
// Les articles de boutique que demandent les quêtes (objectif « item ») : ce que l'état en lit (services/world.js)
const ITEMS = QUESTS.filter(quest => quest.goal.kind === 'item').map(quest => quest.goal.item);

// Anciennes quêtes (avant la chaîne de la bible) : où elles se rangent dans la nouvelle chaîne (les mêmes identifiants
// s'y rangent tout seuls), et leurs coffres. Une ancienne quête réclamée vaut celle-ci comme « plus avancée ».
const LEGACY = {
    // (à la quatrième nuit, ajoutée après elle le 13 oct. : ces comptes trouvent Léo comme avant, sans dormir de plus)
    source: { at: 'nuit-rivet', label: LEGACY_LABELS.source, chest: 'rare' },
    // (l'enclos du Feu et ses portes, au jour de Lorena ; l'enclos d’Agathe : retirés le 19 oct., la barrière du nord les
    // remplace, au jour d’Agathe)
    clotures: { at: 'chemin-aster', label: LEGACY_LABELS.clotures },
    portes: { at: 'chemin-aster', label: LEGACY_LABELS.portes },
    'enclos-cannelle': { at: 'abri-cannelle', label: LEGACY_LABELS['enclos-cannelle'] },
    puits: { at: 'puits-ondin', label: LEGACY_LABELS.puits },
    livre5: { at: 'cabane', label: LEGACY_LABELS.livre5 },
    mine: { at: 'cabane', label: LEGACY_LABELS.mine, chest: 'epique' },
    livre12: { at: 'cabane', label: LEGACY_LABELS.livre12 },
    ponton: { at: 'ponton-aster', label: LEGACY_LABELS.ponton, chest: 'epique' },
    livre45: { at: 'maison', label: LEGACY_LABELS.livre45 },
    deco10: { at: 'hameau', label: LEGACY_LABELS.deco10, chest: 'legendaire' },
    livre70: { at: 'phare', label: LEGACY_LABELS.livre70 },
    legendes: { at: 'ile-legendes', label: LEGACY_LABELS.legendes, chest: 'legendaire' }
};
// Toutes les quêtes à coffre, nouvelles et anciennes : [{ id, label, chest }]
const QUEST_CHESTS = [
    ...QUESTS.filter(quest => quest.chest),
    ...Object.entries(LEGACY).filter(([, old]) => old.chest).map(([id, old]) => ({ id, label: old.label, chest: old.chest }))
];

// Place de la quête la plus avancée parmi celles réclamées (−1 : aucune)
function reachOf(claimed) {
    let reach = -1;
    for (const id of claimed) {
        const at = INDEX.has(id) ? INDEX.get(id) : LEGACY[id] ? INDEX.get(LEGACY[id].at) : -1;
        reach = Math.max(reach, at);
    }
    return reach;
}
// Quêtes faites : réclamées, ou placées avant la plus avancée réclamée. Set des identifiants
function doneOf(claimed) {
    const reach = reachOf(claimed);
    return new Set(QUESTS.filter((quest, i) => i <= reach || claimed.has(quest.id)).map(quest => quest.id));
}

// La première nuit est validée côté serveur quand la Récolte de Lorena a été réclamée : le feu a donc été bâti,
// la nuit jouée et Lorena rencontrée. Les anciennes quêtes plus avancées comptent aussi, via doneOf.
const FIRST_NIGHT_DONE = 'recolte';
const firstNightDoneOf = claimed => doneOf(claimed).has(FIRST_NIGHT_DONE);

// La quête active (la première pas encore faite), telle que la chaîne la définit, ou null
function currentOf(claimed) {
    const done = doneOf(claimed);
    return QUESTS.find(quest => !done.has(quest.id)) || null;
}

// Ce que l'état fournit (services/world.js) : { crafts, runs, stars, zones: Set, levels: { site: palier },
// elements: Set, placed: Set (créations posées), annexes, houses, met: Set ('habitant:besoin' comblés en ce moment ou
// depuis la dernière quête réclamée), awake: Set, hearts (cœurs du meilleur ami), expeditions, landmarks: Set,
// gathered, settled, named, items: Set (articles de boutique possédés : ITEMS), links: Set ('puits-foyer' : bâtiments reliés
// par un chemin) }
// Quêtes du tutoriel qui passent par le Grimoire : la page que marque le ruban a son Encre offerte (le joueur, qui a
// peu d'écus, n'est jamais bloqué devant une énigme) : le Puits de Léo, dont la Boue (Eau + Terre), la première
// recette à deux ingrédients différents. Pas le Brasier (Feu + Feu : l'énigme suffit, choix de l'auteur, 12 oct.)
const GUIDED_INK = new Set(['souvenir-ondin']);

const HAVE = {
    crafts: (goal, facts) => facts.crafts,
    // (need : combien de cette création posées ; une seule par défaut)
    craft: (goal, facts) => (goal.need ? (facts.placedCount[goal.craft] || 0) : facts.placed.has(goal.craft) ? 1 : 0),
    runs: (goal, facts) => facts.runs,
    stars: (goal, facts) => facts.stars,
    element: (goal, facts) => ((goal.any || [goal.element]).some(name => facts.elements.has(name)) ? 1 : 0),
    zone: (goal, facts) => (facts.zones.has(goal.zone) ? 1 : 0),
    level: (goal, facts) => facts.levels[goal.site] || 0,
    annex: (goal, facts) => facts.annexes,
    house: (goal, facts) => facts.houses,
    need: (goal, facts) => (facts.met.has(`${goal.villager}:${goal.what}`) ? 1 : 0),
    wake: (goal, facts) => (facts.awake.has(goal.villager) ? 1 : 0),
    heart: (goal, facts) => facts.hearts,
    expedition: (goal, facts) => facts.expeditions,
    landmark: (goal, facts) => (goal.landmark ? (facts.landmarks.has(goal.landmark) ? 1 : 0) : facts.landmarks.size),
    gather: (goal, facts) => facts.gathered,
    pickup: (goal, facts) => facts.pickups,
    hens: (goal, facts) => facts.hensFed,
    // La cage ouverte (ses poules libérées) ; le poulailler d’Agathe posé
    cage: (goal, facts) => (facts.hensFreed ? 1 : 0),
    coop: (goal, facts) => (facts.coops ? 1 : 0),
    // L'abri d'un coin bâti
    shelter: (goal, facts) => (facts.shelters && facts.shelters.has(goal.who) ? 1 : 0),
    crate: (goal, facts) => (facts.crates.has(goal.crate) ? 1 : 0),
    // Un article de boutique possédé (facts.items : ceux que nomment les quêtes, ITEMS)
    item: (goal, facts) => (facts.items.has(goal.item) ? 1 : 0),
    settle: (goal, facts) => facts.settled,
    // Dormir n'est pas un objectif à compter : la première nuit se passe par world.sleep, jamais par une réclamation
    sleep: () => 0,
    name: (goal, facts) => (facts.named ? 1 : 0),
    link: (goal, facts) => (facts.links && facts.links.has(`${goal.from}-${goal.to}`) ? 1 : 0)
};

// Avancée d'un objectif : { have, need } (have plafonné à need)
function progressOf(goal, facts) {
    const need = goal.need ?? 1;
    return { have: Math.min(need, HAVE[goal.kind](goal, facts)), need };
}

// La quête active (la première de la chaîne pas encore faite) vue par le joueur, ou null si tout est fait.
// kind : le type d'objectif (le front propose l'action qui va avec) ; target : ce que l'objectif désigne sur l'île
// (un bâtiment, un quartier, un habitant ou un lieu), pour y placer Brume ; element : l'élément à écrire (fil d'Ariane)
function active(claimed, facts) {
    const done = doneOf(claimed);
    const step = QUESTS.findIndex(quest => !done.has(quest.id));
    if (step < 0) return null;
    const quest = QUESTS[step];
    const { have, need } = progressOf(quest.goal, facts);
    const { site, zone, villager, landmark, element, craft, from } = quest.goal;
    // (un chemin à tracer : Brume attend au bâtiment d'où il part)
    const target = site ? { site } : zone ? { zone } : villager ? { villager } : landmark ? { landmark } : from ? { site: from } : null;
    return {
        id: quest.id, act: quest.act, step: step + 1, total: QUESTS.length, say: quest.say, label: quest.label, kind: quest.goal.kind,
        coins: quest.coins, chest: quest.chest || null, have, need, done: have >= need, target,
        ...(element ? { element } : {}), ...(craft ? { craft } : {})
    };
}

// Ce que la vue de l'île montre de Brume : la quête active, ou son dernier mot
// Actes finis (leur dernière quête faite), dans l'ordre : les veillées et l'étape de civilisation s'en déduisent
// (bible, § 6.8 et § 6.10), rien n'est stocké
const ACTS = [...new Set(QUESTS.map(quest => quest.act))];
function actsDoneOf(done) {
    return ACTS.filter(act => done.has(QUESTS.filter(quest => quest.act === act).pop().id));
}

// Les étapes du tutoriel (de la première page au premier chemin : le prologue du jeu, game/prologue.js), pour le suivi
// des quêtes : [{ id, label, done }] (done : réclamée)
const TUTORIAL_LAST = 'chemin';
const TUTORIAL = QUESTS.slice(0, INDEX.get(TUTORIAL_LAST) + 1);
function tutorialStepsOf(claimed) {
    const done = doneOf(claimed);
    return TUTORIAL.map(quest => ({ id: quest.id, label: quest.label, done: done.has(quest.id) }));
}
const inTutorial = id => TUTORIAL.some(quest => quest.id === id);

// L'objectif de fond (l'arc du Phare, choix de l'auteur, 15 oct.) : « Rallumer le phare », dès la fin du tutoriel, avec
// l'étape de l'acte en cours (le premier qui n'est pas fini), puis atteint ; rien n'est stocké. { label, act, step } (act
// null une fois atteint), ou null pendant le tutoriel
function goalOf(done) {
    if (!done.has(TUTORIAL_LAST)) return null;
    const finished = actsDoneOf(done);
    const act = ACTS.find(a => a !== 'T' && !finished.includes(a)) || null;
    return { label: PHARE_GOAL.label, act, step: act ? PHARE_GOAL.steps[act] : PHARE_GOAL.done };
}

function boardOf(claimed, facts) {
    const done = doneOf(claimed);
    return {
        quest: active(claimed, facts), done: QUESTS.filter(quest => done.has(quest.id)).length, total: QUESTS.length, acts: actsDoneOf(done), rested: RESTED,
        goal: goalOf(done)
    };
}
// Début de chaque acte commencé (les mots d'Héliane, bible § 6.13) : l'heure où la dernière quête des actes d'avant a été
// réclamée (0 si rien n'a été réclamé avant lui). rows : [{ quest, at (ms) }]. { acte: ms } pour les actes I à VII
// commencés, dans l'ordre. Une ancienne quête (LEGACY) compte dans l'acte de la quête où elle se range
function actStartsOf(rows) {
    const done = actsDoneOf(doneOf(new Set(rows.map(r => r.quest))));
    const actOf = new Map([
        ...QUESTS.map(quest => [quest.id, quest.act]),
        ...Object.entries(LEGACY).map(([id, old]) => [id, QUESTS[INDEX.get(old.at)].act])
    ]);
    const out = {};
    ACTS.forEach((act, i) => {
        const before = ACTS.slice(0, i);
        if (act === 'T' || !before.every(a => done.includes(a))) return;
        out[act] = Math.max(0, ...rows.filter(r => before.includes(actOf.get(r.quest))).map(r => r.at));
    });
    return out;
}

// Quand tout est fait
const { RESTED } = require('../texts/brume');

module.exports = {
    QUESTS, ITEMS, BARRIER, LEGACY, QUEST_CHESTS, BEASTS, GUIDED_INK, FIRST_NIGHT_DONE,
    TUTORIAL_LAST, reachOf, doneOf, firstNightDoneOf, currentOf, progressOf, active, boardOf, goalOf, actsDoneOf, actStartsOf, tutorialStepsOf,
    inTutorial
};
