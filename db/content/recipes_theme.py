# Recettes : paquet thématique (culture commune), huit domaines
# Recherche par domaine, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  # ===================== CUISINE =====================
  ("Lait+Mouvement", "Beurre"),                    # le barattage
  ("Farine+Œuf", "Pâtes"),                         # la pâte aux œufs
  ("Farine+Feu+Lait+Œuf", "Crêpe"),                # la pâte à crêpe cuite à la poêle
  ("Chaleur+Huile+Pomme de terre", "Frites"),      # la pomme de terre plongée dans l'huile chaude
  ("Fruit+Pression", "Jus de fruit"),              # le fruit pressé
  ("Froid+Lait+Sucre", "Crème glacée"),            # le lait sucré glacé
  ("Beurre+Farine+Four+Levure", "Croissant"),      # la pâte feuilletée au beurre, levée puis cuite
  ("Pain+Viande", "Sandwich"),                     # la viande entre deux tranches de pain
  ("Graine+Pression", "Huile"),                    # l'huile pressée des graines (tournesol, colza)
  ("Maïs+Moulin", "Farine"),                       # la farine de maïs
  ("Eau+Feu+Poisson", "Soupe"),                    # la soupe de poisson

  # ===================== MAISON =====================
  ("Bois+Sommeil", "Lit"),                         # le meuble où l'on dort
  ("Bois+Mur", "Porte"),                           # l'ouverture fermée par du bois
  ("Mur+Verre", "Fenêtre"),                        # le verre posé dans le mur
  ("Métal+Porte", "Clé"),                          # ce qui ouvre la porte
  ("Pluie+Tissu", "Parapluie"),                    # le tissu qui protège de la pluie
  ("Fenêtre+Mur+Porte", "Maison"),                 # murs, porte et fenêtres
  ("Argile+Soleil", "Brique"),                     # la brique crue séchée au soleil
  ("Encre+Plume", "Écriture"),                     # la plume trempée dans l'encre
  ("Maison+Médecine", "Hôpital"),                  # la maison où l'on soigne

  # ===================== ANIMAUX =====================
  ("Mammifère+Montagne", "Chèvre"),                # l'animal des pentes rocheuses
  ("Forêt+Herbe+Mammifère", "Cerf"),               # l'herbivore des forêts
  ("Eau+Oiseau", "Canard"),                        # l'oiseau qui nage
  ("Cheval+Savane", "Zèbre"),                      # le cousin rayé du cheval, dans la savane
  ("Jungle+Lion", "Tigre"),                        # le grand félin des jungles d'Asie
  ("Banquise+Mammifère", "Phoque"),                # le mammifère de la banquise
  ("Jungle+Oiseau", "Perroquet"),                  # l'oiseau des forêts tropicales
  ("Langage+Oiseau", "Perroquet"),                 # l'oiseau qui parle
  ("Herbe+Vache", "Lait"),                         # la vache nourrie d'herbe donne son lait
  ("Chèvre+Élevage", "Lait"),                      # le lait de chèvre
  ("Cerf+Chasse", "Viande"),                       # le gibier
  ("Araignée+Arbre", "Toile d'araignée"),          # la toile tendue entre les branches
  ("Abeille+Cire", "Ruche"),                       # les abeilles bâtissent leurs rayons de cire
  ("Fleur+Ruche", "Miel"),                         # le nectar des fleurs devient miel dans la ruche
  ("Plage+Tortue", "Œuf"),                         # la tortue marine pond sur la plage

  # ===================== PLANTES ET JARDIN =====================
  ("Fruit+Légume", "Tomate"),                      # le fruit qu'on mange comme un légume
  ("Feuille+Légume", "Laitue"),                    # le légume-feuille
  ("Fruit+Palmier", "Noix de coco"),               # le fruit du cocotier
  ("Arbre+Sucre", "Érable"),                       # l'arbre au sirop sucré
  ("Fleur+Fleur", "Bouquet"),                      # des fleurs réunies
  ("Fleur+Poterie+Terre", "Pot de fleurs"),        # une fleur plantée dans un pot de terre
  ("Champ+Humain", "Fermier"),                     # celui qui cultive les champs
  ("Agriculture+Humain", "Fermier"),               # celui qui vit de l'agriculture
  ("Fermier+Maison", "Ferme"),                     # la maison du fermier
  ("Chêne+Hache", "Bois"),                         # l'arbre abattu
  ("Abeille+Pollen", "Pollinisation"),             # l'abeille transporte le pollen
  ("Feuille+Lombric+Temps", "Compost"),            # les vers décomposent les feuilles avec le temps

  # ===================== CIEL ET SAISONS =====================
  ("Neige+Saison", "Hiver"),                       # la saison de la neige
  ("Froid+Saison", "Hiver"),                       # la saison froide
  ("Fleur+Saison", "Printemps"),                   # la saison des fleurs
  ("Chaleur+Saison", "Été"),                       # la saison chaude
  ("Feuille+Saison", "Automne"),                   # la saison des feuilles qui tombent
  ("Air+Lumière", "Ciel"),                         # l'air diffuse la lumière : le ciel est bleu
  ("Nuit+Soleil", "Coucher de soleil"),            # le soleil qui laisse place à la nuit
  ("Ciel+Étoile", "Constellation"),                # les étoiles dessinées dans le ciel
  ("Hiver+Lac", "Glace"),                          # le lac gelé en hiver
  ("Froid+Herbe+Nuit", "Givre"),                   # l'herbe blanchie par une nuit froide
  ("Neige+Printemps+Rivière", "Inondation"),       # la fonte des neiges fait déborder la rivière
  ("Océan+Soleil+Vent", "Sel"),                    # le marais salant : soleil et vent évaporent l'eau de mer

  # ===================== CORPS ET SANTÉ =====================
  ("Tristesse+Œil", "Larme"),                      # on pleure de tristesse
  ("Eau+Sel+Œil", "Larme"),                        # une larme, c'est de l'eau salée
  ("Joie+Son", "Rire"),                            # la joie qui s'entend
  ("Joie+Théâtre", "Rire"),                        # la comédie fait rire
  ("Peur+Rêve", "Cauchemar"),                      # un rêve qui fait peur
  ("Peur+Sommeil", "Cauchemar"),                   # la peur pendant le sommeil
  ("Chaleur+Humain", "Sueur"),                     # le corps transpire pour se rafraîchir
  ("Mouvement+Muscle+Temps", "Fatigue"),           # des muscles qui travaillent longtemps
  ("Fatigue+Nuit", "Sommeil"),                     # la fatigue du soir
  ("Sang+Tissu", "Pansement"),                     # le tissu posé sur la plaie
  ("Médecine+Tissu", "Pansement"),                 # le pansement du soignant
  ("Froid+Humain+Virus", "Rhume"),                 # le virus du rhume, favorisé par le froid
  ("Rhume+Temps", "Santé"),                        # le rhume guérit seul en quelques jours
  ("Eau+Humain+Savon", "Santé"),                   # se laver les mains
  ("Air+Humain", "Respiration"),                   # l'humain respire l'air
  ("Livre+Vieillesse+Œil", "Lunettes"),            # la presbytie : lire devient difficile avec l'âge
  ("Douleur+Herbe médicinale", "Remède"),          # la plante qui calme la douleur (écorce de saule)

  # ===================== TRANSPORTS ET ÉNERGIE =====================
  ("Métal+Roue+Roue", "Vélo"),                     # deux roues sur un cadre de métal
  ("Moteur+Vélo", "Moto"),                         # le vélo à moteur
  ("Avion+Tissu", "Parachute"),                    # la toile pour sauter d'un avion
  ("Corde+Machine+Tour", "Grue"),                  # la tour qui soulève avec des câbles
  ("Bateau+Machine à vapeur", "Bateau à vapeur"),  # le bateau mû par la vapeur
  ("Bateau+Vapeur", "Bateau à vapeur"),            # le vapeur
  ("Fer+Route", "Rails"),                          # la voie de fer
  ("Locomotive+Rails", "Train"),                   # la locomotive sur ses rails
  ("Machine à vapeur+Rails", "Locomotive"),        # la machine à vapeur qui roule sur des rails
  ("Charbon+Rails+Usine", "Révolution industrielle"),  # charbon, chemins de fer et usines
  ("Corde+Montagne+Moteur", "Téléphérique"),       # la cabine tirée par un câble en montagne
  ("Lumière+Panneau solaire", "Électricité"),      # le panneau solaire change la lumière en courant
  ("Ampoule+Batterie", "Lumière"),                 # la lampe de poche
  ("Canyon+Corde", "Pont"),                        # le pont de corde au-dessus du vide
  ("Combustion+Pétrole", "Énergie"),               # brûler du pétrole libère de l'énergie
  ("Centrale nucléaire+Ville", "Réseau électrique"),  # la centrale alimente la ville
  ("Machine+Électricité", "Moteur"),               # le moteur électrique
  ("Bambou+Corde+Rivière", "Bateau"),              # le radeau de bambou

  # ===================== ARTS, SPORTS ET LOISIRS =====================
  ("Bois+Corde+Musique", "Guitare"),               # les cordes tendues sur une caisse de bois
  ("Bois+Corde+Marteau+Musique", "Piano"),         # les marteaux qui frappent les cordes
  ("Bois+Cuir+Musique", "Tambour"),                # la peau tendue sur un fût de bois
  ("Cuir+Musique+Poterie", "Tambour"),             # la darbouka, en terre cuite
  ("Mouvement+Musique", "Danse"),                  # bouger en musique
  ("Air+Cuir", "Ballon"),                          # le ballon de cuir gonflé
  ("Humain+Montagne+Neige", "Ski"),                # glisser sur les pentes enneigées
  ("Bois+Neige", "Ski"),                           # les premiers skis en bois
  ("Bambou+Corde+Papier+Vent", "Cerf-volant"),     # le cerf-volant chinois
  ("Corde+Tissu+Vent", "Cerf-volant"),             # la toile tenue au bout d'une corde
  ("Enfant+Neige", "Bonhomme de neige"),           # le jeu d'hiver
  ("Cerf-volant+Orage", "Électricité"),            # l'expérience de Franklin (1752)
  ("Art+Huile", "Peinture"),                       # la peinture à l'huile
  ("Fusée+Poudre à canon", "Feu d'artifice"),      # la fusée d'artifice
]
