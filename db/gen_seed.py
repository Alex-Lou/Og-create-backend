# db/gen_seed.py — génère db/seed.sql (contenu du jeu) et vérifie sa cohérence :
# chaque élément est atteignable depuis Eau/Feu/Terre/Air, aucune recette en double,
# questions Timer faisables.
# Usage : python3 db/gen_seed.py   (FRONT_DIR=../og-create pour vérifier aussi les images)
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRONT_DIR = os.environ.get("FRONT_DIR", os.path.join(ROOT, "..", "og-create"))

BASE = ["Eau", "Feu", "Terre", "Air"]

sys.path.insert(0, os.path.join(HERE, "content"))
from elements import FAMILIES, FILE_OF_FAMILY  # noqa: E402
FAMILY_OF = {n: f for f, els in FAMILIES.items() for n in els}
import check  # noqa: E402  (chargement des recettes, partagé avec le vérificateur)

# file(game_data.name) -> { famille: {nom: emoji} }
FILES = {}
for family, els in FAMILIES.items():
    FILES.setdefault(FILE_OF_FAMILY[family], {})[family] = els

# (ingrédients, résultat) : toutes les recettes de db/content/recipes_*.py
import glob  # noqa: E402
R = [(ing, res) for path in sorted(glob.glob(os.path.join(HERE, "content", "recipes_*.py")))
     for ing, res, _ in check.load(path)]

name_to_file = {}
for f, cats in FILES.items():
    for c, els in cats.items():
        for n in els:
            assert n not in name_to_file, n
            name_to_file[n] = f

# --- validation ---
keys = {}
for ing, res in R:
    parts = ing.split("+")
    for p in parts + [res]:
        assert p in name_to_file, ("unknown element", p)
    k = "+".join(sorted(parts))
    assert k not in keys, ("dup recipe", ing, keys.get(k), res)
    keys[k] = res

def closure(start, rules=R):
    have = set(start)
    changed = True
    while changed:
        changed = False
        for ing, res in rules:
            if res not in have and all(p in have for p in ing.split("+")):
                have.add(res); changed = True
    return have

reach = closure(BASE)
missing = set(name_to_file) - reach
assert not missing, ("unreachable", missing)
produced = {r for _, r in R}
orphan = set(name_to_file) - produced - set(BASE)
assert not orphan, ("never produced", orphan)
by_arity = {n: sum(1 for ing, _ in R if len(ing.split("+")) == n) for n in (2, 3, 4)}
assert all(2 <= len(ing.split("+")) <= 4 for ing, _ in R), "le front accepte 2 à 4 éléments"
print("elements:", len(name_to_file), "recipes:", len(R), by_arity, file=sys.stderr)

# Un élément sans emoji convenable porte « svg:nom » : le front doit avoir public/icons/elements/nom.svg
ICONS_DIR = os.path.join(FRONT_DIR, "public", "icons", "elements")
icons = set(os.listdir(ICONS_DIR)) if os.path.isdir(ICONS_DIR) else None
for fam, els in FAMILIES.items():
    for n, e in els.items():
        if e.startswith("svg:"):
            assert re.fullmatch(r"svg:[a-z0-9-]{1,40}", e), ("nom de dessin invalide", n, e)
            assert icons is None or e[4:] + ".svg" in icons, ("dessin manquant dans le front", n, e)

# rules go in the file of the result element
rules_by_file = {f: {} for f in FILES}
for ing, res in R:
    rules_by_file[name_to_file[res]][ing] = res

