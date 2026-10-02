# Recettes : passe « paires vides » — les éléments du début (profondeur ≤ 2) se mélangent davantage,
# plus des recettes à 3 et 4 ingrédients. Recherche par lots, deux contre-vérifications, validation du propriétaire.
RECIPES = [
  # ===================== PAIRES DU DÉBUT =====================
  ("Air+Air", "Vent"),                                # beaucoup d'air qui bouge : un cran au-dessus de l'air (Air+Vent → Bourrasque, cran suivant)
  ("Air+Nuage", "Ciel"),                              # des nuages qui flottent dans l'air : c'est le ciel
  ("Air+Montagne", "Froid"),                          # en altitude l'air est plus froid (environ -6,5 °C par km)
  ("Air+Incendie", "Fumée"),                          # un incendie remplit l'air de fumée, comme Air+Feu en plus gros
  ("Argile+Esprit", "Golem"),                         # le golem des légendes : une statue d'argile animée par un esprit
  ("Boue+Boue", "Marais"),                            # toujours plus de boue : une étendue boueuse, le marais
  ("Boue+Chaleur", "Brique"),                         # brique crue (adobe) : la boue séchée par la chaleur, comme Argile+Soleil
  ("Boue+Geyser", "Volcan de boue"),                  # un geyser qui crache de la boue
  ("Brasier+Feu", "Incendie"),                        # intensité qui monte : Feu+Feu → Brasier, Brasier+Brasier → Incendie
  ("Brique+Nuage", "Gratte-ciel"),                    # empiler les briques jusqu'aux nuages ; le Monadnock Building (Chicago, 1891, 16 étages) est le plus haut gratte-ciel à murs porteurs en brique
  ("Chaleur+Chaleur", "Sécheresse"),                  # chaleur qui dure et redouble : tout se dessèche
  ("Chaleur+Vapeur", "Pression"),                     # la vapeur chauffée monte en pression : la cocotte-minute qui siffle
  ("Chaleur+Océan", "Nuage"),                         # le soleil chauffe la mer, l'eau s'évapore et forme les nuages
  ("Colline+Déluge", "Glissement de terrain"),        # la pluie diluvienne détrempe la pente : la colline glisse
  ("Colline+Montagne", "Vallée"),                     # entre deux hauteurs se creuse une vallée (comme Montagne+Montagne)
  ("Colline+Terre", "Montagne"),                      # encore plus de terre entassée sur la colline : une montagne
  ("Déluge+Déluge", "Inondation"),                    # pluies diluviennes à répétition : tout est inondé
  ("Déluge+Lac", "Inondation"),                       # le lac gonflé par les pluies déborde
  ("Déluge+Reproduction", "Arche"),                   # clin d'œil : l'arche de Noé (Genèse 6-7) : un couple de chaque espèce pour repeupler la terre après le Déluge (récit biblique)
  ("Eau+Magma", "Geyser"),                            # l'eau souterraine chauffée par le magma jaillit en geyser
  ("Eau+Sédiment", "Boue"),                           # dépôt de terre fine mêlé d'eau : de la boue
  ("Esprit+Fumée", "Génie"),                          # clin d'œil : Les Mille et Une Nuits, « Histoire du pêcheur » : une épaisse fumée sort du vase et devient un génie
  ("Esprit+Lac", "Fée"),                              # clin d'œil : la Dame du Lac, la fée des légendes arthuriennes qui confie Excalibur au roi Arthur (légende)
  ("Esprit+Nuage", "Ange"),                           # un esprit assis sur un nuage : l'image même de l'ange
  ("Esprit+Marais", "Feu follet"),                    # folklore : les feux follets des marais passaient pour des âmes errantes
  ("Feu+Montagne", "Volcan"),                         # une montagne qui crache du feu
  ("Feu+Marais", "Feu follet"),                       # les feux follets des marais : petites flammes pâles, sans doute des gaz de décomposition (méthane, peut-être phosphine) qui s'enflamment ; l'explication exacte reste une hypothèse
  ("Feu+Pluie", "Vapeur"),                            # la pluie tombe sur le feu : pschitt, l'eau part en vapeur
  ("Feu+Vie", "Salamandre"),                          # clin d'œil : la salamandre qui vit dans le feu sans brûler, emblème de François Ier à Chambord (légende, déjà chez Pline l'Ancien ; la vraie salamandre aime l'humidité)
  ("Feu+Reproduction", "Phénix"),                     # clin d'œil : le phénix renaît de ses cendres (légende antique)
  ("Geyser+Océan", "Source hydrothermale"),           # un geyser au fond de l'océan : les sources hydrothermales (fumeurs noirs) crachent une eau très chaude chauffée par le magma
  ("Glissement de terrain+Lac", "Vague"),             # un pan de montagne qui tombe dans un lac soulève une vague géante (Vajont, 1963)
  ("Incendie+Pluie", "Fumée"),                        # la pluie éteint l'incendie : le feu noyé se met à fumer
  ("Lac+Pierre", "Onde"),                             # on jette une pierre dans le lac : des ronds s'étalent à la surface, ce sont des ondes
  ("Lac+Sédiment", "Marais"),                         # le lac se remplit de dépôts, l'eau devient peu profonde : c'est le comblement (atterrissement) qui donne un marais
  ("Lac+Vie", "Poisson"),                             # la vie dans le lac, ce sont d'abord les poissons (comme Eau+Vie, Rivière+Vie)
  ("Lac+Nuage", "Brouillard"),                        # un nuage posé au ras du lac, c'est le brouillard (le brouillard est un nuage au sol)
  ("Lave+Lave", "Volcan"),                            # coulée sur coulée, la lave empilée bâtit un volcan (volcans boucliers : Mauna Loa, Piton de la Fournaise)
  ("Marais+Vapeur", "Brouillard"),                    # la vapeur qui monte du marais : la brume des marais
  ("Montagne+Source", "Rivière"),                     # la source dans la montagne descend la pente et devient rivière
  ("Montagne+Reproduction", "Souris"),                # clin d'œil : La Fontaine, « La Montagne qui accouche » : la montagne accouche d'une souris
  ("Vapeur+Vapeur", "Nuage"),                         # beaucoup de vapeur rassemblée : un nuage
  ("Océan+Pierre", "Sable"),                          # les vagues usent les rochers en sable, même procédé que Mer+Pierre → Sable
  ("Océan+Poussière", "Sédiment"),                    # la poussière (ex. du Sahara) retombe sur l'océan et se dépose au fond, comme Lac+Poussière → Sédiment
  ("Terre+Île", "Continent"),                         # une île qu'on agrandit de terre devient un continent (suite de Océan+Terre → Île)
  ("Plante+Poussière", "Pollen"),                     # le pollen est la fine poussière jaune des plantes (graminées, conifères…)
  ("Pluie+Énergie", "Orage"),                         # une pluie chargée d'énergie : l'orage (cf. Éclair+Pluie → Orage)
  ("Reproduction+Vie", "Naissance"),                  # la reproduction d'un être vivant aboutit à une naissance
  ("Sel+Sel", "Cristal"),                             # les grains de sel sont de petits cristaux cubiques (halite)
  ("Sel+Terre", "Désert de sel"),                     # une terre couverte de sel, où rien ne pousse : le désert de sel
  ("Sédiment+Terre", "Sol fertile"),                  # les alluvions déposées sur les terres les rendent fertiles (le limon du Nil)
  ("Méduse+Pluie", "Parapluie"),                      # clin d'œil : le corps de la méduse s'appelle vraiment l'« ombrelle » ; sous la pluie, elle devient parapluie
  ("Pierre+Île", "Sculpture"),                        # clin d'œil : les moaï de l'île de Pâques, géants taillés dans la pierre volcanique
  ("Source+Vie", "Élixir"),                           # clin d'œil : la fontaine de Jouvence et son eau qui rend la jeunesse (légende), comme Fontaine+Magie → Élixir
  # ===================== RECETTES À 3 ET 4 INGRÉDIENTS =====================
  ("Humain+Neige", "Bonhomme de neige"),              # on roule des boules de neige et on les empile
  ("Pomme+Pression+Levure+Temps", "Cidre"),           # on presse les pommes, les levures font fermenter le jus pendant des semaines : c'est le cidre
  ("Lait+Chaleur+Cacao+Sucre", "Chocolat chaud"),     # lait chauffé + cacao + sucre : la recette du chocolat chaud ; sans chaleur, c'est du lait chocolaté froid
  ("Miel+Eau+Levure+Temps", "Alcool"),                # l'hydromel : miel dilué dans l'eau, fermenté par les levures ; l'une des plus anciennes boissons alcoolisées
  ("Bateau+Humain+Océan+Continent", "Grandes découvertes"),  # Colomb aborde les Bahamas en 1492 et n'atteint le continent américain qu'en 1498 : l'ère des grandes découvertes
  ("Brique+Cochon+Loup+Vent", "Maison"),              # clin d'œil : Les Trois Petits Cochons (conte anglais, Joseph Jacobs, 1890) : le loup souffle, mais la maison de briques tient bon
  ("Vélo+Aimant+Cuivre+Ampoule", "Lumière"),          # la dynamo du vélo : la roue fait tourner un aimant dans une bobine de cuivre, le courant allume la lampe
  ("Air+Eau+Plastique+Pression", "Fusée"),            # la fusée à eau : bouteille en plastique, un peu d'eau, de l'air pompé sous pression ; l'eau jaillit et la fusée décolle
  ("Humain+Chien+Traîneau+Pôle", "Explorateur"),      # Amundsen atteint le pôle Sud le 14 décembre 1911 avec des traîneaux tirés par des chiens
  ("Bois+Friction", "Feu de camp"),                   # frotter deux bois l'un contre l'autre allume le feu
  ("Bois+Bois+Humain", "Cabane"),                     # quelques planches assemblées : une cabane
  ("Sapin+Sapin+Sapin", "Taïga"),                     # la taïga est l'immense forêt de conifères (sapins, épicéas, pins) du Grand Nord
  ("Corail+Corail+Corail", "Récif"),                  # un récif est bâti par des milliers de colonies de coraux accolées
  ("Vent+Vent+Vent", "Tempête"),                      # deux Vent font une Bourrasque ; encore plus fort, c'est la tempête (force 10 sur l'échelle de Beaufort)
  ("Bateau+Récif+Tempête", "Épave"),                  # dans la tempête, le bateau est jeté sur le récif et coule : une épave
  ("Ville+Volcan", "Ruine"),                          # Pompéi, 79 apr. J.-C. : l'éruption du Vésuve ensevelit la ville
  ("Vapeur+Froid+Verre", "Buée"),                     # la vapeur d'eau se condense en fines gouttes sur un verre froid : la buée
  ("Montagne+Rivière+Temps", "Vallée"),               # au fil du temps, la rivière creuse la montagne : une vallée en V
  ("Hiver+Ours", "Sommeil"),                          # l'ours passe l'hiver endormi dans sa tanière
  ("Batterie+Clou+Cuivre", "Électroaimant"),          # fil de cuivre enroulé autour d'un clou en fer, branché sur une pile : le clou attire les trombones
  ("Eau+Poterie+Temps", "Horloge"),                   # la clepsydre : un pot percé qui se vide à vitesse régulière mesure le temps (Égypte ancienne : décrite vers 1500 av. J.-C., la plus ancienne conservée, celle de Karnak, date d'environ 1350 av. J.-C.)
  ("Feu+Soufre+Pluie", "Pluie acide"),                # le soufre brûlé (charbon, fioul) donne un gaz qui se dissout dans la pluie et la rend acide
  ("Lumière+Plancton", "Oxygène"),                    # le phytoplancton fait la photosynthèse : environ la moitié de l'oxygène de la planète (NOAA)
  ("Montagne+Neige+Soleil", "Rivière"),               # au soleil du printemps, la neige des montagnes fond et alimente les rivières
  ("Corde+Enfant", "Jeu"),                            # la corde à sauter
  ("Corde+Poterie+Poterie", "Téléphone"),             # le téléphone à ficelle : deux pots reliés par une ficelle tendue transmettent la voix
  ("Humain+Fourrure+Hiver", "Manteau"),               # pour passer l'hiver, l'humain s'habille d'une fourrure : le manteau
  ("Sapin+Lumière+Étoile", "Sapin de Noël"),          # guirlandes lumineuses et étoile au sommet : le sapin de Noël décoré
  ("Cigale+Fourmi+Hiver", "Faim"),                    # clin d'œil : La Fontaine, La Cigale et la Fourmi : « la Cigale, ayant chanté tout l'été, se trouva fort dépourvue quand la bise fut venue » ; en vrai, la cigale meurt avant l'hiver (fable)
  ("Graine+Magie+Nuage", "Géant"),                    # clin d'œil : Jack et le haricot magique (conte anglais, imprimé par Benjamin Tabart en 1807) : le haricot magique pousse jusqu'aux nuages, où vit un géant (légende)
  ("Dieu+Feu+Humain", "Civilisation"),                # clin d'œil : Prométhée vole le feu aux dieux pour le donner aux hommes, qui en tirent tous les arts (Eschyle, Prométhée enchaîné) (légende)
]
