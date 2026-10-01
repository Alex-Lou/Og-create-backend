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
    "Banquise": "🐧", "Delta": "🔺", "Plaine": "🌾", "Prairie": "🌼", "Savane": "🦒",
    "Toundra": "🌨️", "Mer": "🌊", "Source": "⛲", "Atoll": "🏝️", "Stalactite": "🔻",
    "Sol fertile": "🟫", "Tourbe": "🟤", "Fossile": "🦴", "Pôle": "🧭",
    # Plateau 1
    "Source hydrothermale": "♨️", "Volcan de boue": "🫕", "Désert de sel": "◻️", "Archipel": "🗾",
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
    "Cotonnier": "🌱", "Lin": "🌾", "Thé": "🍵", "Café": "☕", "Cacao": "🍫",
    "Canne à sucre": "🎋", "Herbe médicinale": "🌿", "Lichen": "🟢", "Nénuphar": "🪷",
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
    "Nid": "🪺", "Ruche": "🍯", "Toile d'araignée": "🕸️", "Fourrure": "🦊", "Écaille": "🐉",
    "Os": "🦴", "Mammouth": "🦣", "Oiseau marin": "🕊️", "Cygne": "🦢",
  },

  "Corps et Esprit": {
    "Sang": "🩸", "Cœur": "❤️", "Cerveau": "🧠", "Œil": "👁️", "Muscle": "💪", "Squelette": "💀",
    "Neurone": "⚡", "Pensée": "💭", "Mémoire": "📓", "Rêve": "💤", "Sommeil": "😴",
    "Émotion": "🎭", "Peur": "😱", "Joie": "😄", "Tristesse": "😢", "Colère": "😠",
    "Amour": "💗", "Naissance": "👶", "Enfant": "🧒", "Famille": "👪", "Vieillesse": "👴",
    "Maladie": "🤒", "Santé": "🩺", "Remède": "💊", "Mort": "🕯️", "Tombe": "🪦",
    "Deuil": "🖤", "Langage": "🗣️", "Conscience": "🪞", "Idée": "💡", "Curiosité": "🔍",
    "Courage": "🦁", "Sagesse": "🦉", "Faim": "🍽️", "Douleur": "🤕",
  },

  "Créations Humaines": {
    "Humain": "🧑", "Héros": "🦸", "Épée": "⚔️", "Brique": "🧱", "Maison": "🏠",
    "Chevalier": "🛡️", "Château": "🏰", "Ville": "🏙️", "Arche": "🚢",
    "Outil": "🛠️", "Hache": "🪓", "Marteau": "🔨", "Lance": "🔱", "Arc": "🏹", "Roue": "🛞",
    "Charrette": "🛒", "Bateau": "⛵", "Voile": "⛵", "Agriculture": "🚜", "Champ": "🌾",
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
  },

  "Histoire": {
    "Préhistoire": "🦴", "Âge de pierre": "🪨", "Âge du bronze": "🥉", "Âge du fer": "⚒️",
    "Antiquité": "🏛️", "Égypte ancienne": "🐫", "Pharaon": "👑", "Grèce antique": "🏺",
    "Empire romain": "🛡️", "Moyen Âge": "🏰", "Renaissance": "🎨", "Grandes découvertes": "🧭",
    "Explorateur": "🧗", "Révolution": "✊", "Démocratie": "🗳️", "Révolution industrielle": "🏭",
    "Ère atomique": "☢️", "Conquête spatiale": "🚀", "Ère numérique": "💻", "Civilisation": "🏛️",
    "Empire": "👑", "Archéologie": "🏺", "Musée": "🏛️", "Chronique": "📜", "Mythologie": "📚",
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
  },

  "Légendes": {
    "Magie": "✨", "Esprit": "👻", "Mana": "💠", "Orbe": "🔮", "Baguette": "🪄",
    "Pouvoir": "⚜️", "Anneau": "💍", "Anneau de Pouvoir": "💫", "Feu Magique": "🎇",
    "Potion": "🧪", "Élixir": "⚗️", "Golem": "🗿", "Licorne": "🦄", "Sorcier": "🧙",
    "Dragon": "🐉", "Phénix": "🦅", "Hydre": "🐍", "Olympe": "🏛️",
    "Fantôme": "👻", "Vampire": "🧛", "Loup-garou": "🐺", "Sirène": "🧜", "Géant": "🗻",
    "Fée": "🧚", "Mythe": "📜", "Dieu": "🌟", "Démon": "😈", "Ange": "😇", "Alchimie": "⚗️",
    "Pierre philosophale": "🔴", "Zombie": "🧟", "Kraken": "🦑", "Centaure": "🐎", "Grimoire": "📕",
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
