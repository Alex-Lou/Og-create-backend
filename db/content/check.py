# Vérifie les recettes : python3 db/content/check.py [module...]
# Sans argument : tous les fichiers recipes_*.py présents.
# Contrôles : noms connus, 2 à 4 ingrédients, clés uniques, résultat != ingrédient,
# atteignabilité depuis Eau/Feu/Terre/Air, éléments jamais produits.
import glob, importlib.util, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from elements import FAMILIES

BASE = ["Eau", "Feu", "Terre", "Air"]
FAMILY_OF = {n: f for f, els in FAMILIES.items() for n in els}


def load(path):
    spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return [(ing, res, os.path.basename(path)) for ing, res in mod.RECIPES]


def key(ing):
    return "+".join(sorted(ing.split("+")))


def closure(rules, start=BASE):
    have = set(start)
    changed = True
    while changed:
        changed = False
        for ing, res, _ in rules:
            if res not in have and all(p in have for p in ing.split("+")):
                have.add(res)
                changed = True
    return have


def main():
    paths = sorted(glob.glob(os.path.join(HERE, "recipes_*.py")))
    focus = [os.path.join(HERE, a if a.endswith(".py") else a + ".py") for a in sys.argv[1:]]
    rules = [r for p in paths for r in load(p)]
    errors = []
    seen = {}
    for ing, res, src in rules:
        parts = ing.split("+")
        if not 2 <= len(parts) <= 4:
            errors.append(f"{src}: {ing} -> {res} : 2 à 4 ingrédients")
        for p in parts + [res]:
            if p not in FAMILY_OF:
                errors.append(f"{src}: nom inconnu « {p} » dans {ing} -> {res}")
        if res in parts:
            errors.append(f"{src}: {ing} -> {res} : le résultat est un ingrédient")
        k = key(ing)
        if k in seen and seen[k][0] != res:
            errors.append(f"{src}: clé {k} -> {res} déjà utilisée ({seen[k][1]} -> {seen[k][0]})")
        elif k in seen:
            errors.append(f"{src}: recette en double {k} -> {res} ({seen[k][1]})")
        seen.setdefault(k, (res, src))
    have = closure(rules)
    produced = {res for _, res, _ in rules}
    unreachable = sorted(set(FAMILY_OF) - have)
    never = sorted(set(FAMILY_OF) - produced - set(BASE))
    scope = {os.path.basename(p) for p in focus} or None
    shown = [e for e in errors if scope is None or e.split(":")[0] in scope]
    print(f"{len(rules)} recettes, {len(FAMILY_OF)} éléments, arités {dict(Counter(len(i.split('+')) for i, _, _ in rules))}")
    print(f"erreurs : {len(shown)}")
    for e in shown[:80]:
        print("  ", e)
    print(f"jamais produits ({len(never)}) : {', '.join(never[:120])}")
    print(f"inatteignables ({len(unreachable)}) : {', '.join(unreachable[:120])}")


if __name__ == "__main__":
    main()