# --- timer questions ---
TQ = [
  # level, timer, category, text, answers, points, initial
  ("Facile", 300, "Nature", "Mélange l'eau et la terre pour obtenir de la Boue", ["Boue"], 10,
   {"validationMode": "any", "required": ["Eau", "Terre"], "additional": []}),
  ("Facile", 300, "Météo", "Fais tomber la Pluie", ["Pluie"], 10,
   {"validationMode": "any", "required": ["Eau", "Air"], "additional": []}),
  ("Facile", 300, "Créatures", "Donne naissance à la Vie", ["Vie"], 10,
   {"validationMode": "any", "required": ["Eau", "Terre", "Air"], "additional": []}),
  ("Moyen", 240, "Nature", "Fais surgir une Montagne", ["Montagne"], 20,
   {"validationMode": "any", "required": ["Terre", "Eau"], "additional": ["Lave"]}),
  ("Moyen", 240, "Météo", "Déclenche une Tempête (ou pire !)", ["Tempête", "Tornade"], 20,
   {"validationMode": "any", "required": ["Air", "Eau"], "additional": ["Vent"]}),
  ("Moyen", 240, "Créatures", "Crée 2 habitants des mers", ["Poisson", "Méduse", "Poisson Volant", "Poisson Abyssal"], 20,
   {"validationMode": "multiple", "requiredCount": 2, "required": ["Eau", "Air"], "additional": ["Vie", "Océan"]}),
  ("Difficile", 180, "Nature", "Fais naître un Volcan", ["Volcan", "Île"], 30,
   {"validationMode": "any", "required": ["Terre", "Feu", "Eau"], "additional": []}),
  ("Difficile", 180, "Météo", "Invoque l'Éclair", ["Éclair", "Ozone"], 30,
   {"validationMode": "any", "required": ["Eau", "Feu", "Air"], "additional": []}),
  ("Difficile", 180, "Créatures", "Réveille un Dragon", ["Dragon"], 30,
   {"validationMode": "any", "required": ["Feu", "Terre", "Eau", "Air"], "additional": ["Vie", "Montagne"]}),
  # questions qui demandent une fusion à 3 éléments
  ("Moyen", 240, "Nature", "Fais pousser une Forêt (fusion à 3 éléments)", ["Forêt"], 25,
   {"validationMode": "any", "required": ["Terre", "Eau"], "additional": ["Arbre", "Pluie"]}),
  ("Difficile", 180, "Météo", "Allume une Étoile (fusion à 3 éléments)", ["Étoile", "Galaxie"], 35,
   {"validationMode": "any", "required": ["Feu", "Air", "Eau"], "additional": ["Lumière", "Énergie"]}),
  ("Difficile", 180, "Créatures", "Fais renaître le Phénix de ses cendres", ["Phénix"], 35,
   {"validationMode": "any", "required": ["Feu", "Terre", "Air"], "additional": ["Vie", "Cendre"]}),
]
# --- épreuves générées : par famille, une cible et exactement ce qu'il faut pour l'obtenir ---
# Facile = 1 fusion, Moyen = 2, Difficile = 3 ; deux leurres de la même famille. Déterministe.
import hashlib  # noqa: E402

recipes_of = {}
for ing, res in R:
    recipes_of.setdefault(res, []).append(ing.split("+"))

depth = {e: 0 for e in BASE}
changed = True
while changed:
    changed = False
    for ing, res in R:
        parts = ing.split("+")
        if all(p in depth for p in parts):
            d = 1 + max(depth[p] for p in parts)
            if d < depth.get(res, 10 ** 6):
                depth[res] = d
                changed = True


def stable(key):
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest(), 16)


def simplest(recipes):
    # la recette la plus « lisible » : peu d'ingrédients, ingrédients peu profonds
    return min(recipes, key=lambda parts: (len(parts), max(depth[p] for p in parts), "+".join(parts)))


def plan(target, steps, forbid=frozenset()):
    """Ingrédients à donner pour obtenir target en `steps` fusions (ou moins), sans jamais donner `forbid`."""
    forbid = forbid | {target}
    usable = [parts for parts in recipes_of[target] if not forbid & set(parts)]
    if not usable:
        return None
    parts = simplest(usable)
    if steps <= 1:
        return set(parts)
    deeper = sorted((p for p in parts if p not in BASE and p in recipes_of), key=lambda p: (-depth[p], p))
    if not deeper:
        return set(parts)
    below = plan(deeper[0], steps - 1, forbid)
    return None if below is None else (set(parts) - {deeper[0]}) | below


