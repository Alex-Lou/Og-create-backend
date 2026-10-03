# Recettes historiques du jeu (conservées telles quelles : Timer, Explorer et succès en dépendent)
RECIPES = [
  # matériaux
  ("Eau+Terre", "Boue"), ("Feu+Terre", "Lave"), ("Eau+Feu", "Vapeur"), ("Air+Terre", "Poussière"),
  ("Air+Feu", "Fumée"), ("Eau+Lave", "Pierre"), ("Air+Pierre", "Sable"),
  ("Feu+Pierre", "Métal"), ("Feu+Sable", "Verre"), ("Pierre+Vapeur", "Cristal"), ("Lave+Terre", "Magma"),
  # phénomènes
  ("Air+Eau", "Pluie"), ("Air+Vapeur", "Nuage"), ("Feu+Vapeur", "Énergie"), ("Air+Énergie", "Vent"),
  ("Air+Vent", "Bourrasque"), ("Pluie+Vent", "Tempête"), ("Nuage+Énergie", "Éclair"),
  ("Tempête+Vent", "Tornade"), ("Feu+Énergie", "Explosion"), ("Feu+Vent", "Incendie"),
  ("Terre+Vapeur", "Geyser"), ("Eau+Vent", "Vague"), ("Air+Éclair", "Ozone"),
  ("Feu+Éclair", "Lumière"), ("Lumière+Pluie", "Arc-en-ciel"),
  ("Eau+Neige", "Glace"),
  # formations
  ("Pierre+Terre", "Montagne"), ("Lave+Montagne", "Volcan"), ("Pluie+Terre", "Lac"), ("Eau+Lac", "Océan"),
  ("Montagne+Océan", "Continent"), ("Continent+Vie", "Planète Terre"), ("Océan+Volcan", "Île"),
  ("Sable+Vent", "Désert"), ("Désert+Eau", "Oasis"),
  # vie & créatures
  ("Air+Eau+Feu+Terre", "Vie"),
  ("Terre+Vie", "Plante"), ("Plante+Terre", "Arbre"), ("Boue+Vie", "Lombric"),
  ("Plante+Vie", "Chenille"), ("Air+Chenille", "Papillon"), ("Eau+Vie", "Poisson"),
  ("Lumière+Poisson", "Poisson Tropical"), ("Glace+Poisson", "Poisson Polaire"), ("Air+Poisson", "Poisson Volant"),
  ("Océan+Poisson", "Poisson Abyssal"), ("Océan+Vie", "Méduse"),
  # magie
  ("Énergie+Vie", "Magie"), ("Air+Vie", "Esprit"), ("Eau+Magie", "Mana"), ("Cristal+Magie", "Orbe"),
  ("Bois+Magie", "Baguette"), ("Énergie+Magie", "Pouvoir"),
  ("Anneau+Pouvoir", "Anneau de Pouvoir"), ("Feu+Magie", "Feu Magique"),
  # créations humaines
  ("Esprit+Vie", "Humain"), ("Arbre+Métal", "Bois"),
  ("Boue+Feu", "Brique"), ("Bois+Brique", "Maison"),

  # ---- recettes à 3 éléments ----
  ("Air+Eau+Lumière", "Arc-en-ciel"),            # 2e chemin
  ("Énergie+Feu+Lumière", "Étoile"),
  ("Neige+Tempête+Vent", "Blizzard"),
  ("Explosion+Océan+Vague", "Tsunami"),
  ("Boue+Eau+Plante", "Marais"),
  ("Arbre+Pluie+Terre", "Forêt"),
  ("Forêt+Pluie+Vie", "Jungle"),
  ("Océan+Pierre+Vie", "Récif"),
  ("Air+Lumière+Vie", "Luciole"),
  ("Air+Arbre+Vie", "Oiseau"),
  ("Cendre+Feu+Vie", "Phénix"),
  ("Eau+Magie+Plante", "Potion"),
  ("Esprit+Magie+Pierre", "Golem"),
  ("Arc-en-ciel+Magie+Vie", "Licorne"),
  ("Baguette+Humain+Magie", "Sorcier"),
  ("Humain+Métal+Épée", "Chevalier"),

  # ---- recettes à 4 éléments ----
  ("Air+Feu+Pierre+Énergie", "Météore"),
  ("Galaxie+Étoile+Temps+Énergie", "Univers"),
  ("Nuage+Océan+Pluie+Tempête", "Déluge"),
  ("Cristal+Lumière+Potion+Vie", "Élixir"),
  ("Bois+Humain+Océan+Vie", "Arche"),
]
