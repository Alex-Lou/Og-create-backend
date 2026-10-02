# Recettes : palier 3 (culture commune), huit domaines
# Recherche par domaine, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  # ===================== CHÂTEAU ET MOYEN ÂGE =====================
  ("Acier+Vêtement", "Armure"),                       # l'armure de plates (harnois blanc) est un « vêtement » fait de plaques d'acier articulées (XIVe-XVe s.)
  ("Château+Eau", "Douves"),                          # on remplit d'eau le fossé qui entoure le château : ce sont les douves
  ("Douves+Pont", "Pont-levis"),                      # le pont qui franchit les douves se relève pour fermer l'entrée : le pont-levis
  ("Chevalier+Famille+Peinture", "Blason"),           # XIIe s. : les armoiries peintes sur l'écu identifient le chevalier et se transmettent dans sa famille
  ("Église+Tombe", "Cimetière"),                      # au Moyen Âge, on enterre les morts autour de l'église : le cimetière paroissial
  ("Religion+Village", "Église"),                     # chaque village a son église, lieu de culte de la paroisse
  ("Armure+Cheval+Humain", "Chevalier"),              # un homme en armure monté à cheval : le chevalier
  ("Colline+Mur+Tour", "Château"),                    # murailles et tour bâties sur une hauteur : le château fort (motte, éperon rocheux)
  ("Cheval+Fer+Forgeron", "Fer à cheval"),            # le forgeron (maréchal-ferrant) forge un fer et le cloue sous le sabot du cheval
  ("Catapulte+Château", "Ruine"),                     # les pierres de la catapulte abattent les murailles du château
  ("Bois+Corde+Guerre+Pierre", "Catapulte"),          # engin de siège en bois, actionné par des cordes, qui lance des pierres contre les murs
  ("Église+Peinture+Plomb+Verre", "Vitrail"),         # verres colorés peints (grisaille), sertis dans des baguettes de plomb, posés aux fenêtres des églises
  ("Amour+Château+Humain+Musique", "Troubadour"),     # poète-musicien qui chante l'amour courtois (fin'amor) dans les cours des châteaux
  # ===================== CONTES ET LÉGENDES =====================
  ("Automne+Légume", "Citrouille"),                   # la citrouille est LE légume d'automne (récolte sept.-oct., Halloween)
  ("Baguette+Citrouille", "Carrosse"),                # Perrault, Cendrillon (1697) : la marraine frappe la citrouille de sa baguette, elle devient un carrosse doré
  ("Bois+Fée", "Baguette"),                           # la fée tient une baguette (Perrault, Cendrillon : « la frappa de sa baguette »)
  ("Esprit+Lampe à huile", "Génie"),                  # Mille et une nuits (Galland, Aladdin ou la Lampe merveilleuse) : un génie, esprit, habite la lampe
  ("Faim+Géant", "Ogre"),                             # Perrault, Le Petit Poucet : l'ogre est un géant qui mange les petits enfants
  ("Botte+Chat", "Chat botté"),                       # Perrault, Le Maître Chat ou le Chat botté : le chat demande une paire de bottes
  ("Botte+Ogre", "Bottes de sept lieues"),            # Perrault, Le Petit Poucet : Poucet retire à l'ogre endormi ses bottes de sept lieues
  ("Cheval+Charrette+Roi", "Carrosse"),               # en vrai : le carrosse est la voiture à chevaux des rois et des grands (XVIe-XVIIIe s.)
  ("Chaussure+Fée+Verre", "Pantoufle de verre"),      # Perrault : la marraine donne à Cendrillon « une paire de pantoufles de verre »
  ("Botte+Magie+Vitesse", "Bottes de sept lieues"),   # Perrault : bottes « fées » qui font faire sept lieues à chaque enjambée
  ("Friction+Humain+Lampe à huile", "Génie"),         # Galland : la mère d'Aladdin frotte la lampe pour la nettoyer, le génie apparaît
  ("Citrouille+Fée+Lézard+Souris", "Carrosse"),       # Perrault : citrouille → carrosse, souris → chevaux, lézards → laquais, tout l'équipage
  ("Forêt+Gâteau+Maison+Sucre", "Maison en pain d'épices"),  # Grimm, Hansel et Gretel : au fond de la forêt, une maison de gâteau et de sucre
  # ===================== BRICOLAGE ET OUTILS =====================
  ("Bois+Fer+Marteau", "Clou"),                       # la tige de fer qu'on enfonce au marteau dans le bois
  ("Chaleur+Résine", "Colle"),                        # la résine de pin chauffée devient la poix, colle et mastic d'étanchéité depuis la préhistoire
  ("Corde+Roue", "Poulie"),                           # une poulie, c'est une roue à gorge dans laquelle passe une corde
  ("Poulie+Tour", "Grue"),                            # les grues romaines étaient un mât muni de poulies pour hisser les pierres
  ("Arbre+Bois+Clou", "Cabane"),                      # des planches clouées entre les branches : la cabane dans les arbres
  ("Colle+Maison+Mur+Papier", "Papier peint"),        # on encolle des lés de papier sur les murs de la maison
  ("Humain+Moteur+Outil", "Mécanicien"),              # celui qui entretient et répare les moteurs avec ses outils
  ("Acier+Béton+Grue+Verre", "Gratte-ciel"),          # ossature d'acier, planchers en béton, façade de verre, le tout monté par des grues à tour
  ("Bois+Bois+Colle+Pression", "Contreplaqué"),       # des feuilles de bois collées à fil croisé puis pressées
  ("Bois+Clou+Colle+Humain", "Menuisier"),            # le menuisier assemble le bois en le collant et en le clouant (portes, fenêtres, meubles)
  # ===================== FÊTES ET TRADITIONS =====================
  ("Bougie+Gâteau", "Gâteau d'anniversaire"),         # on plante des bougies sur le gâteau, une par année
  ("Ours en peluche+Papier", "Cadeau"),               # un jouet emballé dans du papier, c'est un paquet cadeau
  ("Cadeau+Sapin", "Sapin de Noël"),                  # les cadeaux se déposent au pied du sapin le soir de Noël
  ("Charrette+Neige", "Traîneau"),                    # sur la neige, la charrette perd ses roues pour des patins : c'est un traîneau
  ("Cadeau+Traîneau", "Père Noël"),                   # le traîneau chargé de cadeaux est celui du Père Noël
  ("Amour+Anneau", "Mariage"),                        # on se marie par amour et on échange les alliances
  ("Caoutchouc+Hélium", "Ballon de baudruche"),       # un ballon en latex gonflé à l'hélium flotte en l'air
  ("Fleur+Mariage", "Bouquet"),                       # le bouquet de la mariée, lancé aux invités
  ("Calendrier+Gâteau+Naissance", "Gâteau d'anniversaire"),  # le gâteau qu'on mange chaque année à la date de naissance
  ("Anneau+Humain+Humain", "Mariage"),                # deux personnes qui échangent des anneaux : un mariage
  ("Air+Caoutchouc+Humain", "Ballon de baudruche"),   # on souffle de l'air dans une enveloppe de caoutchouc
  ("Bois+Cheval+Neige", "Traîneau"),                  # le traîneau en bois tiré par un cheval sur la neige (Bois+Cheval+Roue donne la charrette)
  ("Famille+Hiver+Maison+Sapin", "Sapin de Noël"),    # en hiver, la famille installe un sapin dans la maison
  ("Cuivre+Feu+Poudre à canon+Sodium", "Feu d'artifice"),  # la poudre propulse et éclate ; le cuivre colore en bleu-vert, le sodium en jaune
  ("Cadeau+Hiver+Humain+Nuit", "Père Noël"),          # le personnage qui apporte les cadeaux pendant la nuit d'hiver (24 décembre)
  # ===================== SPORTS ET JEUX =====================
  ("Enfant+Enfant+Joie", "Jeu"),                      # des enfants qui s'amusent ensemble : ils jouent
  ("Jeu+Muscle", "Sport"),                            # le sport, c'est un jeu physique avec des règles : on joue avec ses muscles
  ("Grèce antique+Sport", "Jeux olympiques"),         # les Jeux olympiques sont nés en Grèce, à Olympie, en 776 av. J.-C.
  ("Jeux olympiques+Or", "Médaille"),                 # le vainqueur olympique reçoit la médaille d'or (depuis 1904)
  ("Eau+Sport", "Natation"),                          # le sport qu'on pratique dans l'eau, c'est nager
  ("Chaussure+Glace", "Patin à glace"),               # la chaussure faite pour glisser sur la glace (une lame sous la semelle)
  ("Ballon+Chaussure", "Football"),                   # on frappe le ballon avec la chaussure, au pied : le football
  ("Natation+Vêtement", "Maillot de bain"),           # le vêtement qu'on porte pour nager
  ("Guerre+Jeu+Roi", "Échecs"),                       # un jeu qui simule une guerre et où il faut protéger son roi
  ("Antiquité+Dieu+Sport", "Jeux olympiques"),        # les jeux sportifs antiques donnés en l'honneur de Zeus à Olympie
  ("Eau+Humain+Mouvement", "Natation"),               # un humain qui se déplace dans l'eau par ses mouvements : il nage
  ("Air+Caoutchouc+Natation", "Bouée"),               # un anneau de caoutchouc gonflé d'air qui aide à flotter quand on nage
  ("Cheval+Jeu+Roi+Tour", "Échecs"),                  # le roi, le cavalier (une tête de cheval) et la tour sont des pièces du jeu d'échecs
  ("Argent+Bronze+Or+Sport", "Médaille"),             # or, argent, bronze : les trois médailles du podium sportif
  # ===================== FERME ET POTAGER =====================
  ("Jardin+Légume", "Potager"),                       # un jardin où l'on cultive des légumes, c'est la définition du potager
  ("Ferme+Foin", "Grange"),                           # à la ferme, on rentre le foin à l'abri dans la grange
  ("Humain+Tracteur", "Fermier"),                     # celui qui conduit le tracteur dans les champs, c'est l'agriculteur
  ("Champ+Été", "Moisson"),                           # en été (juillet-août en France), on récolte les céréales des champs
  ("Machine+Moisson", "Moissonneuse-batteuse"),       # la machine qui fait la moisson : elle coupe et bat le blé en un seul passage
  ("Épouvantail+Oiseau", "Peur"),                     # l'épouvantail sert à effrayer les oiseaux pour qu'ils ne mangent pas les semis
  ("Herbe+Outil+Soleil", "Foin"),                     # l'herbe fauchée (outil) puis séchée au soleil devient du foin
  ("Champ+Corbeau+Vêtement", "Épouvantail"),          # de vieux vêtements dressés dans le champ pour chasser les corbeaux
  ("Eau+Outil+Potager", "Arrosoir"),                  # l'ustensile qui sert à porter l'eau pour arroser le potager
  ("Humain+Mouton+Prairie", "Berger"),                # la personne qui mène paître les moutons dans les prés
  ("Fermier+Herbe+Soleil+Vent", "Foin"),              # le paysan fauche l'herbe, le soleil et le vent la sèchent : c'est la fenaison
  ("Jardin+Laitue+Pomme de terre+Tomate", "Potager"),  # salades, pommes de terre et tomates plantées ensemble au jardin
  ("Blé+Fermier+Outil+Été", "Moisson"),               # l'été, le paysan coupe le blé mûr à la faucille : la moisson
  # ===================== PRÉHISTOIRE =====================
  ("Calcaire+Quartz", "Silex"),                       # le silex est du quartz microcristallin qui se forme en rognons dans la craie, un calcaire
  ("Argile+Rouille", "Ocre"),                         # l'ocre est une argile colorée par des oxydes de fer (jaune : goethite, rouge : hématite)
  ("Grotte+Peinture", "Grotte ornée"),                # une grotte dont les parois portent des peintures préhistoriques (Lascaux, Chauvet)
  ("Agriculture+Préhistoire", "Néolithique"),         # le Néolithique est la période de la Préhistoire où naissent l'agriculture et l'élevage
  ("Agriculture+Chasseur-cueilleur", "Fermier"),      # le chasseur-cueilleur qui se met à cultiver devient agriculteur (révolution néolithique)
  ("Menhir+Tombe", "Dolmen"),                         # le dolmen : des pierres levées couvertes d'une dalle, qui abritent une sépulture collective
  ("Silex taillé+Viande", "Couteau"),                 # les lames de silex taillé ont servi de couteaux pour découper la viande
  ("Humain+Pierre+Silex", "Silex taillé"),            # on frappe le silex avec une pierre dure (percuteur) pour en détacher des éclats tranchants
  ("Chasse+Fruit+Humain", "Chasseur-cueilleur"),      # un humain qui vit de la chasse et de la cueillette des fruits sauvages
  ("Granite+Humain+Néolithique", "Menhir"),           # les hommes du Néolithique ont dressé de grandes pierres (menhirs de Carnac, en granite)
  ("Charbon+Grotte+Humain+Ocre", "Grotte ornée"),     # des humains peignent les parois d'une grotte au charbon de bois et à l'ocre (Chauvet)
  ("Granite+Granite+Néolithique+Tombe", "Dolmen"),    # des dalles de granite dressées et une table posée dessus pour couvrir une tombe néolithique
  ("Agriculture+Poterie+Élevage+Âge de pierre", "Néolithique"),  # agriculture, élevage, poterie et outils de pierre : le « paquet » néolithique
  # ===================== SCIENCES DU QUOTIDIEN =====================
  ("Ambre+Friction", "Électricité statique"),         # l'ambre frotté attire les brindilles (Thalès) ; « électricité » vient du grec ēlektron, l'ambre
  ("Ballon de baudruche+Friction", "Électricité statique"),  # le ballon frotté sur les cheveux se charge et les attire
  ("Fenêtre+Vapeur", "Buée"),                         # la vapeur d'eau de la cuisine ou de la douche se condense sur la vitre froide
  ("Miroir+Respiration", "Buée"),                     # l'haleine contient de la vapeur d'eau qui se condense sur le miroir (vieux test « respire-t-il ? »)
  ("Chaleur+Lumière+Route", "Mirage"),                # sur une route brûlante, l'air chaud courbe la lumière : on croit voir une flaque
  ("Miroir+Sous-marin", "Périscope"),                 # deux miroirs inclinés à 45° dans un tube : le sous-marin voit au-dessus de l'eau
  ("Air+Eau+Savon", "Bulle de savon"),                # un film d'eau savonneuse referme une poche d'air
  ("Acide+Cuivre+Fer", "Batterie"),                   # deux métaux différents plantés dans un acide (le citron de l'école) donnent un courant : c'est la pile de Volta
  ("Lentille+Papier+Soleil", "Combustion"),           # la loupe concentre les rayons du soleil en un point : le papier fume puis s'enflamme
  ("Alcool+Température+Verre", "Thermomètre"),        # de l'alcool coloré dans un tube de verre se dilate quand il fait chaud et monte
  ("Glace+Lait+Sel+Sucre", "Crème glacée"),           # glace + sel = mélange réfrigérant vers −20 °C, qui fait geler le lait sucré (sorbetière à manivelle, expérience « glace en sachet »)
  ("Éclair+Maison+Métal+Terre", "Paratonnerre"),      # une tige de métal sur le toit, reliée à la terre, conduit la foudre au sol sans brûler la maison
]
