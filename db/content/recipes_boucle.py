# Recettes : passe « boucle » — les éléments sans usage deviennent ingrédients, deuxièmes chemins, multiples de soi
# Recherche par groupe de familles, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  # ===================== CRÉATIONS HUMAINES (A-L) =====================
  ("Bûcheron+Forêt", "Bois"),                         # le bûcheron abat les arbres de la forêt et en tire du bois
  ("Caoutchouc+Crayon", "Gomme"),                     # le morceau de caoutchouc qui efface le crayon, c'est la gomme (celle au bout du crayon)
  ("Carrosse+Moteur", "Voiture"),                     # la Daimler de 1886 est une calèche commandée chez un carrossier, sur laquelle on a monté un moteur
  ("Fontaine+Magie", "Élixir"),                       # la fontaine de Jouvence, dont l'eau magique rend la jeunesse (légende)
  ("Commerce+Cuisinier", "Restaurant"),               # un cuisinier qui vend ses plats ouvre un restaurant
  ("Archéologie+Dolmen", "Âge de pierre"),            # les fouilles des dolmens datent la fin de l'âge de pierre (Néolithique)
  ("Blouse blanche+Hôpital", "Médecin"),              # à l'hôpital, celui qui porte la blouse blanche, c'est le médecin
  ("Bonhomme de neige+Soleil", "Eau"),                # au soleil, le bonhomme de neige fond et il ne reste qu'une flaque d'eau
  ("Gâteau d'anniversaire+Gâteau d'anniversaire+Gâteau d'anniversaire", "Vieillesse"),  # les anniversaires qui s'enchaînent : on vieillit
  ("Chien+Feu d'artifice", "Peur"),                   # les détonations des feux d'artifice terrorisent les chiens
  ("Bibliothèque+Feu", "Incendie"),                   # des milliers de livres en papier, c'est du combustible : le feu y devient incendie
  ("Grange+Éclair", "Incendie"),                      # la foudre frappe la grange isolée au milieu des champs, le foin s'embrase
  ("Caramel+Feu", "Charbon"),                         # chauffé au-delà de 190 °C, le caramel noircit et se carbonise en « charbon de sucre »
  ("Hôtel+Médecine", "Hôpital"),                      # des lits et des soins
  ("Cimetière+Esprit", "Fantôme"),                    # l'esprit qui hante le cimetière (légende)
  ("Biscuit+Maison+Sucre", "Maison en pain d'épices"),  # murs et toit en biscuit, collés à la glace royale (sucre glace)
  ("Arche+Oiseau+Olive", "Paix"),                     # la colombe revient à l'arche avec un rameau d'olivier : c'est devenu le symbole de la paix
  ("Cabane+Cabane+Cabane", "Village"),                # plusieurs cabanes regroupées forment un village (comme les villages préhistoriques de huttes)
  ("Berger+Ciseaux+Mouton", "Laine"),                 # au printemps, le berger tond ses moutons aux ciseaux (forces) et récolte la laine
  ("Bambou+Corde+Hameçon+Humain", "Pêcheur"),         # une perche de bambou, une ligne et un hameçon : la canne à pêche ; quelqu'un qui la tient, c'est un pêcheur
  ("Confiture+Crêpe+Crêpe+Crêpe", "Gâteau"),          # des crêpes empilées avec de la confiture entre chaque couche : le gâteau de crêpes
  ("Arrosoir+Graine+Poterie+Terre", "Pot de fleurs"),  # on remplit un pot de terre, on sème la graine, on arrose : une fleur en pot pousse
  # ===================== CRÉATIONS HUMAINES (M-Z) =====================
  ("Maladie+Médecin", "Remède"),                      # le médecin examine le malade et prescrit le remède (puis Maladie+Remède → Santé)
  ("Menuisier+Verre", "Fenêtre"),                     # le menuisier du bâtiment fait et pose les fenêtres : il encadre la vitre
  ("Fleur+Potier", "Pot de fleurs"),                  # le potier tourne le pot de terre cuite où l'on met la fleur
  ("Gravité+Parapluie", "Parachute"),                 # un parapluie freine la chute : Lenormand saute d'un arbre avec deux parapluies, puis invente le parachute (1783)
  ("Enfant+Parc", "Jeu"),                             # au parc, les enfants jouent (toboggan, balançoire, cache-cache)
  ("Patin à glace+Ski", "Sport"),                     # le ski et le patinage, ce sont les sports d'hiver
  ("Échecs+Ordinateur", "Intelligence artificielle"),  # un ordinateur qui joue aux échecs : Deep Blue bat Kasparov en 1997
  ("Désert+Puits", "Oasis"),                          # un point d'eau au milieu du désert
  ("Sorcier+Soupe", "Potion"),                        # la « soupe » que le sorcier touille dans son chaudron, c'est sa potion
  ("Médaille+Pompier", "Héros"),                      # le pompier décoré pour acte de courage et de dévouement est un héros
  ("Momie+Pyramide", "Égypte ancienne"),              # les momies des pharaons dans les pyramides
  ("Amour+Pantoufle de verre", "Mariage"),            # le prince amoureux retrouve Cendrillon grâce à la pantoufle et l'épouse
  ("Enfant+Maison en pain d'épices", "Sorcier"),      # la maison en pain d'épices est le piège de la sorcière pour attirer les enfants (Hansel et Gretel)
  ("Étain+Verre", "Miroir"),                          # le miroir « au tain » : une feuille d'étain amalgamée au mercure derrière la glace (Venise, XVIe s.)
  ("Feu de camp+Humain+Tambour", "Danse"),            # autour du feu, au son du tambour, les gens dansent
  ("Légume+Pelle+Terre", "Potager"),                  # on bêche la terre et on y plante des légumes : c'est un potager
  ("Enfant+Nuit+Sapin de Noël", "Père Noël"),         # la nuit de Noël, l'enfant attend que le Père Noël passe déposer les cadeaux au pied du sapin
  ("Pêcheur+Phare+Village", "Port"),                  # un village de pêcheurs avec son phare, c'est un petit port
  ("Pot de fleurs+Pot de fleurs+Pot de fleurs", "Jardin"),  # beaucoup de pots de fleurs alignés font un jardin (de balcon, de terrasse)
  ("Feu+Mer+Tour", "Phare"),                          # les premiers phares étaient une tour au bord de la mer avec un feu au sommet (Alexandrie)
  ("Arbre+Prairie+Ville", "Parc"),                    # des arbres et une pelouse fleurie au milieu de la ville : c'est un parc
  ("Sport+Sport+Sport+Sport", "Jeux olympiques"),     # beaucoup de sports réunis en une seule grande compétition : les Jeux olympiques
  ("Air+Feu+Panier+Tissu", "Montgolfière"),           # le brûleur chauffe l'air dans l'enveloppe de tissu, les passagers voyagent dans la nacelle en osier
  # ===================== VIVANT =====================
  ("Dauphin+Son", "Écho"),                            # le dauphin émet des clics et écoute leur écho pour se repérer (écholocation)
  ("Hérisson+Hiver", "Sommeil"),                      # le hérisson hiberne, il dort de novembre à mars
  ("Bouquet+Tombe", "Deuil"),                         # on dépose des fleurs sur la tombe d'un proche disparu
  ("Cauchemar+Humain", "Sueur"),                      # la peur d'un mauvais rêve fait transpirer, on se réveille en sueur (sueur froide, sans chaleur)
  ("Instinct+Oiseau", "Nid"),                         # l'oiseau construit son nid sans qu'on le lui apprenne, par instinct
  ("Aigle+Empire", "Blason"),                         # l'aigle des armoiries impériales (Rome, Napoléon)
  ("Sueur+Soleil", "Sel"),                            # la sueur sèche au soleil et laisse des traces blanches de sel sur la peau et le tee-shirt
  ("Chameau+Sel", "Commerce"),                        # les caravanes de dromadaires (azalaï) portent les plaques de sel de Taoudeni jusqu'à Tombouctou pour les vendre
  ("Herbe+Herbe", "Prairie"),                         # beaucoup d'herbe à perte de vue, c'est une prairie (multiple de soi)
  ("Ours polaire+Phoque", "Chasse"),                  # l'ours polaire chasse le phoque sur la banquise
  ("Grillon+Grenouille+Serpent", "Chaîne alimentaire"),  # la grenouille mange le grillon, le serpent mange la grenouille
  ("Cafard+Microbe+Humain", "Maladie"),               # les blattes transportent sur leurs pattes des microbes (salmonelles…) jusqu'à notre nourriture et nous rendent malades
  ("Oiseau marin+Île+Temps", "Engrais"),              # les fientes des oiseaux marins s'accumulent pendant des siècles sur les îles et forment le guano, engrais exploité au Pérou
  ("Fougère+Marais+Pression", "Charbon"),             # au Carbonifère, les fougères géantes des marécages, enfouies et comprimées, sont devenues la houille
  ("Noix de coco+Soleil+Pression", "Huile"),          # la chair de coco séchée au soleil (coprah) est pressée pour donner l'huile de coco
  ("Abeille+Abeille+Abeille", "Ruche"),               # des milliers d'abeilles ensemble forment une colonie, la ruche (multiple de soi)
  ("Récif+Poisson Tropical+Étoile de mer+Crabe", "Biodiversité"),  # les récifs coralliens abritent environ un quart des espèces marines sur moins de 1 % des fonds
  ("Savane+Lion+Girafe+Zèbre", "Écosystème"),         # la savane africaine, ses herbivores et ses prédateurs forment un écosystème
  # ===================== TECHNIQUE =====================
  ("Montgolfière+Humain", "Pilote"),                  # un humain qui conduit une montgolfière est un pilote (aéronaute) ; Pilâtre de Rozier, 21 nov. 1783
  ("Moto+Route", "Vitesse"),                          # la moto qui file sur la route
  ("Bulle de savon+Enfant", "Jeu"),                   # souffler des bulles de savon est un jeu d'enfant universel
  ("Antimatière+Atome", "Radiation"),                 # matière et antimatière s'annihilent et toute leur masse part en rayons gamma
  ("Radiotélescope+Galaxie", "Trou noir"),            # 2019 : un réseau de radiotélescopes photographie le trou noir au centre de la galaxie M87
  ("Lunettes+Étoile", "Télescope"),                   # la lunette astronomique vient d'un lunetier (Lippershey, 1608) ; braquer des verres de lunettes sur les étoiles
  ("Électroaimant+Aimant", "Moteur"),                 # un électroaimant qui tourne entre des aimants est le principe du moteur électrique
  ("Humain+Vaccin", "Santé"),                         # le vaccin protège des maladies
  ("Smartphone+Satellite", "GPS"),                    # le téléphone capte les satellites et sert de GPS, comme Carte+Satellite
  ("Bougie+Vent", "Fumée"),                           # on souffle une bougie, un filet de fumée blanche s'en échappe
  ("Huile+Œuf+Vinaigre", "Mayonnaise"),               # jaune d'œuf, huile et un filet de vinaigre, la mayonnaise classique
  ("Moulin à eau+Machine+Coton", "Usine"),            # Cromford (1771), la machine à filer le coton d'Arkwright mue par une roue à eau, première usine
  ("Voiture+Outil+Humain", "Mécanicien"),             # l'humain qui répare les voitures avec ses outils est mécanicien
  ("Laser+Hydrogène+Hydrogène", "Fusion nucléaire"),  # NIF, déc. 2022, 192 lasers compriment une bille de deutérium-tritium et l'allument
  ("Appareil photo+Ordinateur+Téléphone", "Smartphone"),  # un téléphone qui est aussi ordinateur et appareil photo, c'est un smartphone
  ("Soie+Bambou+Corde+Vent", "Cerf-volant"),          # les premiers cerfs-volants chinois : soie tendue sur des baguettes de bambou, au bout d'un fil, dans le vent
  ("Satellite+Satellite+Satellite+Satellite", "GPS"),  # il faut capter 4 satellites pour un point GPS (3 pour la position, 1 pour l'horloge)
  ("Éolienne+Ville", "Réseau électrique"),            # les éoliennes alimentent le réseau de la ville
  ("Antibiotique+Bactérie+Reproduction+Temps", "Évolution"),  # seules les bactéries résistantes survivent et se multiplient : la sélection naturelle en direct
  # ===================== LÉGENDES, HISTOIRE ET COSMOS =====================
  ("Centaure+Enfant", "Héros"),                       # le centaure Chiron élève Achille, Jason, Actéon et en fait des héros (mythe grec)
  ("Chat botté+Ogre", "Château"),                     # Perrault (1697), le chat ruse l'ogre (changé en souris, mangé) et prend son château pour son maître
  ("Démon+Sommeil", "Cauchemar"),                     # « cauche-mare », le démon nocturne (mare) qui foule le dormeur ; c'est l'étymologie du mot
  ("Feu Magique+Oiseau", "Phénix"),                   # l'oiseau qui s'embrase et renaît de son bûcher (Hérodote, Ovide)
  ("Grotte ornée+Archéologie", "Préhistoire"),        # l'étude de Lascaux (1940) ou Chauvet (1994) révèle la vie des humains de la préhistoire
  ("Kraken+Bateau", "Épave"),                         # légende scandinave (Pontoppidan, 1752) : le kraken entraîne les navires par le fond
  ("Mana+Cristal", "Orbe"),                           # dans les jeux et contes de fantasy, la réserve d'énergie magique (mana) enfermée dans un cristal en fait un orbe magique
  ("Marée lunaire+Moulin", "Moulin à eau"),           # moulin à marée (Bretagne, dès le Moyen Âge) : le bassin rempli à marée montante fait tourner la roue en se vidant
  ("Phénix+Larme", "Remède"),                         # Harry Potter et la Chambre des secrets : les larmes du phénix Fumseck guérissent la blessure du basilic
  ("Vampire+Soleil", "Cendre"),                       # depuis Nosferatu (1922) et le Dracula de la Hammer (1958), le vampire part en cendres à la lumière du jour
  ("Père Noël+Enfant", "Joie"),                       # le Père Noël apporte les cadeaux aux enfants, qui sont fous de joie
  ("Épave+Archéologie", "Musée"),                     # archéologie sous-marine : le navire Vasa (coulé en 1628, renfloué en 1961) a son propre musée à Stockholm, comme la Mary Rose à Portsmouth
  ("Mythe+Mythe", "Mythologie"),                      # une mythologie est l'ensemble des mythes d'un peuple ; plusieurs mythes, un cran au-dessus
  ("Sirène+Bateau+Falaise", "Épave"),                 # le chant des sirènes (Odyssée XII) ou de la Lorelei attire les marins sur les rochers et le navire s'y fracasse
  ("Constellation+Soleil+Saison", "Calendrier"),      # le lever de Sirius juste avant le Soleil annonçait la crue du Nil et ouvrait l'année égyptienne ; les étoiles qui se lèvent avec le Soleil disent la saison
  ("Licorne+Lion+Roi", "Blason"),                     # armoiries royales du Royaume-Uni (Jacques VI/Ier, 1603) : le lion anglais et la licorne écossaise soutiennent l'écu
  ("Dieu+Dieu+Dieu", "Olympe"),                       # « l'Olympe » désigne aussi l'assemblée des douze dieux grecs ; beaucoup de dieux réunis
  ("Argent+Loup-garou", "Mort"),                      # la balle d'argent qui tue le loup-garou (tradition populaire moderne)
  ("Or+Volcan+Sorcier", "Anneau de Pouvoir"),         # Tolkien : le sorcier Sauron forge l'Anneau unique, en or, dans les feux du volcan Orodruin (Montagne du Destin)
  ("Pirate+Île+Carte+Pelle", "Trésor"),               # L'Île au trésor (Stevenson, 1883) : le pirate enterre son butin sur une île, la carte marque l'endroit, on creuse
  ("Éclipse+Étoile+Gravité+Télescope", "Relativité"),  # Eddington, 29 mai 1919 : pendant l'éclipse, il photographie au télescope des étoiles déviées par la gravité du Soleil, preuve de la relativité générale
  # ===================== NATURE =====================
  ("Atoll+Atoll", "Archipel"),                        # les Maldives sont un archipel fait de 26 atolls ; plusieurs atolls = un archipel (multiple de soi)
  ("Dune+Dune", "Désert"),                            # une mer de dunes (erg, Sahara) est un désert ; cohérent avec Sable+Sable → Désert (multiple de soi)
  ("Blizzard+Montagne", "Avalanche"),                 # la neige lourde et le vent d'un blizzard chargent les pentes ; les avalanches suivent dans les 24 h
  ("Buée+Froid", "Givre"),                            # quand la vitre gèle, la buée se change en givre (les « fleurs de givre » des fenêtres)
  ("Éclair+Tonnerre", "Orage"),                       # l'éclair et le tonnerre : c'est l'orage
  ("Tsunami+Centrale nucléaire", "Radiation"),        # Fukushima, 2011 : le tsunami coupe le refroidissement de la centrale, des radiations s'échappent
  ("Sapin+Toundra", "Taïga"),                         # la taïga est la forêt de conifères qui borde la toundra ; des sapins qui gagnent la toundra font de la taïga
  ("Désert de sel+Pluie", "Miroir"),                  # à la saison des pluies, une fine couche d'eau sur le salar d'Uyuni en fait le plus grand miroir du monde
  ("Avalanche+Village", "Ruine"),                     # une avalanche qui descend sur un village écrase et ensevelit les maisons (Galtür, 1999)
  ("Fjord+Bateau", "Port"),                           # un fjord est un bras de mer profond et abrité, un port naturel pour les bateaux (Bergen, Oslo)
  ("Magma+Mer", "Source hydrothermale"),              # sous la mer, l'eau qui s'infiltre est chauffée par le magma et ressort très chaude (îles Éoliennes, Méditerranée)
  ("Ferme+Tornade", "Ruine"),                         # une tornade arrache les toits et rase les fermes des grandes plaines
  ("Humain+Verglas", "Douleur"),                      # sur le verglas, on glisse et on tombe : aïe
  ("Océan+Volcan+Volcan", "Archipel"),                # chaque volcan sous-marin qui émerge fait une île (Océan+Volcan → Île) ; plusieurs volcans = un archipel (Hawaï, Açores)
  ("Air+Chaleur+Éclair", "Tonnerre"),                 # l'éclair chauffe l'air à environ 30 000 °C ; l'air se dilate d'un coup et l'onde de choc s'entend comme le tonnerre
  ("Archipel+Oiseau+Évolution", "Espèce"),            # les pinsons de Darwin : un seul oiseau ancêtre a donné une douzaine d'espèces, d'île en île des Galápagos
  ("Mer+Ouragan+Ville", "Inondation"),                # l'ouragan pousse la mer sur la côte (onde de tempête) : Katrina a noyé 80 % de La Nouvelle-Orléans
  ("Fleur+Neige+Soleil", "Printemps"),                # le soleil fait fondre la neige et les premières fleurs sortent (perce-neige, crocus) : c'est le printemps
  ("Feuille+Froid+Vent", "Automne"),                  # un vent qui devient froid et emporte les feuilles : l'automne
  ("Feu de forêt+Graine+Pluie", "Prairie"),           # après l'incendie, les graines restées dans le sol germent à la première pluie ; herbes et fleurs couvrent d'abord la zone brûlée
  ("Hiver+Nuit+Pluie+Route", "Verglas"),              # le regel : en hiver, la route mouillée par la pluie refroidit sous zéro pendant la nuit et l'eau y gèle en verglas (Météo-France)
]