LEVELS = [("Facile", 300, 1, 10), ("Moyen", 240, 2, 20), ("Difficile", 180, 3, 30)]
for family, els in FAMILIES.items():
    if family == "Elements Fondamentaux":
        continue
    pool = sorted((e for e in els if e in recipes_of and depth.get(e, 0) >= 1), key=lambda e: (depth[e], e))
    used = set()
    for level, timer, steps, points in LEVELS:
        # cibles assez profondes pour le niveau, choisies de façon stable
        fit = [e for e in pool if depth[e] >= steps and e not in used] or [e for e in pool if e not in used]
        fit.sort(key=lambda e: stable(f"{family}/{level}/{e}"))
        picked = 0
        for target in fit:
            given = plan(target, steps)
            if given is None or picked == 2:
                continue
            picked += 1
            used.add(target)
            given -= set(BASE)
            decoys = sorted((e for e in els if e != target and e not in given and depth.get(e, 99) <= depth[target]),
                            key=lambda e: stable(f"leurre/{target}/{e}"))[:2]
            TQ.append((level, timer, family, f"Fais naître « {target} »", [target], points,
                       {"validationMode": "any", "required": sorted(given), "additional": decoys}))

emoji = {}
for cats in FILES.values():
    for els in cats.values():
        emoji.update(els)
tq_rows = []
for lvl, t, cat, txt, ans, pts, ini in TQ:
    start = set(BASE) | set(ini["required"]) | set(ini["additional"])
    have = closure(start)
    ok = [a for a in ans if a in have]
    need = ini.get("requiredCount", 1) if ini["validationMode"] == "multiple" else 1
    assert len(ok) >= need, (txt, ok)
    for a in ans:
        assert a not in start, ("answer given for free", txt, a)
    names = sorted(start | set(ans))
    tq_rows.append((lvl, t, cat, txt, ans, pts, ini, {n: emoji[n] for n in names}))

# --- achievements (names = assets/success/*.png) ---
ACH = [
  ("Eurêka", "Réalise ta toute première création.", "this.discoveredElements.length >= 5"),
  ("L'Éveil de la Vie", "Donne naissance à la Vie.", "this.discoveredElements.includes('Vie')"),
  ("L'Esprit de la Rivière", "Forme ton premier Lac.", "this.discoveredElements.includes('Lac')"),
  ("Explorateur Curieux", "Découvre 15 éléments.", "this.discoveredElements.length >= 15"),
  ("Roi Soleil", "Fais jaillir la Lumière.", "this.discoveredElements.includes('Lumière')"),
  ("Légende Émeraude", "Fais pousser ton premier Cristal.", "this.discoveredElements.includes('Cristal')"),
  ("Sous le Baobab", "Fais pousser un Arbre.", "this.discoveredElements.includes('Arbre')"),
  ("Magie en Arc-en-Ciel", "Crée un Arc-en-ciel.", "this.discoveredElements.includes('Arc-en-ciel')"),
  ("Gardien des Pics Glacés", "Fige l'eau en Glace.", "this.discoveredElements.includes('Glace')"),
  ("Pays du Soleil Levant", "Fais émerger une Île volcanique.", "this.discoveredElements.includes('Île')"),
  ("Merlin l'enchanteur", "Façonne une Baguette magique.", "this.discoveredElements.includes('Baguette')"),
  ("Le Serpent à Plumes", "Réveille le Dragon.", "this.discoveredElements.includes('Dragon')"),
  ("Ville des lumières", "Construis ta première Maison.", "this.discoveredElements.includes('Maison')"),
  ("Apprenti Dieu", "Découvre 30 éléments.", "this.discoveredElements.length >= 30"),
  ("Visionnaire Divin", "Crée la Planète Terre.", "this.discoveredElements.includes('Planète Terre')"),
  ("Maître Créateur", "Découvre 50 éléments.", "this.discoveredElements.length >= 50"),
  ("Dieu Omniscient", "Découvre tous les éléments du monde.", f"this.discoveredElements.length >= {len(name_to_file)}"),
]
# Succès de famille : un repère (une découverte clé) et une maîtrise (plusieurs découvertes savantes)
def has(*names):
    return " && ".join(f"this.discoveredElements.includes('{n}')" for n in names)


