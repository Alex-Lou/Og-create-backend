// Ce que répond l'île du joueur (services/world.js) : le tutoriel à passer, l'île à recommencer
// (routes/play/world.js aussi), les quêtes à réclamer, la première nuit, l'achat des quartiers, les chantiers, les noms
// donnés à l'île ; et ce que plusieurs services de l'île disent pareil (quartier ou bâtiment inconnu, quartier à
// acheter, bâtiment à bâtir, palier, chapitre : world/lands.js, world/moves.js, world/nights.js, world/chests.js,
// world/annexPlots.js). Le déplacement d'un grand bâtiment (MOVE : services/world/moves.js) et les abris du camp
// (SHELTER : services/world/shelters.js) sont ici aussi.

// Communs aux services de l'île
const ZONE_UNKNOWN = 'Quartier inconnu.';
const BUILDING_UNKNOWN = 'Bâtiment inconnu.';
const BUY_ZONE_FIRST = 'Achète d’abord ce quartier de l’île.';
const BUILD_FIRST = 'Bâtis d’abord ce bâtiment.';
const NEED_TIER = tier => `Il faut le palier ${tier} de ce bâtiment.`;
const OPEN_CHAPTER_FIRST = chapter => `Ouvre d’abord le chapitre ${chapter} du Grimoire.`;
const NAME_RULE = max => `Un nom de 2 à ${max} lettres ou chiffres (espace, tiret ou apostrophe entre deux).`;

// Tutoriel, île recommencée
const SKIP_TOO_EARLY = 'Bâtis d’abord le camp et termine la première Récolte avec Lorena.';
// Une scène de l'histoire (l'arc du Phare) inconnue, ou pas encore venue
const SCENE_UNKNOWN = 'Scène inconnue.';
const SCENE_TOO_EARLY = 'Cette scène n’est pas encore venue.';
const RESTART_CONFIRM = 'Écris RECOMMENCER pour confirmer.';
const RESTARTED_ONCE = 'Ton île a déjà été recommencée une fois.';
const RESTARTED = 'Ton île vient d’être recommencée.';

// Quêtes, première nuit
const QUEST_NOT_CURRENT = 'Ce n’est pas la quête en cours.';
const QUEST_NOT_DONE = (label, have, need) => `Pas encore : ${label} (${have}/${need}).`;
const REWARD_TAKEN = 'Récompense déjà reçue.';
const NOT_SLEEP_TIME = 'Ce n’est pas le moment de dormir.';
const ALREADY_SLEPT = 'Tu as déjà dormi.';

// Quartiers et chantiers
const EXPLORE_FIRST = 'Envoie d’abord une expédition découvrir ce quartier.';
const ZONE_OWNED = 'Ce quartier est déjà à toi.';
const WORKSITE_UNKNOWN = 'Chantier inconnu.';
const WORKSITE_DONE = 'Ce chantier est déjà achevé.';
const PLAN_FIRST = plan => `Il te faut d’abord faire naître « ${plan} » dans l’Athanor du Grimoire.`;

// Noms
const RENAME_TOO_EARLY = 'Un bâtiment se renomme dès son palier III.';
const RENAME_BUY_ZONE = name => `${name} : achète d’abord son quartier.`;
const RENAME_ZONE_BUY = 'Achète d’abord ce quartier pour le renommer.';

// Déplacer un grand bâtiment
const MOVE = {
    outside: 'Hors de l’île.',
    zones: 'Pose-le dans tes quartiers.',
    ground: 'Il se pose sur l’herbe, le sable ou la prairie (pas sur un chemin).',
    taken: 'La place est prise.',
    keepNear: name => `« ${name} » doit rester près de lui : déplace-la d’abord.`
};

// Abris du camp
const SHELTER = {
    unknown: 'Abri inconnu.',
    notYet: 'Pas encore : son coin attend son tour.',
    built: 'Cet abri est déjà bâti.'
};

module.exports = {
    ZONE_UNKNOWN, BUILDING_UNKNOWN, BUY_ZONE_FIRST, BUILD_FIRST, NEED_TIER, OPEN_CHAPTER_FIRST, NAME_RULE, SKIP_TOO_EARLY,
    RESTART_CONFIRM, RESTARTED_ONCE, RESTARTED, QUEST_NOT_CURRENT, QUEST_NOT_DONE, REWARD_TAKEN, NOT_SLEEP_TIME, ALREADY_SLEPT,
    EXPLORE_FIRST, ZONE_OWNED, WORKSITE_UNKNOWN, WORKSITE_DONE, PLAN_FIRST, RENAME_TOO_EARLY, RENAME_BUY_ZONE, RENAME_ZONE_BUY,
    MOVE, SHELTER, SCENE_UNKNOWN, SCENE_TOO_EARLY
};
