// Ce que disent les quêtes de Brume (services/quests.js) : pour chacune, son titre (label : le suivi des quêtes, la
// fiche de Brume) et ce que Brume en dit (say), dans l'ordre de l'histoire ; puis les titres des anciennes quêtes à
// coffre (LEGACY), gardés pour les comptes d'avant la bible.

const QUEST_TEXTS = {
    pages: {
        label: 'Découvre ta première recette : le Vent',
        say: 'Le Grimoire s’est ouvert pour toi. Mêle l’Air à l’Air dans l’Athanor : que le Vent chasse la brume du rivage.'
    },
    ramasser: {
        label: 'Ramasse les trois trouvailles du rivage',
        say: 'Deux bois flottés, un galet : ramasse les trois trouvailles, de quoi bâtir notre premier feu.'
    },
    feu: {
        label: 'Allume le Feu de camp',
        say: 'Ceux d’avant faisaient un cercle de pierres, et le bois au milieu. Bâtis le feu ici, sur la plage de Brumelune : tes trouvailles suffiront.'
    },
    nuit: {
        label: 'Passe ta première nuit',
        say: 'Le feu tient. La nuit tombe sur Brumelune, qui ne s’éveille que pour toi. Explore à ta guise… puis dors : demain, nous ne serons plus seuls.'
    },
    caisse: {
        label: 'Ouvre la caisse d’Aster',
        say: 'Sa caisse a échoué près du camp. Ouvre-la avec elle : la mer rend ce qu’elle a pris.'
    },
    recolte: {
        label: 'Termine une Récolte avec Aster',
        say: 'Aster a rejoint le camp au matin. Suis-la au rivage : relie ce qui se ressemble, vite, avant la marée.'
    },
    'premier-ponton': {
        label: 'Bâtis le Ponton d’Aster',
        say: 'Vingt-cinq bois, et la mer nous ouvre ses portes. Bâtis le Ponton avec Aster.'
    },
    'chemin-aster': {
        label: 'Relie le Ponton au Feu',
        say: 'Deux camps, un seul chemin : trace-le du Ponton jusqu’au Feu. Les premières pierres sont offertes.'
    },
    clotures: {
        label: 'Barre le passage des égarés',
        say: 'Brume l’a dit : ils viendront du nord. Plante les quatre piquets en travers de leur passage.'
    },
    veille: {
        label: 'Passe ta deuxième nuit',
        say: 'Deux, ce soir, autour du feu. Dors : je veille.'
    },
    soupe: {
        label: 'Une soupe pour Cannelle',
        say: 'Cannelle grelotte… Touche la bulle au-dessus d’elle : un repas chaud, et elle reprend des couleurs.'
    },
    cage: {
        label: 'Ouvre la cage des poules',
        say: 'Des caquets sur l’eau… La cage du navire s’est échouée au bout de la plage. Ouvre-la avec Cannelle.'
    },
    poules: {
        label: 'Nourris les trois poules',
        say: 'Paprika, Brioche et Madame ont faim : deux vivres chacune, depuis la bulle au-dessus d’elles.'
    },
    poulailler: {
        label: 'Pose le poulailler de Cannelle',
        say: 'Il leur faut un toit : touche le Feu de camp, puis « Annexes », et pose le poulailler près de la cuisine de Cannelle.'
    },
    'nuit-cannelle': {
        label: 'Passe ta troisième nuit',
        say: 'Trois, ce soir, autour du feu. Dors : je veille.'
    },
    deco: {
        label: 'Fabrique ta première lanterne',
        say: 'Rivet a monté un établi près du feu. Assemble une Lanterne, puis pose-la au bord d’un chemin, là où l’île brille d’or.'
    },
    'eveil-ondin': {
        label: 'Réveille Ondin',
        say: 'Un petit dort contre un rocher, sa baguette à la main. Parle-lui doucement : la brume endort, sans faire de mal.'
    },
    'souvenir-ondin': {
        label: 'Fais naître la Pluie',
        say: 'La source s’est tue sous ses pieds. Sans pluie, la terre oublie l’eau. Écris-la : sa baguette aura de nouveau quelque chose à chercher.'
    },
    'puits-ondin': {
        label: 'Construis le Puits',
        say: 'Ondin sent l’eau sous ses pieds. Creuse le Puits avec la pierre de la Récolte : l’eau ne manquera plus.'
    },
    chemin: {
        label: 'Relie le Puits au Feu',
        say: 'Ondin porte l’eau à travers l’herbe mouillée… Trace un chemin du Puits jusqu’au Feu : les premières pierres sont offertes.'
    },
    lisiere: {
        label: 'Achète La Lisière',
        say: 'Le bois flotté s’épuise. À l’ouest, des arbres dorment sous la brume… et quelqu’un avec eux. Achète La Lisière.'
    },
    'eveil-sylve': {
        label: 'Réveille Sylve',
        say: 'Une sauvageonne dort roulée en boule, près d’un radeau brisé. Approche sans bruit, et parle-lui.'
    },
    vie: {
        label: 'Fais naître la Vie',
        say: 'Air, Eau, Feu, Terre… Les quatre Souffles ensemble, dans l’Athanor. Je crois que c’est ça, la Vie.'
    },
    'souvenir-sylve': {
        label: 'Rends son souvenir à Sylve : fais naître l’Arbre',
        say: 'De la Vie naît la Plante, et de la Plante, l’Arbre. Fais-le naître : Sylve se souviendra de sa forêt.'
    },
    bosquet: {
        label: 'Plante le Bosquet',
        say: 'Sylve se souvient ! Plante le Bosquet : elle ramassera le bois mort, sans abattre un seul arbre.'
    },
    lumiere: {
        label: 'Fais naître la Lumière',
        say: 'Une lumière repousse la brume. Le Feu, et l’Éclair d’un orage… Le Grimoire te mettra sur la voie.'
    },
    lanterne: {
        label: 'Allume la première lanterne',
        say: 'Assemble une Lanterne à l’établi et pose-la au bord d’un chemin. Une lumière… Je les compterai toutes.'
    },
    colline: {
        label: 'Achète La Colline',
        say: 'L’orage approche, et l’Abri demande de la pierre. Au nord-est, une fissure… Achète La Colline.'
    },
    'eveil-galet': {
        label: 'Réveille Galet',
        say: 'Un vieil homme dort dans la fissure, son maillet à la main. Il ronfle comme une pierre qui roule.'
    },
    'souvenir-galet': {
        label: 'Rends son souvenir à Galet : fais naître la Pierre',
        say: 'Galet a oublié la pierre. Le Feu et la Terre font la Lave ; l’Air la refroidit… Fais naître la Pierre.'
    },
    carriere: {
        label: 'Ouvre la Fissure',
        say: '« Hm. » Il dit qu’il est prêt à tailler. Ouvre la Fissure : la pierre de l’Abri viendra de là.'
    },
    bois: {
        label: 'Fais naître le Bois',
        say: 'Pour l’Abri, il faut du bois… sans faire pleurer Sylve. L’Arbre et le Métal, peut-être ?'
    },
    cabane: {
        label: 'Dresse l’Abri avant l’orage',
        say: 'Le ciel gronde déjà. Dresse l’Abri près du feu de camp : il faut tenir, tous ensemble.'
    },
    annexe: {
        label: 'Pose une annexe',
        say: 'L’Abri tient ! Un bâtiment grandit aussi par ce qu’on pose autour de lui : dans sa fiche, l’onglet Annexes.'
    },
    jardins: {
        label: 'Achète Les Jardins',
        say: 'Sept bouches, et la Récolte ne suffit plus. Au nord, une terre noire… et une barque de graines. Achète Les Jardins.'
    },
    'eveil-melisse': {
        label: 'Réveille Mélisse',
        say: 'Une jardinière dort sur sa boîte en fer. Réveille-la : ses graines ont de la mémoire, dit-elle.'
    },
    potager: {
        label: 'Bâtis le Potager',
        say: 'Tes pages l’ont réveillée avant toi : elle se souvient déjà de la Plante. Bâtis le Potager.'
    },
    faubourg: {
        label: 'Achète Le Faubourg',
        say: 'Rivet rêve d’une vraie forge. « Attends… Non. Si ! » À l’est, Le Faubourg l’attend.'
    },
    atelier: {
        label: 'Bâtis l’Atelier',
        say: 'La Brique et le Feu font un Four. Bâtis l’Atelier : Rivet forgera les outils de tous.'
    },
    etoile: {
        label: 'Fais naître l’Étoile',
        say: 'Aster veut explorer, mais la nuit, il faut un guide. Fais naître l’Étoile : elle tracera la route.'
    },
    hauteurs: {
        label: 'Achète Les Hauteurs',
        say: 'Des Hauteurs, on voit tout le cœur de l’île… et ce qui dort au-delà, dans la brume. C’est de là-haut qu’on partira.'
    },
    expedition: {
        label: 'Envoie une expédition',
        say: 'Au-delà de nos quartiers, des terres dorment dans la brume. La boussole, en haut : envoie une expédition.'
    },
    ruine: {
        label: 'Découvre un lieu des Anciens',
        say: 'D’autres ont vécu ici, avant nous. Achète une terre explorée, et touche ce qui y luit.'
    },
    village: {
        label: 'Fais naître le Village',
        say: 'Des maisons, des voisins… Notre camp devient un village. Fais-le naître dans le Grimoire.'
    },
    crique: {
        label: 'Achète La Crique',
        say: 'Aster veut reprendre la mer. Au nord-est, une crique abritée : on dit que des dauphins y viennent.'
    },
    'souvenir-aster': {
        label: 'Rends son courage à Aster : fais naître le Bateau',
        say: '« Je ne sais plus tenir une barre », dit Aster. Le Bois et l’Eau… Fais naître le Bateau : rends-lui la mer.'
    },
    'ponton-aster': {
        label: 'Fais du Ponton un port de pêche',
        say: 'Cap sur la crique ! Agrandis le Ponton : la mer devient un chemin.'
    },
    bete: {
        label: 'Fais naître une bête',
        say: 'Ce qu’on fabrique renaît. Une bête, dans le Grimoire : Poisson, Oiseau, Grenouille… Sylve dit qu’elles attendent.'
    },
    voyageur: {
        label: 'Comble un voyageur',
        say: 'Une barque approche… et ne se brise pas ! Ils ont vu nos lanternes. Comble la demande du voyageur.'
    },
    coeur: {
        label: 'Gagne un cœur d’amitié',
        say: 'Bavarde avec la troupe, offre-leur ce qu’ils aiment. Un cœur, et ils te diront un peu de leur passé.'
    },
    trouvaille: {
        label: 'Ramasse une trouvaille de climat',
        say: 'Les terres nouvelles ont leurs trésors : glace, laine, sel… Achète-en une, et ramasse un gisement.'
    },
    serre: {
        label: 'Bâtis la Serre',
        say: 'Sous le verre, tout pousse plus vite. Fais de ton Potager une Serre : Mélisse y sèmera ses graines étranges.'
    },
    maison: {
        label: 'Bâtis la Cabane',
        say: 'Notre camp devient un foyer. Bâtis la Cabane : on y verra de la lumière la nuit.'
    },
    'une-maison': {
        label: 'Pose une maison',
        say: 'Des voyageurs voudraient rester. Une maison autour du Foyer, et quelqu’un pourra s’installer.'
    },
    installe: {
        label: 'Garde un voyageur sur l’île',
        say: 'Comble un voyageur, puis propose-lui de rester : une maison l’attend.'
    },
    hameau: {
        label: 'Achète Le Hameau',
        say: 'Des toits dorment sous la brume, à l’est. Achète Le Hameau : une baleine passe parfois au large.'
    },
    potion: {
        label: 'Fais naître la Potion',
        say: 'Cannelle ne sent plus le goût de rien. L’Eau, la Magie, la Plante… Une potion le lui rendra peut-être.'
    },
    alchimiste: {
        label: 'Bâtis la Maison de l’alchimiste',
        say: 'La Potion est le plan d’une maison très ancienne. Bâtis-la : quelqu’un y a laissé son bureau.'
    },
    peuple: {
        label: 'Donne un nom au peuple',
        say: 'Une table, une soupe, un nom : c’est comme ça que tout commence. Comment s’appelle notre peuple ?'
    },
    phare: {
        label: 'Achète L’Îlot aux Mouettes',
        say: 'Sur l’Îlot aux Mouettes dort le phare éteint des Anciens. Achète-le : je dois savoir ce qui s’est passé.'
    },
    ecriture: {
        label: 'Fais naître l’Écriture',
        say: 'Galet lit les runes des Anciens. Le Langage et la Pierre : réapprenons à écrire, nous aussi.'
    },
    cle: {
        label: 'Trouve la clé du phare',
        say: '« J’ai laissé la clé du phare sous une pierre », écrivait H. Le Cercle de menhirs… Ondin, ta baguette ?'
    },
    tour: {
        label: 'Bâtis la Tour d’étude',
        say: 'Pour lire tout ce qui revient, il faut une tour. Bâtis la Tour d’étude : son plan, c’est le Livre.'
    },
    civilisation: {
        label: 'Fais naître la Civilisation',
        say: 'Une ville, et l’écriture : nous ne sommes plus des naufragés. Fais naître la Civilisation.'
    },
    phenix: {
        label: 'Fais naître le Phénix',
        say: 'J’ai froid, tout à coup… Le Feu et la Vie. Fais naître le Phénix, s’il te plaît.'
    },
    'ile-legendes': {
        label: 'Achète L’Île des Légendes',
        say: 'Le Passeur attend avec sa barque qui vole. Sur L’Île des Légendes, Héliane a laissé son dernier mot.'
    },
    'feu-follet': {
        label: 'Fais naître le Feu follet',
        say: 'Le Feu et le Marais… C’est ma recette, n’est-ce pas ? Fais-moi naître. Ce qui est né ne s’oublie plus.'
    },
    'phare-brume': {
        label: 'Allume le Phare de Brume',
        say: 'Rivet a monté la lentille. Il ne manque que la flamme… Allume le Phare : je serai sa lumière.'
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
