# Recettes : palier 2 (culture commune), huit domaines
# Recherche par domaine, deux contre-vérifications indépendantes, validation du propriétaire.
RECIPES = [
  # ===================== MER ET LITTORAL =====================
  ("Escargot+Mer", "Coquillage"),                  # la coquille des escargots de mer
  ("Escargot+Océan", "Coquillage"),
  ("Poisson+Riz", "Sushi"),                        # le poisson cru sur du riz
  ("Métal+Pêche", "Hameçon"),                      # le crochet de métal du pêcheur
  ("Bateau+Or+Épée", "Pirate"),                    # le bateau, le sabre et le trésor
  ("Air+Mer+Plastique", "Bouée"),                  # l'anneau gonflé qui flotte
  ("Coquillage+Sédiment", "Fossile"),              # la coquille prise dans les sédiments
  ("Coquillage+Sable", "Plage"),                   # le sable et les coquillages
  ("Plage+Soleil", "Été"),                         # la saison de la plage

  # ===================== OISEAUX ET PETITES BÊTES =====================
  ("Escargot+Jardin+Mammifère", "Hérisson"),       # le petit mammifère du jardin qui mange les escargots
  ("Escargot+Mammifère+Nuit", "Hérisson"),         # il chasse la nuit
  ("Chêne+Mammifère", "Écureuil"),                 # le mangeur de glands
  ("Arbre+Graine+Hiver+Mammifère", "Écureuil"),    # il cache ses graines pour l'hiver
  ("Araignée+Crabe+Désert", "Scorpion"),           # un arachnide à pinces, au désert
  ("Arbre+Fromage+Oiseau", "Corbeau"),             # « Maître Corbeau, sur un arbre perché, tenait en son bec un fromage »
  ("Insecte+Musique+Nuit", "Grillon"),             # le chant du soir
  ("Cuisine+Insecte+Nuit", "Cafard"),              # l'insecte qui sort la nuit dans les cuisines
  ("Extinction+Oiseau", "Dodo"),                   # l'oiseau disparu de l'île Maurice
  ("Poule+Œuf", "Poussin"),                        # l'œuf couvé éclot
  ("Naissance+Poule", "Poussin"),
  ("Abeille+Ruche", "Miel"),                       # les abeilles font le miel dans la ruche
  ("Oiseau+Roi", "Aigle"),                         # le « roi des oiseaux »
  ("Marais+Oiseau", "Canard"),                     # l'oiseau des marais

  # ===================== VÊTEMENTS =====================
  ("Caoutchouc+Cuir", "Chaussure"),                # le dessus en cuir, la semelle en caoutchouc
  ("Chaussure+Pluie", "Botte"),                    # la chaussure montante contre la pluie
  ("Chaussure+Laine", "Chaussette"),               # la laine qu'on porte dans la chaussure
  ("Froid+Vêtement", "Manteau"),                   # le vêtement contre le froid
  ("Plage+Vêtement", "Maillot de bain"),           # le vêtement de la plage
  ("Mer+Vêtement+Été", "Maillot de bain"),         # pour se baigner l'été
  ("Laboratoire+Vêtement", "Blouse blanche"),      # la blouse du laboratoire
  ("Médecine+Vêtement", "Blouse blanche"),         # la blouse du médecin
  ("Cuir+Monnaie", "Porte-monnaie"),               # la petite bourse de cuir
  ("Air+Gravité+Tissu", "Parachute"),              # la toile qui freine la chute dans l'air

  # ===================== MÉTIERS =====================
  ("Humain+Pain", "Boulanger"),                    # celui qui fait le pain
  ("Cuisine+Humain", "Cuisinier"),                 # celui qui cuisine
  ("Humain+Incendie", "Pompier"),                  # celui qui combat l'incendie
  ("Humain+Hôpital", "Médecin"),                   # celui qui soigne à l'hôpital
  ("Brique+Humain", "Maçon"),                      # celui qui monte les briques
  ("Ciment+Humain", "Maçon"),
  ("Avion+Humain", "Pilote"),                      # celui qui pilote l'avion
  ("Beurre+Boulanger", "Croissant"),               # la viennoiserie au beurre du boulanger

  # ===================== VILLE ET BÂTIMENTS =====================
  ("Acier+Tour", "Gratte-ciel"),                   # la tour à ossature d'acier (Chicago, 1885)
  ("Gratte-ciel+Gratte-ciel", "Ville"),            # les tours qui font la ville
  ("Train+Ville", "Gare"),                         # le train arrive en ville
  ("Cloche+Religion", "Église"),                   # les cloches du lieu de culte
  ("Cloche+Tour+Village", "Église"),               # le clocher du village
  ("Maison+Temps", "Ruine"),                       # la maison abandonnée au temps
  ("Maison+Séisme", "Ruine"),                      # la maison effondrée
  ("Ruine+Science", "Archéologie"),                # l'étude des ruines
  ("Commerce+Cuisine", "Restaurant"),              # la cuisine qu'on vend
  ("Lit+Ville", "Hôtel"),                          # un lit en ville
  ("Commerce+Lit+Maison", "Hôtel"),                # la maison où l'on loue un lit
  ("Lit+Médecine", "Hôpital"),                     # les lits des malades

  # ===================== ÉCOLE ET COMMUNICATION =====================
  ("Encre+Plastique", "Stylo"),                    # le stylo à bille en plastique
  ("Papier+Stylo", "Écriture"),                    # écrire sur le papier
  ("Cuir+École", "Cartable"),                      # le sac de cuir de l'écolier
  ("Cuir+Enfant+Livre", "Cartable"),               # l'enfant qui porte ses livres
  ("Chronique+Imprimerie", "Journal"),             # la chronique imprimée (Gazette, 1631)
  ("Écriture+Son", "Alphabet"),                    # un signe pour chaque son
  ("Alphabet+Livre", "Dictionnaire"),              # le livre des mots par ordre alphabétique
  ("Langage+Livre", "Dictionnaire"),               # le livre de la langue
  ("Internet+Téléphone", "Smartphone"),            # le téléphone connecté
  ("Ordinateur+Ordinateur", "Internet"),           # des ordinateurs reliés entre eux

  # ===================== ESPACE =====================
  ("Espace+Humain", "Astronaute"),                 # l'humain dans l'espace
  ("Fusée+Pilote", "Astronaute"),                  # les premiers astronautes étaient pilotes
  ("Astronaute+Lune", "Conquête spatiale"),        # le premier pas sur la Lune
  ("Radio+Télescope", "Radiotélescope"),           # le télescope qui capte les ondes radio
  ("Boussole+Satellite", "GPS"),                   # s'orienter grâce aux satellites
  ("Carte+Satellite", "GPS"),                      # la carte guidée par satellite

  # ===================== DESSERTS ET BOISSONS =====================
  ("Farine+Four+Fruit", "Tarte"),                  # la pâte garnie de fruits, cuite au four
  ("Beurre+Farine+Four+Sucre", "Biscuit"),         # la pâte sablée cuite au four
  ("Chaleur+Farine+Huile", "Beignet"),             # la pâte frite dans l'huile
  ("Froid+Jus de fruit+Sucre", "Sorbet"),          # le jus sucré glacé
  ("Dioxyde de carbone+Eau+Sucre", "Limonade"),    # l'eau sucrée gazeuse
  ("Alcool+Jus de fruit", "Cocktail"),             # le mélange d'alcool et de jus
  ("Jus de fruit+Rhum", "Cocktail"),
  ("Canne à sucre+Distillation+Fermentation", "Rhum"),  # le jus de canne fermenté puis distillé
  ("Feu+Sucre", "Caramel"),                        # le sucre chauffé
  ("Feu+Maïs", "Pop-corn"),                        # le grain qui éclate au feu
]
