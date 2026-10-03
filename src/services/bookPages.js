// Le Livre : chapitres et pages du joueur, calculés par le serveur.
// Une page trouvée montre son élément et une recette ; une page à portée ne montre jamais le nom
// de l'élément inconnu : seulement un identifiant opaque, sa famille, sa longueur et un indice de familles.
const crypto = require('crypto');
const { BASE_ELEMENTS } = require('./recipeBook');

// Les 15 familles regroupées en 7 chapitres ; « need » = découvertes requises (hors 4 éléments de base)
const CHAPTERS = [
    { id: 'I', name: 'Les Premiers Souffles', families: ['Elements Fondamentaux', 'Phénomènes Naturels'], need: 0 },
    { id: 'II', name: 'La Matière', families: ['Matériaux', 'Chimie', 'Physique'], need: 0 },
    { id: 'III', name: 'Ciel et Terre', families: ['Cosmos', 'Formations Naturelles'], need: 5 },
    { id: 'IV', name: 'Le Vivant', families: ['Flore', 'Biologie', 'Vie et Créatures'], need: 12 },
    { id: 'V', name: 'Le Foyer', families: ['Corps et Esprit', 'Créations Humaines'], need: 25 },
    { id: 'VI', name: 'Les Âges', families: ['Histoire', 'Technologie'], need: 45 },
    { id: 'VII', name: 'Les Légendes', families: ['Légendes'], need: 70 }
];

// Difficulté de chaque chapitre : leurres du plateau, pages ouvertes à la fois, première lettre,
// ingrédient offert, et essais ratés avant l'encre offerte (0 : l'ingrédient est déjà donné)
const DIFFICULTY = {
    I: { decoys: 2, open: 3, letter: true, given: true, freeInkAfter: 0 },
    II: { decoys: 3, open: 3, letter: true, given: true, freeInkAfter: 0 },
    III: { decoys: 4, open: 3, letter: true, given: false, freeInkAfter: 3 },
    IV: { decoys: 6, open: 3, letter: true, given: false, freeInkAfter: 3 },
    V: { decoys: 8, open: 3, letter: false, given: false, freeInkAfter: 5 },
    VI: { decoys: 10, open: 3, letter: false, given: false, freeInkAfter: 5 },
    VII: { decoys: 12, open: 3, letter: false, given: false, freeInkAfter: 5 }
};
const chapterOf = family => CHAPTERS.find(c => c.families.includes(family)) || CHAPTERS[0];
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

// Ingrédient montré par l'encre (ou offert) : le moins évident de la recette
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

// Première recette faite d'éléments possédés, pour chaque élément (trouvé ou à portée)
function recipesWithin(b, have) {
    const out = new Map();
    for (const [parts, result] of b.entries) {
        if (!out.has(result) && parts.every(p => have.has(p))) out.set(result, parts);
    }
    return out;
}

// misses : essais ratés par page (compte seulement), pour l'encre offerte
function view(b, owned, misses = {}) {
    const have = new Set(owned);
    const within = recipesWithin(b, have);
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
        const open = stars >= chapter.need;
        const rules = DIFFICULTY[chapter.id];
        // Pages à portée ouvertes : les plus proches des éléments premiers d'abord, les autres restent scellées
        const reachable = names.filter(name => !have.has(name) && within.has(name));
        const opened = new Set(reachable
            .sort((x, y) => depth.get(x) - depth.get(y) || pageId(x).localeCompare(pageId(y)))
            .slice(0, rules.open));
        const pages = [];
        let found = 0;
        let far = 0;
        for (const name of names) {
            const info = b.meta.get(name);
            if (have.has(name)) {
                found++;
                pages.push({ id: pageId(name), status: 'found', name, emoji: info.emoji, family: info.family, recipe: BASE_ELEMENTS.includes(name) ? null : within.get(name) || null });
            } else if (opened.has(name)) {
                const parts = within.get(name);
                const id = pageId(name);
                const clue = parts.map(part => b.meta.get(part)?.family).filter(Boolean);
                // groups : même numéro = même ingrédient (Eau + Eau → [0, 0]), sans dire lequel
                const groups = parts.map(part => [...new Set(parts)].indexOf(part));
                pages.push({
                    id, status: 'reach', family: info.family, letters: [...name].length, clue, groups,
                    ...(rules.letter ? { first: [...name][0] } : {}),
                    ...(rules.given ? { given: telling(parts) } : {}),
                    tray: trayOf(b, owned, id, parts, rules.decoys),
                    misses: misses[id] || 0,
                    ...(rules.given ? {} : { freeInkAfter: rules.freeInkAfter })
                });
            } else if (!within.has(name)) {
                far++;
            }
        }
        const sealed = reachable.length - opened.size;
        return { id: chapter.id, name: chapter.name, families: chapter.families, need: chapter.need, open, total: names.length, found, far, sealed, pages: open ? pages : [] };
    });
    return { stars, chapters };
}

// Élément inconnu à portée qui porte cet identifiant de page, ou null
function reachableById(b, owned, id) {
    const have = new Set(owned);
    for (const [parts, result] of b.entries) {
        if (!have.has(result) && parts.every(p => have.has(p)) && pageId(result) === id) return { name: result, parts };
    }
    return null;
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

// Essai visé sur une page à portée : ingrédients justes, comparés à la recette possédée la plus proche
// (même nombre d'ingrédients d'abord). Le nom ne sort pas d'ici sauf pour savoir si la page est trouvée.
function aim(b, owned, id, tried) {
    const have = new Set(owned);
    let best = null;
    for (const [parts, result] of b.entries) {
        if (have.has(result) || !parts.every(p => have.has(p)) || pageId(result) !== id) continue;
        const candidate = { name: result, right: overlap(tried, parts), of: parts.length };
        const fits = c => (c.of === tried.length ? 1 : 0);
        if (!best || fits(candidate) > fits(best) || (fits(candidate) === fits(best) && candidate.right > best.right)) best = candidate;
    }
    return best;
}

module.exports = { CHAPTERS, DIFFICULTY, view, reachableById, pageId, aim, telling, difficultyOf };
