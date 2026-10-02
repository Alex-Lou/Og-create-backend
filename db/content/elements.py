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
    "Argile": "🏺", "Charbon": "⚫", "Sel": "🧂", "Fer": "🔩", "Cuivre": "🟧", "Or": "🥇",
    "Argent": "🥈", "Étain": "🪙", "Bronze": "🥉", "Acier": "🗡️", "Plomb": "🔘",
    "Calcaire": "⬜", "Marbre": "🏛️", "Granite": "◼️", "Obsidienne": "🖤", "Quartz": "🔷",
    "Diamant": "💠", "Graphite": "✏️", "Pétrole": "🛢️", "Goudron": "⬛", "Béton": "🧱",
    "Ciment": "🪣", "Plâtre": "🤍", "Céramique": "🍶", "Porcelaine": "🫖", "Papier": "📄",
    "Encre": "🖋️", "Cire": "🕯️", "Caoutchouc": "🎈", "Plastique": "🧴", "Laine": "🧶",
    "Coton": "☁️", "Tissu": "🧵", "Cuir": "👞", "Corde": "🪢", "Rouille": "🟫",
    # Plateau 1
    "Pierre ponce": "🧽", "Compost": "♻️", "Sédiment": "🫙", "Suie": "🧹",
    # Plateau 2
    "Résine": "🟨", "Ambre": "🔶",
    "Soie": "svg:soie",
    "Colle": "svg:colle", "Contreplaqué": "svg:contreplaque", "Foin": "svg:foin", "Silex": "svg:silex", "Ocre": "svg:ocre",
  },

  "Phénomènes Naturels": {
    "Pluie": "🌧️", "Nuage": "☁️", "Énergie": "⚡", "Vent": "🌬️", "Bourrasque": "🍃",
    "Tempête": "⛈️", "Éclair": "🌩️", "Tornade": "🌪️", "Explosion": "💥", "Incendie": "🚒",
    "Brasier": "🪔", "Geyser": "⛲", "Vague": "🏄", "Ozone": "🔵", "Lumière": "☀️",
    "Arc-en-ciel": "🌈", "Temps": "⌛", "Neige": "❄️", "Glace": "🧊",
    "Blizzard": "🌨️", "Tsunami": "🌀", "Déluge": "☔",
    "Brouillard": "🌁", "Rosée": "💦", "Givre": "🥶", "Grêle": "🧊", "Orage": "⛈️",
    "Ouragan": "🌀", "Séisme": "📳", "Érosion": "🏜️", "Marée": "🌊", "Chaleur": "🌡️",
    "Froid": "❄️", "Sécheresse": "🥵", "Inondation": "🌊", "Avalanche": "🏔️",
    "Glissement de terrain": "⛰️", "Saison": "🍂", "Jour": "🌞", "Nuit": "🌙", "Ombre": "👤",
    "Son": "🔊", "Écho": "📢", "Feu de forêt": "🔥",
    # Plateau 1
    "Pluie acide": "🥀",
    # Paquet thématique (culture commune)
    "Hiver": "🧣", "Printemps": "🌷", "Été": "⛱️", "Automne": "🎃", "Ciel": "🌤️", "Coucher de soleil": "🌇",
    "Verglas": "svg:verglas", "Mirage": "svg:mirage", "Tonnerre": "svg:tonnerre",
    "Buée": "svg:buee",
  },

  "Physique": {
    "Atome": "⚛️", "Électron": "🔹", "Proton": "🔺", "Neutron": "⚪", "Noyau atomique": "🟠",
    "Particule": "✴️", "Onde": "〰️", "Magnétisme": "🧲", "Aimant": "🧲", "Électricité": "🔌",
    "Pression": "🎚️", "Gravité": "🍎", "Masse": "⚖️", "Force": "💪", "Mouvement": "🏃",
    "Vitesse": "💨", "Friction": "🔥", "Plasma": "🟣", "Radiation": "☢️", "Radioactivité": "☢️",
    "Fusion nucléaire": "🌟", "Fission nucléaire": "💣", "Lentille": "🔎", "Prisme": "🔻",
    "Spectre lumineux": "🌈", "Infrarouge": "🟥", "Ultraviolet": "🟪", "Rayons X": "🩻",
    "Vide": "⭕", "Gaz": "🫧", "Liquide": "💧", "Solide": "🧊",
    "Température": "🌡️", "Inertie": "🪨", "Relativité": "⏱️", "Physique quantique": "🎲",
    "Antimatière": "🌑",
    "Électricité statique": "svg:electricite-statique", "Bulle de savon": "svg:bulle-de-savon",
  },

  "Chimie": {
    "Hydrogène": "🎈", "Oxygène": "🫁", "Carbone": "⚫", "Azote": "🌬️", "Hélium": "🎈",
    "Sodium": "🧂", "Chlore": "🧪", "Calcium": "🦴", "Silicium": "💻", "Soufre": "🟡",
    "Phosphore": "✨", "Molécule": "🔗", "Réaction chimique": "⚗️", "Combustion": "🔥",
    "Oxydation": "🟫", "Acide": "🍋", "Base chimique": "🧼", "Dioxyde de carbone": "😮‍💨",
    "Méthane": "💨", "Ammoniac": "🧪", "Eau salée": "🌊", "Solution": "🧫", "Distillation": "⚗️",
    "Cristallisation": "❇️", "Catalyseur": "⚡", "Alcool": "🍶", "Sucre": "🍬", "Amidon": "🥔",
    "Savon": "🧼", "Vinaigre": "🍾", "Engrais": "🌾", "Poudre à canon": "🧨", "Polymère": "🔗",
    "Tableau périodique": "📊", "Laboratoire": "🧪",
  },

  "Formations Naturelles": {
    "Montagne": "⛰️", "Volcan": "🌋", "Lac": "🏞️", "Océan": "🌊", "Continent": "🗺️",
    "Planète Terre": "🌍", "Île": "🏝️", "Désert": "🏜️", "Oasis": "🌴",
    "Marais": "🪷", "Forêt": "🌲", "Jungle": "🎋", "Récif": "🪸", "Jardin": "🌻",
    "Rivière": "🏞️", "Cascade": "💧", "Plage": "🏖️", "Falaise": "🧗", "Grotte": "🕳️",
    "Canyon": "🏜️", "Vallée": "🏞️", "Colline": "⛰️", "Glacier": "🏔️", "Iceberg": "🧊",
    "Banquise": "🐧", "Delta": "🔺", "Plaine": "🌾", "Prairie": "🌼", "Savane": "🦏",
    "Toundra": "🌨️", "Mer": "🌊", "Source": "⛲", "Atoll": "🏝️", "Stalactite": "🔻",
    "Sol fertile": "🟫", "Tourbe": "🟤", "Fossile": "🦴", "Pôle": "🧭",
    # Plateau 1
    "Source hydrothermale": "♨️", "Volcan de boue": "🫕", "Désert de sel": "◻️", "Archipel": "🗾",
    "Fjord": "svg:fjord", "Taïga": "svg:taiga", "Dune": "svg:dune",
  },

  "Cosmos": {
    "Étoile": "⭐", "Aurore": "🌠", "Météore": "☄️", "Galaxie": "🌌", "Univers": "🪐",
    "Soleil": "🌞", "Lune": "🌕", "Planète": "🪐", "Comète": "☄️", "Astéroïde": "🪨",
    "Nébuleuse": "🌫️", "Supernova": "💥", "Trou noir": "⚫", "Constellation": "✨",
    "Éclipse": "🌘", "Orbite": "🔄", "Big Bang": "💥", "Poussière d'étoiles": "✨",
    "Système solaire": "☀️", "Voie lactée": "🌌", "Mars": "🔴", "Jupiter": "🟠",
    "Saturne": "🪐", "Anneaux planétaires": "💫", "Pulsar": "🔦", "Quasar": "🌟",
    "Matière noire": "🌑", "Espace": "🌃", "Cratère": "🕳️", "Marée lunaire": "🌊",
  },

  "Flore": {
    "Plante": "🌿", "Arbre": "🌳", "Herbe": "🌱", "Fleur": "🌸", "Rose": "🌹",
    "Cactus": "🌵", "Bambou": "🎋", "Blé": "🌾", "Riz": "🍚", "Maïs": "🌽", "Vigne": "🍇",
    "Raisin": "🍇", "Pomme": "🍎", "Olive": "🫒", "Légume": "🥕", "Pomme de terre": "🥔",
    "Tournesol": "🌻", "Chêne": "🌳", "Sapin": "🌲", "Palmier": "🌴", "Lierre": "🍃",
    "Mousse": "🟩", "Fougère": "🌿", "Champignon": "🍄", "Algue": "🌿", "Graine": "🌰",
    "Fruit": "🍑", "Pollen": "🟡", "Feuille": "🍃", "Racine": "🫚", "Bois": "🪵",
    "Cotonnier": "🌱", "Lin": "🌾", "Thé": "🍵", "Café": "☕", "Cacao": "🫘",
    "Canne à sucre": "🎋", "Herbe médicinale": "🌿", "Lichen": "🟢", "Nénuphar": "🪷",
    # Paquet thématique (culture commune)
    "Tomate": "🍅", "Laitue": "🥬", "Noix de coco": "🥥", "Érable": "🍁", "Bouquet": "💐",
    "Citrouille": "svg:citrouille",
  },

  "Biologie": {
    "Vie": "🧬", "Cellule": "🦠", "ADN": "🧬", "Gène": "🧬", "Bactérie": "🦠", "Virus": "🦠",
    "Plancton": "🦐", "Protéine": "🥚", "Enzyme": "🔬", "Photosynthèse": "🍃",
    "Chlorophylle": "🟢", "Évolution": "🐒", "Mutation": "🧪", "Symbiose": "🤝",
    "Écosystème": "🌐", "Chaîne alimentaire": "🔗", "Décomposition": "🍂", "Fermentation": "🫧",
    "Levure": "🍞", "Microbe": "🦠", "Organisme": "🧫", "Reproduction": "💞", "Œuf": "🥚",
    "Embryon": "🫘", "Métamorphose": "🦋", "Instinct": "🐾", "Espèce": "🐾", "Extinction": "☠️",
    "Biodiversité": "🌍", "Parasite": "🪱", "Pollinisation": "🐝", "Respiration": "🫁",
  },

  "Vie et Créatures": {
    "Lombric": "🪱", "Asticot": "🐛", "Chenille": "🐛", "Papillon": "🦋", "Poisson": "🐟",
    "Poisson Tropical": "🐠", "Poisson Polaire": "🐟", "Poisson Volant": "🐟",
    "Poisson Abyssal": "🐡", "Méduse": "🪼", "Salamandre": "🦎", "Ptérodactyle": "🦖",
    "Luciole": "🪲", "Oiseau": "🐦",
    "Insecte": "🐞", "Abeille": "🐝", "Fourmi": "🐜", "Araignée": "🕷️", "Escargot": "🐌",
    "Grenouille": "🐸", "Serpent": "🐍", "Lézard": "🦎", "Tortue": "🐢", "Crocodile": "🐊",
    "Dinosaure": "🦕", "Aigle": "🦅", "Hibou": "🦉", "Pingouin": "🐧", "Poule": "🐔",
    "Mammifère": "🐾", "Souris": "🐭", "Chat": "🐈", "Chien": "🐕", "Loup": "🐺",
    "Cheval": "🐎", "Vache": "🐄", "Mouton": "🐑", "Cochon": "🐖", "Ours": "🐻",
    "Ours polaire": "🐻‍❄️", "Baleine": "🐋", "Dauphin": "🐬", "Requin": "🦈", "Pieuvre": "🐙",
    "Crabe": "🦀", "Corail": "🪸", "Chauve-souris": "🦇", "Singe": "🐒", "Éléphant": "🐘",
    "Lion": "🦁", "Chameau": "🐫", "Castor": "🦫", "Moustique": "🦟", "Plume": "🪶",
    "Nid": "🪺", "Ruche": "🍯", "Toile d'araignée": "🕸️", "Fourrure": "svg:fourrure", "Écaille": "🐉",
    "Os": "🦴", "Mammouth": "🦣", "Oiseau marin": "🕊️", "Cygne": "🦢",
    # Paquet thématique (culture commune)
    "Chèvre": "🐐", "Cerf": "🦌", "Canard": "🦆", "Zèbre": "🦓", "Tigre": "🐅", "Phoque": "🦭",
    "Perroquet": "🦜",
    # Palier 2 (culture commune)
    "Coquillage": "🐚", "Hérisson": "🦔", "Écureuil": "🐿️", "Scorpion": "🦂", "Corbeau": "🐦‍⬛", "Grillon": "🦗",
    "Cafard": "🪳", "Dodo": "🦤", "Poussin": "🐣",
    "Girafe": "🦒", "Étoile de mer": "svg:etoile-de-mer", "Renard": "🦊",
  },

  "Corps et Esprit": {
    "Sang": "🩸", "Cœur": "❤️", "Cerveau": "🧠", "Œil": "👁️", "Muscle": "💪", "Squelette": "💀",
    "Neurone": "⚡", "Pensée": "💭", "Mémoire": "📓", "Rêve": "💤", "Sommeil": "😴",
    "Émotion": "🎭", "Peur": "😱", "Joie": "😄", "Tristesse": "😢", "Colère": "😠",
    "Amour": "💗", "Naissance": "👶", "Enfant": "🧒", "Famille": "👪", "Vieillesse": "👴",
    "Maladie": "🤒", "Santé": "🩺", "Remède": "💊", "Mort": "🕯️", "Tombe": "🪦",
    "Deuil": "🖤", "Langage": "🗣️", "Conscience": "🪞", "Idée": "💡", "Curiosité": "🔍",
    "Courage": "🦁", "Sagesse": "🦉", "Faim": "🍽️", "Douleur": "🤕",
    # Paquet thématique (culture commune)
    "Larme": "😭", "Rire": "😂", "Cauchemar": "😨", "Sueur": "😓", "Fatigue": "🥱", "Pansement": "🩹",
    "Rhume": "🤧",
  },

  "Créations Humaines": {
    "Humain": "🧑", "Héros": "🦸", "Épée": "⚔️", "Brique": "🧱", "Maison": "🏠",
    "Chevalier": "🛡️", "Château": "🏰", "Ville": "🏙️", "Arche": "🚢",
    "Outil": "🛠️", "Hache": "🪓", "Marteau": "🔨", "Lance": "🔱", "Arc": "🏹", "Roue": "🛞",
    "Charrette": "🛒", "Bateau": "⛵", "Voile": "⛵", "Agriculture": "🐂", "Champ": "🌾",
    "Ferme": "🏡", "Farine": "🌾", "Pain": "🍞", "Four": "🔥", "Poterie": "🏺",
    "Feu de camp": "🏕️", "Cuisine": "🍳", "Viande": "🍖", "Lait": "🥛", "Fromage": "🧀",
    "Vin": "🍷", "Bière": "🍺", "Miel": "🍯", "Huile": "🫒", "Vêtement": "👕", "Écriture": "✍️",
    "Livre": "📖", "Monnaie": "🪙", "Commerce": "⚖️", "Marché": "🏪", "Route": "🛣️", "Pont": "🌉",
    "Village": "🏘️", "Mur": "🧱", "Tour": "🗼", "Temple": "🛕", "Pyramide": "🔺", "Loi": "📜",
    "Roi": "🤴", "Armée": "🪖", "Guerre": "⚔️", "Paix": "🕊️", "Religion": "🙏", "Musique": "🎵",
    "Art": "🎨", "Peinture": "🖼️", "Sculpture": "🗿", "Théâtre": "🎭", "École": "🏫",
    "Science": "🔬", "Médecine": "⚕️", "Port": "⚓", "Puits": "🪣", "Moulin": "🌀",
    "Forge": "⚒️", "Tente": "⛺", "Chasse": "🏹", "Pêche": "🎣", "Élevage": "🐄",
    "Tisserand": "🧵", "Forgeron": "⚒️", "Philosophie": "📜", "Mathématiques": "➗",
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
  },

  "Histoire": {
    "Préhistoire": "🦴", "Âge de pierre": "🪨", "Âge du bronze": "🥉", "Âge du fer": "⚒️",
    "Antiquité": "🏛️", "Égypte ancienne": "🐫", "Pharaon": "👑", "Grèce antique": "🏺",
    "Empire romain": "🛡️", "Moyen Âge": "🏰", "Renaissance": "🎨", "Grandes découvertes": "🧭",
    "Explorateur": "🧗", "Révolution": "✊", "Démocratie": "🗳️", "Révolution industrielle": "🏭",
    "Ère atomique": "☢️", "Conquête spatiale": "🚀", "Ère numérique": "💻", "Civilisation": "🏛️",
    "Empire": "👑", "Archéologie": "🏺", "Musée": "🏛️", "Chronique": "📜", "Mythologie": "📚",
    # Palier 2 (culture commune)
    "Pirate": "🏴‍☠️",
    "Néolithique": "svg:neolithique", "Grotte ornée": "svg:grotte-ornee",
  },

  "Technologie": {
    "Machine à vapeur": "🚂", "Moteur": "⚙️", "Machine": "🏭", "Usine": "🏭", "Locomotive": "🚂",
    "Train": "🚆", "Voiture": "🚗", "Avion": "✈️", "Fusée": "🚀", "Satellite": "🛰️",
    "Ampoule": "💡", "Batterie": "🔋", "Téléphone": "☎️", "Radio": "📻", "Télévision": "📺",
    "Ordinateur": "💻", "Internet": "🌐", "Robot": "🤖", "Intelligence artificielle": "🧠",
    "Panneau solaire": "🔆", "Éolienne": "🌬️", "Barrage": "🌊", "Centrale nucléaire": "🏭",
    "Microscope": "🔬", "Télescope": "🔭", "Imprimerie": "🖨️", "Appareil photo": "📷",
    "Cinéma": "🎬", "Vaccin": "💉", "Antibiotique": "💊", "Laser": "🔴", "Électroaimant": "🧲",
    "Station spatiale": "🛰️", "Sous-marin": "🌊", "Bombe atomique": "💣", "Puce électronique": "🔲",
    "Réseau électrique": "🔌", "Moulin à eau": "💧", "Sauvegarde": "💾",
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
    "Magie": "✨", "Esprit": "👻", "Mana": "💠", "Orbe": "🔮", "Baguette": "🪄",
    "Pouvoir": "⚜️", "Anneau": "💍", "Anneau de Pouvoir": "💫", "Feu Magique": "🎇",
    "Potion": "🧪", "Élixir": "⚗️", "Golem": "🗿", "Licorne": "🦄", "Sorcier": "🧙",
    "Dragon": "🐉", "Phénix": "🦅", "Hydre": "🐍", "Olympe": "🏛️",
    "Fantôme": "👻", "Vampire": "🧛", "Loup-garou": "🐺", "Sirène": "🧜", "Géant": "🗻",
    "Fée": "🧚", "Mythe": "📜", "Dieu": "🌟", "Démon": "😈", "Ange": "😇", "Alchimie": "⚗️",
    "Pierre philosophale": "🔴", "Zombie": "🧟", "Kraken": "🦑", "Centaure": "🐎", "Grimoire": "📕",
    "Génie": "🧞", "Ogre": "👹", "Chat botté": "svg:chat-botte", "Père Noël": "🎅",
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
