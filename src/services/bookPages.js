// Le Livre : chapitres et pages du joueur, calculés par le serveur.
// Une page trouvée montre son élément et une recette ; une page à portée ne montre jamais le nom
// de l'élément inconnu : seulement un identifiant opaque, sa famille, sa longueur, son énigme et un indice de familles.
const crypto = require('crypto');
const { BASE_ELEMENTS } = require('./recipeBook');
const hangman = require('./hangman');

// Les 15 familles regroupées en 7 chapitres ; « need » = découvertes requises (hors 4 éléments de base),
// « verse » = la phrase de la page de garde du chapitre. Le chapitre II s'ouvre à 3 découvertes (bible, D4), sauf pour
// un joueur d'avant la bible : il l'avait ouvert d'emblée et le garde (needOf)
const CHAPTERS = [
    { id: 'I', name: 'Les Premiers Souffles', families: ['Elements Fondamentaux', 'Phénomènes Naturels'], need: 0, verse: 'Au commencement, quatre souffles et une étincelle de curiosité.' },
    { id: 'II', name: 'La Matière', families: ['Matériaux', 'Chimie', 'Physique'], need: 3, verse: 'Ce qui se pétrit, se fond, se forge : le monde a des mains.' },
    { id: 'III', name: 'Ciel et Terre', families: ['Cosmos', 'Formations Naturelles'], need: 5, verse: 'Lève les yeux vers les astres, puis baisse-les vers les montagnes.' },
    { id: 'IV', name: 'Le Vivant', families: ['Flore', 'Biologie', 'Vie et Créatures'], need: 12, verse: 'Une graine, un souffle, un battement : tout ce qui pousse et respire.' },
    { id: 'V', name: 'Le Foyer', families: ['Corps et Esprit', 'Créations Humaines'], need: 25, verse: 'Autour du feu, l’humain invente, rêve et bâtit sa maison.' },
    { id: 'VI', name: 'Les Âges', families: ['Histoire', 'Technologie'], need: 45, verse: 'Des silex aux étoiles : les siècles tournent leurs pages.' },
    { id: 'VII', name: 'Les Légendes', families: ['Légendes'], need: 70, verse: 'Ici s’écrit ce que nul n’a vu, et que tout le monde connaît.' }
];

// Difficulté de chaque chapitre : leurres du plateau, pages ouvertes à la fois, première lettre,
// essais ratés avant l'encre offerte, et nombre d'ingrédients visé pour la recette de la page
const DIFFICULTY = {
    I: { decoys: 2, open: 3, letter: true, freeInkAfter: 3, size: 2 },
    II: { decoys: 3, open: 3, letter: true, freeInkAfter: 3, size: 2 },
    III: { decoys: 4, open: 3, letter: true, freeInkAfter: 3, size: 3 },
    IV: { decoys: 6, open: 3, letter: true, freeInkAfter: 3, size: 3 },
    V: { decoys: 8, open: 3, letter: false, freeInkAfter: 5, size: 4 },
    VI: { decoys: 10, open: 3, letter: false, freeInkAfter: 5, size: 4 },
    VII: { decoys: 12, open: 3, letter: false, freeInkAfter: 5, size: 4 }
};
const chapterOf = family => CHAPTERS.find(c => c.families.includes(family)) || CHAPTERS[0];
// Découvertes qui ouvrent ce chapitre pour ce joueur (veteran : compte d'avant la bible, players.isVeteran)
const needOf = (chapter, veteran) => (veteran && chapter.id === 'II' ? 0 : chapter.need);
const difficultyOf = family => DIFFICULTY[chapterOf(family).id];

const hmac = text => crypto.createHmac('sha256', process.env.JWT_SECRET || 'og-create-book').update(text);

// Identifiant stable d'une page, qui ne laisse pas retrouver le nom de l'élément
function pageId(name) {
    return hmac(name).digest('base64url').slice(0, 14);
}
// Ordre stable mais imprévisible d'un élément pour une page (plateau, choix des leurres)
const rank = (id, name) => hmac(`${id}|${name}`).digest('hex').slice(0, 12);

