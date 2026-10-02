# Recettes : Matériaux, Chimie, Physique
RECIPES = [
  # ===================== MATÉRIAUX =====================
  # Argile
  ("Eau+Poussière", "Argile"), ("Boue+Pierre+Temps", "Argile"),
  # Charbon
  ("Bois+Feu", "Charbon"), ("Bois+Pression+Temps", "Charbon"),
  ("Pression+Tourbe", "Charbon"), ("Forêt+Pression+Temps+Terre", "Charbon"),
  # Sel
  ("Feu+Océan", "Sel"), ("Eau salée+Feu", "Sel"), ("Chlore+Sodium", "Sel"), ("Acide+Base chimique", "Sel"),
  # Fer
  ("Métal+Terre", "Fer"), ("Charbon+Feu+Pierre", "Fer"), ("Métal+Météore", "Fer"), ("Aimant+Métal", "Fer"),
  # Cuivre
  ("Feu+Métal+Pierre", "Cuivre"),
  # Or
  ("Pierre philosophale+Plomb", "Or"),
  ("Métal+Rivière+Sable", "Or"),
  # Argent
  ("Air+Feu+Plomb", "Argent"),
  # Étain
  ("Métal+Sable", "Étain"),
  # Bronze
  ("Cuivre+Étain", "Bronze"), ("Cuivre+Feu+Étain", "Bronze"),
  # Acier
  ("Charbon+Fer", "Acier"), ("Carbone+Fer", "Acier"), ("Fer+Forge", "Acier"), ("Carbone+Chaleur+Fer", "Acier"),
  # Plomb
  ("Métal+Soufre", "Plomb"), ("Métal+Radioactivité", "Plomb"),
  # Calcaire
  ("Pierre+Récif", "Calcaire"), ("Calcium+Pierre", "Calcaire"), ("Calcium+Dioxyde de carbone", "Calcaire"),
  ("Océan+Pierre+Temps", "Calcaire"),
  # Marbre
  ("Calcaire+Pression", "Marbre"), ("Calcaire+Chaleur", "Marbre"),
  ("Calcaire+Pression+Temps", "Marbre"),
  # Granite
  ("Magma+Temps", "Granite"), ("Magma+Quartz", "Granite"),
  ("Magma+Montagne", "Granite"),
  # Obsidienne
  ("Glace+Lave", "Obsidienne"), ("Froid+Lave", "Obsidienne"), ("Lave+Verre", "Obsidienne"),
  # Quartz
  ("Cristal+Sable", "Quartz"), ("Oxygène+Silicium", "Quartz"),
  ("Pression+Sable+Temps", "Quartz"),
  # Diamant
  ("Carbone+Pression", "Diamant"), ("Graphite+Pression", "Diamant"),
  # Graphite
  ("Carbone+Solide", "Graphite"), ("Chaleur+Charbon", "Graphite"), ("Carbone+Carbone", "Graphite"),
  # Pétrole
  ("Plancton+Pression+Temps", "Pétrole"),
  ("Algue+Pression+Sédiment", "Pétrole"),
  # Goudron
  ("Charbon+Distillation", "Goudron"), ("Bois+Distillation", "Goudron"),
  ("Pétrole+Sable", "Goudron"),
  # Ciment
  ("Argile+Calcaire", "Ciment"), ("Argile+Calcaire+Feu", "Ciment"), ("Calcium+Chaleur+Silicium", "Ciment"),
  ("Argile+Calcaire+Four", "Ciment"),
  # Béton
  ("Ciment+Eau+Sable", "Béton"), ("Ciment+Sable", "Béton"), ("Ciment+Eau+Pierre+Sable", "Béton"),
  ("Acier+Ciment", "Béton"),
  # Plâtre
  ("Calcium+Soufre", "Plâtre"), ("Calcium+Eau+Soufre", "Plâtre"),
  # Céramique
  ("Argile+Feu", "Céramique"), ("Argile+Chaleur", "Céramique"),
  ("Argile+Brasier", "Céramique"),
  # Porcelaine
  ("Céramique+Quartz", "Porcelaine"), ("Argile+Feu+Quartz", "Porcelaine"), ("Céramique+Os", "Porcelaine"),
  ("Argile+Four+Quartz", "Porcelaine"),
  # Papier
  ("Bois+Machine", "Papier"), ("Plante+Pression", "Papier"), ("Bois+Eau+Pression", "Papier"),
  ("Coton+Eau+Pression", "Papier"),
  # Encre
  ("Charbon+Eau", "Encre"), ("Carbone+Liquide", "Encre"), ("Eau+Pieuvre", "Encre"),
  # Cire
  ("Feu+Ruche", "Cire"), ("Distillation+Pétrole", "Cire"),
  # Caoutchouc
  ("Arbre+Liquide", "Caoutchouc"), ("Arbre+Feu+Soufre", "Caoutchouc"), ("Pétrole+Polymère+Soufre", "Caoutchouc"),
  # Plastique
  ("Pétrole+Polymère", "Plastique"), ("Pétrole+Réaction chimique", "Plastique"),
  # Laine
  ("Mouton+Outil", "Laine"), ("Fourrure+Outil", "Laine"),
  # Coton
  ("Nuage+Plante", "Coton"), ("Cotonnier+Humain", "Coton"), ("Cotonnier+Outil", "Coton"),
  # Tissu
  ("Coton+Outil", "Tissu"), ("Corde+Corde", "Tissu"), ("Coton+Tisserand", "Tissu"), ("Laine+Tisserand", "Tissu"),
  ("Lin+Outil", "Tissu"), ("Coton+Machine", "Tissu"),
  # Cuir
  ("Arbre+Eau+Fourrure", "Cuir"),
  ("Chêne+Eau+Fourrure", "Cuir"),
  # Corde
  ("Coton+Coton", "Corde"), ("Lin+Lin", "Corde"),
  # Rouille
  ("Fer+Oxygène", "Rouille"), ("Eau+Fer", "Rouille"), ("Fer+Oxydation", "Rouille"),
  ("Air+Eau+Fer", "Rouille"),
  # chemins savants vers des matériaux de base
  ("Chaleur+Eau", "Vapeur"), ("Chaleur+Pierre", "Magma"),
  ("Quartz+Feu", "Verre"), ("Silicium+Oxygène+Chaleur", "Verre"),
  ("Pierre+Érosion", "Sable"), ("Quartz+Érosion", "Sable"), ("Molécule+Solide+Temps", "Cristal"),
  # ===================== PHYSIQUE =====================
  # Atome
  ("Philosophie+Poussière", "Atome"), ("Électron+Noyau atomique", "Atome"),
  ("Électron+Neutron+Proton", "Atome"),
  # Particule
  ("Atome+Atome+Vitesse", "Particule"),
  ("Atome+Énergie", "Particule"),
  # Électron
  ("Électricité+Particule", "Électron"), ("Atome+Lumière", "Électron"), ("Éclair+Particule", "Électron"),
  ("Atome+Électricité", "Électron"),
  # Proton
  ("Énergie+Hydrogène", "Proton"), ("Neutron+Radioactivité", "Proton"), ("Électricité+Hydrogène", "Proton"),
  # Neutron
  ("Électron+Pression+Proton", "Neutron"), ("Fission nucléaire+Noyau atomique", "Neutron"),
  # Noyau atomique
  ("Neutron+Proton", "Noyau atomique"), ("Atome+Radiation", "Noyau atomique"),
  # Onde
  ("Énergie+Vague", "Onde"), ("Air+Son", "Onde"), ("Lumière+Vague", "Onde"),
  ("Écho+Air", "Onde"),
  # Magnétisme
  ("Aimant+Aimant", "Magnétisme"), ("Aimant+Fer", "Magnétisme"), ("Électricité+Mouvement", "Magnétisme"),
  ("Boussole+Planète Terre", "Magnétisme"),
  # Aimant
  ("Éclair+Fer", "Aimant"), ("Fer+Magnétisme", "Aimant"), ("Magnétisme+Pierre", "Aimant"),
  ("Éclair+Fer+Pierre", "Aimant"),
  # Électricité
  ("Énergie+Métal", "Électricité"), ("Aimant+Mouvement", "Électricité"),
  ("Friction+Laine", "Électricité statique"), ("Électron+Mouvement", "Électricité"),
  # Pression
  ("Air+Force", "Pression"), ("Air+Gravité", "Pression"), ("Force+Gaz", "Pression"),
  ("Eau+Gravité+Océan", "Pression"),
  # Gravité
  ("Masse+Masse", "Gravité"), ("Masse+Planète Terre", "Gravité"), ("Pomme+Planète Terre", "Gravité"),
  ("Lune+Planète Terre+Masse", "Gravité"),
  # Masse
  ("Gravité+Inertie", "Masse"), ("Énergie+Relativité", "Masse"),
  # Force
  ("Masse+Mouvement", "Force"), ("Énergie+Muscle", "Force"), ("Masse+Vitesse+Temps", "Force"),
  # Mouvement
  ("Énergie+Pierre", "Mouvement"), ("Force+Masse", "Mouvement"), ("Énergie+Roue", "Mouvement"),
  # Vitesse
  ("Mouvement+Temps", "Vitesse"), ("Mouvement+Vent", "Vitesse"),
  ("Force+Mouvement+Temps", "Vitesse"),
  # Friction
  ("Mouvement+Solide", "Friction"), ("Mouvement+Sable", "Friction"),
  ("Force+Mouvement+Pierre", "Friction"),
  # Plasma
  ("Électricité+Gaz", "Plasma"), ("Éclair+Gaz", "Plasma"), ("Chaleur+Énergie+Gaz", "Plasma"),
  ("Étoile+Gaz", "Plasma"),
  # Radiation
  ("Énergie+Onde", "Radiation"), ("Particule+Radioactivité", "Radiation"), ("Onde+Soleil", "Radiation"),
  ("Énergie+Lumière+Onde", "Radiation"),
  # Radioactivité
  ("Noyau atomique+Temps", "Radioactivité"), ("Noyau atomique+Radiation", "Radioactivité"),
  ("Pierre+Radiation", "Radioactivité"),
  # Fusion nucléaire
  ("Chaleur+Hydrogène+Hydrogène+Pression", "Fusion nucléaire"),
  ("Noyau atomique+Noyau atomique", "Fusion nucléaire"), ("Hydrogène+Plasma+Pression", "Fusion nucléaire"),
  ("Hydrogène+Étoile", "Fusion nucléaire"), ("Hydrogène+Hydrogène+Plasma+Pression", "Fusion nucléaire"),
  # Fission nucléaire
  ("Neutron+Noyau atomique", "Fission nucléaire"), ("Neutron+Radioactivité+Noyau atomique", "Fission nucléaire"),
  # Lentille
  ("Lumière+Verre", "Lentille"), ("Verre+Œil", "Lentille"), ("Glace+Lumière", "Lentille"),
  ("Eau+Lumière+Verre", "Lentille"),
  # Prisme
  ("Cristal+Lumière", "Prisme"), ("Arc-en-ciel+Verre", "Prisme"), ("Spectre lumineux+Verre", "Prisme"),
  ("Lumière+Quartz", "Prisme"),
  # Spectre lumineux
  ("Lumière+Prisme", "Spectre lumineux"), ("Arc-en-ciel+Onde", "Spectre lumineux"),
  ("Infrarouge+Lumière+Ultraviolet", "Spectre lumineux"),
  # Infrarouge
  ("Chaleur+Lumière", "Infrarouge"), ("Feu+Onde", "Infrarouge"), ("Feu+Spectre lumineux", "Infrarouge"),
  ("Chaleur+Onde", "Infrarouge"),
  # Ultraviolet
  ("Lumière+Ozone", "Ultraviolet"), ("Énergie+Spectre lumineux", "Ultraviolet"), ("Soleil+Spectre lumineux", "Ultraviolet"),
  # Rayons X
  ("Énergie+Ultraviolet", "Rayons X"), ("Électron+Énergie+Métal", "Rayons X"),
  ("Électron+Métal+Vitesse", "Rayons X"),
  # Vide
  ("Air+Espace", "Vide"), ("Air+Pression+Verre", "Vide"),
  # Gaz
  ("Feu+Liquide", "Gaz"), ("Fumée+Vapeur", "Gaz"), ("Chaleur+Liquide", "Gaz"), ("Air+Molécule", "Gaz"),
  # Liquide
  ("Feu+Glace", "Liquide"), ("Chaleur+Solide", "Liquide"), ("Froid+Gaz", "Liquide"), ("Gaz+Pression", "Liquide"),
  # Solide
  ("Glace+Pierre", "Solide"), ("Froid+Liquide", "Solide"), ("Liquide+Pression+Froid", "Solide"),
  # Température
  ("Chaleur+Froid", "Température"), ("Mouvement+Particule", "Température"),
  ("Molécule+Vitesse", "Température"),
  # Inertie
  ("Masse+Vitesse", "Inertie"), ("Mouvement+Vide", "Inertie"),
  # Relativité
  ("Temps+Vitesse", "Relativité"), ("Gravité+Lumière", "Relativité"), ("Énergie+Lumière+Masse", "Relativité"),
  ("Lumière+Temps+Vitesse", "Relativité"),
  # Physique quantique
  ("Onde+Particule", "Physique quantique"), ("Électron+Onde", "Physique quantique"),
  ("Lumière+Particule", "Physique quantique"), ("Atome+Onde", "Physique quantique"),
  # Antimatière
  ("Électron+Physique quantique+Relativité", "Antimatière"), ("Proton+Radioactivité", "Antimatière"),
  ("Particule+Physique quantique+Relativité", "Antimatière"), ("Big Bang+Particule", "Antimatière"),
  # ===================== CHIMIE =====================
  # Hydrogène
  ("Électron+Proton", "Hydrogène"), ("Eau+Électricité", "Hydrogène"), ("Eau+Sodium", "Hydrogène"),
  ("Acide+Métal", "Hydrogène"),
  # Oxygène
  ("Air+Arbre", "Oxygène"), ("Énergie+Ozone", "Oxygène"), ("Air+Photosynthèse", "Oxygène"),
  ("Eau+Électricité+Air", "Oxygène"),
  # Carbone
  ("Atome+Charbon", "Carbone"), ("Atome+Graphite", "Carbone"), ("Atome+Diamant", "Carbone"),
  # Azote
  ("Air+Distillation", "Azote"), ("Ammoniac+Oxygène", "Azote"),
  # Hélium
  ("Fusion nucléaire+Hydrogène", "Hélium"),
  ("Étoile+Spectre lumineux", "Hélium"), ("Gaz+Radioactivité", "Hélium"),
  # Sodium
  ("Électricité+Sel", "Sodium"), ("Base chimique+Électricité", "Sodium"), ("Atome+Sel", "Sodium"),
  # Chlore
  ("Eau salée+Électricité", "Chlore"), ("Électricité+Eau+Sel", "Chlore"),
  # Calcium
  ("Calcaire+Électricité", "Calcium"), ("Atome+Os", "Calcium"), ("Atome+Calcaire", "Calcium"),
  ("Lait+Os", "Calcium"),
  # Silicium
  ("Atome+Sable", "Silicium"), ("Carbone+Feu+Quartz", "Silicium"),
  ("Charbon+Feu+Quartz", "Silicium"),
  # Soufre
  ("Fumée+Volcan", "Soufre"), ("Cristal+Volcan", "Soufre"), ("Geyser+Pierre", "Soufre"),
  # Phosphore
  ("Feu+Os", "Phosphore"), ("Distillation+Os", "Phosphore"),
  # Molécule
  ("Atome+Atome", "Molécule"), ("Hydrogène+Hydrogène", "Molécule"), ("Oxygène+Oxygène", "Molécule"),
  ("Atome+Atome+Force", "Molécule"),
  # Réaction chimique
  ("Molécule+Molécule", "Réaction chimique"), ("Énergie+Molécule+Molécule", "Réaction chimique"),
  ("Catalyseur+Molécule", "Réaction chimique"),
  # Combustion
  ("Feu+Oxygène", "Combustion"), ("Oxygène+Réaction chimique", "Combustion"),
  ("Bois+Feu+Oxygène", "Combustion"), ("Chaleur+Oxygène+Charbon", "Combustion"),
  # Oxydation
  ("Métal+Oxygène", "Oxydation"), ("Oxygène+Temps", "Oxydation"), ("Air+Eau+Métal", "Oxydation"),
  ("Oxygène+Pomme", "Oxydation"),
  # Acide
  ("Chlore+Hydrogène", "Acide"), ("Dioxyde de carbone+Eau", "Acide"),
  ("Eau+Oxygène+Soufre", "Acide"),
  # Base chimique
  ("Cendre+Eau", "Base chimique"), ("Calcaire+Feu", "Base chimique"), ("Ammoniac+Eau", "Base chimique"),
  ("Eau+Oxygène+Sodium", "Base chimique"),
  # Dioxyde de carbone
  ("Carbone+Oxygène", "Dioxyde de carbone"), ("Carbone+Combustion", "Dioxyde de carbone"),
  ("Air+Respiration", "Dioxyde de carbone"),
  ("Fermentation+Gaz", "Dioxyde de carbone"), ("Acide+Calcaire", "Dioxyde de carbone"),
  # Méthane
  ("Carbone+Hydrogène", "Méthane"), ("Gaz+Marais", "Méthane"), ("Décomposition+Gaz", "Méthane"),
  ("Gaz+Vache", "Méthane"),
  # Ammoniac
  ("Azote+Hydrogène", "Ammoniac"), ("Azote+Catalyseur+Hydrogène+Pression", "Ammoniac"),
  ("Azote+Hydrogène+Hydrogène+Hydrogène", "Ammoniac"), ("Azote+Décomposition", "Ammoniac"),
  # Eau salée
  ("Eau+Sel", "Eau salée"), ("Liquide+Sel", "Eau salée"),
  # Solution
  ("Eau+Sucre", "Solution"), ("Liquide+Molécule", "Solution"), ("Liquide+Solide+Eau", "Solution"),
  # Distillation
  ("Vapeur+Verre", "Distillation"), ("Laboratoire+Vapeur", "Distillation"), ("Feu+Glace+Liquide+Verre", "Distillation"),
  ("Feu+Liquide+Verre", "Distillation"),
  # Cristallisation
  ("Solution+Temps", "Cristallisation"), ("Cristal+Solution", "Cristallisation"),
  ("Eau salée+Temps", "Cristallisation"), ("Feu+Solution+Temps", "Cristallisation"),
  # Catalyseur
  ("Réaction chimique+Vitesse", "Catalyseur"), ("Métal+Réaction chimique", "Catalyseur"),
  ("Enzyme+Réaction chimique", "Catalyseur"),
  # Alcool
  ("Levure+Sucre", "Alcool"), ("Distillation+Vin", "Alcool"), ("Fermentation+Sucre", "Alcool"),
  ("Fruit+Levure+Temps", "Alcool"),
  # Sucre
  ("Canne à sucre+Feu", "Sucre"), ("Carbone+Hydrogène+Oxygène", "Sucre"), ("Air+Eau+Lumière+Plante", "Sucre"),
  ("Canne à sucre+Cristallisation", "Sucre"),
  # Amidon
  ("Sucre+Sucre", "Amidon"), ("Polymère+Sucre", "Amidon"),
  ("Sucre+Sucre+Sucre", "Amidon"),
  # Savon
  ("Base chimique+Huile", "Savon"), ("Cendre+Huile", "Savon"),
  ("Base chimique+Cire", "Savon"), ("Cendre+Eau+Huile+Feu", "Savon"),
  # Vinaigre
  ("Air+Vin", "Vinaigre"), ("Alcool+Oxygène", "Vinaigre"), ("Alcool+Bactérie", "Vinaigre"),
  ("Alcool+Air+Temps", "Vinaigre"),
  # Engrais
  ("Ammoniac+Terre", "Engrais"), ("Azote+Phosphore", "Engrais"), ("Azote+Terre", "Engrais"),
  ("Azote+Calcium+Phosphore", "Engrais"),
  # Poudre à canon
  ("Charbon+Sel+Soufre", "Poudre à canon"),
  ("Azote+Charbon+Soufre", "Poudre à canon"),
  ("Azote+Charbon+Oxygène+Soufre", "Poudre à canon"),
  # Polymère
  ("Molécule+Molécule+Molécule", "Polymère"),
  ("Carbone+Molécule+Réaction chimique", "Polymère"), ("Molécule+Molécule+Molécule+Molécule", "Polymère"),
  # Tableau périodique
  ("Atome+Science", "Tableau périodique"), ("Atome+Papier", "Tableau périodique"),
  # Laboratoire
  ("Maison+Réaction chimique", "Laboratoire"), ("Maison+Science", "Laboratoire"), ("Distillation+Maison", "Laboratoire"),
  ("Maison+Solution+Verre", "Laboratoire"),
  # ---- procédés en 4 étapes ----
  ("Air+Charbon+Feu+Fer", "Acier"), ("Charbon+Cuivre+Feu+Étain", "Bronze"),
  ("Base chimique+Calcaire+Feu+Sable", "Verre"), ("Argile+Feu+Os+Quartz", "Porcelaine"),
  ("Carbone+Catalyseur+Hydrogène+Pression", "Polymère"), ("Air+Distillation+Froid+Pression", "Azote"),
  ("Dioxyde de carbone+Eau+Lumière+Plante", "Oxygène"), ("Électron+Énergie+Métal+Vide", "Rayons X"),
  ("Atome+Atome+Vide+Vitesse", "Particule"), ("Acide+Chêne+Eau+Fer", "Encre"),
  ("Arbre+Eau+Fourrure+Sel", "Cuir"),
  ("Air+Bactérie+Temps+Vin", "Vinaigre"), ("Catalyseur+Eau+Oxygène+Soufre", "Acide"),
  ("Calcaire+Chaleur+Pression+Temps", "Marbre"), ("Carbone+Chaleur+Pression+Temps", "Diamant"),
  ("Hydrogène+Hydrogène+Hydrogène+Hydrogène", "Hélium"), ("Neutron+Neutron+Proton+Proton", "Noyau atomique"),
  ("Aimant+Cuivre+Mouvement", "Électricité"), ("Calcaire+Eau+Feu", "Base chimique"),
]