FAMILY_ACH = [
  ("Matériaux", ("Main de Potier", "Façonne la Céramique.", ["Céramique"]),
   ("Maître des Alliages", "Forge l'Acier, le Bronze et le Béton.", ["Acier", "Bronze", "Béton"])),
  ("Chimie", ("Premier Flacon", "Isole l'Oxygène.", ["Oxygène"]),
   ("Grand Chimiste", "Maîtrise la Réaction chimique, le Catalyseur et le Polymère.", ["Réaction chimique", "Catalyseur", "Polymère"])),
  ("Physique", ("Pomme de Newton", "Découvre la Gravité.", ["Gravité"]),
   ("Esprit Quantique", "Comprends la Relativité, la Physique quantique et l'Antimatière.", ["Relativité", "Physique quantique", "Antimatière"])),
  ("Phénomènes Naturels", ("Faiseur de Pluie", "Déclenche un Orage.", ["Orage"]),
   ("Seigneur des Cieux", "Déchaîne Ouragan, Séisme et Avalanche.", ["Ouragan", "Séisme", "Avalanche"])),
  ("Cosmos", ("Premier Regard", "Contemple la Lune.", ["Lune"]),
   ("Architecte des Étoiles", "Fais naître Supernova, Trou noir et Big Bang.", ["Supernova", "Trou noir", "Big Bang"])),
  ("Formations Naturelles", ("Source Claire", "Fais jaillir une Source.", ["Source"]),
   ("Arpenteur du Monde", "Dessine Canyon, Glacier et Delta.", ["Canyon", "Glacier", "Delta"])),
  ("Flore", ("Main Verte", "Fais éclore une Fleur.", ["Fleur"]),
   ("Botaniste Royal", "Cultive Vigne, Cacao et Herbe médicinale.", ["Vigne", "Cacao", "Herbe médicinale"])),
  ("Biologie", ("Première Cellule", "Fais naître la Cellule.", ["Cellule"]),
   ("Gardien du Vivant", "Comprends ADN, Évolution et Écosystème.", ["ADN", "Évolution", "Écosystème"])),
  ("Vie et Créatures", ("Ami des Bêtes", "Apprivoise le Chien.", ["Chien"]),
   ("Arche Vivante", "Fais naître Baleine, Éléphant et Aigle.", ["Baleine", "Éléphant", "Aigle"])),
  ("Corps et Esprit", ("Premier Rêve", "Fais naître le Rêve.", ["Rêve"]),
   ("Sage parmi les Sages", "Atteins Conscience, Sagesse et Mémoire.", ["Conscience", "Sagesse", "Mémoire"])),
  ("Créations Humaines", ("Premier Outil", "Façonne un Outil.", ["Outil"]),
   ("Bâtisseur de Cités", "Élève Pyramide, Temple et Pont.", ["Pyramide", "Temple", "Pont"])),
  ("Histoire", ("Mémoire des Âges", "Ouvre la Préhistoire.", ["Préhistoire"]),
   ("Chroniqueur du Temps", "Traverse Antiquité, Renaissance et Révolution industrielle.", ["Antiquité", "Renaissance", "Révolution industrielle"])),
  ("Technologie", ("Étincelle", "Allume l'Ampoule.", ["Ampoule"]),
   ("Ingénieur des Étoiles", "Construis Ordinateur, Fusée et Intelligence artificielle.", ["Ordinateur", "Fusée", "Intelligence artificielle"])),
  ("Légendes", ("Conteur", "Fais naître le Mythe.", ["Mythe"]),
   ("Maître des Arcanes", "Crée Pierre philosophale, Kraken et Centaure.", ["Pierre philosophale", "Kraken", "Centaure"])),
]
for family, *pairs in FAMILY_ACH:
    for name, desc, needed in pairs:
        for el in needed:
            assert FAMILY_OF.get(el) == family, (name, el, FAMILY_OF.get(el))
        ACH.append((name, desc, has(*needed)))
for count, name in [(100, "Archiviste"), (200, "Gardien du Registre"), (300, "Grand Encyclopédiste"),
                    (400, "Mémoire du Monde"), (500, "Presque Tout")]:
    ACH.append((name, f"Consigne {count} éléments au registre.", f"this.discoveredElements.length >= {count}"))

SUCCESS_DIR = os.path.join(FRONT_DIR, "src", "assets", "success")
succ = set(os.listdir(SUCCESS_DIR)) if os.path.isdir(SUCCESS_DIR) else None
assert len({n for n, _, _ in ACH}) == len(ACH), "succès en double"
for n, _, c in ACH:
    for el in re.findall(r"includes\('([^']+)'\)", c):
        assert el in name_to_file, (n, el)
