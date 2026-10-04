# Liste des éléments du jeu, par famille : {famille: {nom: emoji}}.
# Les noms sont des identifiants (sauvegardes, Timer, Explorer, succès, images) :
# ne jamais renommer un élément existant.
# FILE_OF_FAMILY range chaque famille dans une ligne game_data (le front les fusionne toutes).

FAMILIES = {
  "Elements Fondamentaux": {"Eau": "svg:eau", "Feu": "svg:feu", "Terre": "svg:terre", "Air": "svg:air"},

  "Matériaux": {
    "Boue": "svg:boue", "Lave": "svg:lave", "Vapeur": "svg:vapeur", "Poussière": "svg:poussiere", "Fumée": "svg:fumee",
    "Pierre": "svg:pierre", "Sable": "svg:sable", "Cendre": "svg:cendre", "Métal": "svg:metal", "Verre": "svg:verre",
    "Cristal": "svg:cristal", "Magma": "svg:magma",
    "Argile": "svg:argile", "Charbon": "svg:charbon", "Sel": "svg:sel", "Fer": "svg:fer", "Cuivre": "svg:cuivre", "Or": "svg:or",
    "Argent": "svg:argent", "Étain": "svg:etain", "Bronze": "svg:bronze", "Acier": "svg:acier", "Plomb": "svg:plomb",
    "Calcaire": "svg:calcaire", "Marbre": "svg:bloc-de-marbre", "Granite": "svg:granite", "Obsidienne": "svg:obsidienne", "Quartz": "svg:quartz",
    "Diamant": "svg:diamant", "Graphite": "svg:graphite", "Pétrole": "svg:petrole", "Goudron": "svg:goudron", "Béton": "svg:beton",
    "Ciment": "svg:ciment", "Plâtre": "svg:platre", "Céramique": "svg:ceramique", "Porcelaine": "svg:porcelaine", "Papier": "svg:papier",
    "Encre": "svg:encre", "Cire": "svg:cire", "Caoutchouc": "svg:caoutchouc", "Plastique": "svg:plastique", "Laine": "svg:laine",
    "Coton": "svg:coton", "Tissu": "svg:tissu", "Cuir": "svg:cuir", "Corde": "svg:corde", "Rouille": "svg:rouille",
    # Plateau 1
    "Pierre ponce": "svg:pierre-ponce", "Compost": "svg:compost", "Sédiment": "svg:sediment", "Suie": "svg:suie",
    # Plateau 2
    "Résine": "svg:resine", "Ambre": "svg:ambre",
    "Soie": "svg:soie",
    "Colle": "svg:colle", "Contreplaqué": "svg:contreplaque", "Foin": "svg:foin", "Silex": "svg:silex", "Ocre": "svg:ocre",
  },

  "Phénomènes Naturels": {
    "Pollution": "svg:pollution",
    "Pluie": "svg:pluie", "Nuage": "svg:nuage", "Énergie": "svg:energie", "Vent": "svg:vent", "Bourrasque": "svg:bourrasque",
    "Tempête": "svg:tempete", "Éclair": "svg:eclair", "Tornade": "svg:tornade", "Explosion": "svg:explosion", "Incendie": "svg:incendie",
    "Brasier": "svg:brasier", "Geyser": "svg:geyser", "Vague": "svg:vague", "Ozone": "svg:ozone", "Lumière": "svg:lumiere",
    "Arc-en-ciel": "svg:arc-en-ciel", "Temps": "svg:temps", "Neige": "svg:neige", "Glace": "svg:glace",
    "Blizzard": "svg:blizzard", "Tsunami": "svg:tsunami", "Déluge": "svg:deluge",
    "Brouillard": "svg:brouillard", "Rosée": "svg:rosee", "Givre": "svg:givre", "Grêle": "svg:grele", "Orage": "svg:orage",
    "Ouragan": "svg:ouragan", "Séisme": "svg:seisme", "Érosion": "svg:erosion", "Marée": "svg:maree", "Chaleur": "svg:chaleur",
    "Froid": "svg:froid", "Sécheresse": "svg:secheresse", "Inondation": "svg:inondation", "Avalanche": "svg:avalanche",
    "Glissement de terrain": "svg:glissement-de-terrain", "Saison": "svg:saisons", "Jour": "svg:jour", "Nuit": "svg:nuit", "Ombre": "svg:ombre",
    "Son": "svg:son", "Écho": "svg:echo", "Feu de forêt": "svg:feu-de-foret",
    # Plateau 1
    "Pluie acide": "svg:pluie-acide",
    # Paquet thématique (culture commune)
    "Hiver": "svg:hiver", "Printemps": "svg:printemps", "Été": "svg:ete", "Automne": "svg:automne", "Ciel": "svg:ciel", "Coucher de soleil": "svg:coucher-de-soleil",
    "Verglas": "svg:verglas", "Mirage": "svg:mirage", "Tonnerre": "svg:tonnerre",
    "Buée": "svg:buee",
    "Feu follet": "svg:feu-follet",
  },

  "Physique": {
    "Atome": "svg:atome", "Électron": "svg:electron", "Proton": "svg:proton", "Neutron": "svg:neutron", "Noyau atomique": "svg:noyau-atomique",
    "Particule": "svg:particule", "Onde": "svg:onde", "Magnétisme": "svg:magnetisme", "Aimant": "svg:aimant", "Électricité": "svg:electricite",
    "Pression": "svg:pression", "Gravité": "svg:gravite", "Masse": "svg:masse", "Force": "svg:force", "Mouvement": "svg:mouvement",
    "Vitesse": "svg:vitesse", "Friction": "svg:friction", "Plasma": "svg:plasma", "Radiation": "svg:radiation", "Radioactivité": "svg:radioactivite",
    "Fusion nucléaire": "svg:fusion-nucleaire", "Fission nucléaire": "svg:fission-nucleaire", "Lentille": "svg:lentille", "Prisme": "svg:prisme",
    "Spectre lumineux": "svg:spectre-lumineux", "Infrarouge": "svg:infrarouge", "Ultraviolet": "svg:ultraviolet", "Rayons X": "svg:rayons-x",
    "Vide": "svg:vide", "Gaz": "svg:gaz", "Liquide": "svg:liquide", "Solide": "svg:solide",
    "Température": "svg:temperature", "Inertie": "svg:inertie", "Relativité": "svg:relativite", "Physique quantique": "svg:physique-quantique",
    "Antimatière": "svg:antimatiere",
    "Électricité statique": "svg:electricite-statique", "Bulle de savon": "svg:bulle-de-savon",
  },

  "Chimie": {
    "Hydrogène": "svg:hydrogene", "Oxygène": "svg:oxygene", "Carbone": "svg:carbone", "Azote": "svg:azote", "Hélium": "svg:helium",
    "Sodium": "svg:sodium", "Chlore": "svg:chlore", "Calcium": "svg:calcium", "Silicium": "svg:silicium", "Soufre": "svg:soufre",
    "Phosphore": "svg:phosphore", "Molécule": "svg:molecule", "Réaction chimique": "svg:reaction-chimique", "Combustion": "svg:combustion",
    "Oxydation": "svg:oxydation", "Acide": "svg:acide", "Base chimique": "svg:base-chimique", "Dioxyde de carbone": "svg:dioxyde-de-carbone",
    "Méthane": "svg:methane", "Ammoniac": "svg:ammoniac", "Eau salée": "svg:eau-salee", "Solution": "svg:solution", "Distillation": "svg:distillation",
    "Cristallisation": "svg:cristallisation", "Catalyseur": "svg:catalyseur", "Alcool": "svg:alcool", "Sucre": "svg:sucre", "Amidon": "svg:amidon",
    "Savon": "svg:savon", "Vinaigre": "svg:vinaigre", "Engrais": "svg:engrais", "Poudre à canon": "svg:poudre-a-canon", "Polymère": "svg:polymere",
    "Tableau périodique": "svg:tableau-periodique", "Laboratoire": "svg:laboratoire",
  },

  "Formations Naturelles": {
    "Montagne": "svg:montagne", "Volcan": "svg:volcan", "Lac": "svg:lac", "Océan": "svg:ocean", "Continent": "svg:continent",
    "Planète Terre": "svg:planete-terre", "Île": "svg:ile", "Désert": "svg:desert", "Oasis": "svg:oasis",
    "Marais": "svg:marais", "Forêt": "svg:foret", "Jungle": "svg:jungle", "Récif": "svg:recif", "Jardin": "svg:jardin",
    "Rivière": "svg:riviere", "Cascade": "svg:cascade", "Plage": "svg:plage", "Falaise": "svg:falaise", "Grotte": "svg:grotte",
    "Canyon": "svg:canyon", "Vallée": "svg:vallee", "Colline": "svg:colline", "Glacier": "svg:glacier", "Iceberg": "svg:iceberg",
    "Banquise": "svg:banquise", "Delta": "svg:delta", "Plaine": "svg:plaine", "Prairie": "svg:prairie", "Savane": "svg:savane",
    "Toundra": "svg:toundra", "Mer": "svg:mer", "Source": "svg:source", "Atoll": "svg:atoll", "Stalactite": "svg:stalactite",
    "Sol fertile": "svg:sol-fertile", "Tourbe": "svg:tourbe", "Fossile": "svg:fossile", "Pôle": "svg:pole",
    # Plateau 1
    "Source hydrothermale": "svg:source-hydrothermale", "Volcan de boue": "svg:volcan-de-boue", "Désert de sel": "svg:desert-de-sel", "Archipel": "svg:archipel",
    "Fjord": "svg:fjord", "Taïga": "svg:taiga", "Dune": "svg:dune",
  },

  "Cosmos": {
    "Étoile": "svg:etoile", "Aurore": "svg:aurore", "Météore": "svg:meteore", "Galaxie": "svg:galaxie", "Univers": "svg:univers",
    "Soleil": "svg:soleil", "Lune": "svg:lune", "Planète": "svg:planete", "Comète": "svg:comete", "Astéroïde": "svg:asteroide",
    "Nébuleuse": "svg:nebuleuse", "Supernova": "svg:supernova", "Trou noir": "svg:trou-noir", "Constellation": "svg:constellation",
    "Éclipse": "svg:eclipse", "Orbite": "svg:orbite", "Big Bang": "svg:big-bang", "Poussière d'étoiles": "svg:poussiere-etoiles",
    "Système solaire": "svg:systeme-solaire", "Voie lactée": "svg:voie-lactee", "Mars": "svg:mars", "Jupiter": "svg:jupiter",
    "Saturne": "svg:saturne", "Anneaux planétaires": "svg:anneaux-planetaires", "Pulsar": "svg:pulsar", "Quasar": "svg:quasar",
    "Matière noire": "svg:matiere-noire", "Espace": "svg:espace", "Cratère": "svg:cratere", "Marée lunaire": "svg:maree-lunaire",
  },

  "Flore": {
    "Plante": "svg:plante", "Arbre": "svg:arbre", "Herbe": "svg:herbe", "Fleur": "svg:fleur", "Rose": "svg:rose",
    "Cactus": "svg:cactus", "Bambou": "svg:bambou", "Blé": "svg:ble", "Riz": "svg:riz", "Maïs": "svg:mais", "Vigne": "svg:vigne",
    "Raisin": "svg:raisin", "Pomme": "svg:pomme", "Olive": "svg:olive", "Légume": "svg:legume", "Pomme de terre": "svg:pomme-de-terre",
    "Tournesol": "svg:tournesol", "Chêne": "svg:chene", "Sapin": "svg:sapin", "Palmier": "svg:palmier", "Lierre": "svg:lierre",
    "Mousse": "svg:mousse", "Fougère": "svg:fougere", "Champignon": "svg:champignon", "Algue": "svg:algue", "Graine": "svg:graine",
    "Fruit": "svg:fruit", "Pollen": "svg:pollen", "Feuille": "svg:feuille", "Racine": "svg:racine", "Bois": "svg:bois",
    "Cotonnier": "svg:cotonnier", "Lin": "svg:lin", "Thé": "svg:the", "Café": "svg:cafe", "Cacao": "svg:cacao",
    "Canne à sucre": "svg:canne-a-sucre", "Herbe médicinale": "svg:herbe-medicinale", "Lichen": "svg:lichen", "Nénuphar": "svg:nenuphar",
    # Paquet thématique (culture commune)
    "Tomate": "svg:tomate", "Laitue": "svg:laitue", "Noix de coco": "svg:noix-de-coco", "Érable": "svg:erable", "Bouquet": "svg:bouquet",
    "Citrouille": "svg:citrouille",
  },

  "Biologie": {
    "Vie": "svg:vie", "Cellule": "svg:cellule", "ADN": "svg:adn", "Gène": "svg:gene", "Bactérie": "svg:bacterie", "Virus": "svg:virus",
    "Plancton": "svg:plancton", "Protéine": "svg:proteine", "Enzyme": "svg:enzyme", "Photosynthèse": "svg:photosynthese",
    "Chlorophylle": "svg:chlorophylle", "Évolution": "svg:evolution", "Mutation": "svg:mutation", "Symbiose": "svg:symbiose",
    "Écosystème": "svg:ecosysteme", "Chaîne alimentaire": "svg:chaine-alimentaire", "Décomposition": "svg:decomposition", "Fermentation": "svg:fermentation",
    "Levure": "svg:levure", "Microbe": "svg:microbe", "Organisme": "svg:organisme", "Reproduction": "svg:reproduction", "Œuf": "svg:oeuf",
    "Embryon": "svg:embryon", "Métamorphose": "svg:metamorphose", "Instinct": "svg:instinct", "Espèce": "svg:espece", "Extinction": "svg:extinction",
    "Biodiversité": "svg:biodiversite", "Parasite": "svg:parasite", "Pollinisation": "svg:pollinisation", "Respiration": "svg:respiration",
  },

  "Vie et Créatures": {
    "Lombric": "svg:lombric", "Asticot": "svg:asticot", "Chenille": "svg:chenille", "Papillon": "svg:papillon", "Poisson": "svg:poisson",
    "Poisson Tropical": "svg:poisson-tropical", "Poisson Polaire": "svg:poisson-polaire", "Poisson Volant": "svg:poisson-volant",
    "Poisson Abyssal": "svg:poisson-abyssal", "Méduse": "svg:meduse", "Salamandre": "svg:salamandre", "Ptérodactyle": "svg:pterodactyle",
    "Luciole": "svg:luciole", "Oiseau": "svg:oiseau",
    "Insecte": "svg:insecte", "Abeille": "svg:abeille", "Fourmi": "svg:fourmi", "Araignée": "svg:araignee", "Escargot": "svg:escargot",
    "Grenouille": "svg:grenouille", "Serpent": "svg:serpent", "Lézard": "svg:lezard", "Tortue": "svg:tortue", "Crocodile": "svg:crocodile",
    "Dinosaure": "svg:dinosaure", "Aigle": "svg:aigle", "Hibou": "svg:hibou", "Pingouin": "svg:pingouin", "Manchot": "svg:manchot", "Poule": "svg:poule",
    "Mammifère": "svg:mammifere", "Souris": "svg:souris", "Chat": "svg:chat", "Chien": "svg:chien", "Loup": "svg:loup",
    "Cheval": "svg:cheval", "Vache": "svg:vache", "Mouton": "svg:mouton", "Cochon": "svg:cochon", "Ours": "svg:ours",
    "Ours polaire": "svg:ours-polaire", "Baleine": "svg:baleine", "Dauphin": "svg:dauphin", "Requin": "svg:requin", "Pieuvre": "svg:pieuvre",
    "Crabe": "svg:crabe", "Corail": "svg:corail", "Chauve-souris": "svg:chauve-souris", "Singe": "svg:singe", "Éléphant": "svg:elephant",
    "Lion": "svg:lion", "Chameau": "svg:chameau", "Castor": "svg:castor", "Moustique": "svg:moustique", "Plume": "svg:plume",
    "Nid": "svg:nid", "Ruche": "svg:ruche", "Toile d'araignée": "svg:toile-d-araignee", "Fourrure": "svg:fourrure", "Écaille": "svg:ecaille",
    "Os": "svg:os", "Mammouth": "svg:mammouth", "Oiseau marin": "svg:oiseau-marin", "Cygne": "svg:cygne",
    # Paquet thématique (culture commune)
    "Chèvre": "svg:chevre", "Cerf": "svg:cerf", "Canard": "svg:canard", "Zèbre": "svg:zebre", "Tigre": "svg:tigre", "Phoque": "svg:phoque",
    "Perroquet": "svg:perroquet",
    # Palier 2 (culture commune)
    "Coquillage": "svg:coquillage", "Hérisson": "svg:herisson", "Écureuil": "svg:ecureuil", "Scorpion": "svg:scorpion", "Corbeau": "svg:corbeau", "Grillon": "svg:grillon",
    "Cafard": "svg:cafard", "Dodo": "svg:dodo", "Poussin": "svg:poussin",
    "Girafe": "svg:girafe", "Étoile de mer": "svg:etoile-de-mer", "Renard": "svg:renard",
    "Cigale": "svg:cigale",
  },

  "Corps et Esprit": {
    "Sang": "svg:sang", "Cœur": "svg:coeur", "Cerveau": "svg:cerveau", "Œil": "svg:oeil", "Muscle": "svg:muscle", "Squelette": "svg:squelette",
    "Neurone": "svg:neurone", "Pensée": "svg:pensee", "Mémoire": "svg:memoire", "Rêve": "svg:reve", "Sommeil": "svg:sommeil",
    "Émotion": "svg:emotion", "Peur": "svg:peur", "Joie": "svg:joie", "Tristesse": "svg:tristesse", "Colère": "svg:colere",
    "Amour": "svg:amour", "Naissance": "svg:naissance", "Enfant": "svg:enfant", "Famille": "svg:famille", "Vieillesse": "svg:vieillesse",
    "Maladie": "svg:maladie", "Santé": "svg:sante", "Remède": "svg:remede", "Mort": "svg:mort", "Tombe": "svg:tombe",
    "Deuil": "svg:deuil", "Langage": "svg:langage", "Conscience": "svg:conscience", "Idée": "svg:idee", "Curiosité": "svg:curiosite",
    "Courage": "svg:courage", "Sagesse": "svg:sagesse", "Faim": "svg:faim", "Douleur": "svg:douleur",
    # Paquet thématique (culture commune)
    "Larme": "svg:larme", "Rire": "svg:rire", "Cauchemar": "svg:cauchemar", "Sueur": "svg:sueur", "Fatigue": "svg:fatigue", "Pansement": "svg:pansement",
    "Rhume": "svg:rhume",
  },

  "Créations Humaines": {
    "Aquarium": "svg:aquarium", "Couronne": "svg:couronne", "Igloo": "svg:igloo", "Sablier": "svg:sablier", "Serre": "svg:serre",
    "Tirelire": "svg:tirelire", "Parasol": "svg:parasol", "Zoo": "svg:zoo", "Allumette": "svg:allumette",
    "Humain": "svg:humain", "Héros": "svg:heros", "Épée": "svg:epee", "Brique": "svg:brique", "Maison": "svg:maison",
    "Chevalier": "svg:chevalier", "Château": "svg:chateau", "Ville": "svg:ville", "Arche": "svg:arche",
    "Outil": "svg:outil", "Hache": "svg:hache", "Marteau": "svg:marteau", "Lance": "svg:lance", "Arc": "svg:arc", "Roue": "svg:roue",
    "Charrette": "svg:charrette", "Bateau": "svg:bateau", "Voile": "svg:voile", "Agriculture": "svg:agriculture", "Champ": "svg:champ",
    "Ferme": "svg:ferme", "Farine": "svg:farine", "Pain": "svg:pain", "Four": "svg:four", "Poterie": "svg:poterie",
    "Feu de camp": "svg:feu-de-camp", "Cuisine": "svg:cuisine", "Viande": "svg:viande", "Lait": "svg:lait", "Fromage": "svg:fromage",
    "Vin": "svg:vin", "Bière": "svg:biere", "Miel": "svg:miel", "Huile": "svg:huile", "Vêtement": "svg:vetement", "Écriture": "svg:ecriture",
    "Livre": "svg:livre", "Monnaie": "svg:monnaie", "Commerce": "svg:commerce", "Marché": "svg:marche", "Route": "svg:route", "Pont": "svg:pont",
    "Village": "svg:village", "Mur": "svg:mur", "Tour": "svg:tour", "Temple": "svg:temple", "Pyramide": "svg:pyramide", "Loi": "svg:loi",
    "Roi": "svg:roi", "Armée": "svg:armee", "Guerre": "svg:guerre", "Paix": "svg:paix", "Religion": "svg:religion", "Musique": "svg:musique",
    "Art": "svg:art", "Peinture": "svg:peinture", "Sculpture": "svg:sculpture", "Théâtre": "svg:theatre", "École": "svg:ecole",
    "Science": "svg:science", "Médecine": "svg:medecine", "Port": "svg:port", "Puits": "svg:puits", "Moulin": "svg:moulin",
    "Forge": "svg:forge", "Tente": "svg:tente", "Chasse": "svg:chasse", "Pêche": "svg:peche", "Élevage": "svg:elevage",
    "Tisserand": "svg:tisserand", "Forgeron": "svg:forgeron", "Philosophie": "svg:philosophie", "Mathématiques": "svg:mathematiques",
    "Carte": "svg:carte", "Boussole": "svg:boussole", "Calendrier": "svg:calendrier", "Horloge": "svg:horloge", "Bougie": "svg:bougie",
    "Momie": "svg:momie",
    # Plateau 2
    "Pop-corn": "svg:pop-corn", "Caramel": "svg:caramel", "Gâteau": "svg:gateau", "Soupe": "svg:soupe", "Panier": "svg:panier", "Cloche": "svg:cloche", "Feu d'artifice": "svg:feu-d-artifice",
    # Paquet thématique (culture commune)
    "Beurre": "svg:beurre", "Pâtes": "svg:pates", "Crêpe": "svg:crepe", "Frites": "svg:frites", "Jus de fruit": "svg:jus-de-fruit", "Crème glacée": "🍨",
    "Croissant": "🥐", "Sandwich": "🥪", "Lit": "🛏️", "Porte": "🚪", "Fenêtre": "🪟", "Clé": "🔑",
    "Parapluie": "☂️", "Fermier": "🧑‍🌾", "Pot de fleurs": "🪴", "Hôpital": "🏥", "Rails": "🛤️", "Guitare": "🎸",
    "Piano": "🎹", "Tambour": "🥁", "Danse": "💃", "Ballon": "⚽", "Ski": "🎿", "Cerf-volant": "🪁",
    "Bonhomme de neige": "⛄",
    # Palier 2 (culture commune)
    "Sushi": "🍣", "Hameçon": "🪝", "Bouée": "🛟", "Chaussure": "👟", "Botte": "👢", "Chaussette": "🧦",
    "Manteau": "🧥", "Maillot de bain": "🩱", "Blouse blanche": "🥼", "Porte-monnaie": "👛", "Boulanger": "🥖", "Cuisinier": "🧑‍🍳",
    "Pompier": "🧑‍🚒", "Médecin": "🧑‍⚕️", "Maçon": "👷", "Pilote": "🧑‍✈️", "Gratte-ciel": "🏢", "Gare": "🚉",
    "Église": "⛪", "Ruine": "🏚️", "Restaurant": "🍴", "Hôtel": "🏨", "Stylo": "🖊️", "Cartable": "🎒",
    "Journal": "📰", "Alphabet": "🔤", "Dictionnaire": "📘", "Astronaute": "🧑‍🚀", "Tarte": "🥧", "Biscuit": "🍪",
    "Beignet": "🍩", "Sorbet": "🍧", "Limonade": "🥤", "Cocktail": "🍹", "Rhum": "🥃",
    "Bibliothèque": "📚", "Miroir": "🪞", "Lampe à huile": "🪔", "Couteau": "🔪", "Ciseaux": "✂️", "Ours en peluche": "🧸", "Cahier": "📔", "Pelle": "svg:pelle", "Chocolat": "🍫", "Cidre": "svg:cidre", "Parc": "svg:parc", "Chocolat chaud": "svg:chocolat-chaud", "Confiture": "svg:confiture", "Mayonnaise": "svg:mayonnaise", "Fontaine": "svg:fontaine", "Cimetière": "svg:cimetiere", "Crayon": "svg:crayon", "Potier": "svg:potier", "Bûcheron": "svg:bucheron", "Berger": "svg:berger", "Pêcheur": "svg:pecheur", "Gomme": "svg:gomme", "Phare": "svg:phare",
    "Armure": "svg:armure", "Douves": "svg:douves", "Pont-levis": "svg:pont-levis", "Blason": "svg:blason", "Catapulte": "svg:catapulte", "Fer à cheval": "svg:fer-a-cheval", "Vitrail": "svg:vitrail", "Troubadour": "svg:troubadour", "Carrosse": "svg:carrosse", "Pantoufle de verre": "svg:pantoufle-de-verre", "Bottes de sept lieues": "svg:bottes-sept-lieues", "Maison en pain d'épices": "svg:maison-pain-epices", "Clou": "svg:clou", "Poulie": "svg:poulie", "Cabane": "🛖", "Menuisier": "svg:menuisier", "Papier peint": "svg:papier-peint", "Mécanicien": "🧑‍🔧", "Gâteau d'anniversaire": "🎂", "Cadeau": "🎁", "Sapin de Noël": "🎄", "Traîneau": "🛷", "Mariage": "💒", "Ballon de baudruche": "svg:ballon-baudruche", "Jeu": "🎲", "Sport": "🤸", "Jeux olympiques": "svg:anneaux-olympiques", "Médaille": "🏅", "Natation": "🏊", "Patin à glace": "⛸️", "Football": "🥅", "Échecs": "♟️", "Grange": "svg:grange", "Épouvantail": "svg:epouvantail", "Potager": "svg:potager", "Arrosoir": "svg:arrosoir", "Moisson": "svg:moisson", "Silex taillé": "svg:silex-taille", "Chasseur-cueilleur": "svg:chasseur-cueilleur", "Menhir": "svg:menhir", "Dolmen": "svg:dolmen",
    "Épave": "svg:epave", "Trésor": "svg:coffre-tresor",
    "Salade": "🥗",
    "Parfum": "svg:flacon-parfum",
  },

  "Histoire": {
    "Préhistoire": "svg:prehistoire", "Âge de pierre": "svg:age-de-pierre", "Âge du bronze": "svg:age-du-bronze", "Âge du fer": "svg:age-du-fer",
    "Antiquité": "svg:colonne-antique", "Égypte ancienne": "svg:egypte-ancienne", "Pharaon": "svg:pharaon", "Grèce antique": "svg:grece-antique",
    "Empire romain": "svg:empire-romain", "Moyen Âge": "svg:moyen-age", "Renaissance": "svg:renaissance", "Grandes découvertes": "svg:grandes-decouvertes",
    "Explorateur": "🧗", "Révolution": "✊", "Démocratie": "🗳️", "Révolution industrielle": "svg:revolution-industrielle",
    "Ère atomique": "svg:ere-atomique", "Conquête spatiale": "svg:conquete-spatiale", "Ère numérique": "svg:ere-numerique", "Civilisation": "svg:civilisation",
    "Empire": "👑", "Archéologie": "⛏️", "Musée": "🏛️", "Chronique": "📜", "Mythologie": "svg:mythologie",
    # Palier 2 (culture commune)
    "Pirate": "🏴‍☠️",
    "Néolithique": "svg:neolithique", "Grotte ornée": "svg:grotte-ornee",
  },

  "Technologie": {
    "Machine à vapeur": "svg:machine-a-vapeur", "Moteur": "⚙️", "Machine": "svg:machine", "Usine": "🏭", "Locomotive": "🚂",
    "Train": "🚆", "Voiture": "🚗", "Avion": "✈️", "Fusée": "🚀", "Satellite": "🛰️",
    "Ampoule": "💡", "Batterie": "🔋", "Téléphone": "☎️", "Radio": "📻", "Télévision": "📺",
    "Ordinateur": "💻", "Internet": "🌐", "Robot": "🤖", "Intelligence artificielle": "svg:intelligence-artificielle",
    "Panneau solaire": "🔆", "Éolienne": "svg:eolienne", "Barrage": "svg:barrage", "Centrale nucléaire": "svg:centrale-nucleaire",
    "Microscope": "🔬", "Télescope": "🔭", "Imprimerie": "🖨️", "Appareil photo": "📷",
    "Cinéma": "🎬", "Vaccin": "💉", "Antibiotique": "💊", "Laser": "svg:laser", "Électroaimant": "svg:electroaimant",
    "Station spatiale": "svg:station-spatiale", "Sous-marin": "svg:sous-marin", "Bombe atomique": "💣", "Puce électronique": "🔲",
    "Réseau électrique": "svg:reseau-electrique", "Moulin à eau": "svg:moulin-a-eau", "Sauvegarde": "💾",
    # Plateau 2
    "Lunettes": "👓",
    # Paquet thématique (culture commune)
    "Vélo": "🚲", "Moto": "🏍️", "Parachute": "🪂", "Grue": "🏗️", "Bateau à vapeur": "🛳️", "Téléphérique": "🚡",
    # Palier 2 (culture commune)
    "Smartphone": "📱", "Radiotélescope": "📡", "GPS": "📍",
    "Feu tricolore": "🚦", "Tracteur": "🚜", "Lampadaire": "svg:lampadaire", "Montgolfière": "svg:montgolfiere",
    "Moissonneuse-batteuse": "svg:moissonneuse-batteuse", "Thermomètre": "svg:thermometre", "Périscope": "svg:periscope", "Paratonnerre": "svg:paratonnerre",
  },

  "Légendes": {
    "Sphinx": "svg:sphinx",
    "Magie": "✨", "Esprit": "svg:esprit", "Mana": "svg:mana", "Orbe": "🔮", "Baguette": "🪄",
    "Pouvoir": "⚜️", "Anneau": "💍", "Anneau de Pouvoir": "svg:anneau-de-pouvoir", "Feu Magique": "🎇",
    "Potion": "svg:potion", "Élixir": "svg:elixir", "Golem": "svg:golem", "Licorne": "🦄", "Sorcier": "🧙",
    "Dragon": "🐉", "Phénix": "🐦‍🔥", "Hydre": "svg:hydre", "Olympe": "svg:mont-olympe",
    "Fantôme": "👻", "Vampire": "🧛", "Loup-garou": "svg:loup-garou", "Sirène": "🧜", "Géant": "🗻",
    "Fée": "🧚", "Mythe": "svg:mythe", "Dieu": "svg:dieu", "Démon": "😈", "Ange": "😇", "Alchimie": "svg:alchimie",
    "Pierre philosophale": "svg:pierre-philosophale", "Zombie": "🧟", "Kraken": "🦑", "Centaure": "svg:centaure", "Grimoire": "📕",
    "Génie": "🧞", "Ogre": "👹", "Chat botté": "svg:chat-botte", "Père Noël": "🎅",
    "Monstre de Frankenstein": "svg:monstre-frankenstein", "Robin des Bois": "svg:robin-des-bois", "Ailes d'Icare": "svg:ailes-icare", "Cheval de Troie": "svg:cheval-de-troie", "Boîte de Pandore": "svg:boite-de-pandore",
    "Griffon": "svg:griffon",
  },
}

# Famille -> ligne game_data qui la porte (4 lignes lues par le front)
FILE_OF_FAMILY = {
  "Elements Fondamentaux": "materiaux_elementaires",
  "Matériaux": "materiaux_elementaires",
  "Chimie": "materiaux_elementaires",
  "Physique": "materiaux_elementaires",
  "Phénomènes Naturels": "phenomenes_naturels",
  "Cosmos": "phenomenes_naturels",
  "Formations Naturelles": "formations_naturelles",
  "Flore": "formations_naturelles",
  "Biologie": "formations_naturelles",
  "Vie et Créatures": "formations_naturelles",
  "Corps et Esprit": "humains_craft_rules",
  "Créations Humaines": "humains_craft_rules",
  "Histoire": "humains_craft_rules",
  "Technologie": "humains_craft_rules",
  "Légendes": "humains_craft_rules",
}
