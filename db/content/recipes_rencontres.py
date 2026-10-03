# Recettes : passe « rencontres improbables » — des domaines éloignés qui se rencontrent pour de vrai (Poisson+Verre → Aquarium).
# Recherche par lots, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  ("Pansement+Pharaon", "Momie"),  # un pharaon tout enroulé dans des bandes : une momie
  ("Chenille+Élevage", "Soie"),  # on élève la chenille du ver à soie pour son cocon en soie (source : fr.wikipedia.org/wiki/Sériciculture)
  ("Horloge+Sable", "Sablier"),  # une horloge qui marche avec du sable : un sablier
  ("Atome+Guerre", "Bombe atomique"),  # l'atome utilisé pour la guerre a donné la bombe atomique (Hiroshima, 1945)
  ("Arbre+Maison", "Cabane"),  # une maison dans un arbre : une cabane
  ("Moyen Âge+Musique", "Troubadour"),  # le musicien poète du Moyen Âge, c'est le troubadour
  ("Cheval+Moyen Âge", "Chevalier"),  # au Moyen Âge, le guerrier à cheval est le chevalier
  ("Poussin+Temps", "Poule"),  # avec le temps, le poussin grandit et devient une poule
  ("Poisson+Verre", "Aquarium"),  # un poisson derrière une vitre : c'est un aquarium
  ("Insecte+Résine", "Ambre"),  # un insecte piégé dans la résine durcie, c'est le célèbre morceau d'ambre
  ("Chien+Neige", "Traîneau"),  # des chiens qui tirent sur la neige : le traîneau à chiens
  ("Or+Roi", "Couronne"),  # l'or posé sur la tête du roi : une couronne
  ("Dinosaure+Évolution", "Oiseau"),  # les oiseaux descendent des petits dinosaures à plumes (source : fr.wikipedia.org/wiki/Histoire_évolutive_des_oiseaux)
  ("Singe+Évolution", "Humain"),  # l'humain et les grands singes ont un ancêtre commun : c'est l'évolution qui a donné l'humain
  ("Foin+Vêtement", "Épouvantail"),  # des vieux vêtements bourrés de paille, c'est un épouvantail
  ("Cheval+Chaussure", "Fer à cheval"),  # la « chaussure » du cheval, c'est le fer à cheval
  ("Préhistoire+Peinture", "Grotte ornée"),  # les peintures de la préhistoire sont sur les parois des grottes ornées comme Lascaux
  ("Préhistoire+Outil", "Silex taillé"),  # l'outil des hommes de la préhistoire, c'est le silex taillé
  ("Lion+Pharaon", "Sphinx"),  # un corps de lion avec la tête d'un pharaon : le Sphinx de Gizeh (source : fr.vikidia.org/wiki/Sphinx_de_Gizeh)
  ("Lion+Parc", "Zoo"),  # un parc où l'on va voir des lions, c'est un zoo (parc zoologique)
  ("Silex+Acier", "Feu"),  # on frappe le silex contre l'acier pour faire jaillir des étincelles : c'est le vieux briquet
  ("Lentille+Soleil", "Feu"),  # une loupe qui concentre le soleil peut allumer un feu
  ("Explosion+Maïs", "Pop-corn"),  # le grain de maïs éclate sous la chaleur : c'est le pop-corn
  ("Galaxie+Lait", "Voie lactée"),  # « galaxie » vient du grec gala, « lait » : notre galaxie s'appelle la Voie lactée (source : Larousse, article galaxie)
  ("Métal+Chevalier", "Armure"),  # le chevalier se protège avec une armure de métal
  ("Charbon+Bateau", "Bateau à vapeur"),  # les bateaux à vapeur brûlaient du charbon pour avancer
  ("Température+Médecin", "Thermomètre"),  # le médecin prend la température avec un thermomètre
  ("Naissance+Œuf", "Poussin"),  # quand l'œuf éclot, un poussin naît
  ("Oiseau+Peur", "Épouvantail"),  # l'épouvantail sert à faire peur aux oiseaux
  ("Route+Soie", "Commerce"),  # la route de la soie reliait la Chine à l'Europe pour le commerce
  ("Mammouth+Peinture", "Grotte ornée"),  # les hommes préhistoriques peignaient des mammouths sur les parois des grottes (source : grotte de Rouffignac, « grotte aux cent mammouths »)
  ("Sable+Verre", "Sablier"),  # du sable qui coule dans du verre : un sablier
  ("Plante+Verre", "Serre"),  # les plantes poussent à l'abri sous une maison de verre : une serre
  ("Fumée+Usine", "Pollution"),  # la fumée des cheminées d'usine salit l'air : c'est la pollution
  ("Banquise+Maison", "Igloo"),  # sur la banquise, la maison des Inuits est un igloo en blocs de neige
  ("Lumière+Port", "Phare"),  # la lumière qui guide les bateaux à l'entrée du port : un phare
  ("Lit+Nuit", "Sommeil"),  # la nuit, au lit, on dort
  ("Ciel+Tour", "Gratte-ciel"),  # une tour si haute qu'elle « gratte le ciel »
  ("Radiation+Squelette", "Rayons X"),  # les rayons X traversent le corps et montrent le squelette à la radio
  ("Bois+Castor", "Barrage"),  # le castor construit un barrage avec du bois
  ("Cinéma+Maïs", "Pop-corn"),  # au cinéma, on mange du pop-corn, fait avec du maïs
  ("Enzyme+Lait", "Fromage"),  # la présure, une enzyme, fait cailler le lait pour faire le fromage (source : synpa.org, « Définition Présure »)
  ("Sous-marin+Œil", "Périscope"),  # l'œil du sous-marin qui regarde au-dessus de l'eau : le périscope
  ("Enfant+Ours", "Ours en peluche"),  # l'ours de l'enfant, c'est son ours en peluche
  ("Enfant+Vent", "Cerf-volant"),  # quand il y a du vent, l'enfant fait voler son cerf-volant
  ("Enfant+Savon", "Bulle de savon"),  # l'enfant souffle dans l'eau savonneuse pour faire des bulles
  ("Château+Pont", "Pont-levis"),  # le pont du château qu'on relève pour le fermer : le pont-levis
  ("Cheval+Grèce antique", "Cheval de Troie"),  # les Grecs ont pris Troie en se cachant dans un cheval de bois
  ("Neige+Père Noël", "Traîneau"),  # le Père Noël voyage sur la neige en traîneau
  ("Père Noël+Sapin", "Sapin de Noël"),  # le sapin du Père Noël, c'est le sapin de Noël
  ("Neige+Sculpture", "Bonhomme de neige"),  # une sculpture en neige, c'est un bonhomme de neige
  ("Cochon+Monnaie", "Tirelire"),  # on glisse les pièces dans un petit cochon : une tirelire
  ("Parapluie+Soleil", "Parasol"),  # un parapluie contre le soleil, c'est un parasol
  ("Bois+Phosphore", "Allumette"),  # un bâtonnet de bois et du phosphore pour l'enflammer : une allumette (source : fr.vikidia.org/wiki/Allumette)
  ("Laboratoire+Orbite", "Station spatiale"),  # un laboratoire qui tourne autour de la Terre : une station spatiale
  ("Maison+Neige", "Igloo"),  # la maison de neige des Inuits
  ("Jardin+Verre", "Serre"),  # un jardin sous verre
  ("Fumée+Ville", "Pollution"),  # la fumée qui stagne sur la ville
  ("Parapluie+Plage", "Parasol"),  # le parapluie de la plage
  ("Bois+Soufre", "Allumette"),  # la tige de bois à tête soufrée
  ("Poisson+Zoo", "Aquarium"),  # le zoo des poissons
  ("Pluie+Pollution", "Pluie acide"),  # la pollution retombe avec la pluie
  ("Allumette+Bois", "Feu de camp"),  # on allume le bois avec une allumette
  ("Mur+Papier", "Papier peint"),  # du papier collé sur un mur : du papier peint
  ("Pirate+Île", "Trésor"),  # les pirates enterrent leur trésor sur une île, comme dans L'Île au trésor
  ("Pirate+Carte", "Trésor"),  # la carte d'un pirate, c'est une carte au trésor
  ("Église+Verre", "Vitrail"),  # le verre coloré des fenêtres d'église, ce sont les vitraux
  ("Téléphone+Appareil photo", "Smartphone"),  # un téléphone qui prend des photos : le smartphone
  ("Silicium+Soleil", "Panneau solaire"),  # les panneaux solaires sont faits de silicium qui transforme la lumière en électricité
  ("Électricité statique+Nuage", "Éclair"),  # l'éclair est une énorme décharge d'électricité statique accumulée dans le nuage
  ("Naissance+Gâteau", "Gâteau d'anniversaire"),  # on fête le jour de sa naissance avec un gâteau d'anniversaire
  ("Ciseaux+Mouton", "Laine"),  # on tond le mouton aux ciseaux pour récolter sa laine
  ("Gâteau+Maison", "Maison en pain d'épices"),  # une maison faite en gâteau, comme dans Hansel et Gretel
  ("Fenêtre+Église", "Vitrail"),  # les fenêtres colorées des églises sont des vitraux
  ("Citrouille+Fée", "Carrosse"),  # dans Cendrillon, la fée change la citrouille en carrosse
  ("Alchimie+Plomb", "Or"),  # le rêve des alchimistes : changer le plomb en or
  ("Bronze+Jeux olympiques", "Médaille"),  # aux Jeux olympiques, la troisième place gagne la médaille de bronze
  ("Cheval+Fer", "Fer à cheval"),  # le fer que l'on cloue sous le sabot du cheval
]