# Une illustration n'existe que pour certains succès ; les autres s'affichent avec le sceau gravé
ACH_IMAGE = {n: (n + ".png" if succ is None or n + ".png" in succ else None) for n, _, _ in ACH}

# Cabinet : cadres (anneau du sceau) et emblèmes (cœur du sceau), dessinés par le front
# (src/utils/cabinet.js, clés = image_path). Avec un succès : ne s'achète pas, se mérite.
ITEMS = [
  ("Cadre basique", "frame", "basicCadre.png", 0, True, "Un filet simple autour du sceau.", None),
  ("Cadre argenté", "frame", "silverFrame.png", 100, False, "Double filet gradué, comme un cadran.", None),
  ("Cadre doré", "frame", "goldFrame.png", 250, False, "Un filet d'or perlé, pour les alchimistes fortunés.", None),
  ("Orbe céleste", "frame", "orbe", 350, False, "Une orbite d'étoiles et sa planète d'or.", None),
  ("Cadre mystique", "frame", "customCadre1.png", 400, False, "Douze runes gravées entre deux filets.", None),
  ("Couronne de ronces", "frame", "ronces", 450, False, "Une tige vivante, feuilles et épines.", None),
  ("Rouages", "frame", "rouages", 0, False, "Une couronne dentée, boulonnée d'or.", "Ingénieur des Étoiles"),
  ("Ouroboros", "frame", "ouroboros", 0, False, "Le serpent d'or qui se mord la queue.", "Maître des Arcanes"),
  ("Pièce", "avatar", "coin.png", 0, True, "Le cœur d'or d'origine.", None),
  ("Goutte d'eau", "avatar", "waterAvatar.png", 150, False, "Le triangle de l'Eau.", None),
  ("Flamme", "avatar", "fireAvatar.png", 150, False, "Le triangle du Feu.", None),
  ("Nuage", "avatar", "cloudy.png", 200, False, "Le triangle barré de l'Air.", None),
  ("Lune", "avatar", "moon.png", 300, False, "Un croissant d'or.", None),
  ("Soleil d'or", "avatar", "soleil", 400, False, "Le disque pointé et ses douze rayons.", None),
  ("Arbre de vie", "avatar", "arbre", 500, False, "Ramure et racines dans un cercle.", None),
  ("Œil du Sage", "avatar", "oeil", 0, False, "L'œil qui a tout vu.", "Sage parmi les Sages"),
  ("Étoile septénaire", "avatar", "septenaire", 0, False, "L'heptagramme des sept lumières.", "Architecte des Étoiles"),
]
ach_names = {n for n, _, _ in ACH}
for it in ITEMS:
    assert it[6] is None or it[6] in ach_names, it
CABINET_JS = os.path.join(FRONT_DIR, "src", "utils", "cabinet.js")
if os.path.isfile(CABINET_JS):
    drawn = set(re.findall(r"^  '?([\w.]+)'?: \[", open(CABINET_JS, encoding="utf-8").read(), re.M))
    for it in ITEMS:
        assert it[2] in drawn, ("gravure absente de cabinet.js", it[2])

# --- SQL emit ---
def q(s):
    return "'" + str(s).replace("'", "''") + "'"
def j(o):
    return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"
out = []
w = out.append
w("-- =====================================================================")
w("-- Origins Creation - données de démonstration (idempotent, rejouable)")
w(f"-- {len(name_to_file)} éléments, {len(R)} recettes ({by_arity[2]} à 2, {by_arity[3]} à 3, {by_arity[4]} à 4 éléments), {len(tq_rows)} questions Timer,")
w(f"-- {len(ACH)} succès, {len(ITEMS)} items. Aucun utilisateur.")
w("-- NE PAS MODIFIER À LA MAIN : généré par db/gen_seed.py (python3 db/gen_seed.py).")
w("-- Vérifié : tout élément est atteignable depuis Eau/Feu/Terre/Air.")
w("-- =====================================================================")
w("BEGIN;")
w("")
w("-- ---------------------------------------------------------------- game_data")
w("-- Seuls formations_naturelles, materiaux_elementaires, phenomenes_naturels et")
w("-- humains_craft_rules (servi sous /api/game-data/creations_humaines) atteignent")
w("-- réellement la BDD depuis le front : server.js intercepte animaux, biologie,")
w("-- geologie, magie, elements, elements_data avec des réponses vides.")
meta_desc = {
  "materiaux_elementaires": "Éléments fondamentaux, matériaux, chimie et physique",
  "phenomenes_naturels": "Météo, phénomènes naturels et cosmos",
  "formations_naturelles": "Reliefs, eaux, flore, biologie et êtres vivants",
  "humains_craft_rules": "Corps et esprit, créations humaines, histoire, technologie et légendes",
}
rows = []
for f, cats in FILES.items():
    rows.append((f, {"elements": cats}, {"rules": rules_by_file[f]}, {"description": meta_desc[f], "version": 1}))