// Profondeur : nombre de mélanges qui séparent un élément des éléments premiers (calculée une fois par livre)
const depths = new WeakMap();
function depthOf(b) {
    if (depths.has(b)) return depths.get(b);
    const depth = new Map(BASE_ELEMENTS.map(name => [name, 0]));
    let changed = true;
    while (changed) {
        changed = false;
        for (const [parts, result] of b.entries) {
            if (!parts.every(p => depth.has(p))) continue;
            const value = Math.max(...parts.map(p => depth.get(p))) + 1;
            if (!depth.has(result) || value < depth.get(result)) {
                depth.set(result, value);
                changed = true;
            }
        }
    }
    depths.set(b, depth);
    return depth;
}

// Ingrédient montré par l'encre : le moins évident de la recette
const telling = parts => parts.find(p => !BASE_ELEMENTS.includes(p)) || parts[0];

// Plateau d'une page : les bons ingrédients mêlés à des leurres possédés, des mêmes familles d'abord
function trayOf(b, owned, id, parts, decoys) {
    const right = [...new Set(parts)];
    const families = new Set(parts.map(p => b.meta.get(p)?.family));
    const pool = owned
        .filter(name => !right.includes(name) && b.meta.has(name))
        .sort((x, y) => (families.has(b.meta.get(x).family) ? 0 : 1) - (families.has(b.meta.get(y).family) ? 0 : 1)
            || rank(id, x).localeCompare(rank(id, y)));
    return [...right, ...pool.slice(0, decoys)].sort((x, y) => rank(id, x).localeCompare(rank(id, y)));
}

// Recettes faites d'éléments possédés, pour chaque élément (trouvé ou à portée), dans l'ordre du contenu
function recipesWithin(b, have) {
    const out = new Map();
    for (const [parts, result] of b.entries) {
        if (parts.every(p => have.has(p))) out.set(result, [...(out.get(result) || []), parts]);
    }
    return out;
}

// Emplacements de l'Athanor du joueur, comme à l'écran (front utils/eras.js) : 2, un 3e à 3 familles, un 4e à 4
function slotsFor(b, owned) {
    const families = new Set(owned.map(name => b.meta.get(name)?.family).filter(Boolean)).size;
    return families >= 4 ? 4 : families >= 3 ? 3 : 2;
}

// Recette d'une page : la plus proche du nombre d'ingrédients visé par le chapitre, sans dépasser
// les emplacements du joueur (à égalité, la première du contenu) ; null si aucune ne tient dans l'Athanor
function pageRecipe(recipes, size, slots) {
    const want = Math.min(size, slots);
    return recipes
        .filter(parts => parts.length <= slots)
        .reduce((best, parts) => (!best || Math.abs(parts.length - want) < Math.abs(best.length - want) ? parts : best), null);
}

// Fil d'Ariane (bible, § 6.1) : le chemin de recettes le plus court des éléments possédés vers une cible. Recherche
// par générations : un élément naît à la génération qui suit la plus tardive de ses ingrédients ; d'abord avec les
// seules recettes qui tiennent dans l'Athanor du joueur (les emplacements ne font que grandir), sinon avec toutes.
// targets : les cibles (une bête au choix : plusieurs) ; la plus proche l'emporte. { target, next, remaining } :
// next = la première page manquante dont les ingrédients sont tous possédés (la page marquée), remaining = les pages
// qui restent jusqu'à la cible (elle comprise) ; null si toutes sont possédées ou hors d'atteinte. Rien n'est stocké.
function arianeOf(b, owned, targets) {
    const have = new Set(owned);
    const wanted = targets.filter(name => !have.has(name) && b.meta.has(name));
    if (!wanted.length) return null;
    const search = max => {
        const depth = new Map([...have].map(name => [name, 0]));
        const via = new Map();
        for (let d = 1; !wanted.some(name => depth.has(name)); d++) {
            const born = [];
            for (const [parts, result] of b.entries) {
                if (!depth.has(result) && parts.length <= max && parts.every(p => depth.has(p) && depth.get(p) < d)) born.push([result, parts]);
            }
            if (!born.length) return null;
            for (const [result, parts] of born) {
                if (!depth.has(result)) {
                    depth.set(result, d);
                    via.set(result, parts);
                }
            }
        }
        // Les pages manquantes, dans l'ordre où on les écrit (les ingrédients d'abord)
        const chainOf = target => {
            const order = [];
            const seen = new Set();
            const visit = name => {
                if (seen.has(name) || have.has(name)) return;
                seen.add(name);
                via.get(name).forEach(visit);
                order.push(name);
            };
            visit(target);
            return order;
        };
        const best = wanted.filter(name => depth.has(name)).map(target => ({ target, chain: chainOf(target) }))
            .sort((x, y) => x.chain.length - y.chain.length)[0];
        return { target: best.target, next: best.chain[0], remaining: best.chain.length };
    };
    return search(slotsFor(b, owned)) || search(Infinity);
}

