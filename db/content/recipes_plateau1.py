# Recettes : Plateau 1 (début de partie), vérifiées par recherche et contre-vérification
# Chaque recette suit un procédé réel ou une évidence ; les remplacements d'anciennes recettes sont en fin de liste.
RECIPES = [
  # ===================== ATMOSPHÈRE ET EAU =====================
  ("Poussière+Vapeur", "Nuage"),              # la vapeur se condense sur les poussières (noyaux de condensation)
  ("Montagne+Nuage", "Pluie"),                # pluie orographique : le nuage monte sur la montagne et crève
  ("Fumée+Pluie", "Pluie acide"),             # les fumées soufrées acidifient la pluie
  ("Lac+Poussière", "Sédiment"),              # les particules se déposent au fond de l'eau calme
  ("Chaleur+Lac+Sel", "Désert de sel"),       # un lac salé s'évapore et laisse sa croûte de sel
  ("Eau+Eau", "Lac"),                         # de l'eau qui s'accumule (la mer, elle, est salée)

  # ===================== TERRE, MER ET VOLCANS =====================
  ("Mer+Pierre", "Sable"),                    # les vagues usent la roche
  ("Lave+Océan", "Île"),                      # naissance d'une île volcanique (Surtsey, 1963)
  ("Glissement de terrain+Mer", "Tsunami"),   # un éboulement dans la mer (Lituya Bay, 1958)
  ("Magma+Océan", "Source hydrothermale"),    # l'eau de mer chauffée par le magma jaillit du fond
  ("Boue+Gaz", "Volcan de boue"),             # le gaz du sous-sol pousse la boue vers la surface
  ("Gaz+Lave", "Pierre ponce"),               # une lave pleine de bulles de gaz, figée

  # ===================== FEU ET MATIÈRE =====================
  ("Fumée+Pierre", "Suie"),                   # le dépôt noir de la fumée, comme dans une cheminée
  ("Eau+Suie", "Encre"),                      # l'encre de Chine : du noir de suie dans l'eau
  ("Feu+Plante", "Cendre"),                   # ce qui reste d'une plante brûlée
  ("Air+Chaleur+Plante", "Combustion"),       # le triangle du feu : combustible, comburant, chaleur

  # ===================== VIVANT =====================
  ("Lombric+Plante", "Compost"),              # les vers digèrent les végétaux
  ("Compost+Terre", "Sol fertile"),           # le compost enrichit la terre
  ("Poisson+Sédiment", "Fossile"),            # un poisson enfoui dans les sédiments se fossilise
  ("Source hydrothermale+Vie", "Bactérie"),   # les bactéries extrêmophiles des sources chaudes
  ("Boue+Énergie", "Vie"),                    # l'éclair sur la soupe primordiale (expérience de Miller-Urey)
  ("Boue+Poisson", "Salamandre"),             # du poisson à l'amphibien
  ("Décomposition+Vie", "Asticot"),           # l'asticot naît sur la matière qui se décompose (expérience de Redi)
  ("Herbe+Vie", "Insecte"),                   # la petite vie qui grouille dans l'herbe
]
