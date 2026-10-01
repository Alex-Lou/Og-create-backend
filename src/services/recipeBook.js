// Livre des recettes : lu une fois en base (game_data), il ne quitte jamais le serveur.
// Le navigateur ne reçoit que le résultat d'un mélange, et les noms des éléments qu'il possède.
const db = require('../config/db');

const BASE_ELEMENTS = ['Eau', 'Feu', 'Terre', 'Air'];

const keyOf = ingredients => [...ingredients].sort().join('+');

let book = null;
let loading = null;

async function read() {
    const { rows } = await db.query('SELECT elements, rules FROM game_data WHERE active = true');
    const recipes = new Map(); // clé triée -> résultat
    const meta = new Map(); // nom -> { emoji, family }
    const totals = {}; // famille -> nombre d'éléments
    for (const row of rows) {
        const families = row.elements?.elements;
        // elements_data garde une liste à plat (ancien format) : seules les familles nommées comptent
        if (families && !Array.isArray(families)) {
            for (const [family, entries] of Object.entries(families)) {
                for (const [rawName, value] of Object.entries(entries)) {
                    const name = rawName.trim();
                    if (meta.has(name)) continue;
                    meta.set(name, { emoji: typeof value === 'string' ? value : (value?.emoji || '❓'), family });
                    totals[family] = (totals[family] || 0) + 1;
                }
            }
        }
        for (const [key, result] of Object.entries(row.rules?.rules || {})) {
            recipes.set(keyOf(key.split('+').map(p => p.trim())), result.trim());
        }
    }
    // Entrées : [ingrédients, résultat], sans doublon
    const entries = [...recipes].map(([key, result]) => [key.split('+'), result]);
    return { recipes, meta, totals, entries };
}

async function load() {
    if (book) return book;
    if (!loading) loading = read().then(value => (book = value)).finally(() => { loading = null; });
    return loading;
}

// Résultat d'un mélange, ou null
function combine(b, ingredients) {
    return b.recipes.get(keyOf(ingredients)) || null;
}

// Nom, emoji et famille de chaque élément connu
function describe(b, names) {
    const out = {};
    for (const name of names) {
        const info = b.meta.get(name);
        if (info) out[name] = info;
    }
    return out;
}

// Éléments inconnus qu'une seule fusion d'éléments possédés suffit à créer
function nearby(b, owned) {
    const have = new Set(owned);
    const found = new Set();
    for (const [parts, result] of b.entries) {
        if (!have.has(result) && parts.every(p => have.has(p))) found.add(result);
    }
    return [...found].sort();
}

// Pour chaque élément possédé : nombre de recettes qui l'utilisent et donnent un élément encore inconnu
function unexplored(b, owned) {
    const have = new Set(owned);
    const count = {};
    for (const [parts, result] of b.entries) {
        if (have.has(result)) continue;
        for (const part of new Set(parts)) {
            if (have.has(part)) count[part] = (count[part] || 0) + 1;
        }
    }
    return count;
}

// Recettes à portée (ingrédients tous possédés) qui donnent cet élément
function origins(b, owned, name) {
    const have = new Set(owned);
    return b.entries
        .filter(([parts, result]) => result === name && parts.every(p => have.has(p)))
        .map(([parts]) => parts);
}

// Prochaine fusion utile vers l'une des cibles : { ingredients, result } ou null
function nextStep(b, owned, targets) {
    const have = new Set(owned);
    // Chaque élément atteignable, avec la première recette qui le donne
    const via = new Map();
    let grew = true;
    while (grew) {
        grew = false;
        for (const [parts, result] of b.entries) {
            if (have.has(result) || via.has(result)) continue;
            if (parts.every(p => have.has(p) || via.has(p))) {
                via.set(result, parts);
                grew = true;
            }
        }
    }
    const target = targets.find(t => via.has(t));
    if (!target) return null;
    // Remonte vers une fusion faisable tout de suite
    let current = target;
    for (;;) {
        const parts = via.get(current);
        const missing = parts.find(p => !have.has(p));
        if (!missing) return { ingredients: parts, result: current };
        current = missing;
    }
}

module.exports = { BASE_ELEMENTS, load, combine, describe, nearby, unexplored, origins, nextStep, keyOf };
