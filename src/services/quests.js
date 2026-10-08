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
// - pickup : trouvailles de la Grève ramassées (bois flotté, coquillages, galets : services/pickups.js) ;
// - hens : poules de Cannelle nourries et encore rassasiées ;
// - visitor : voyageurs comblés ; settle : voyageurs installés ; name : le peuple a un nom.
// chest : la dernière quête des actes donne aussi un coffre de cette rareté (loot.js), à ouvrir une fois réclamée.
//
// Joueurs d'avant la chaîne de la bible : une quête placée avant la plus avancée déjà réclamée compte comme faite
// (sans récompense) ; les anciennes quêtes (LEGACY) se rangent à leur place dans la nouvelle chaîne, et leurs coffres
// encore fermés restent dus. Un joueur ne recule donc jamais.

// Les bêtes du Bestiaire (éléments du Grimoire, § 1.2 de la bible)
const BEASTS = ['Poisson', 'Méduse', 'Grenouille', 'Oiseau', 'Tortue', 'Papillon', 'Poule', 'Luciole', 'Abeille', 'Hibou', 'Renard',
    'Hérisson', 'Écureuil', 'Cerf', 'Vache', 'Cochon', 'Chèvre', 'Dauphin', 'Baleine', 'Mouton', 'Chat', 'Chien'];

