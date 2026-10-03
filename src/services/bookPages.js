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

function view(b, owned) {
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
                const clue = within.get(name).map(part => b.meta.get(part)?.family).filter(Boolean);
                pages.push({ id: pageId(name), status: 'reach', family: info.family, letters: [...name].length, clue });
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

module.exports = { CHAPTERS, view, reachableById, pageId };
