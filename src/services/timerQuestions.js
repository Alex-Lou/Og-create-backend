// Questions de l'Épreuve rangées par niveau puis chapitre, sans les réponses (services/trial.js les garde).
// Lues en base au plus une fois toutes les 5 minutes.
const db = require('../config/db');

const CACHE_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;

async function read() {
    const { rows } = await db.query(
        'SELECT id, level, timer, category, question_text, points, initial_elements FROM timer_questions ORDER BY level, category');
    const levels = {};
    for (const row of rows) {
        const level = (levels[row.level] = levels[row.level] || { timer: row.timer, categories: {} });
        level.timer = row.timer;
        const chapter = (level.categories[row.category] = level.categories[row.category] || { questions: [] });
        const initial = row.initial_elements || {};
        chapter.questions.push({
            id: row.id,
            text: row.question_text,
            points: row.points,
            // Éléments de départ et mode de validation seulement
            initialElements: {
                validationMode: initial.validationMode || 'any',
                requiredCount: initial.requiredCount,
                required: initial.required || [],
                additional: initial.additional || []
            }
        });
    }
    return { levels };
}

async function all() {
    if (!cached || Date.now() - cachedAt >= CACHE_MS) {
        cached = await read();
        cachedAt = Date.now();
    }
    return cached;
}

module.exports = { all };