# elements_data : jamais servi au front (intercepté par server.js) mais lu par
# POST /combine qui fait elementsData.elements.find(e => e.name === ...) => TABLEAU.
el_list = []
for f, cats in FILES.items():
    for c, els in cats.items():
        for n, e in els.items():
            el_list.append({"name": n, "category": c, "emoji": e})
rows.append(("elements_data", {"elements": el_list}, {"rules": {}},
             {"description": "Liste plate des éléments (utilisée par POST /api/game-data/combine)", "version": 1}))
# 'formulas' est requis par POST /api/game-data/combine (sinon erreur 500).
# checkCraftRules() ne parcourt pas humains_craft_rules : ses recettes sont donc
# recopiées ici en combinaisons 'specific' pour que /combine les connaisse.
specific = [{"ingredients": ing.split("+"), "result": res, "known": False}
            for ing, res in rules_by_file["humains_craft_rules"].items()]
rows.append(("formulas", {}, {}, {"specific": specific, "generic": []}))
for name, el, ru, me in rows:
    w(f"INSERT INTO game_data (name, elements, rules, metadata, active) VALUES ({q(name)}, {j(el)}, {j(ru)}, {j(me)}, TRUE)")
    w("ON CONFLICT (name) DO UPDATE SET elements = EXCLUDED.elements, rules = EXCLUDED.rules, metadata = EXCLUDED.metadata, active = TRUE, updated_at = NOW();")
w("")
w("-- ---------------------------------------------------------------- timer_questions")
for lvl, t, cat, txt, ans, pts, ini, emo in tq_rows:
    w(f"INSERT INTO timer_questions (level, timer, category, question_text, valid_answers, points, initial_elements, elements_emojis) VALUES ({q(lvl)}, {t}, {q(cat)}, {q(txt)}, {j(ans)}, {pts}, {j(ini)}, {j(emo)})")
    w("ON CONFLICT (level, category, question_text) DO UPDATE SET timer = EXCLUDED.timer, valid_answers = EXCLUDED.valid_answers, points = EXCLUDED.points, initial_elements = EXCLUDED.initial_elements, elements_emojis = EXCLUDED.elements_emojis;")
w("")
w("-- ---------------------------------------------------------------- achievements_list")
w("-- Formats de condition compris par le front (utils/achievementChecker.js) :")
w("--   this.discoveredElements.includes('X')  |  this.discoveredElements.length >= N")
for n, d, c in ACH:
    w(f"INSERT INTO achievements_list (name, description, unlocked, condition, image) VALUES ({q(n)}, {q(d)}, FALSE, {q(c)}, {q(ACH_IMAGE[n]) if ACH_IMAGE[n] else 'NULL'})")
    w("ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, image = EXCLUDED.image;")
w("")
w("-- ---------------------------------------------------------------- customization_items")
for n, t, p, price, dflt, d, ach in ITEMS:
    w(f"INSERT INTO customization_items (name, type, image_path, price, is_default, description, achievement) VALUES ({q(n)}, {q(t)}, {q(p)}, {price}, {'TRUE' if dflt else 'FALSE'}, {q(d)}, {q(ach) if ach else 'NULL'})")
    w("ON CONFLICT (image_path) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, price = EXCLUDED.price, is_default = EXCLUDED.is_default, description = EXCLUDED.description, achievement = EXCLUDED.achievement;")
w("")
w("COMMIT;")
open(os.path.join(HERE, "seed.sql"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("ok", file=sys.stderr)