// misses : essais ratés par page (compte seulement), pour l'encre offerte ; letters : parties de pendu par page ;
// veteran : compte d'avant la bible (le chapitre II lui reste ouvert d'emblée) ; ariane : le fil d'Ariane (arianeOf)
// ou null. La page marquée s'ajoute aux pages ouvertes de son chapitre, même scellé ; elle ne dit rien de plus
// qu'une autre page
function view(b, owned, misses = {}, letters = {}, veteran = false, ariane = null) {
    const have = new Set(owned);
    const within = recipesWithin(b, have);
    const slots = slotsFor(b, owned);
    const depth = depthOf(b);
    const stars = owned.filter(name => !BASE_ELEMENTS.includes(name) && b.meta.has(name)).length;
    // Éléments de chaque famille, dans l'ordre du contenu
    const byFamily = new Map();
    for (const [name, info] of b.meta) {
        if (!byFamily.has(info.family)) byFamily.set(info.family, []);
        byFamily.get(info.family).push(name);
    }
    const chapters = CHAPTERS.map(chapter => {
        const names = chapter.families.flatMap(family => byFamily.get(family) || []);
        const need = needOf(chapter, veteran);
        const open = stars >= need;
        const rules = DIFFICULTY[chapter.id];
        const recipeOf = new Map(names
            .filter(name => !have.has(name) && within.has(name))
            .map(name => [name, pageRecipe(within.get(name), rules.size, slots)])
            .filter(([, parts]) => parts));
        // Pages à portée ouvertes : les plus proches des éléments premiers d'abord, les autres restent scellées
        const reachable = [...recipeOf.keys()];
        const opened = new Set(reachable
            .sort((x, y) => depth.get(x) - depth.get(y) || pageId(x).localeCompare(pageId(y)))
            .slice(0, rules.open));
        const marked = ariane && recipeOf.has(ariane.next) ? ariane.next : null;
        if (marked) opened.add(marked);
        const pages = [];
        let found = 0;
        let far = 0;
        for (const name of names) {
            const info = b.meta.get(name);
            if (have.has(name)) {
                found++;
                pages.push({
                    id: pageId(name), status: 'found', name, emoji: info.emoji, family: info.family,
                    recipe: BASE_ELEMENTS.includes(name) ? null : within.get(name)?.[0] || null,
                    // L'énigme reste sur la page une fois l'élément trouvé
                    ...(info.riddle ? { riddle: info.riddle } : {})
                });
            } else if (opened.has(name)) {
                const parts = recipeOf.get(name);
                const id = pageId(name);
                const clue = parts.map(part => b.meta.get(part)?.family).filter(Boolean);
                // groups : même numéro = même ingrédient (Eau + Eau → [0, 0]), sans dire lequel
                const groups = parts.map(part => [...new Set(parts)].indexOf(part));
                pages.push({
                    id, status: 'reach', family: info.family, letters: [...name].length, clue, groups, ...(name === marked ? { marked: true } : {}),
                    ...(info.riddle ? { riddle: info.riddle } : {}),
                    ...(rules.letter ? { first: [...name][0] } : {}),
                    tray: trayOf(b, owned, id, parts, rules.decoys),
                    misses: misses[id] || 0,
                    freeInkAfter: rules.freeInkAfter,
                    hangman: hangman.state(name, letters[id], hangman.maxMisses(chapter.id), rules.letter, info.emoji)
                });
            } else if (!recipeOf.has(name)) {
                far++;
            }
        }
        const sealed = reachable.length - opened.size;
        return { id: chapter.id, name: chapter.name, verse: chapter.verse, families: chapter.families, need, open, total: names.length, found, far, sealed, pages: open ? pages : pages.filter(p => p.marked) };
    });
    // Le ruban du fil d'Ariane : la cible (déjà nommée par la quête), les pages qui restent, la page marquée
    const marked = ariane && chapters.flatMap(c => c.pages).find(p => p.marked);
    return { stars, chapters, ariane: marked ? { target: ariane.target, remaining: ariane.remaining, page: marked.id, chapter: chapterOf(b.meta.get(ariane.next).family).id } : null };
}

