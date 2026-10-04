// Mélanges et aides de tous les modes, décidés par le serveur.
// Le navigateur n'apprend que le résultat d'un mélange qu'il peut faire, et les éléments qu'il possède.
const express = require('express');
const book = require('../../services/recipeBook');
const players = require('../../services/players');
const achievementService = require('../../services/achievementService');
const trial = require('../../services/trial');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const { NAME, PAGE, playLimiter, addressLimiter, guestLimiter, fail, withPlayer } = require('./shared');

const router = express.Router();
router.use(addressLimiter);

const MODES = ['infinite', 'timer'];

router.post('/guest', guestLimiter, async (req, res) => {
    try {
        const owner = (await players.resolve(req)) || (await players.createGuest(res));
        res.json({ kind: owner.kind });
    } catch (error) {
        fail(res, error, 'Création du carnet invité');
    }
});

// Carnet de l'Infini, avec ce qu'il faut pour l'afficher ; les familles ne livrent que leur taille
router.get('/state', playLimiter, withPlayer(async (req, res, owner, b) => {
    const elements = await players.elements(owner);
    res.json({
        kind: owner.kind,
        elements,
        known: book.describe(b, elements),
        families: b.totals,
        unexplored: book.unexplored(b, elements)
    });
}));

// Livre : mélange visé sur une page à portée ; si ce n'est pas elle, combien d'ingrédients sont justes
async function aimOf(owner, b, inHand, page, ingredients, result) {
    const aimed = bookPages.aim(b, inHand, page, ingredients);
    if (!aimed || aimed.name === result) return null;
    const misses = owner.kind === 'user' ? await bookTries.record(owner.id, page, book.keyOf(ingredients)) : null;
    // L'encre offerte ne concerne qu'un compte (un invité n'a pas de compteur d'essais)
    const need = owner.kind === 'user' ? bookPages.difficultyOf(b.meta.get(aimed.name)?.family).freeInkAfter : null;
    return { page, right: aimed.right, of: aimed.of, misses, need, freeInk: need !== null && misses !== null && misses >= need };
}

// Un mélange : les ingrédients doivent être en main ; seul le serveur ajoute le résultat
router.post('/combine', playLimiter, withPlayer(async (req, res, owner, b) => {
    const { mode, ingredients, page } = req.body;
    if (!MODES.includes(mode)) return res.status(400).json({ message: 'Mode invalide' });
    if (!Array.isArray(ingredients) || ingredients.length < 2 || ingredients.length > 4
        || !ingredients.every(i => typeof i === 'string' && NAME.test(i))) {
        return res.status(400).json({ message: 'Mélange invalide' });
    }
    const run = mode === 'infinite' ? null : await players.getRun(owner, mode);
    if (mode !== 'infinite' && !run) return res.status(409).json({ message: 'Aucune partie en cours', code: 'NO_RUN' });
    const inHand = new Set(run ? run.inventory : await players.elements(owner));
    if (!ingredients.every(i => inHand.has(i))) return res.status(403).json({ message: 'Ingrédient absent de ton carnet' });

    const result = book.combine(b, ingredients);
    const aim = mode === 'infinite' && typeof page === 'string' && PAGE.test(page)
        ? await aimOf(owner, b, [...inHand], page, ingredients, result)
        : null;
    if (!result) return res.json(aim ? { result: null, aim } : { result: null });

    const isNew = run ? await players.addToRun(owner, mode, result) : await players.addElement(owner, result);
    const reply = { result, ...book.describe(b, [result])[result], isNew };
    if (aim) reply.aim = aim;
    // Épreuve : le serveur juge la question (réussite, points, progression « 2 / 3 »)
    if (mode === 'timer') reply.trial = await trial.judge(owner, [...run.inventory, result]);
    if (mode === 'infinite' && isNew) {
        reply.unexplored = book.unexplored(b, [...inHand, result]);
        if (owner.kind === 'user') {
            // Page trouvée : ses essais ratés n'ont plus d'usage
            await bookTries.clear(owner.id, bookPages.pageId(result));
            await achievementService.syncAchievements(owner.id);
        }
    }
    res.json(reply);
}));

router.use(require('./book'));
router.use(require('./world'));
router.use(require('./trial'));

module.exports = router;
