# Recettes : passe « boucler les recettes simples » — une voie à 2 ingrédients, juste et évidente, pour les éléments qui n'en avaient aucune.
# Recherche, deux contre-vérifications indépendantes (web, sources), validation du propriétaire.
RECIPES = [
  ("Plancton+Pression", "Pétrole"),  # Le pétrole vient du plancton marin enfoui dans les sédiments sous pression et chaleur.
  ("Algue+Pression", "Pétrole"),  # Même origine : plancton, algues et bactéries des anciens océans.
  ("Bois+Colle", "Contreplaqué"),  # Le contreplaqué = fines feuilles de bois (plis) encollées et pressées.
  ("Herbe+Soleil", "Foin"),  # Le foin est de l'herbe fauchée et séchée au soleil.
  ("Désert+Oasis", "Mirage"),  # L'oasis qui n'existe pas, image type du mirage dans le désert.
  ("Charbon+Soufre", "Poudre à canon"),  # Poudre noire = charbon + soufre + salpêtre ; les deux ingrédients disponibles suffisent à l'identifier.
  ("Molécule+Plastique", "Polymère"),  # Un plastique est fait de polymères (macromolécules) ; « la molécule du plastique » = polymère.
  ("Fleur+Maison", "Jardin"),  # Des fleurs autour de la maison : le jardin.
  ("Maison+Plante", "Jardin"),  # Les plantes de la maison, cultivées dehors : le jardin.
  ("Mer+Vallée", "Fjord"),  # Fjord = ancienne vallée glaciaire envahie par la mer (Glacier+Mer étant déjà pris pour Iceberg).
  ("Explosion+Univers", "Big Bang"),  # L'explosion originelle de l'Univers (Univers reste obtenable par Galaxie+Galaxie, pas de circularité).
  ("Naissance+Univers", "Big Bang"),  # La naissance de l'Univers = Big Bang.
  ("Araignée+Désert", "Scorpion"),  # Le scorpion est un arachnide (cousin de l'araignée), animal emblème du désert.
  ("Fromage+Oiseau", "Corbeau"),  # « Maître Corbeau... tenait en son bec un fromage » (La Fontaine), connu de tous les francophones ; Fromage reste obtenable par Lait+Temps.
  ("Cuisine+Insecte", "Cafard"),  # Le cafard est le nuisible de cuisine par excellence (blatte germanique, 70-90 % des infestations).
  ("Insecte+Tristesse", "Cafard"),  # « Avoir le cafard » = être triste ; clin d'œil francophone transparent.
  ("Farine+Sucre", "Gâteau"),  # La base de toute pâtisserie.
  ("Chocolat+Farine", "Gâteau"),  # Gâteau au chocolat, le plus évident des gâteaux.
  ("Eau+Légume", "Soupe"),  # Légumes dans l'eau = soupe.
  ("Farine+Lait", "Crêpe"),  # Pâte à crêpes = farine + lait (Farine+Œuf étant déjà Pâtes).
  ("Huile+Pomme de terre", "Frites"),  # Pommes de terre frites dans l'huile.
  ("Froid+Lait", "Crème glacée"),  # Lait glacé = crème glacée (le sorbet, lui, est sans lait).
  ("Glace+Lait", "Crème glacée"),  # Glace au lait = crème glacée.
  ("Corde+Musique", "Guitare"),  # L'instrument à cordes populaire par excellence.
  ("Cuir+Musique", "Tambour"),  # Peau tendue que l'on frappe = tambour.
  ("Caoutchouc+Natation", "Bouée"),  # La bouée gonflable en caoutchouc pour nager.
  ("Beurre+Farine", "Biscuit"),  # Pâte sablée : beurre + farine, la base du biscuit (Beurre+Boulanger donne déjà Croissant).
  ("Froid+Jus de fruit", "Sorbet"),  # Sorbet = jus de fruit glacé, sans lait.
  ("Fruit+Glace", "Sorbet"),  # Fruit glacé = sorbet.
  ("Dioxyde de carbone+Jus de fruit", "Limonade"),  # Jus de fruit (citron) gazéifié = limonade (Eau+Dioxyde de carbone est déjà pris pour Acide).
  ("Alcool+Canne à sucre", "Rhum"),  # Le rhum est l'alcool de la canne à sucre.
  ("Canne à sucre+Distillation", "Rhum"),  # Le jus de canne fermenté est distillé en rhum.
  ("Huile+Lumière", "Lampe à huile"),  # S'éclairer avec de l'huile = lampe à huile.
  ("Chaleur+Chocolat", "Chocolat chaud"),  # Chocolat chauffé.
  ("Fruit+Sucre", "Confiture"),  # Fruits cuits avec du sucre = confiture.
  ("Huile+Œuf", "Mayonnaise"),  # Émulsion d'huile dans le jaune d'œuf.
  ("Chien+Mouton", "Berger"),  # Le chien de berger garde les moutons (Humain+Mouton est déjà pris pour Élevage).
  ("Fermier+Mouton", "Berger"),  # Le fermier qui garde les moutons est un berger.
  ("Guerre+Pierre", "Catapulte"),  # L'engin de guerre qui lance des pierres (inventée vers 399 av. J.-C. à Syracuse).
  ("Chaussure+Verre", "Pantoufle de verre"),  # La chaussure en verre de Cendrillon.
  ("Fer+Marteau", "Clou"),  # Le clou en fer que l'on plante au marteau.
  ("Humain+Moteur", "Mécanicien"),  # Celui qui répare les moteurs.
  ("Outil+Voiture", "Mécanicien"),  # Réparer une voiture avec des outils = mécanicien.
  ("Jeu+Roi", "Échecs"),  # Le jeu où il faut mater le roi.
  ("Chasse+Fruit", "Chasseur-cueilleur"),  # Chasser et cueillir = chasseur-cueilleur.
  ("Chasse+Préhistoire", "Chasseur-cueilleur"),  # La chasse préhistorique définit le chasseur-cueilleur.
  ("Humain+Préhistoire", "Chasseur-cueilleur"),  # L'humain préhistorique était un chasseur-cueilleur (Chien reste obtenable par Loup+Os, pas de circularité).
  ("Néolithique+Pierre", "Menhir"),  # Les menhirs sont les pierres dressées du Néolithique (Carnac, vers 4000 av. J.-C.) ; Dolmen dérive déjà de Menhir+Tombe.
  ("Granite+Néolithique", "Menhir"),  # Les menhirs de Carnac sont tous en granite local.
  ("Acide+Électricité", "Batterie"),  # La batterie (au plomb, pile de Volta) stocke l'électricité grâce à un acide (Acide+Métal est déjà pris pour Hydrogène).
  ("Roue+Sport", "Vélo"),  # Le sport sur roues = vélo (Roue+Roue est déjà pris pour Charrette).
  ("Montagne+Poulie", "Téléphérique"),  # Une cabine tirée par câble et poulie en montagne.
  ("Ballon de baudruche+Panier", "Montgolfière"),  # Un ballon avec une nacelle en osier = montgolfière.
  ("Gratte-ciel+Éclair", "Paratonnerre"),  # Les gratte-ciel sont coiffés d'un paratonnerre qui attire la foudre.
  ("Zombie+Électricité", "Monstre de Frankenstein"),  # Un mort-vivant animé par l'électricité = la créature de Frankenstein.
  ("Arc+Forêt", "Robin des Bois"),  # L'archer de la forêt de Sherwood.
  ("Forêt+Héros", "Robin des Bois"),  # Le héros de la forêt (Sherwood).
  ("Curiosité+Mythe", "Boîte de Pandore"),  # Pandore cède à la curiosité et ouvre la boîte.
  ("Curiosité+Mythologie", "Boîte de Pandore"),  # Même mythe grec, variante avec Mythologie.
  ("Aigle+Lion", "Griffon"),  # Tête et ailes d'aigle sur un corps de lion.
  ("Lune+Métal", "Argent"),  # Tradition alchimique : l'argent est le métal de la Lune (☽), comme l'or celui du Soleil.
  ("Os+Pansement", "Plâtre"),  # Le plâtre médical : bandes plâtrées posées sur un os fracturé.
  ("Vache+Vêtement", "Cuir"),  # Un vêtement fait de vache : le cuir, bovin à 65 %.
  ("Fatigue+Graine", "Café"),  # La graine que l'on prend contre la fatigue : le grain de café (caféine).
  ("Serpent+Serpent", "Hydre"),  # Le serpent à plusieurs têtes (convention du jeu : Os+Os = Squelette).
]