// Élément inconnu à portée qui porte cet identifiant de page, avec la recette que montre sa page, ou null
function reachableById(b, owned, id) {
    const have = new Set(owned);
    let name = null;
    const recipes = [];
    for (const [parts, result] of b.entries) {
        if (!have.has(result) && parts.every(p => have.has(p)) && pageId(result) === id) {
            name = result;
            recipes.push(parts);
        }
    }
    const parts = name && pageRecipe(recipes, difficultyOf(b.meta.get(name)?.family).size, slotsFor(b, owned));
    return parts ? { name, parts } : null;
}

// Ingrédients communs à deux mélanges (Eau + Eau contre Eau + Air : 1)
function overlap(tried, parts) {
    const left = [...parts];
    let count = 0;
    for (const part of tried) {
        const at = left.indexOf(part);
        if (at >= 0) {
            left.splice(at, 1);
            count++;
        }
    }
    return count;
}

// Essai visé sur une page à portée : ingrédients justes, comparés à la recette que montre la page.
// Le nom ne sort pas d'ici sauf pour savoir si la page est trouvée.
function aim(b, owned, id, tried) {
    const target = reachableById(b, owned, id);
    return target && { name: target.name, right: overlap(tried, target.parts), of: target.parts.length };
}

// Savoir d'un maître (bible, § 6.4) : un indice sur une page à portée de son Art (families), ouverte ou marquée, la
// marquée d'abord. strong (assez de cœurs) : l'ingrédient que l'Encre révélerait ; sinon la famille de cet ingrédient,
// sur une page à énigme pas encore essayée (ailleurs, les familles sont déjà écrites sur la page). known : pages dont
// l'appareil a déjà un ingrédient ; heard : pages dont il a déjà une famille. Rien n'est gardé ici.
// { page, chapter, ingredient } ou { page, chapter, family }, ou null (aucune page de son Art à portée)
function savoir(b, owned, families, { strong = false, known = [], heard = [], misses = {}, veteran = false, ariane = null } = {}) {
    const skip = new Set(strong ? known : [...known, ...heard]);
    const pages = view(b, owned, misses, {}, veteran, ariane).chapters
        .flatMap(chapter => chapter.pages.map(page => ({ ...page, chapter: chapter.id })))
        .filter(page => page.status === 'reach' && families.includes(page.family) && !skip.has(page.id) && (strong || (page.riddle && !page.misses)));
    const page = pages.find(p => p.marked) || pages[0];
    if (!page) return null;
    const ingredient = telling(reachableById(b, owned, page.id).parts);
    return strong ? { page: page.id, chapter: page.chapter, ingredient } : { page: page.id, chapter: page.chapter, family: b.meta.get(ingredient)?.family || null };
}

// Chapitres ouverts pour ces éléments possédés (découvertes hors éléments de base ≥ « need »)
// Découvertes inscrites au Livre (les éléments de base n'en sont pas)
const starsOf = (b, owned) => owned.filter(name => !BASE_ELEMENTS.includes(name) && b.meta.has(name)).length;

function openChapters(b, owned, veteran = false) {
    const stars = starsOf(b, owned);
    return new Set(CHAPTERS.filter(c => stars >= needOf(c, veteran)).map(c => c.id));
}
// Chapitres dont toutes les pages sont trouvées (créations d'île, lot 8)
function finishedChapters(b, owned) {
    const have = new Set(owned);
    const byFamily = new Map();
    for (const [name, info] of b.meta) {
        if (!byFamily.has(info.family)) byFamily.set(info.family, []);
        byFamily.get(info.family).push(name);
    }
    return new Set(CHAPTERS.filter(c => {
        const names = c.families.flatMap(family => byFamily.get(family) || []);
        return names.length > 0 && names.every(name => have.has(name));
    }).map(c => c.id));
}

module.exports = { DIFFICULTY, view, arianeOf, reachableById, pageId, aim, telling, savoir, difficultyOf, chapterOf, openChapters, finishedChapters, starsOf };
