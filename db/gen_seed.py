# db/gen_seed.py — génère db/seed.sql (contenu du jeu) et vérifie sa cohérence :
# chaque élément est atteignable depuis Eau/Feu/Terre/Air, aucune recette en double,
# questions Timer et régions Explorer faisables.
# Usage : python3 db/gen_seed.py   (FRONT_DIR=../og-create pour vérifier aussi les images)
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRONT_DIR = os.environ.get("FRONT_DIR", os.path.join(ROOT, "..", "og-create"))

BASE = ["Eau", "Feu", "Terre", "Air"]

sys.path.insert(0, os.path.join(HERE, "content"))
from elements import FAMILIES, FILE_OF_FAMILY  # noqa: E402
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

# rules go in the file of the result element
rules_by_file = {f: {} for f in FILES}
for ing, res in R:
    rules_by_file[name_to_file[res]][ing] = res

# --- regions ---
regions = json.load(open(os.path.join(ROOT, "src", "public", "data", "regionChallenges.json"), encoding="utf-8"))["regions"]
for r in regions:
    have = closure(r.get("availableElements", []))
    for e in r.get("requiredElements", []):
        assert e in have, ("region", r["id"], e)

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
SUCCESS_DIR = os.path.join(FRONT_DIR, "src", "assets", "success")
succ = set(os.listdir(SUCCESS_DIR)) if os.path.isdir(SUCCESS_DIR) else None
for n, _, c in ACH:
    assert succ is None or n + ".png" in succ, n
    if "includes" in c:
        el = c.split("'")[1]
        assert el in name_to_file, el

ITEMS = [
  ("Cadre basique", "frame", "basicCadre.png", 0, True, "Le cadre de départ."),
  ("Cadre argenté", "frame", "silverFrame.png", 100, False, "Un cadre argenté élégant."),
  ("Cadre doré", "frame", "goldFrame.png", 250, False, "Pour les alchimistes fortunés."),
  ("Cadre mystique", "frame", "customCadre1.png", 400, False, "Un cadre orné de runes."),
  ("Pièce", "avatar", "coin.png", 0, True, "L'avatar par défaut."),
  ("Goutte d'eau", "avatar", "waterAvatar.png", 150, False, "Pour les amis de l'Eau."),
  ("Flamme", "avatar", "fireAvatar.png", 150, False, "Pour les amis du Feu."),
  ("Nuage", "avatar", "cloudy.png", 200, False, "Léger comme l'Air."),
  ("Lune", "avatar", "moon.png", 300, False, "Un avatar nocturne."),
]
SVGS_DIR = os.path.join(FRONT_DIR, "src", "assets", "Svgs")
if os.path.isdir(SVGS_DIR):
    svgs = set(os.listdir(SVGS_DIR))
    for it in ITEMS:
        assert it[2] in svgs, it

# --- SQL emit ---
def q(s):
    return "'" + str(s).replace("'", "''") + "'"
def j(o):
    return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"
def arr(lst):
    return "ARRAY[" + ",".join(q(x) for x in lst) + "]::TEXT[]" if lst else "'{}'::TEXT[]"

out = []
w = out.append
w("-- =====================================================================")
w("-- Origins Creation - données de démonstration (idempotent, rejouable)")
w(f"-- {len(name_to_file)} éléments, {len(R)} recettes ({by_arity[2]} à 2, {by_arity[3]} à 3, {by_arity[4]} à 4 éléments), {len(tq_rows)} questions Timer,")
w(f"-- {len(ACH)} succès, {len(ITEMS)} items, {len(regions)} régions. Aucun utilisateur.")
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
    w(f"INSERT INTO achievements_list (name, description, unlocked, condition, image) VALUES ({q(n)}, {q(d)}, FALSE, {q(c)}, {q(n + '.png')})")
    w("ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, image = EXCLUDED.image;")
w("")
w("-- ---------------------------------------------------------------- customization_items")
for n, t, p, price, dflt, d in ITEMS:
    w(f"INSERT INTO customization_items (name, type, image_path, price, is_default, description) VALUES ({q(n)}, {q(t)}, {q(p)}, {price}, {'TRUE' if dflt else 'FALSE'}, {q(d)})")
    w("ON CONFLICT (image_path) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, price = EXCLUDED.price, is_default = EXCLUDED.is_default, description = EXCLUDED.description;")
w("")
w("-- ---------------------------------------------------------------- game_settings")
for k, v, d in [("max_energy", "20", "Énergie maximale en mode Explorer"),
                ("default_energy", "10", "Énergie initiale en mode Explorer (informatif, la route utilise 10 en dur)"),
                ("energy_regen_minutes", "30", "Minutes par point d'énergie régénéré (informatif, 30 en dur)")]:
    w(f"INSERT INTO game_settings (setting_name, value, description) VALUES ({q(k)}, {q(v)}, {q(d)})")
    w("ON CONFLICT (setting_name) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;")
w("")
w("-- ---------------------------------------------------------------- explorer_regions")
w("-- Miroir de src/public/data/regionChallenges.json (initRegions.js les ré-upserte")
w("-- de toute façon au démarrage du serveur, avec les mêmes règles de mapping).")
for r in regions:
    boss = r.get("is_boss", False)
    img = r.get("bossImage") if boss else r.get("background")
    cost = 0 if boss else r.get("energyCost", 2)
    reward = r.get("energyReward", 10 if boss else 5)
    parent = r.get("parent_region_id")
    vals = [str(r["id"]), q(r["name"]), q(r.get("description", "")), q(img) if img else "NULL",
            "TRUE" if r.get("is_default") else "FALSE", str(r.get("required_level") or r["id"]),
            str(parent) if parent else "NULL", arr(r.get("requiredElements", [])), arr(r.get("availableElements", [])),
            str(r.get("position_x") or 50), str(r.get("position_y") or 50), "TRUE" if boss else "FALSE",
            str(cost), str(reward), str(r.get("map_id") or 1)]
    w("INSERT INTO explorer_regions (id, name, description, image_path, is_default, required_level, parent_region_id, required_elements, unlocked_elements, position_x, position_y, is_boss, energy_cost, energy_reward, map_id)")
    w(f"VALUES ({', '.join(vals)})")
    w("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, image_path = EXCLUDED.image_path, is_default = EXCLUDED.is_default, required_level = EXCLUDED.required_level, parent_region_id = EXCLUDED.parent_region_id, required_elements = EXCLUDED.required_elements, unlocked_elements = EXCLUDED.unlocked_elements, position_x = EXCLUDED.position_x, position_y = EXCLUDED.position_y, is_boss = EXCLUDED.is_boss, energy_cost = EXCLUDED.energy_cost, energy_reward = EXCLUDED.energy_reward, map_id = EXCLUDED.map_id;")
w("")
w("COMMIT;")
open(os.path.join(HERE, "seed.sql"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("ok", file=sys.stderr)
