// Ce que disent les quêtes de Brume (services/quests.js) : pour chacune, son titre (label : le suivi des quêtes, la
// fiche de Brume) et ce que Brume en dit (say), dans l'ordre de l'histoire ; puis les titres des anciennes quêtes à
// coffre (LEGACY), gardés pour les comptes d'avant la bible.

const QUEST_TEXTS = {
    pages: {
        label: 'Écris ta première page : le Vent',
        say: 'Il s’est ouvert pour toi. Ceux d’avant savaient en faire sortir le vent… Essaie.'
    },
    ramasser: {
        label: 'Ramasse ce que la mer a rendu',
        say: 'Ce que la mer rend, on le garde. Ce soir, on en fera un feu.'
    },
    feu: {
        label: 'Rallume le feu de ceux d’avant',
        say: 'C’est ici qu’ils dansaient, autour des flammes. Rallume-les.'
    },
    nuit: {
        label: 'Passe ta première nuit',
        say: 'Le feu tient. Va voir la plage, si tu veux. Quand tu auras sommeil, je veillerai.'
    },
    caisse: {
        label: 'Ouvre la caisse d’Hermine',
        say: 'Une caisse est venue avec l’épave. Hermine dit qu’elle est à elle.'
    },
    recolte: {
        label: 'Fais une Récolte avec Hermine',
        say: 'Hermine connaît la marée. Suis-la au rivage.'
    },
    'premier-ponton': {
        label: 'Bâtis le Ponton d’Hermine',
        say: 'Un ponton, dit-elle, et la mer devient un chemin. Elle a l’air d’y croire.'
    },
    'chemin-aster': {
        label: 'Relie le Ponton au feu',
        say: 'Deux camps, un seul feu. Il leur faut un chemin.'
    },
    clotures: {
        label: 'Entoure le feu d’un enclos',
        say: 'La nuit, des égarés sortent de ma brume. Une clôture autour du feu… et ils s’arrêtent, je crois.'
    },
    // (choix de l'auteur, 15 oct. : les sentiers traversent l'enclos ; texte à valider)
    portes: {
        label: 'Pose les portes de l’enclos',
        say: 'Les sentiers passent toujours. Hermine a deux portes, avec leurs verrous.'
    },
    veille: {
        label: 'Passe ta deuxième nuit',
        say: 'Deux, ce soir, autour du feu. Dors : je veille.'
    },
    soupe: {
        label: 'Une soupe pour Marcelle',
        say: 'Marcelle a faim, et froid. Deux nuits sur les rochers, ça creuse.'
    },
    cage: {
        label: 'Ouvre la cage des poules',
        say: 'Des caquets, sur l’eau… La cage du navire est venue jusqu’au bout de la plage.'
    },
    poules: {
        label: 'Nourris les trois poules',
        say: 'Elles ont faim. Marcelle les regarde comme si c’étaient ses filles. Ce sont ses filles.'
    },
    poulailler: {
        label: 'Pose le poulailler de Marcelle',
        say: 'Il leur faut un toit, dans l’herbe, près de la cuisine. Marcelle a déjà choisi l’endroit.'
    },
    'abri-cannelle': {
        label: 'Un abri pour Marcelle',
        say: 'Elle dort sur une marmite renversée. Elle ne se plaint pas. Enfin, un peu.'
    },
    'enclos-cannelle': {
        label: 'Entoure le coin de Marcelle',
        say: 'Une cuisine brille toute la nuit. Les égarés le savent aussi.'
    },
    'nuit-cannelle': {
        label: 'Passe ta troisième nuit',
        say: 'Trois, ce soir, autour du feu. Dors : je veille.'
    },
    deco: {
        label: 'Assemble ta première lanterne',
        say: 'Jovin a monté un établi : une porte de cabine, deux caisses. Il dit que c’est un début.'
    },
    'torches-rivet': {
        label: 'Plante les trois torches de Jovin',
        say: 'Ils sont venus de trois côtés, hier soir. Jovin a compté. Il compte tout.'
    },
    'nuit-rivet': {
        label: 'Passe ta quatrième nuit',
        say: 'Quatre, ce soir, autour du feu. Dors : je veille.'
    },
    'eveil-ondin': {
        label: 'Réveille Pierrot',
        say: 'Un enfant dort sur une planche. La vague l’a posé là. Doucement.'
    },
    'souvenir-ondin': {
        label: 'Écris la Pluie',
        say: 'Sans pluie, la terre oublie l’eau. Et Pierrot aussi.'
    },
    'puits-ondin': {
        label: 'Bâtis le Puits',
        say: 'Pierrot sent l’eau sous ses pieds. Il chuchote qu’elle chante.'
    },
    chemin: {
        label: 'Relie le Puits au feu',
        say: 'Pierrot porte l’eau dans l’herbe mouillée. Les seaux arrivent à moitié vides.'
    },
    lisiere: {
        label: 'Achète La Lisière',
        say: 'Le bois flotté ne suffira pas. À l’ouest, des arbres dorment sous la brume. Et une lueur, entre eux.'
    },
    'eveil-sylve': {
        label: 'Apprivoise Freya',
        say: 'Quelqu’un vit dans ces arbres, et se cache. Une queue rousse t’a montré le chemin. Approche sans bruit.'
    },
    vie: {
        label: 'Écris la Vie',
        say: 'Air, Eau, Feu, Terre… Les quatre Souffles ensemble. Je crois que c’est ça, la Vie.'
    },
    'souvenir-sylve': {
        label: 'Rends son souvenir à Freya : écris l’Arbre',
        say: 'De la Vie naît la Plante, et de la Plante, l’Arbre. Freya se souviendra de sa forêt.'
    },
    bosquet: {
        label: 'Plante le Bosquet',
        say: 'Freya ramassera le bois mort. Pas un arbre ne tombera : elle y veille.'
    },
    lumiere: {
        label: 'Écris la Lumière',
        say: 'Le Feu, et l’Éclair d’un orage… Une lumière qui ne s’éteint pas.'
    },
    lanterne: {
        label: 'Allume la première lanterne',
        say: 'Une lumière de plus. Je les compterai toutes.'
    },
    colline: {
        label: 'Achète La Colline',
        say: 'L’orage approche, et l’Abri demandera de la pierre. Du côté de la Colline, quelqu’un taille la pierre.'
    },
    'eveil-galet': {
        label: 'Va trouver Saturnin',
        say: 'Il vit dans la fissure depuis des années. Il ne parle pas beaucoup. Il ne parle pas du tout, en fait.'
    },
    'souvenir-galet': {
        label: 'Rends son souvenir à Saturnin : écris la Pierre',
        say: 'Le Feu et la Terre font la Lave ; l’Air la refroidit… Saturnin, lui, a oublié.'
    },
    carriere: {
        label: 'Ouvre la Fissure',
        say: '« Hm. » Il dit qu’il est prêt à tailler. Je crois.'
    },
    bois: {
        label: 'Écris le Bois',
        say: 'Pour l’Abri, il faut du bois… sans faire pleurer Freya. L’Arbre et le Métal, peut-être ?'
    },
    cabane: {
        label: 'Dresse l’Abri avant l’orage',
        say: 'Le ciel gronde déjà. Un toit, avant la pluie.'
    },
    annexe: {
        label: 'Pose une annexe',
        say: 'L’Abri tient. Autour de lui, il y a de la place pour autre chose.'
    },
    jardins: {
        label: 'Achète Les Jardins',
        say: 'Sept bouches, et la marée ne suffit plus. Au nord, une terre noire, et une barque de graines échouée.'
    },
    'eveil-melisse': {
        label: 'Réveille Flore',
        say: 'Une jardinière dort sur sa boîte en fer. Elle la serre comme on serre un secret.'
    },
    potager: {
        label: 'Bâtis le Potager',
        say: 'Tes pages l’ont réveillée avant toi : elle se souvient déjà de la Plante.'
    },
    faubourg: {
        label: 'Achète Le Faubourg',
        say: 'Jovin rêve d’une vraie forge. Il n’ose pas le dire. Il le dit quand même.'
    },
    atelier: {
        label: 'Bâtis l’Atelier',
        say: 'Le Métal et la Terre font le Fer. Jovin forgera les outils de tous.'
    },
    etoile: {
        label: 'Écris l’Étoile',
        say: 'Hermine veut un guide, pour la nuit. Une étoile. … Oui. Une étoile.'
    },
    hauteurs: {
        label: 'Achète Les Hauteurs',
        say: 'De là-haut, on voit tout le cœur de l’île… et ce qui dort au-delà, dans la brume.'
    },
    expedition: {
        label: 'Envoie une expédition',
        say: 'Au-delà de nos quartiers, des terres dorment dans la brume. Quelqu’un doit aller voir.'
    },
    ruine: {
        label: 'Découvre un lieu des Anciens',
        say: 'D’autres ont vécu ici, avant nous. Il reste des pierres qui luisent.'
    },
    village: {
        label: 'Écris le Village',
        say: 'Des maisons, des voisins… Notre camp devient un village.'
    },
    crique: {
        label: 'Achète La Crique',
        say: 'Hermine veut reprendre la mer. Elle ne le dit pas. Elle regarde la crique.'
    },
    'souvenir-aster': {
        label: 'Rends son courage à Hermine : écris le Bateau',
        say: '« Je ne tiens plus une barre », dit Hermine. Le Bois et l’Eau…'
    },
    'ponton-aster': {
        label: 'Fais du Ponton un port de pêche',
        say: 'Cap sur la crique, dit-elle. Ses mains ne tremblent plus.'
    },
    bete: {
        label: 'Écris une bête',
        say: 'Freya dit que les bêtes attendent qu’on se souvienne d’elles.'
    },
    voyageur: {
        label: 'Comble un voyageur',
        say: 'Une barque approche… et elle ne se brise pas. Ils ont vu nos lanternes.'
    },
    coeur: {
        label: 'Gagne un cœur d’amitié',
        say: 'Ils ont tous un passé. Ils le racontent à qui revient les voir.'
    },
    trouvaille: {
        label: 'Ramasse une trouvaille de climat',
        say: 'Les terres nouvelles ont leurs trésors : glace, laine, sel…'
    },
    serre: {
        label: 'Bâtis la Serre',
        say: 'Sous le verre, tout pousse plus vite. Flore y sèmera ses graines étranges.'
    },
    maison: {
        label: 'Bâtis la Cabane',
        say: 'Une cabane, avec une fenêtre. On y verra de la lumière, la nuit. Une de plus.'
    },
    'une-maison': {
        label: 'Pose une maison',
        say: 'Des voyageurs voudraient rester. Il leur faut un toit.'
    },
    installe: {
        label: 'Garde un voyageur sur l’île',
        say: 'Quelqu’un hésite à repartir. Une maison l’attend.'
    },
    hameau: {
        label: 'Achète Le Hameau',
        say: 'Des toits dorment sous la brume, à l’est. Une baleine passe parfois au large.'
    },
    potion: {
        label: 'Rends le goût à Marcelle : écris le Remède',
        say: 'Marcelle repose sa cuillère. « Plus rien n’a de goût… Ce n’est pas la brume, c’est moi. » Le livre se souvient du Remède.'
    },
    alchimiste: {
        label: 'Bâtis la Maison de l’alchimiste',
        say: 'Le Remède est le plan d’une maison très ancienne. Quelqu’un y a laissé son bureau.'
    },
    peuple: {
        label: 'Donne un nom au peuple',
        say: 'Une table pour tous, et pas encore de nom. Comment s’appelle notre peuple ?'
    },
    phare: {
        label: 'Achète L’Îlot aux Mouettes',
        say: 'Sur l’Îlot aux Mouettes dort le phare éteint des Anciens. Je dois savoir ce qui s’est passé.'
    },
    ecriture: {
        label: 'Réapprends l’Écriture',
        say: 'Saturnin lit les runes des Anciens. Le Langage et la Pierre… Réapprenons, nous aussi.'
    },
    cle: {
        label: 'Trouve la clé du phare',
        say: '« J’ai laissé la clé du phare sous une pierre », écrivait H. Le Cercle de menhirs… Pierrot, ta baguette ?'
    },
    tour: {
        label: 'Bâtis la Tour d’étude',
        say: 'Pour lire tout ce qui revient, il faut une tour.'
    },
    civilisation: {
        label: 'Écris la Civilisation',
        say: 'Une ville, et l’écriture. Nous ne sommes plus des naufragés.'
    },
    phenix: {
        label: 'Écris le Phénix',
        say: 'J’ai froid, tout à coup… Le Feu et la Vie. S’il te plaît.'
    },
    'ile-legendes': {
        label: 'Achète L’Île des Légendes',
        say: 'Le Passeur attend avec sa barque qui vole. Sur L’Île des Légendes, Héliane a laissé son dernier mot.'
    },
    'feu-follet': {
        label: 'Écris le Feu follet',
        say: 'Le Feu et le Marais… C’est moi, n’est-ce pas ? Écris-moi. Ce qui est écrit ne s’oublie plus.'
    },
    'phare-brume': {
        label: 'Allume le Phare de Brume',
        say: 'Jovin a monté la lentille. Il ne manque que la flamme… Allume le Phare : je serai sa lumière.'
    }
};

const LEGACY_LABELS = {
    source: 'Achète La Source',
    puits: 'Construis le Puits',
    livre5: 'Inscris 5 découvertes au Grimoire',
    mine: 'Ouvre la Carrière',
    livre12: 'Inscris 12 découvertes au Grimoire',
    ponton: 'Construis le Ponton',
    livre45: 'Inscris 45 découvertes au Grimoire',
    deco10: 'Pose 10 créations sur l’île',
    livre70: 'Inscris 70 découvertes au Grimoire',
    legendes: 'Achète L’Île des Légendes'
};

module.exports = { QUEST_TEXTS, LEGACY_LABELS };
