# Recettes : Histoire, Technologie, Légendes
RECIPES = [
  # ======================= HISTOIRE =======================
  # --- Préhistoire
  ("Humain+Pierre+Temps", "Préhistoire"),
  ("Fossile+Humain", "Préhistoire"),
  ("Humain+Mammouth", "Préhistoire"),
  ("Feu de camp+Humain", "Préhistoire"),
  # --- Âge de pierre
  ("Pierre+Préhistoire", "Âge de pierre"),
  ("Humain+Outil+Pierre", "Âge de pierre"),
  ("Feu+Hache+Humain+Pierre", "Âge de pierre"),
  # --- Civilisation
  ("Humain+Ville", "Civilisation"),
  ("Agriculture+Village", "Civilisation"),
  ("Écriture+Ville", "Civilisation"),
  # --- Âge du bronze
  ("Bronze+Civilisation", "Âge du bronze"),
  ("Métal+Âge de pierre", "Âge du bronze"),
  ("Bronze+Âge de pierre", "Âge du bronze"),
  ("Civilisation+Cuivre+Feu+Étain", "Âge du bronze"),
  # --- Âge du fer
  ("Civilisation+Fer", "Âge du fer"),
  ("Fer+Âge du bronze", "Âge du fer"),
  ("Civilisation+Fer+Feu+Forge", "Âge du fer"),
  # --- Antiquité
  ("Civilisation+Temps", "Antiquité"),
  ("Civilisation+Âge du fer", "Antiquité"),
  ("Civilisation+Écriture", "Antiquité"),
  # --- Égypte ancienne
  ("Civilisation+Désert", "Égypte ancienne"),
  ("Civilisation+Pyramide", "Égypte ancienne"),
  ("Antiquité+Désert+Rivière", "Égypte ancienne"),
  ("Civilisation+Désert+Pyramide+Rivière", "Égypte ancienne"),
  # --- Pharaon
  ("Pyramide+Roi", "Pharaon"),
  ("Roi+Égypte ancienne", "Pharaon"),
  ("Humain+Pouvoir+Égypte ancienne", "Pharaon"),
  # --- Grèce antique
  ("Antiquité+Philosophie", "Grèce antique"),
  ("Antiquité+Olympe", "Grèce antique"),
  ("Civilisation+Olympe", "Grèce antique"),
  ("Antiquité+Marbre+Philosophie+Temple", "Grèce antique"),
  # --- Empire
  ("Civilisation+Roi", "Empire"),
  ("Armée+Civilisation", "Empire"),
  ("Civilisation+Pouvoir", "Empire"),
  ("Guerre+Roi+Ville", "Empire"),
  # --- Empire romain
  ("Antiquité+Empire", "Empire romain"),
  ("Antiquité+Armée+Route", "Empire romain"),
  ("Antiquité+Armée+Loi+Route", "Empire romain"),
  # --- Moyen Âge
  ("Chevalier+Château", "Moyen Âge"),
  ("Château+Civilisation", "Moyen Âge"),
  ("Empire romain+Temps", "Moyen Âge"),
  ("Chevalier+Château+Religion+Roi", "Moyen Âge"),
  # --- Renaissance
  ("Art+Imprimerie", "Renaissance"),
  ("Art+Moyen Âge", "Renaissance"),
  ("Art+Imprimerie+Moyen Âge+Science", "Renaissance"),
  # --- Grandes découvertes
  ("Boussole+Renaissance", "Grandes découvertes"),
  ("Océan+Renaissance", "Grandes découvertes"),
  ("Explorateur+Océan", "Grandes découvertes"),
  ("Bateau+Boussole+Carte+Océan", "Grandes découvertes"),
  # --- Explorateur
  ("Carte+Humain", "Explorateur"),
  ("Boussole+Humain", "Explorateur"),
  ("Curiosité+Humain", "Explorateur"),
  ("Bateau+Humain+Océan", "Explorateur"),
  # --- Révolution
  ("Colère+Roi", "Révolution"),
  ("Faim+Roi", "Révolution"),
  ("Colère+Humain+Ville", "Révolution"),
  ("Colère+Humain+Roi+Ville", "Révolution"),
  # --- Démocratie
  ("Loi+Révolution", "Démocratie"),
  ("Grèce antique+Loi", "Démocratie"),
  ("Civilisation+Loi+Paix+Révolution", "Démocratie"),
  # --- Révolution industrielle
  ("Machine à vapeur+Usine", "Révolution industrielle"),
  ("Machine à vapeur+Révolution", "Révolution industrielle"),
  ("Révolution+Usine", "Révolution industrielle"),
  ("Charbon+Machine à vapeur+Usine+Ville", "Révolution industrielle"),
  # --- Ère atomique
  ("Atome+Civilisation", "Ère atomique"),
  ("Bombe atomique+Civilisation", "Ère atomique"),
  ("Centrale nucléaire+Civilisation", "Ère atomique"),
  # --- Conquête spatiale
  ("Fusée+Humain", "Conquête spatiale"),
  ("Fusée+Lune", "Conquête spatiale"),
  ("Civilisation+Station spatiale", "Conquête spatiale"),
  ("Espace+Fusée+Humain+Lune", "Conquête spatiale"),
  # --- Ère numérique
  ("Civilisation+Internet", "Ère numérique"),
  ("Civilisation+Ordinateur", "Ère numérique"),
  ("Civilisation+Internet+Ordinateur+Téléphone", "Ère numérique"),
  # --- Archéologie
  ("Antiquité+Science", "Archéologie"),
  ("Pelle+Ruine", "Archéologie"),
  ("Antiquité+Humain+Terre", "Archéologie"),
  ("Antiquité+Outil+Science+Terre", "Archéologie"),
  # --- Musée
  ("Archéologie+Maison", "Musée"),
  ("Art+Maison", "Musée"),
  ("Maison+Peinture+Sculpture", "Musée"),
  # --- Chronique
  ("Temps+Écriture", "Chronique"),
  ("Roi+Écriture", "Chronique"),
  ("Papier+Roi+Temps+Écriture", "Chronique"),
  # --- Mythologie
  ("Civilisation+Mythe", "Mythologie"),
  ("Dieu+Mythe", "Mythologie"),
  ("Mythe+Olympe", "Mythologie"),
  ("Civilisation+Dieu+Héros+Mythe", "Mythologie"),

  # ======================= TECHNOLOGIE =======================
  # --- Machine
  ("Humain+Métal+Énergie", "Machine"),
  ("Outil+Énergie", "Machine"),
  # --- Moteur
  ("Machine+Énergie", "Moteur"),
  ("Machine+Pétrole", "Moteur"),
  ("Combustion+Machine", "Moteur"),
  # --- Machine à vapeur
  ("Machine+Vapeur", "Machine à vapeur"),
  ("Charbon+Eau+Feu+Machine", "Machine à vapeur"),
  # --- Usine
  ("Machine+Maison", "Usine"),
  ("Machine+Ville", "Usine"),
  ("Brique+Humain+Machine", "Usine"),
  # --- Locomotive
  ("Charrette+Machine à vapeur", "Locomotive"),
  ("Machine à vapeur+Roue", "Locomotive"),
  # --- Train
  ("Charrette+Locomotive", "Train"),
  # --- Voiture
  ("Charrette+Moteur", "Voiture"),
  ("Moteur+Roue", "Voiture"),
  ("Moteur+Route", "Voiture"),
  # --- Avion
  ("Moteur+Oiseau", "Avion"),
  ("Air+Moteur", "Avion"),
  ("Air+Métal+Moteur+Oiseau", "Avion"),
  # --- Fusée
  ("Espace+Moteur", "Fusée"),
  ("Avion+Espace", "Fusée"),
  ("Espace+Explosion+Moteur+Métal", "Fusée"),
  # --- Satellite
  ("Fusée+Orbite", "Satellite"),
  ("Fusée+Planète Terre", "Satellite"),
  ("Espace+Radio", "Satellite"),
  # --- Station spatiale
  ("Maison+Satellite", "Station spatiale"),
  ("Humain+Satellite", "Station spatiale"),
  ("Espace+Fusée+Maison", "Station spatiale"),
  # --- Ampoule
  ("Verre+Électricité", "Ampoule"),
  ("Lumière+Verre+Énergie", "Ampoule"),
  ("Bougie+Électricité", "Ampoule"),
  # --- Batterie
  ("Acide+Métal+Électricité", "Batterie"),
  ("Acide+Métal+Énergie", "Batterie"),
  ("Acide+Cuivre+Électricité+Étain", "Batterie"),
  # --- Réseau électrique
  ("Ville+Électricité", "Réseau électrique"),
  ("Barrage+Ville", "Réseau électrique"),
  ("Cuivre+Tour+Ville+Électricité", "Réseau électrique"),
  # --- Téléphone
  ("Son+Électricité", "Téléphone"),
  ("Langage+Électricité", "Téléphone"),
  # --- Radio
  ("Onde+Son", "Radio"),
  ("Musique+Onde+Électricité", "Radio"),
  # --- Appareil photo
  ("Lentille+Machine", "Appareil photo"),
  ("Lentille+Mémoire", "Appareil photo"),
  ("Lentille+Lumière+Papier", "Appareil photo"),
  # --- Cinéma
  ("Appareil photo+Mouvement", "Cinéma"),
  ("Appareil photo+Théâtre", "Cinéma"),
  ("Appareil photo+Art+Temps", "Cinéma"),
  # --- Télévision
  ("Cinéma+Radio", "Télévision"),
  ("Appareil photo+Radio", "Télévision"),
  ("Appareil photo+Onde+Son+Électricité", "Télévision"),
  # --- Puce électronique
  ("Silicium+Électricité", "Puce électronique"),
  ("Silicium+Électron", "Puce électronique"),
  # --- Ordinateur
  ("Machine+Puce électronique", "Ordinateur"),
  ("Machine+Mathématiques", "Ordinateur"),
  ("Cerveau+Machine+Électricité", "Ordinateur"),
  ("Machine+Mathématiques+Puce électronique+Électricité", "Ordinateur"),
  # --- Internet
  ("Ordinateur+Téléphone", "Internet"),
  ("Ordinateur+Planète Terre", "Internet"),
  # --- Robot
  ("Humain+Machine", "Robot"),
  ("Golem+Machine", "Robot"),
  ("Cerveau+Machine+Métal+Électricité", "Robot"),
  # --- Intelligence artificielle
  ("Cerveau+Ordinateur", "Intelligence artificielle"),
  ("Pensée+Robot", "Intelligence artificielle"),
  # --- Panneau solaire
  ("Soleil+Électricité", "Panneau solaire"),
  ("Lumière+Silicium+Électricité", "Panneau solaire"),
  ("Lumière+Silicium+Verre+Électricité", "Panneau solaire"),
  # --- Éolienne
  ("Moulin+Vent", "Éolienne"),
  ("Machine+Vent", "Éolienne"),
  ("Vent+Électricité", "Éolienne"),
  # --- Moulin à eau
  ("Eau+Moulin", "Moulin à eau"),
  ("Bois+Eau+Machine", "Moulin à eau"),
  ("Moulin+Rivière", "Moulin à eau"),
  ("Rivière+Roue", "Moulin à eau"),
  # --- Barrage
  ("Mur+Rivière", "Barrage"),
  ("Béton+Rivière", "Barrage"),
  ("Béton+Mur+Rivière+Électricité", "Barrage"),
  # --- Centrale nucléaire
  ("Fission nucléaire+Usine", "Centrale nucléaire"),
  ("Usine+Ère atomique", "Centrale nucléaire"),
  ("Atome+Usine", "Centrale nucléaire"),
  ("Radioactivité+Usine+Électricité", "Centrale nucléaire"),
  ("Eau+Fission nucléaire+Usine+Vapeur", "Centrale nucléaire"),
  # --- Bombe atomique
  ("Explosion+Fission nucléaire", "Bombe atomique"),
  ("Explosion+Ère atomique", "Bombe atomique"),
  ("Atome+Explosion", "Bombe atomique"),
  # --- Microscope
  ("Lentille+Laboratoire", "Microscope"),
  ("Lentille+Microbe", "Microscope"),
  # --- Télescope
  ("Lentille+Étoile", "Télescope"),
  ("Science+Verre+Étoile", "Télescope"),
  ("Lentille+Nuit+Verre+Étoile", "Télescope"),
  # --- Imprimerie
  ("Livre+Machine", "Imprimerie"),
  ("Machine+Écriture", "Imprimerie"),
  ("Encre+Machine+Papier", "Imprimerie"),
  # --- Vaccin
  ("Médecine+Virus", "Vaccin"),
  ("Maladie+Remède+Science+Virus", "Vaccin"),
  # --- Antibiotique
  ("Bactérie+Médecine", "Antibiotique"),
  ("Champignon+Médecine", "Antibiotique"),
  ("Bactérie+Champignon+Science", "Antibiotique"),
  # --- Laser
  ("Cristal+Lumière+Énergie", "Laser"),
  ("Cristal+Lumière+Électricité", "Laser"),
  # --- Électroaimant
  ("Aimant+Électricité", "Électroaimant"),
  ("Fer+Électricité", "Électroaimant"),
  ("Magnétisme+Électricité", "Électroaimant"),
  # --- Sous-marin
  ("Machine+Poisson Abyssal", "Sous-marin"),
  ("Bateau+Poisson Abyssal", "Sous-marin"),  # le bateau qui plonge jusqu'aux abysses
  # --- Sauvegarde
  ("Mémoire+Ordinateur", "Sauvegarde"),
  ("Mémoire+Puce électronique", "Sauvegarde"),

  # ======================= LÉGENDES =======================
  # --- Mythe (les récits nés de la peur et de l'imaginaire)
  ("Humain+Peur", "Mythe"),
  ("Dragon+Humain", "Mythe"),
  ("Humain+Nuit+Peur", "Mythe"),
  ("Feu de camp+Humain+Nuit+Peur", "Mythe"),
  # --- Dieu
  ("Mythe+Pouvoir", "Dieu"),
  ("Mythe+Éclair", "Dieu"),
  ("Religion+Pouvoir", "Dieu"),
  # --- Ange
  ("Dieu+Esprit", "Ange"),
  ("Lumière+Religion+Esprit", "Ange"),
  ("Humain+Mythe+Oiseau", "Ange"),
  ("Dieu+Lumière+Plume+Esprit", "Ange"),
  # --- Démon
  ("Ange+Feu", "Démon"),
  ("Mythe+Peur+Esprit", "Démon"),
  ("Lave+Mythe+Esprit", "Démon"),
  # --- Fantôme
  ("Mort+Esprit", "Fantôme"),
  ("Tombe+Esprit", "Fantôme"),
  ("Château+Esprit", "Fantôme"),
  ("Mort+Nuit+Tombe+Esprit", "Fantôme"),
  # --- Vampire
  ("Chauve-souris+Humain", "Vampire"),
  ("Humain+Mythe+Sang", "Vampire"),
  ("Humain+Mort+Sang", "Vampire"),
  ("Chauve-souris+Humain+Nuit+Sang", "Vampire"),
  # --- Loup-garou
  ("Humain+Loup+Lune", "Loup-garou"),
  ("Loup+Mythe", "Loup-garou"),
  ("Humain+Loup", "Loup-garou"),
  ("Humain+Loup+Lune+Nuit", "Loup-garou"),
  # --- Sirène
  ("Mythe+Poisson", "Sirène"),
  ("Humain+Mythe+Océan", "Sirène"),
  ("Musique+Mythe+Océan", "Sirène"),
  # --- Géant
  ("Humain+Montagne+Mythe", "Géant"),
  ("Force+Humain+Mythe", "Géant"),
  # --- Fée
  ("Magie+Papillon", "Fée"),
  ("Fleur+Magie", "Fée"),
  ("Forêt+Mythe+Esprit", "Fée"),
  # --- Alchimie
  ("Magie+Métal", "Alchimie"),
  ("Magie+Science", "Alchimie"),
  ("Distillation+Magie", "Alchimie"),
  ("Magie+Métal+Or+Distillation", "Alchimie"),
  # --- Pierre philosophale
  ("Alchimie+Or", "Pierre philosophale"),
  ("Alchimie+Pierre", "Pierre philosophale"),
  ("Alchimie+Cristal+Élixir", "Pierre philosophale"),
  ("Alchimie+Feu+Or+Plomb", "Pierre philosophale"),
  # --- Zombie
  ("Humain+Mort", "Zombie"),
  ("Magie+Tombe", "Zombie"),
  ("Humain+Virus+Mort", "Zombie"),
  ("Humain+Magie+Mort+Tombe", "Zombie"),
  # --- Kraken
  ("Mythe+Pieuvre", "Kraken"),
  ("Géant+Pieuvre", "Kraken"),
  ("Mythe+Océan+Poisson Abyssal", "Kraken"),
  ("Mythe+Océan+Pieuvre+Tempête", "Kraken"),
  # --- Centaure
  ("Cheval+Humain", "Centaure"),
  ("Cheval+Humain+Mythe", "Centaure"),
  ("Arc+Cheval+Humain+Mythe", "Centaure"),
  # --- Grimoire
  ("Livre+Magie", "Grimoire"),
  ("Livre+Sorcier", "Grimoire"),
  ("Encre+Magie+Papier", "Grimoire"),
  ("Encre+Livre+Magie+Sorcier", "Grimoire"),

  # --- Chemins « mythologiques » pour les légendes existantes
  ("Feu+Mythe+Serpent", "Dragon"),
  ("Dinosaure+Mythe", "Dragon"),
  ("Feu+Mythe+Serpent+Écaille", "Dragon"),
  ("Feu+Mythe+Oiseau", "Phénix"),
  ("Cendre+Mythe+Oiseau", "Phénix"),
  ("Marais+Mythe+Serpent", "Hydre"),
  ("Eau+Mythe+Serpent", "Hydre"),
  ("Cheval+Magie", "Licorne"),
  ("Arc-en-ciel+Cheval", "Licorne"),
  ("Argile+Magie", "Golem"),
  ("Argile+Humain+Mythe", "Golem"),
  ("Dieu+Montagne", "Olympe"),
  ("Montagne+Mythologie", "Olympe"),
  ("Dieu+Montagne+Nuage+Éclair", "Olympe"),
  ("Grimoire+Humain", "Sorcier"),
  ("Humain+Magie+Sagesse", "Sorcier"),
  ("Eau+Grimoire", "Potion"),
  ("Alchimie+Herbe médicinale", "Potion"),
  ("Alchimie+Vie", "Élixir"),
]