const q = (id, act, goal, coins, label, say, chest) => ({ id, act, goal, coins, label, say, ...(chest ? { chest } : {}) });
const QUESTS = [
    // Prologue : le naufrage de l'Hirondelle (Brume, Aster, Cannelle, Rivet, Ondin). Ses écus, jusqu'à La Source, en
    // paient le prix (100), pas plus ; au tutoriel, La Source se découvre en écrivant la Source (world.ZONE_PLANS)
    q('pages', 'T', { kind: 'stars', need: 3 }, 20, 'Écris tes trois premières pages',
        'Trois pages, et le Grimoire te fera confiance… Mets deux Souffles dans l’Athanor, lis l’énigme, puis devine.'),
    // (v6, § 9, étape 4 : la mer rend ce qu'elle a pris ; trois trouvailles de la Grève ramassées)
    q('ramasser', 'T', { kind: 'pickup', need: 3 }, 10, 'Ramasse ce que la mer a rendu',
        'Du bois, là, sur le sable. Ça brûle, le bois, je m’en souviens. Et ces coquillages… vous mangez ça, non ? Ramasse trois choses au rivage.'),
    q('recolte', 'T', { kind: 'runs', need: 1 }, 15, 'Termine une Récolte',
        'La mer rend ce qu’elle a pris. Aster t’attend au rivage : relie ce qui se ressemble, vite, avant la marée.'),
    // (v6, étape 5 : le premier feu, bâti avec ce qu'on a ramassé ; c'est le Foyer au palier I, et il attire Cannelle)
    q('feu', 'T', { kind: 'level', site: 'foyer', need: 1 }, 15, 'Allume le Feu de camp',
        'Ceux d’avant faisaient un cercle de pierres, et le bois au milieu. Bâtis le feu de camp : ton bois flotté et tes galets suffiront.'),
    q('soupe', 'T', { kind: 'need', villager: 'foyer', what: 'manger' }, 15, 'Une soupe pour Cannelle',
        'Cannelle grelotte… Sa bulle dit ce qui lui manque. Donne-lui de quoi manger, depuis sa fiche.'),
    // (v6, étape 8 : les poules de la cuisine du navire, coincées sous les rochers ; nourries, elles pondent)
    q('poules', 'T', { kind: 'hens', need: 1 }, 10, 'Nourris les poules',
        'Des caquets, sous les rochers… La cage du navire ! Ouvre-la, puis nourris les poules depuis leur fiche.'),
    q('deco', 'T', { kind: 'crafts', need: 1 }, 15, 'Pose ta première création sur l’île',
        'Rivet a monté un établi près du feu. Assemble une Clôture, puis pose-la là où l’île brille d’or.'),
    q('achat-source', 'T', { kind: 'zone', zone: 'source' }, 30, 'Achète La Source',
        'J’entends de l’eau, au nord-ouest… et quelqu’un qui ronfle. Achète La Source : je dissiperai la brume.'),
    q('eveil-ondin', 'T', { kind: 'wake', villager: 'puits' }, 10, 'Réveille Ondin',
        'Un petit dort contre un rocher, sa baguette à la main. Parle-lui doucement : la brume endort, sans faire de mal.'),
    q('souvenir-ondin', 'T', { kind: 'element', element: 'Puits' }, 20, 'Rends son don à Ondin : écris le Puits',
        'Sa baguette ne trouve plus rien. Le Grimoire s’en souvient pour lui : la Boue, la Brique, puis le Puits.'),
    q('puits-ondin', 'T', { kind: 'level', site: 'puits', need: 1 }, 40, 'Construis le Puits',
        'Ondin sent l’eau sous ses pieds. Creuse le Puits avec la pierre de la Récolte : l’eau ne manquera plus.', 'rare'),
    // Acte I : la Vie et la lumière (Sylve). D'abord le premier chemin (choix de l'auteur, 8 oct. : l'île neuve n'a que
    // son sentier ; ses cases offertes le paient)
    q('chemin', 'I', { kind: 'link', from: 'puits', to: 'foyer' }, 15, 'Relie le Puits au Feu',
        'Ondin porte l’eau à travers l’herbe mouillée… Trace un chemin du Puits jusqu’au Feu : les premières pierres sont offertes.'),
    q('lisiere', 'I', { kind: 'zone', zone: 'lisiere' }, 50, 'Achète La Lisière',
        'Le bois flotté s’épuise. À l’ouest, des arbres dorment sous la brume… et quelqu’un avec eux. Achète La Lisière.'),
    q('eveil-sylve', 'I', { kind: 'wake', villager: 'bosquet' }, 10, 'Réveille Sylve',
        'Une sauvageonne dort roulée en boule, près d’un radeau brisé. Approche sans bruit, et parle-lui.'),
    q('vie', 'I', { kind: 'element', element: 'Vie' }, 40, 'Écris la Vie',
        'Air, Eau, Feu, Terre… Les quatre Souffles ensemble, dans l’Athanor. Je crois que c’est ça, la Vie.'),
    q('souvenir-sylve', 'I', { kind: 'element', element: 'Arbre' }, 20, 'Rends son souvenir à Sylve : écris l’Arbre',
        'De la Vie naît la Plante, et de la Plante, l’Arbre. Écris-le : Sylve se souviendra de sa forêt.'),
    q('bosquet', 'I', { kind: 'level', site: 'bosquet', need: 1 }, 40, 'Plante le Bosquet',
        'Sylve se souvient ! Plante le Bosquet : elle ramassera le bois mort, sans abattre un seul arbre.'),
    q('lumiere', 'I', { kind: 'element', element: 'Lumière' }, 40, 'Écris la Lumière',
        'Une lumière repousse la brume. Le Feu, et l’Éclair d’un orage… Le Grimoire te mettra sur la voie.'),
    q('lanterne', 'I', { kind: 'craft', craft: 'lanterne' }, 60, 'Allume la première lanterne',
        'Assemble une Lanterne à l’établi et pose-la au bord d’un chemin. Une lumière… Je les compterai toutes.', 'rare'),
    // Acte II : la matière, s'abriter (Galet)
    q('colline', 'II', { kind: 'zone', zone: 'colline' }, 80, 'Achète La Colline',
        'L’orage approche, et l’Abri demande de la pierre. Au nord-est, une fissure… Achète La Colline.'),
    q('eveil-galet', 'II', { kind: 'wake', villager: 'carriere' }, 10, 'Réveille Galet',
        'Un vieil homme dort dans la fissure, son maillet à la main. Il ronfle comme une pierre qui roule.'),
    q('souvenir-galet', 'II', { kind: 'element', element: 'Pierre' }, 20, 'Rends son souvenir à Galet : écris la Pierre',
        'Galet a oublié la pierre. Le Feu et la Terre font la Lave ; l’Air la refroidit… Écris la Pierre.'),
    q('carriere', 'II', { kind: 'level', site: 'carriere', need: 1 }, 40, 'Ouvre la Fissure',
        '« Hm. » Il dit qu’il est prêt à tailler. Ouvre la Fissure : la pierre de l’Abri viendra de là.'),
    q('bois', 'II', { kind: 'element', element: 'Bois' }, 40, 'Écris le Bois',
        'Pour l’Abri, il faut du bois… sans faire pleurer Sylve. L’Arbre et le Métal, peut-être ?'),
    q('cabane', 'II', { kind: 'level', site: 'foyer', need: 2 }, 70, 'Dresse l’Abri avant l’orage',
        'Le ciel gronde déjà. Dresse l’Abri près du feu de camp : il faut tenir, tous ensemble.', 'rare'),
    // Acte III : se nourrir, explorer (Mélisse, la forge de Rivet)
    // L'annexe vient après l'Abri : il faut un bâtiment au palier II (bible, mises à jour du lot H1)
    q('annexe', 'III', { kind: 'annex', need: 1 }, 50, 'Pose une annexe',
        'L’Abri tient ! Un bâtiment grandit aussi par ce qu’on pose autour de lui : dans sa fiche, l’onglet Annexes.'),
    q('jardins', 'III', { kind: 'zone', zone: 'jardins' }, 110, 'Achète Les Jardins',
        'Sept bouches, et la Récolte ne suffit plus. Au nord, une terre noire… et une barque de graines. Achète Les Jardins.'),
    q('eveil-melisse', 'III', { kind: 'wake', villager: 'potager' }, 10, 'Réveille Mélisse',
        'Une jardinière dort sur sa boîte en fer. Réveille-la : ses graines ont de la mémoire, dit-elle.'),
    q('potager', 'III', { kind: 'level', site: 'potager', need: 1 }, 50, 'Bâtis le Potager',
        'Tes pages l’ont réveillée avant toi : elle se souvient déjà de la Plante. Bâtis le Potager.'),
    q('faubourg', 'III', { kind: 'zone', zone: 'est' }, 120, 'Achète Le Faubourg',
        'Rivet rêve d’une vraie forge. « Attends… Non. Si ! » À l’est, Le Faubourg l’attend.'),
    q('atelier', 'III', { kind: 'level', site: 'atelier', need: 1 }, 60, 'Bâtis l’Atelier',
        'La Brique et le Feu font un Four. Bâtis l’Atelier : Rivet forgera les outils de tous.'),
    q('etoile', 'III', { kind: 'element', element: 'Étoile' }, 50, 'Écris l’Étoile',
        'Aster veut explorer, mais la nuit, il faut un guide. Écris l’Étoile : elle tracera la route.'),
    q('hauteurs', 'III', { kind: 'zone', zone: 'hauteurs' }, 60, 'Achète Les Hauteurs',
        'Des Hauteurs, on voit tout le cœur de l’île… et ce qui dort au-delà, dans la brume. C’est de là-haut qu’on partira.'),
    q('expedition', 'III', { kind: 'expedition', need: 1 }, 60, 'Envoie une expédition',
        'Au-delà de nos quartiers, des terres dorment dans la brume. La boussole, en haut : envoie une expédition.'),
    q('ruine', 'III', { kind: 'landmark', need: 1 }, 60, 'Découvre un lieu des Anciens',
        'D’autres ont vécu ici, avant nous. Achète une terre explorée, et touche ce qui y luit.'),
    q('village', 'III', { kind: 'element', element: 'Village' }, 80, 'Écris le Village',
        'Des maisons, des voisins… Notre camp devient un village. Écris-le dans le Grimoire.', 'epique'),
    // Acte IV : le vivant, s'ouvrir aux autres (Aster reprend la mer, les bêtes, les voyageurs)
    q('crique', 'IV', { kind: 'zone', zone: 'crique' }, 160, 'Achète La Crique',
        'Aster veut reprendre la mer. Au nord-est, une crique abritée : on dit que des dauphins y viennent.'),
    q('souvenir-aster', 'IV', { kind: 'element', element: 'Bateau' }, 30, 'Rends son courage à Aster : écris le Bateau',
        '« Je ne sais plus tenir une barre », dit Aster. Le Bois et l’Eau… Écris le Bateau : rends-lui la mer.'),
    q('ponton-aster', 'IV', { kind: 'level', site: 'ponton', need: 1 }, 80, 'Construis le Ponton',
        'Cap sur la crique ! Construis le Ponton : la mer devient un chemin.'),
    q('bete', 'IV', { kind: 'element', any: BEASTS }, 50, 'Écris une bête',
        'Ce qu’on écrit renaît. Une bête, dans le Grimoire : Poisson, Oiseau, Grenouille… Sylve dit qu’elles attendent.'),
    q('voyageur', 'IV', { kind: 'visitor', need: 1 }, 80, 'Comble un voyageur',
        'Une barque approche… et ne se brise pas ! Ils ont vu nos lanternes. Comble la demande du voyageur.'),
    q('coeur', 'IV', { kind: 'heart', need: 1 }, 60, 'Gagne un cœur d’amitié',
        'Bavarde avec la troupe, offre-leur ce qu’ils aiment. Un cœur, et ils te diront un peu de leur passé.'),
    q('trouvaille', 'IV', { kind: 'gather', need: 1 }, 60, 'Ramasse une trouvaille de climat',
        'Les terres nouvelles ont leurs trésors : glace, laine, sel… Achète-en une, et ramasse un gisement.'),
    q('serre', 'IV', { kind: 'level', site: 'potager', need: 2 }, 120, 'Bâtis la Serre',
        'Sous le verre, tout pousse plus vite. Fais de ton Potager une Serre : Mélisse y sèmera ses graines étranges.', 'epique'),
    // Acte V : le foyer, se nommer (les voyageurs restent, le goût de Cannelle)
    q('maison', 'V', { kind: 'level', site: 'foyer', need: 3 }, 150, 'Bâtis la Cabane',
        'Notre camp devient un foyer. Bâtis la Cabane : on y verra de la lumière la nuit.'),
    q('une-maison', 'V', { kind: 'house', need: 1 }, 100, 'Pose une maison',
        'Des voyageurs voudraient rester. Une maison autour du Foyer, et quelqu’un pourra s’installer.'),
    q('installe', 'V', { kind: 'settle', need: 1 }, 120, 'Garde un voyageur sur l’île',
        'Comble un voyageur, puis propose-lui de rester : une maison l’attend.'),
    q('hameau', 'V', { kind: 'zone', zone: 'hameau' }, 220, 'Achète Le Hameau',
        'Des toits dorment sous la brume, à l’est. Achète Le Hameau : une baleine passe parfois au large.'),
    q('potion', 'V', { kind: 'element', element: 'Potion' }, 80, 'Écris la Potion',
        'Cannelle ne sent plus le goût de rien. L’Eau, la Magie, la Plante… Une potion le lui rendra peut-être.'),
    q('alchimiste', 'V', { kind: 'level', site: 'foyer', need: 4 }, 200, 'Bâtis la Maison de l’alchimiste',
        'La Potion est le plan d’une maison très ancienne. Bâtis-la : quelqu’un y a laissé son bureau.'),
    q('peuple', 'V', { kind: 'name' }, 100, 'Donne un nom au peuple',
        'Une table, une soupe, un nom : c’est comme ça que tout commence. Comment s’appelle notre peuple ?', 'legendaire'),
    // Acte VI : les âges, se souvenir (les Anciens, la clé du phare, le Phénix)
    q('phare', 'VI', { kind: 'zone', zone: 'phare' }, 300, 'Achète L’Îlot aux Mouettes',
        'Sur l’Îlot aux Mouettes dort le phare éteint des Anciens. Achète-le : je dois savoir ce qui s’est passé.'),
    q('ecriture', 'VI', { kind: 'element', element: 'Écriture' }, 100, 'Écris l’Écriture',
        'Galet lit les runes des Anciens. Le Langage et la Pierre : réapprenons à écrire, nous aussi.'),
    q('cle', 'VI', { kind: 'landmark', landmark: 'menhirs' }, 100, 'Trouve la clé du phare',
        '« J’ai laissé la clé du phare sous une pierre », écrivait H. Le Cercle de menhirs… Ondin, ta baguette ?'),
    q('tour', 'VI', { kind: 'level', site: 'foyer', need: 5 }, 250, 'Bâtis la Tour d’étude',
        'Pour lire tout ce qui revient, il faut une tour. Bâtis la Tour d’étude : son plan, c’est le Livre.'),
    q('civilisation', 'VI', { kind: 'element', element: 'Civilisation' }, 150, 'Écris la Civilisation',
        'Une ville, et l’écriture : nous ne sommes plus des naufragés. Écris la Civilisation.'),
    q('phenix', 'VI', { kind: 'element', element: 'Phénix' }, 200, 'Écris le Phénix',
        'J’ai froid, tout à coup… Le Feu et la Vie. Écris le Phénix, s’il te plaît.', 'legendaire'),
    // Acte VII : les légendes, guider (le Passeur, la recette de Brume, le Phare)
    q('ile-legendes', 'VII', { kind: 'zone', zone: 'legendes' }, 300, 'Achète L’Île des Légendes',
        'Le Passeur attend avec sa barque qui vole. Sur L’Île des Légendes, Héliane a laissé son dernier mot.'),
    q('feu-follet', 'VII', { kind: 'element', element: 'Feu follet' }, 200, 'Écris le Feu follet',
        'Le Feu et le Marais… C’est ma recette, n’est-ce pas ? Écris-moi. Ce qui est écrit ne s’oublie plus.'),
    q('phare-brume', 'VII', { kind: 'level', site: 'foyer', need: 7 }, 500, 'Allume le Phare de Brume',
        'Rivet a monté la lentille. Il ne manque que la flamme… Allume le Phare : je serai sa lumière.', 'legendaire')
];
const INDEX = new Map(QUESTS.map((quest, i) => [quest.id, i]));

