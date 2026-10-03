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

// Identifiant stable d'une page, qui ne laisse pas retrouver le nom de l'élément
function pageId(name) {
    return crypto.createHmac('sha256', process.env.JWT_SECRET || 'og-create-book').update(name).digest('base64url').slice(0, 14);
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
        const pages = [];
        let found = 0;
        let far = 0;
        for (const name of names) {
            const info = b.meta.get(name);
            if (have.has(name)) {
                found++;
                pages.push({ id: pageId(name), status: 'found', name, emoji: info.emoji, family: info.family, recipe: BASE_ELEMENTS.includes(name) ? null : within.get(name) || null });
            } else if (within.has(name)) {
                const parts = within.get(name);
                const id = pageId(name);
                const clue = parts.map(part => b.meta.get(part)?.family).filter(Boolean);
                // groups : même numéro = même ingrédient (Eau + Eau → [0, 0]), sans dire lequel
                const groups = parts.map(part => [...new Set(parts)].indexOf(part));
                pages.push({ id, status: 'reach', family: info.family, letters: [...name].length, first: [...name][0], clue, groups, misses: misses[id] || 0 });
            } else {
                far++;
            }
        }
        return { id: chapter.id, name: chapter.name, families: chapter.families, need: chapter.need, open, total: names.length, found, far, pages: open ? pages : [] };
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

module.exports = { CHAPTERS, view, reachableById, pageId, aim };
