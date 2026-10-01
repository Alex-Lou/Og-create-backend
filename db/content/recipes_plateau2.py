# Recettes : Plateau 2 (milieu de partie), vérifiées par recherche et contre-vérification
# Les remplacements d'anciennes recettes fausses ou arbitraires viennent d'abord, puis les ajouts.
RECIPES = [
  # ===================== REMPLACEMENTS =====================
  ("Énergie+Molécule", "Atome"),              # casser une molécule libère ses atomes
  ("Montagne+Nuage+Vent", "Neige"),           # le vent pousse le nuage contre la montagne : l'air monte, refroidit, il neige
  ("Lumière+Planète Terre", "Jour"),          # la Terre éclairée (pendant de Ombre+Planète Terre → Nuit)
  ("Cellule+Eau", "Microbe"),                 # la vie microscopique des eaux
  ("Charbon+Grotte", "Peinture"),             # le noir de charbon des grottes préhistoriques
  ("Humain+Mur+Suie", "Peinture"),            # le noir de fumée, pigment des premières peintures
  ("Feu+Or", "Anneau"),                       # un anneau d'or forgé au feu
  ("Jour+Jour", "Temps"),                     # les jours qui passent (remplace le sablier, Sable+Verre)

  # ===================== MATIÈRE ET MONDE =====================
  ("Sapin+Hache", "Résine"),                  # le résineux entaillé laisse couler sa résine
  ("Résine+Sédiment+Temps", "Ambre"),         # la résine enfouie durcit en ambre au fil des millénaires
  ("Ambre+Insecte", "Fossile"),               # l'insecte piégé dans l'ambre
  ("Éclair+Sable", "Verre"),                  # la foudre fond le sable : la fulgurite
  ("Glace+Sel", "Eau salée"),                 # le sel fait fondre la glace des routes
  ("Inondation+Plaine", "Sédiment"),          # la crue dépose ses alluvions sur la plaine
  ("Usine+Pluie", "Pluie acide"),             # les fumées d'usine acidifient la pluie
  ("Feuille+Décomposition", "Compost"),       # les feuilles mortes se décomposent en compost
  ("Hydrogène+Oxygène+Feu", "Explosion"),     # le mélange hydrogène-oxygène détone à la flamme
  ("Aimant+Électricité+Cuivre", "Moteur"),    # le moteur électrique : courant, bobine de cuivre et aimant

  # ===================== MAISON ET CUISINE =====================
  ("Bois+Boue+Herbe", "Maison"),              # le torchis : boue et herbe sur une ossature de bois
  ("Maïs+Chaleur", "Pop-corn"),               # le grain de maïs éclate à la chaleur
  ("Sucre+Chaleur", "Caramel"),               # le sucre chauffé caramélise
  ("Œuf+Farine+Sucre+Four", "Gâteau"),        # la pâte cuite au four
  ("Légume+Eau+Feu", "Soupe"),                # des légumes cuits dans l'eau

  # ===================== OBJETS ET ARTISANAT =====================
  ("Bambou+Tisserand", "Panier"),             # la vannerie de bambou
  ("Lin+Tisserand", "Tissu"),                 # la toile de lin
  ("Bronze+Son", "Cloche"),                   # la cloche coulée dans le bronze
  ("Poudre à canon+Arc-en-ciel", "Feu d'artifice"),  # la poudre et ses couleurs
  ("Lentille+Œil", "Lunettes"),               # des lentilles devant les yeux
]
