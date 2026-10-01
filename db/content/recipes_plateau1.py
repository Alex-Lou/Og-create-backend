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

  # ===================== DENSITÉ DU DÉBUT : mélanges évidents entre les premiers éléments =====================
  # Eau et terre
  ("Océan+Terre", "Île"),                     # une terre entourée d'eau
  ("Île+Île", "Archipel"),                    # un groupe d'îles
  ("Eau+Énergie", "Vague"),                   # une vague, c'est de l'énergie qui traverse l'eau
  ("Source+Source", "Rivière"),               # des sources qui se rejoignent
  ("Argile+Eau", "Boue"),                     # l'argile mouillée
  ("Sédiment+Sédiment", "Pierre"),            # les couches se tassent en roche sédimentaire
  ("Pierre+Pierre", "Mur"),                   # le mur en pierres sèches
  ("Océan+Sédiment", "Plage"),                # le sable déposé par la mer
  ("Magma+Terre", "Volcan"),                  # le magma qui perce la croûte
  ("Gaz+Magma", "Volcan"),                    # les gaz du magma déclenchent l'éruption
  ("Pierre+Pluie acide", "Érosion"),          # la pluie acide ronge la roche
  ("Brasier+Brasier", "Incendie"),            # l'escalade du feu, comme Feu+Feu → Brasier
  # Vivant
  ("Pierre+Vie", "Lichen"),                   # le premier vivant à coloniser la roche nue
  ("Air+Plante", "Oxygène"),                  # la photosynthèse
  ("Plante+Reproduction", "Fleur"),           # la fleur est l'organe reproducteur des plantes
  ("Marais+Plante", "Tourbe"),                # les plantes du marais qui s'accumulent
  ("Marais+Vie", "Grenouille"),               # l'animal du marais
  ("Geyser+Vie", "Bactérie"),                 # les bactéries des sources chaudes (Yellowstone)
  ("Île+Plante", "Palmier"),                  # l'arbre des îles
  ("Montagne+Plante", "Sapin"),               # l'arbre des montagnes
  ("Lombric+Poisson", "Pêche"),               # le ver au bout de l'hameçon
  ("Lac+Plante+Poisson", "Écosystème"),       # la mare, l'exemple de l'école
  ("Chaleur+Océan+Poisson", "Poisson Tropical"),  # le poisson des mers chaudes
  # Légendes
  ("Esprit+Énergie", "Mana"),                 # la force des esprits, comme Énergie+Vie → Magie
]
