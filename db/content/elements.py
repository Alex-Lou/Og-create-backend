# Liste des éléments du jeu, par famille : {famille: {nom: emoji}}.
# Les noms sont des identifiants (sauvegardes, Timer, Explorer, succès, images) :
# ne jamais renommer un élément existant.
# FILE_OF_FAMILY range chaque famille dans une ligne game_data (le front les fusionne toutes).

FAMILIES = {
  "Elements Fondamentaux": {"Eau": "💧", "Feu": "🔥", "Terre": "🌱", "Air": "💨"},

  "Matériaux": {
    "Boue": "🟤", "Lave": "🟠", "Vapeur": "♨️", "Poussière": "🟫", "Fumée": "🌫️",
    "Pierre": "🪨", "Sable": "⏳", "Cendre": "⚱️", "Métal": "⚙️", "Verre": "🔍",
    "Cristal": "💎", "Magma": "🔴",
    "Argile": "svg:argile", "Charbon": "⚫", "Sel": "🧂", "Fer": "🔩", "Cuivre": "🟧", "Or": "🥇",
    "Argent": "🥈", "Étain": "🪙", "Bronze": "🥉", "Acier": "🗡️", "Plomb": "🔘",
    "Calcaire": "⬜", "Marbre": "🏛️", "Granite": "◼️", "Obsidienne": "🖤", "Quartz": "🔷",
    "Diamant": "💠", "Graphite": "✏️", "Pétrole": "🛢️", "Goudron": "⬛", "Béton": "🧱",
    "Ciment": "🪣", "Plâtre": "🤍", "Céramique": "🍶", "Porcelaine": "🫖", "Papier": "📄",
    "Encre": "🖋️", "Cire": "svg:cire", "Caoutchouc": "🎈", "Plastique": "🧴", "Laine": "🧶",
    "Coton": "svg:coton", "Tissu": "🧵", "Cuir": "👞", "Corde": "🪢", "Rouille": "svg:rouille",
    # Plateau 1
    "Pierre ponce": "🧽", "Compost": "♻️", "Sédiment": "🫙", "Suie": "🧹",
    # Plateau 2
    "Résine": "🟨", "Ambre": "🔶",
    "Soie": "svg:soie",
    "Colle": "svg:colle", "Contreplaqué": "svg:contreplaque", "Foin": "svg:foin", "Silex": "svg:silex", "Ocre": "svg:ocre",
  },

  "Phénomènes Naturels": {
    "Pluie": "🌧️", "Nuage": "☁️", "Énergie": "⚡", "Vent": "🌬️", "Bourrasque": "🍃",
    "Tempête": "svg:tempete", "Éclair": "🌩️", "Tornade": "🌪️", "Explosion": "💥", "Incendie": "🚒",
    "Brasier": "🪔", "Geyser": "svg:geyser", "Vague": "🏄", "Ozone": "🔵", "Lumière": "☀️",
    "Arc-en-ciel": "🌈", "Temps": "⌛", "Neige": "❄️", "Glace": "🧊",
    "Blizzard": "🌨️", "Tsunami": "🌀", "Déluge": "☔",
    "Brouillard": "🌁", "Rosée": "💦", "Givre": "🥶", "Grêle": "svg:grele", "Orage": "⛈️",
    "Ouragan": "🌀", "Séisme": "📳", "Érosion": "🏜️", "Marée": "svg:maree", "Chaleur": "svg:chaleur",
    "Froid": "svg:froid", "Sécheresse": "🥵", "Inondation": "svg:inondation", "Avalanche": "🏔️",
    "Glissement de terrain": "svg:glissement-de-terrain", "Saison": "🍂", "Jour": "svg:jour", "Nuit": "🌙", "Ombre": "👤",
    "Son": "🔊", "Écho": "📢", "Feu de forêt": "svg:feu-de-foret",
    # Plateau 1
    "Pluie acide": "🥀",
    # Paquet thématique (culture commune)
    "Hiver": "🧣", "Printemps": "🌷", "Été": "⛱️", "Automne": "🎃", "Ciel": "🌤️", "Coucher de soleil": "🌇",
    "Verglas": "svg:verglas", "Mirage": "svg:mirage", "Tonnerre": "svg:tonnerre",
    "Buée": "svg:buee",
    "Feu follet": "svg:feu-follet",
  },

  "Physique": {
    "Atome": "⚛️", "Électron": "🔹", "Proton": "svg:proton", "Neutron": "⚪", "Noyau atomique": "🟠",
    "Particule": "✴️", "Onde": "〰️", "Magnétisme": "svg:magnetisme", "Aimant": "🧲", "Électricité": "🔌",
    "Pression": "🎚️", "Gravité": "svg:gravite", "Masse": "⚖️", "Force": "🫸", "Mouvement": "🏃",
    "Vitesse": "⏩", "Friction": "🔥", "Plasma": "🟣", "Radiation": "svg:radiation", "Radioactivité": "☢️",
    "Fusion nucléaire": "🌟", "Fission nucléaire": "svg:fission-nucleaire", "Lentille": "🔎", "Prisme": "🔻",
    "Spectre lumineux": "svg:spectre-lumineux", "Infrarouge": "🟥", "Ultraviolet": "🟪", "Rayons X": "🩻",
    "Vide": "⭕", "Gaz": "🫧", "Liquide": "🫗", "Solide": "svg:solide",
    "Température": "🌡️", "Inertie": "🥌", "Relativité": "⏱️", "Physique quantique": "🎲",
    "Antimatière": "🌑",
    "Électricité statique": "svg:electricite-statique", "Bulle de savon": "svg:bulle-de-savon",
  },

  "Chimie": {
    "Hydrogène": "svg:hydrogene", "Oxygène": "svg:oxygene", "Carbone": "svg:carbone", "Azote": "🌬️", "Hélium": "🎈",
    "Sodium": "svg:sodium", "Chlore": "🧪", "Calcium": "svg:calcium", "Silicium": "💻", "Soufre": "🟡",
    "Phosphore": "✨", "Molécule": "🔗", "Réaction chimique": "⚗️", "Combustion": "svg:combustion",
    "Oxydation": "🟫", "Acide": "🍋", "Base chimique": "svg:base-chimique", "Dioxyde de carbone": "😮‍💨",
    "Méthane": "💨", "Ammoniac": "🧪", "Eau salée": "🌊", "Solution": "🧫", "Distillation": "⚗️",
    "Cristallisation": "❇️", "Catalyseur": "⚡", "Alcool": "🍶", "Sucre": "🍬", "Amidon": "svg:amidon",
    "Savon": "🧼", "Vinaigre": "🍾", "Engrais": "🌾", "Poudre à canon": "🧨", "Polymère": "⛓️",
    "Tableau périodique": "📊", "Laboratoire": "🧪",
  },

  "Formations Naturelles": {
    "Montagne": "⛰️", "Volcan": "🌋", "Lac": "svg:lac", "Océan": "🌊", "Continent": "svg:continent",
    "Planète Terre": "🌍", "Île": "🏝️", "Désert": "🏜️", "Oasis": "svg:oasis",
    "Marais": "svg:marais", "Forêt": "🌲", "Jungle": "svg:jungle", "Récif": "svg:recif", "Jardin": "🌻",
    "Rivière": "🏞️", "Cascade": "svg:cascade", "Plage": "🏖️", "Falaise": "🧗", "Grotte": "🕳️",
    "Canyon": "svg:canyon", "Vallée": "svg:vallee", "Colline": "svg:colline", "Glacier": "🏔️", "Iceberg": "🧊",
    "Banquise": "svg:banquise", "Delta": "svg:delta", "Plaine": "🌾", "Prairie": "🌼", "Savane": "🦏",
    "Toundra": "🌨️", "Mer": "svg:mer", "Source": "⛲", "Atoll": "svg:atoll", "Stalactite": "🔻",
    "Sol fertile": "🟫", "Tourbe": "🟤", "Fossile": "svg:fossile", "Pôle": "svg:pole",
    # Plateau 1
    "Source hydrothermale": "♨️", "Volcan de boue": "🫕", "Désert de sel": "◻️", "Archipel": "🗾",
    "Fjord": "svg:fjord", "Taïga": "svg:taiga", "Dune": "svg:dune",
  },

  "Cosmos": {
    "Étoile": "⭐", "Aurore": "🌠", "Météore": "svg:meteore", "Galaxie": "svg:galaxie", "Univers": "🪐",
    "Soleil": "🌞", "Lune": "🌕", "Planète": "svg:planete", "Comète": "☄️", "Astéroïde": "svg:asteroide",
    "Nébuleuse": "🌫️", "Supernova": "svg:supernova", "Trou noir": "⚫", "Constellation": "✨",
    "Éclipse": "🌘", "Orbite": "🔄", "Big Bang": "svg:big-bang", "Poussière d'étoiles": "✨",
    "Système solaire": "☀️", "Voie lactée": "🌌", "Mars": "🔴", "Jupiter": "🟠",
    "Saturne": "🪐", "Anneaux planétaires": "💫", "Pulsar": "🔦", "Quasar": "🌟",
    "Matière noire": "🌑", "Espace": "🌃", "Cratère": "🕳️", "Marée lunaire": "svg:maree-lunaire",
  },

  "Flore": {
    "Plante": "🌿", "Arbre": "🌳", "Herbe": "svg:herbe", "Fleur": "🌸", "Rose": "🌹",
    "Cactus": "🌵", "Bambou": "🎋", "Blé": "🌾", "Riz": "🍚", "Maïs": "🌽", "Vigne": "svg:vigne",
    "Raisin": "🍇", "Pomme": "🍎", "Olive": "🫒", "Légume": "🥕", "Pomme de terre": "🥔",
    "Tournesol": "🌻", "Chêne": "svg:chene", "Sapin": "🌲", "Palmier": "🌴", "Lierre": "🍃",
    "Mousse": "🟩", "Fougère": "svg:fougere", "Champignon": "🍄", "Algue": "svg:algue", "Graine": "🌰",
    "Fruit": "🍑", "Pollen": "🟡", "Feuille": "🍃", "Racine": "🫚", "Bois": "🪵",
    "Cotonnier": "🌱", "Lin": "🌾", "Thé": "🍵", "Café": "☕", "Cacao": "🫘",
    "Canne à sucre": "svg:canne-a-sucre", "Herbe médicinale": "🌿", "Lichen": "🟢", "Nénuphar": "🪷",
    # Paquet thématique (culture commune)
    "Tomate": "🍅", "Laitue": "🥬", "Noix de coco": "🥥", "Érable": "🍁", "Bouquet": "💐",
    "Citrouille": "svg:citrouille",
  },

  "Biologie": {
    "Vie": "🧬", "Cellule": "svg:cellule", "ADN": "🧬", "Gène": "svg:gene", "Bactérie": "svg:bacterie", "Virus": "svg:virus",
    "Plancton": "🦐", "Protéine": "🥚", "Enzyme": "🔬", "Photosynthèse": "🍃",
    "Chlorophylle": "🟢", "Évolution": "🐒", "Mutation": "🧪", "Symbiose": "🤝",
    "Écosystème": "🌐", "Chaîne alimentaire": "🔗", "Décomposition": "🍂", "Fermentation": "🫧",
    "Levure": "svg:levure", "Microbe": "🦠", "Organisme": "🧫", "Reproduction": "💞", "Œuf": "🥚",
    "Embryon": "🫘", "Métamorphose": "svg:metamorphose", "Instinct": "🐾", "Espèce": "🐾", "Extinction": "☠️",
    "Biodiversité": "🌍", "Parasite": "svg:parasite", "Pollinisation": "svg:pollinisation", "Respiration": "🫁",
  },

  "Vie et Créatures": {
    "Lombric": "🪱", "Asticot": "🐛", "Chenille": "🐛", "Papillon": "🦋", "Poisson": "🐟",
    "Poisson Tropical": "🐠", "Poisson Polaire": "svg:poisson-polaire", "Poisson Volant": "svg:poisson-volant",
    "Poisson Abyssal": "🐡", "Méduse": "🪼", "Salamandre": "svg:salamandre", "Ptérodactyle": "🦖",
    "Luciole": "🪲", "Oiseau": "🐦",
    "Insecte": "🐞", "Abeille": "🐝", "Fourmi": "🐜", "Araignée": "🕷️", "Escargot": "🐌",
    "Grenouille": "🐸", "Serpent": "🐍", "Lézard": "🦎", "Tortue": "🐢", "Crocodile": "🐊",
    "Dinosaure": "🦕", "Aigle": "🦅", "Hibou": "🦉", "Pingouin": "🐧", "Poule": "🐔",
    "Mammifère": "🐾", "Souris": "🐭", "Chat": "🐈", "Chien": "🐕", "Loup": "🐺",
    "Cheval": "🐎", "Vache": "🐄", "Mouton": "🐑", "Cochon": "🐖", "Ours": "🐻",
    "Ours polaire": "🐻‍❄️", "Baleine": "🐋", "Dauphin": "🐬", "Requin": "🦈", "Pieuvre": "🐙",
    "Crabe": "🦀", "Corail": "🪸", "Chauve-souris": "🦇", "Singe": "🐒", "Éléphant": "🐘",
    "Lion": "🦁", "Chameau": "🐫", "Castor": "🦫", "Moustique": "🦟", "Plume": "🪶",
    "Nid": "🪺", "Ruche": "svg:ruche", "Toile d'araignée": "🕸️", "Fourrure": "svg:fourrure", "Écaille": "svg:ecaille",
    "Os": "🦴", "Mammouth": "🦣", "Oiseau marin": "🕊️", "Cygne": "🦢",
    # Paquet thématique (culture commune)
    "Chèvre": "🐐", "Cerf": "🦌", "Canard": "🦆", "Zèbre": "🦓", "Tigre": "🐅", "Phoque": "🦭",
    "Perroquet": "🦜",
    # Palier 2 (culture commune)
    "Coquillage": "🐚", "Hérisson": "🦔", "Écureuil": "🐿️", "Scorpion": "🦂", "Corbeau": "🐦‍⬛", "Grillon": "🦗",
    "Cafard": "🪳", "Dodo": "🦤", "Poussin": "🐣",
    "Girafe": "🦒", "Étoile de mer": "svg:etoile-de-mer", "Renard": "🦊",
    "Cigale": "svg:cigale",
  },

  "Corps et Esprit": {
    "Sang": "🩸", "Cœur": "❤️", "Cerveau": "🧠", "Œil": "👁️", "Muscle": "💪", "Squelette": "💀",
    "Neurone": "⚡", "Pensée": "💭", "Mémoire": "📓", "Rêve": "💤", "Sommeil": "😴",
    "Émotion": "🥲", "Peur": "😱", "Joie": "😄", "Tristesse": "😢", "Colère": "😠",
    "Amour": "💗", "Naissance": "👶", "Enfant": "🧒", "Famille": "👪", "Vieillesse": "👴",
    "Maladie": "🤒", "Santé": "🩺", "Remède": "💊", "Mort": "⚰️", "Tombe": "🪦",
    "Deuil": "🖤", "Langage": "🗣️", "Conscience": "🧘", "Idée": "svg:idee", "Curiosité": "🔍",
    "Courage": "svg:courage", "Sagesse": "svg:sagesse", "Faim": "🍽️", "Douleur": "🤕",
    # Paquet thématique (culture commune)
    "Larme": "😭", "Rire": "😂", "Cauchemar": "😨", "Sueur": "😓", "Fatigue": "🥱", "Pansement": "🩹",
    "Rhume": "🤧",
  },

  "Créations Humaines": {
    "Humain": "🧑", "Héros": "🦸", "Épée": "⚔️", "Brique": "🧱", "Maison": "🏠",
    "Chevalier": "🛡️", "Château": "🏰", "Ville": "🏙️", "Arche": "🚢",
    "Outil": "🛠️", "Hache": "🪓", "Marteau": "🔨", "Lance": "🔱", "Arc": "🏹", "Roue": "🛞",
    "Charrette": "🛒", "Bateau": "⛵", "Voile": "svg:voile", "Agriculture": "🐂", "Champ": "svg:champ",
    "Ferme": "🏡", "Farine": "svg:farine", "Pain": "🍞", "Four": "svg:four", "Poterie": "🏺",
    "Feu de camp": "🏕️", "Cuisine": "🍳", "Viande": "🍖", "Lait": "🥛", "Fromage": "🧀",
    "Vin": "🍷", "Bière": "🍺", "Miel": "🍯", "Huile": "svg:huile", "Vêtement": "👕", "Écriture": "✍️",
    "Livre": "📖", "Monnaie": "🪙", "Commerce": "⚖️", "Marché": "🏪", "Route": "🛣️", "Pont": "🌉",
    "Village": "🏘️", "Mur": "svg:mur", "Tour": "🗼", "Temple": "🛕", "Pyramide": "🔺", "Loi": "📜",
    "Roi": "🤴", "Armée": "🪖", "Guerre": "svg:guerre", "Paix": "☮️", "Religion": "🙏", "Musique": "🎵",
    "Art": "🎨", "Peinture": "🖼️", "Sculpture": "🗿", "Théâtre": "🎭", "École": "🏫",
    "Science": "🧑‍🔬", "Médecine": "⚕️", "Port": "⚓", "Puits": "🪣", "Moulin": "🌀",
    "Forge": "⚒️", "Tente": "⛺", "Chasse": "svg:chasse", "Pêche": "🎣", "Élevage": "svg:elevage",
    "Tisserand": "svg:tisserand", "Forgeron": "svg:forgeron", "Philosophie": "📜", "Mathématiques": "➗",
    "Carte": "🗺️", "Boussole": "🧭", "Calendrier": "📅", "Horloge": "🕰️", "Bougie": "🕯️",
    "Momie": "🧟",
    # Plateau 2
    "Pop-corn": "🍿", "Caramel": "🍮", "Gâteau": "🍰", "Soupe": "🍲", "Panier": "🧺", "Cloche": "🔔", "Feu d'artifice": "🎆",
    # Paquet thématique (culture commune)
    "Beurre": "🧈", "Pâtes": "🍝", "Crêpe": "🥞", "Frites": "🍟", "Jus de fruit": "🧃", "Crème glacée": "🍨",
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
    "Antiquité": "🏛️", "Égypte ancienne": "🐫", "Pharaon": "👑", "Grèce antique": "🏺",
    "Empire romain": "🛡️", "Moyen Âge": "svg:moyen-age", "Renaissance": "svg:renaissance", "Grandes découvertes": "svg:grandes-decouvertes",
    "Explorateur": "🧗", "Révolution": "✊", "Démocratie": "🗳️", "Révolution industrielle": "svg:revolution-industrielle",
    "Ère atomique": "☢️", "Conquête spatiale": "svg:conquete-spatiale", "Ère numérique": "svg:ere-numerique", "Civilisation": "svg:civilisation",
    "Empire": "👑", "Archéologie": "⛏️", "Musée": "🏛️", "Chronique": "📜", "Mythologie": "📚",
    # Palier 2 (culture commune)
    "Pirate": "🏴‍☠️",
    "Néolithique": "svg:neolithique", "Grotte ornée": "svg:grotte-ornee",
  },

  "Technologie": {
    "Machine à vapeur": "svg:machine-a-vapeur", "Moteur": "⚙️", "Machine": "svg:machine", "Usine": "🏭", "Locomotive": "🚂",
    "Train": "🚆", "Voiture": "🚗", "Avion": "✈️", "Fusée": "🚀", "Satellite": "🛰️",
    "Ampoule": "💡", "Batterie": "🔋", "Téléphone": "☎️", "Radio": "📻", "Télévision": "📺",
    "Ordinateur": "💻", "Internet": "🌐", "Robot": "🤖", "Intelligence artificielle": "svg:intelligence-artificielle",
    "Panneau solaire": "🔆", "Éolienne": "svg:eolienne", "Barrage": "🌊", "Centrale nucléaire": "svg:centrale-nucleaire",
    "Microscope": "🔬", "Télescope": "🔭", "Imprimerie": "🖨️", "Appareil photo": "📷",
    "Cinéma": "🎬", "Vaccin": "💉", "Antibiotique": "💊", "Laser": "🔴", "Électroaimant": "svg:electroaimant",
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
    "Magie": "✨", "Esprit": "svg:esprit", "Mana": "💠", "Orbe": "🔮", "Baguette": "🪄",
    "Pouvoir": "⚜️", "Anneau": "💍", "Anneau de Pouvoir": "💫", "Feu Magique": "🎇",
    "Potion": "🧪", "Élixir": "⚗️", "Golem": "🗿", "Licorne": "🦄", "Sorcier": "🧙",
    "Dragon": "🐉", "Phénix": "🐦‍🔥", "Hydre": "svg:hydre", "Olympe": "🏛️",
    "Fantôme": "👻", "Vampire": "🧛", "Loup-garou": "svg:loup-garou", "Sirène": "🧜", "Géant": "🗻",
    "Fée": "🧚", "Mythe": "📜", "Dieu": "🌟", "Démon": "😈", "Ange": "😇", "Alchimie": "svg:alchimie",
    "Pierre philosophale": "🔴", "Zombie": "🧟", "Kraken": "🦑", "Centaure": "svg:centaure", "Grimoire": "📕",
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