// Anciennes quêtes (avant la chaîne de la bible) : où elles se rangent dans la nouvelle chaîne (les mêmes identifiants
// s'y rangent tout seuls), et leurs coffres. Une ancienne quête réclamée vaut celle-ci comme « plus avancée ».
const LEGACY = {
    source: { at: 'achat-source', label: 'Achète La Source', chest: 'rare' },
    puits: { at: 'puits-ondin', label: 'Construis le Puits' },
    livre5: { at: 'cabane', label: 'Inscris 5 découvertes au Grimoire' },
    mine: { at: 'cabane', label: 'Ouvre la Carrière', chest: 'epique' },
    livre12: { at: 'cabane', label: 'Inscris 12 découvertes au Grimoire' },
    ponton: { at: 'ponton-aster', label: 'Construis le Ponton', chest: 'epique' },
    livre45: { at: 'maison', label: 'Inscris 45 découvertes au Grimoire' },
    deco10: { at: 'hameau', label: 'Pose 10 créations sur l’île', chest: 'legendaire' },
    livre70: { at: 'phare', label: 'Inscris 70 découvertes au Grimoire' },
    legendes: { at: 'ile-legendes', label: 'Achète L’Île des Légendes', chest: 'legendaire' }
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

// La quête active (la première pas encore faite), telle que la chaîne la définit, ou null
function currentOf(claimed) {
    const done = doneOf(claimed);
    return QUESTS.find(quest => !done.has(quest.id)) || null;
}

// Ce que l'état fournit (services/world.js) : { crafts, runs, stars, zones: Set, levels: { site: palier },
// elements: Set, placed: Set (créations posées), annexes, houses, met: Set ('habitant:besoin' comblés en ce moment ou
// depuis la dernière quête réclamée), awake: Set, hearts (cœurs du meilleur ami), expeditions, landmarks: Set,
// gathered, visitors, settled, named, links: Set ('puits-foyer' : bâtiments reliés par un chemin) }
// Quêtes du tutoriel qui passent par le Grimoire : la page que marque le ruban a son Encre offerte (le joueur, qui a
// peu d'écus, n'est jamais bloqué devant une énigme) : le Brasier du feu de camp, la Source, le Puits d'Ondin
const GUIDED_INK = new Set(['feu', 'achat-source', 'souvenir-ondin']);

const HAVE = {
    crafts: (goal, facts) => facts.crafts,
    craft: (goal, facts) => (facts.placed.has(goal.craft) ? 1 : 0),
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
    visitor: (goal, facts) => facts.visitors,
    settle: (goal, facts) => facts.settled,
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

function boardOf(claimed, facts) {
    const done = doneOf(claimed);
    return { quest: active(claimed, facts), done: QUESTS.filter(quest => done.has(quest.id)).length, total: QUESTS.length, acts: actsDoneOf(done), rested: RESTED };
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
const RESTED = 'La brume s’est levée sur toute l’île. Merci, alchimiste : elle est de nouveau vivante.';

module.exports = { QUESTS, LEGACY, QUEST_CHESTS, BEASTS, GUIDED_INK, reachOf, doneOf, currentOf, progressOf, active, boardOf, actsDoneOf, actStartsOf };
