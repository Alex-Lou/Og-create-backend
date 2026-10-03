# Recettes : passe « tout est fusionnable » — de nouveaux usages pour les éléments qui ne servaient presque à rien.
# Recherche par lots, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  ("Alphabet+Enfant", "École"),  # apprendre l'alphabet, c'est le premier travail de l'école  # lot 1
  ("Alphabet+Encre+Plomb", "Imprimerie"),  # caractères mobiles en plomb encrés : Gutenberg, vers 1450 (alliage plomb-étain-antimoine)  # lot 1
  ("Armure+Pluie", "Rouille"),  # une armure de fer laissée sous la pluie rouille  # lot 1
  ("Ballon+Enfant", "Jeu"),  # un enfant et un ballon : on joue  # lot 1
  ("Ballon+Panier", "Sport"),  # basket-ball : inventé en 1891 par James Naismith avec des paniers à pêches  # lot 1
  ("Ballon de baudruche+Gâteau", "Gâteau d'anniversaire"),  # ballons et gâteau : la fête d'anniversaire  # lot 1
  ("Ballon de baudruche+Eau+Enfant", "Jeu"),  # remplir des ballons d'eau : la bataille de bombes à eau  # lot 1
  ("Berger+Lait", "Fromage"),  # les bergers font le fromage de brebis (roquefort, ossau-iraty)  # lot 1
  ("Biscuit+Chocolat+Lait", "Gâteau"),  # gâteau de biscuits trempés dans le lait, en couches avec du chocolat (classique sans four)  # lot 1
  ("Boulanger+Huile", "Beignet"),  # pâte frite dans l'huile chez le boulanger : le beignet  # lot 1
  ("Boulanger+Fruit", "Tarte"),  # la tarte aux fruits de la boulangerie  # lot 1
  ("Bûcheron+Bois", "Cabane"),  # cabane en rondins bâtie par le bûcheron  # lot 1
  ("Brique+Cabane", "Maison"),  # remplacer la cabane par des murs de briques (cf. les trois petits cochons) : une maison  # lot 1
  ("Caramel+Farine+Four+Pomme", "Tarte"),  # tarte Tatin : pommes caramélisées sous la pâte, cuites au four (l'« accident » des sœurs Tatin est une légende)  # lot 1
  ("Chasseur-cueilleur+Loup", "Chien"),  # le chien a été domestiqué à partir du loup par des chasseurs-cueilleurs, il y a plus de 15 000 ans  # lot 1
  ("Chasseur-cueilleur+Silex", "Silex taillé"),  # tailler le silex : l'outil du chasseur-cueilleur  # lot 1
  ("Chasseur-cueilleur+Grotte+Ocre", "Grotte ornée"),  # les peintures de Lascaux ou Chauvet sont faites d'ocre par des chasseurs-cueilleurs  # lot 1
  ("Cidre+Distillation", "Alcool"),  # le calvados est du cidre distillé  # lot 1
  ("Bactérie+Cidre", "Vinaigre"),  # vinaigre de cidre : les bactéries acétiques transforment l'alcool en acide acétique  # lot 1
  ("Cimetière+Nuit", "Peur"),  # le cimetière la nuit, ça fait peur  # lot 1
  ("Ciseaux+Papier+Pierre", "Jeu"),  # pierre-feuille-ciseaux (chifoumi), jeu connu de tous  # lot 1
  ("Ciseaux+Tissu", "Vêtement"),  # couper le tissu : le premier geste de la couture  # lot 1
  ("Ciseaux+Colle+Papier", "Art"),  # découper et coller du papier : le collage (Matisse, papiers découpés)  # lot 1
  ("Ciseaux+Fleur", "Bouquet"),  # on coupe des fleurs pour faire un bouquet  # lot 1
  ("Confiture+Farine+Four", "Tarte"),  # tarte à la confiture (pâte garnie de confiture, cuite au four, ex. tarte de Linz)  # lot 1
  ("Bois+Couteau", "Sculpture"),  # sculpter un bout de bois au couteau  # lot 1
  ("Crayon+Papier", "Art"),  # un crayon et une feuille : le dessin  # lot 1
  ("Cuisinier+Eau+Légume", "Soupe"),  # le cuisinier fait une soupe de légumes  # lot 1
  ("Électricité+Fer à cheval", "Électroaimant"),  # le premier électroaimant (William Sturgeon, 1824) était un fer en forme de fer à cheval entouré de fil  # lot 1
  ("Fontaine+Vieillesse", "Élixir"),  # clin d'œil : la fontaine de Jouvence, dont l'eau rend la jeunesse (légende)  # lot 2
  ("Frites+Commerce", "Restaurant"),  # vendre des frites, c'est tenir une friterie / un snack  # lot 2
  ("Gratte-ciel+Métal+Éclair", "Paratonnerre"),  # tige de métal reliée à la terre, comme Éclair+Maison+Métal+Terre ; les tours sont frappées très souvent (Empire State Building ~20 fois/an, NWS) d'où leur paratonnerre  # lot 2
  ("Guitare+Feu de camp", "Joie"),  # la soirée guitare autour du feu de camp  # lot 2
  ("Air+Gâteau d'anniversaire", "Fumée"),  # on souffle les bougies : un filet de fumée (comme Bougie+Vent → Fumée)  # lot 2
  ("Hameçon+Lombric+Rivière", "Poisson"),  # un ver sur l'hameçon dans la rivière : on attrape un poisson  # lot 2
  ("Jeux olympiques+Neige", "Ski"),  # le ski est aux Jeux d'hiver depuis Chamonix 1924 (ski de fond, saut)  # lot 2
  ("Glace+Jeux olympiques", "Patin à glace"),  # le patinage artistique est olympique depuis Londres 1908  # lot 2
  ("Limonade+Rhum", "Cocktail"),  # rhum + eau gazeuse sucrée citronnée : la base du mojito  # lot 2
  ("Maison+Mariage", "Famille"),  # les mariés s'installent sous le même toit : une famille (comme Amour+Maison → Famille)  # lot 2
  ("Brique+Maçon", "Mur"),  # le maçon monte un mur de briques  # lot 2
  ("Archéologie+Menhir", "Préhistoire"),  # les menhirs (Carnac, ~4500-3000 av. J.-C.) sont étudiés par l'archéologie préhistorique, comme Grotte ornée+Archéologie  # lot 2
  ("Menuisier+Mur", "Porte"),  # le menuisier pose une porte dans le mur (comme Bois+Mur → Porte)  # lot 2
  ("Menuisier+Sommeil", "Lit"),  # le menuisier fabrique le lit en bois (comme Bois+Sommeil → Lit)  # lot 2
  ("Moisson+Moulin", "Farine"),  # le grain moissonné est moulu au moulin  # lot 2
  ("Momie+Rayons X", "Squelette"),  # les momies sont radiographiées sans être démaillotées (dès 1896, Flinders König (1896))  # lot 2
  ("Archéologie+Momie", "Musée"),  # les momies exhumées par les archéologues sont exposées au musée (Louvre, British Museum)  # lot 2
  ("Enfant+Ours en peluche", "Joie"),  # le doudou fait le bonheur de l'enfant  # lot 2
  ("Musique+Patin à glace", "Danse"),  # la danse sur glace (olympique depuis 1976)  # lot 2
  ("Pilote+Voiture", "Sport"),  # le sport automobile (course, rallye)  # lot 2
  ("Arbre+Chat+Pompier", "Héros"),  # clin d'œil : le pompier qui descend le chat coincé dans l'arbre, image d'Épinal (et vraie intervention)  # lot 2
  ("Mur+Pont-levis+Tour", "Château"),  # murailles, tours et pont-levis : le château fort  # lot 2
  ("Pop-corn+Théâtre", "Cinéma"),  # la salle où l'on mange du pop-corn devant le spectacle : le cinéma (habitude américaine des années 1930)  # lot 2
  ("Pêcheur+Poisson+Port", "Marché"),  # au port, les pêcheurs vendent le poisson à la criée  # lot 2
  ("Corbeau+Potager+Vêtement", "Épouvantail"),  # de vieux vêtements dans le potager pour chasser les corbeaux (comme Champ+Corbeau+Vêtement)  # lot 2
  ("Aigle+Lion+Mythe", "Griffon"),  # le griffon des mythes grecs et perses : avant d'aigle, arrière de lion (Mythe marque la légende, ce n'est pas un hybride réel)  # lot 3
  ("Griffon+Chevalier", "Blason"),  # le griffon est une figure classique des armoiries médiévales  # lot 3
  ("Crabe+Panier+Mer", "Pêche"),  # le casier à crabes, traditionnellement un panier d'osier immergé (Bretagne)  # lot 3
  ("Crocodile+Zèbre", "Chaîne alimentaire"),  # les crocodiles du Nil attaquent zèbres et gnous à la traversée de la rivière Mara  # lot 3
  ("Hibou+Souris", "Os"),  # la pelote de réjection : le hibou recrache poils et os de souris (dissection classique à l'école)  # lot 3
  ("Oiseau marin+Falaise", "Nid"),  # fous, guillemots et mouettes nichent en colonies sur les falaises  # lot 3
  ("Phoque+Ours polaire+Poisson Polaire", "Chaîne alimentaire"),  # la chaîne arctique : morue polaire → phoque annelé → ours polaire  # lot 3
  ("Perroquet+Bateau", "Pirate"),  # clin d'œil : le perroquet de Long John Silver dans « L'Île au trésor » (Stevenson, 1883)  # lot 3
  ("Pingouin+Pingouin+Pingouin", "Chaleur"),  # serrés en « tortue », les manchots empereurs montent jusqu'à 37 °C au cœur du groupe (Gilbert et al. 2006)  # lot 3
  ("Ptérodactyle+Calcaire", "Fossile"),  # le premier ptérodactyle fossile a été trouvé dans le calcaire de Solnhofen (Bavière), décrit en 1784  # lot 3
  ("Scorpion+Humain", "Douleur"),  # la piqûre de scorpion est très douloureuse  # lot 3
  ("Singe+Fusée", "Astronaute"),  # Albert II (1949) puis le chimpanzé Ham (1961) ont volé dans l'espace avant les humains  # lot 3
  ("Toile d'araignée+Ordinateur", "Internet"),  # clin d'œil : le World Wide Web, « la Toile » en français  # lot 3
  ("Tortue+Temps", "Vieillesse"),  # les tortues terrestres vivent très vieilles : Jonathan, à Sainte-Hélène, a plus de 190 ans  # lot 3
  ("Écureuil+Graine+Temps", "Forêt"),  # l'écureuil enterre des milliers de graines et en oublie une grande part, qui repoussent en forêt (sciencedaily.com, 1998)  # lot 3
  ("Courage+Guerre", "Médaille"),  # les décorations pour bravoure au combat (croix de guerre, médaille militaire)  # lot 3
  ("Courage+Incendie", "Pompier"),  # il faut du courage pour entrer dans le feu : c'est le métier de pompier  # lot 3
  ("Rhume+Miel+Thé", "Remède"),  # le thé au miel, remède de grand-mère qui adoucit la toux (le miel est recommandé par l'OMS contre la toux de l'enfant)  # lot 3
  ("Sueur+Air", "Froid"),  # la sueur qui s'évapore à l'air refroidit la peau  # lot 3
  ("Antibiotique+Maladie", "Santé"),  # l'antibiotique soigne les maladies dues aux bactéries (même logique que Maladie+Remède → Santé)  # lot 4
  ("Bombe atomique+Ville", "Ruine"),  # Hiroshima et Nagasaki, août 1945  # lot 4
  ("Cinéma+Peur", "Cauchemar"),  # un film qui fait peur donne des cauchemars  # lot 4
  ("Chat+Laser", "Jeu"),  # le chat qui court après le point rouge du pointeur laser, jeu connu de tous  # lot 4
  ("Bois+Lunettes+Soleil", "Feu de camp"),  # des verres de presbyte (convergents, cf. Livre+Vieillesse+Œil → Lunettes) concentrent le soleil et allument le bois, comme une loupe  # lot 4
  ("Aimant+Cuivre+Moulin à eau", "Électricité"),  # la roue qui tourne fait bouger l'aimant devant la bobine de cuivre : principe de l'hydroélectricité (cf. Aimant+Cuivre+Mouvement)  # lot 4
  ("Fusée+Panneau solaire+Radio", "Satellite"),  # panneaux + émetteur lancés par une fusée ; Vanguard 1 (1958), premier satellite solaire (nasa.gov, Vanguard 1)  # lot 4
  ("Réseau électrique+Route", "Lampadaire"),  # l'éclairage public est branché sur le réseau le long des routes  # lot 4
  ("Nuit+Smartphone", "Fatigue"),  # l'écran le soir retarde l'endormissement (avis Anses, 14 mai 2019, lumière bleue)  # lot 4
  ("Sous-marin+Épave", "Trésor"),  # on explore les épaves en sous-marin et on y trouve des trésors engloutis  # lot 4
  ("Humain+Station spatiale", "Astronaute"),  # ceux qui vivent dans la station spatiale sont des astronautes  # lot 4
  ("Moisson+Tracteur", "Moissonneuse-batteuse"),  # la moissonneuse est l'engin motorisé de la moisson, cousin du tracteur  # lot 4
  ("Fantôme+Train", "Peur"),  # clin d'œil : le « train fantôme » de la fête foraine, fait pour faire peur  # lot 4
  ("Humain+Neige+Téléphérique", "Ski"),  # on monte en téléphérique pour redescendre à ski  # lot 4
  ("Fossile+Musée", "Dinosaure"),  # au musée, les fossiles sont remontés en squelettes de dinosaures  # lot 4
  ("Pluie+Révolution industrielle", "Pluie acide"),  # le terme « acid rain » forgé en 1872 par R. A. Smith, chimiste à Manchester, ville de l'industrie (Air and Rain, 1872)  # lot 4
  ("Lampadaire+Mer", "Phare"),  # une lumière haut perchée au bord de la mer, pour guider les bateaux  # lot 4
  ("Ailes d'Icare+Moteur", "Avion"),  # le rêve d'Icare enfin réalisé : des ailes + un moteur (comme Moteur+Oiseau → Avion)  # lot 5
  ("Ange+Démon+Humain", "Conscience"),  # clin d'œil : le petit ange et le petit diable sur les épaules, image classique de la conscience  # lot 5
  ("Boîte de Pandore+Curiosité", "Douleur"),  # Pandore ouvre la jarre par curiosité et libère les maux de l'humanité (Hésiode, Les Travaux et les Jours)  # lot 5
  ("Centaure+Arc+Étoile", "Constellation"),  # le Sagittaire est figuré par un centaure archer (constellation du zodiaque)  # lot 5
  ("Dragon+Épée", "Héros"),  # celui qui tue le dragon à l'épée est le héros des légendes (Sigurd et Fafnir, saint Georges)  # lot 5
  ("Feu Magique+Serpent", "Dragon"),  # un serpent qui crache un feu magique : le dragon (cf. Feu+Mythe+Serpent)  # lot 5
  ("Hydre+Étoile", "Constellation"),  # l'Hydre est la plus grande des 88 constellations (UAI)  # lot 5
  ("Humain+Orbe", "Sorcier"),  # la boule de cristal : l'humain qui y lit l'avenir est un sorcier, un devin  # lot 5
  ("Mana+Humain", "Sorcier"),  # un humain qui maîtrise l'énergie magique  # lot 5
  ("Feu+Mana", "Feu Magique"),  # du feu nourri d'énergie magique (cf. Feu+Magie)  # lot 5
  ("Bois+Marteau+Vampire", "Poussière"),  # le vampire qu’on transperce d’un pieu tombe en poussière (image des films et séries)
  ("Temps+Zombie", "Squelette"),  # un mort-vivant reste un corps mort : avec le temps il ne reste que les os (cf. Mort+Temps → Squelette)  # lot 5
  ("Humain+Élixir", "Santé"),  # l'élixir de longue vie des alchimistes : boire l'élixir rend la santé  # lot 5
  ("Comète+Soleil", "Vapeur"),  # près du Soleil, la glace d'eau de la comète se sublime et forme la chevelure (coma) et la queue (NASA)  # lot 5
  ("Constellation+Papier", "Carte"),  # les constellations dessinées sur papier : la carte du ciel des navigateurs et astronomes  # lot 5
  ("Cratère+Dinosaure", "Extinction"),  # le cratère de Chicxulub (Mexique, 66 Ma) signe l'impact qui a éteint les dinosaures non aviens  # lot 5
  ("Gaz+Poussière d'étoiles", "Nébuleuse"),  # une nébuleuse est un nuage de gaz et de poussières interstellaires  # lot 5
  ("Fusée+Robot+Système solaire", "Conquête spatiale"),  # les sondes robotisées lancées par fusée explorent le Système solaire (Voyager 1977)  # lot 5
  ("Mythe+Voie lactée", "Lait"),  # clin d'œil : dans la mythologie grecque la Voie lactée est le lait d'Héra répandu dans le ciel (gala = lait, d'où « galaxie ») (légende)  # lot 5
  ("Bulle de savon+Lumière", "Spectre lumineux"),  # la mince paroi de la bulle décompose la lumière blanche en couleurs irisées (interférences)  # lot 5
  ("Gravité+Inertie+Lune", "Orbite"),  # Newton : la Lune « tombe » vers la Terre (gravité) mais son inertie la fait avancer, d'où l'orbite  # lot 5
  ("Prisme+Sous-marin", "Périscope"),  # les périscopes de sous-marin renvoient l'image par des prismes à réflexion totale  # lot 5
  ("Humain+Rayons X", "Squelette"),  # la radiographie fait voir le squelette à travers la chair (Röntgen, 1895, main de sa femme)  # lot 5
  ("Glace+Nuage+Électricité statique", "Éclair"),  # dans le cumulonimbus, les chocs entre cristaux de glace et grésil séparent les charges : l'électricité statique se décharge en éclair  # lot 5
  ("Laitue+Tomate", "Salade"),  # la salade composée de base : laitue et tomates  # lot 6
  ("Huile+Laitue+Vinaigre", "Salade"),  # laitue + vinaigrette (huile et vinaigre) = une salade verte  # lot 6
  ("Rose+Distillation", "Parfum"),  # l'eau et l'essence de rose s'obtiennent par distillation des pétales (Avicenne, XIe s. ; Grasse) — fr.wikipedia.org/wiki/Huile_essentielle_de_rose  # lot 6
  ("Fleur+Alcool", "Parfum"),  # un parfum = des essences de fleurs dissoutes dans l'alcool (eau de Cologne, 1709)  # lot 6
  ("Poulie+Montagne+Moteur", "Téléphérique"),  # le câble d'un téléphérique tourne sur de grandes poulies entraînées par un moteur  # lot 6
  ("Puits+Son", "Écho"),  # crier dans un puits : la voix revient du fond  # lot 6
  ("Restaurant+Lit", "Hôtel"),  # le gîte (lit) et le couvert (restaurant) : c'est l'hôtel, l'auberge  # lot 6
  ("Rhum+Bateau", "Pirate"),  # clin d'œil : « Yo-ho-ho, et une bouteille de rhum ! », la chanson des pirates de L'Île au trésor (Stevenson, 1883)  # lot 6
  ("Noix de coco+Rhum", "Cocktail"),  # rhum + lait de coco : la piña colada, le punch coco des Antilles  # lot 6
  ("Ruine+Explorateur", "Trésor"),  # les explorateurs cherchent les trésors des cités en ruine (Machu Picchu, Angkor)  # lot 6
  ("Sapin de Noël+Bougie", "Incendie"),  # les bougies sur les sapins ont causé tant d'incendies qu'on les a remplacées par des guirlandes électriques — chroniques-histoire.com (2019) : en 1908, les assureurs américains demandaient leur interdiction  # lot 6
  ("Sapin de Noël+Cadeau+Enfant", "Joie"),  # le matin de Noël : l'enfant découvre ses cadeaux au pied du sapin  # lot 6
  ("Silex taillé+Bois", "Lance"),  # une pointe de silex fixée au bout d'un bâton : la sagaie préhistorique  # lot 6
  ("Stylo+Guerre", "Paix"),  # on met fin à une guerre en signant un traité, un armistice  # lot 6
  ("Trésor+Archéologie", "Musée"),  # les trésors mis au jour par les archéologues finissent au musée (Toutânkhamon au Caire)  # lot 6
  ("Voile+Boussole+Océan", "Grandes découvertes"),  # la caravelle à voiles et la boussole permettent de traverser les océans au XVe s.  # lot 6
  ("Échecs+Riz", "Mathématiques"),  # clin d'œil : la légende de Sissa, un grain sur la 1re case puis on double à chaque case — 2^64−1 grains (légende) — fr.wikipedia.org/wiki/Problème_de_l'échiquier_de_Sissa  # lot 6
  ("Bouquet+Papier", "Cadeau"),  # un bouquet emballé dans du papier : le cadeau du fleuriste  # lot 6
  ("Rose+Rose", "Bouquet"),  # « un bouquet de roses »  # lot 6
  ("Fougère+Sédiment", "Fossile"),  # les empreintes de fougères sont parmi les fossiles végétaux les plus courants (Carbonifère)  # lot 6
  ("Nénuphar+Peinture", "Art"),  # clin d'œil : les Nymphéas de Claude Monet (musée de l'Orangerie)  # lot 6
  ("Riz+Eau+Fermentation", "Alcool"),  # le saké : riz et eau fermentés  # lot 6
  ("Tomate+Pression", "Jus de fruit"),  # le jus de tomate ; botaniquement, la tomate est un fruit  # lot 6
  ("Tournesol+Abeille", "Miel"),  # le miel de tournesol est l'un des miels les plus produits en France  # lot 6
  ("Amidon+Eau+Feu", "Colle"),  # l'amidon cuit dans l'eau donne la colle d'amidon (colle à papier peint, colle des écoliers)  # lot 6
  ("Cristallisation+Magma", "Granite"),  # le granite est un magma qui a cristallisé lentement en profondeur  # lot 6
  ("Engrais+Mer", "Algue"),  # les nitrates des engrais emportés vers la mer provoquent les marées vertes (Bretagne) — fr.wikipedia.org/wiki/Marée_verte  # lot 6
  ("Engrais+Blé+Champ", "Moisson"),  # un champ de blé fertilisé donne une bonne récolte  # lot 6
  ("Méthane+Marais", "Feu follet"),  # l'explication classique des feux follets : gaz des marais (méthane, phosphine) qui s'enflamment — fr.wikipedia.org/wiki/Feu_follet  # lot 6
  ("Biodiversité+Forêt", "Jungle"),  # la forêt tropicale humide abrite plus de la moitié des espèces terrestres  # lot 6
  ("Photosynthèse+Dioxyde de carbone+Eau", "Sucre"),  # 6 CO₂ + 6 H₂O → glucose + 6 O₂ : la plante fabrique son sucre  # lot 6
  ("Pollinisation+Plante", "Graine"),  # une plante pollinisée produit ses graines  # lot 6
  ("Instinct+Abeille", "Ruche"),  # les abeilles bâtissent leurs rayons de cire hexagonaux par instinct, sans apprentissage  # lot 6
  ("Automne+Froid", "Hiver"),  # l'automne se refroidit et devient l'hiver  # lot 7
  ("Automne+Vigne", "Raisin"),  # les vendanges se font en septembre-octobre : la vigne donne ses raisins à l'automne  # lot 7
  ("Ciel+Nuit", "Étoile"),  # la nuit, le ciel se couvre d'étoiles  # lot 7
  ("Coucher de soleil+Poule", "Sommeil"),  # clin d'œil : « se coucher comme les poules » — et c'est vrai, les poules vont se jucher au crépuscule  # lot 7
  ("Feu follet+Cimetière", "Fantôme"),  # les feux follets des cimetières passaient pour des âmes errantes (Wikipédia « Feu follet » ; explication : gaz de décomposition, phosphine et méthane)  # lot 7
  ("Grêle+Humain", "Douleur"),  # un grêlon peut faire mal, voire blesser (les gros grêlons dépassent 5 cm)  # lot 7
  ("Marée+Barrage", "Énergie"),  # usine marémotrice de la Rance (1966) : un barrage turbine la marée, c'est l'énergie marémotrice  # lot 7
  ("Ouragan+Bateau", "Épave"),  # un ouragan coule ou jette les bateaux à la côte  # lot 7
  ("Pluie acide+Fer", "Rouille"),  # les pluies acides accélèrent la corrosion du fer (ponts, grilles, statues métalliques)  # lot 7
  ("Printemps+Chaleur", "Été"),  # le printemps qui se réchauffe devient l'été  # lot 7
  ("Oiseau+Printemps", "Nid"),  # le printemps est la saison des nids chez la plupart des oiseaux d'Europe  # lot 7
  ("Chien+Tonnerre", "Peur"),  # beaucoup de chiens ont peur de l'orage et se cachent au premier coup de tonnerre  # lot 7
  ("Marteau+Tonnerre", "Dieu"),  # clin d'œil : Thor, dieu nordique du tonnerre, et son marteau Mjöllnir (mythologie, pas de personnage sous licence)  # lot 7
  ("Tsunami+Ville", "Inondation"),  # le tsunami de 2011 au Japon a noyé des villes côtières entières  # lot 7
  ("Sel+Verglas", "Eau salée"),  # le sel de déneigement fait fondre le verglas : il reste de l'eau salée (le sel abaisse le point de fusion de la glace)  # lot 7
  ("Delta+Agriculture", "Riz"),  # les deltas sont des terres de rizières : Mékong, Gange, Nil, Camargue (Rhône)  # lot 7
  ("Iceberg+Bateau", "Épave"),  # le Titanic a coulé après avoir heurté un iceberg, dans la nuit du 14 au 15 avril 1912  # lot 7
  ("Oasis+Humain", "Village"),  # les humains s'installent autour des oasis : villages et ksour du Sahara  # lot 7
  ("Toundra+Été", "Marais"),  # l'été, le dessus du pergélisol dégèle et la toundra se couvre de mares et de tourbières  # lot 7
  ("Feu+Tourbe", "Chaleur"),  # la tourbe séchée se brûle pour se chauffer (Irlande, Écosse)  # lot 7
  ("Clou+Contreplaqué+Marteau", "Cabane"),  # des planches de contreplaqué clouées au marteau : la cabane bricolée  # lot 7
  ("Diamant+Or", "Trésor"),  # de l'or et des diamants : un trésor  # lot 7
  ("Foin+Tissu", "Lit"),  # la paillasse : un sac de toile bourré de paille ou de foin, longtemps le lit des campagnes  # lot 7
  ("Foin+Humain", "Rhume"),  # clin d'œil : le « rhume des foins » — en réalité une allergie au pollen des graminées, au moment des foins  # lot 7
  ("Goudron+Mammouth+Temps", "Fossile"),  # les fosses à bitume de La Brea (Los Angeles) ont piégé et conservé des mammouths pendant des dizaines de milliers d'années  # lot 7
  ("Humain+Obsidienne+Pierre", "Couteau"),  # on taille l'obsidienne avec une pierre : lames plus tranchantes qu'un scalpel (Aztèques, préhistoire)  # lot 7
  ("Huile+Ocre", "Peinture"),  # l'ocre broyée dans l'huile donne la peinture à l'huile ocre  # lot 7
  ("Ciment+Eau+Pierre ponce", "Béton"),  # béton léger : les Romains ont coulé la coupole du Panthéon avec de la pierre ponce dans le haut  # lot 7
  ("Soie+Tisserand", "Tissu"),  # le tisserand tisse le fil de soie : la soierie (soieries de Lyon)  # lot 7
]
