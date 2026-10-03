// Mélanges et aides de tous les modes, décidés par le serveur.
// Le navigateur n'apprend que le résultat d'un mélange qu'il peut faire, et les éléments qu'il possède.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const book = require('../services/recipeBook');
const players = require('../services/players');
const ledger = require('../services/ledger');
const achievementService = require('../services/achievementService');
const trial = require('../services/trial');
const bookPages = require('../services/bookPages');
const world = require('../services/world');
const bookTries = require('../services/bookTries');
const { verifyAccess, readCookie } = require('../services/authSession');
const { log } = require('../utils/logger');

const router = express.Router();

const MODES = ['infinite', 'timer'];
const HELP_PRICE = 50; // piste de l'Infini, encre du Livre et joker payant de l'Épreuve
const JOKER_TIME = 30; // secondes ajoutées par le joker de temps
const MAX_ORIGINS = 3;
const NAME = /^[^\u0000-\u001f]{1,60}$/;
const PAGE = /^[A-Za-z0-9_-]{1,32}$/;


// Limites : par joueur (compte ou cookie invité), et par adresse pour la création de carnets invités
const limiter = (windowMs, max, keyGenerator) => rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { message: 'Doucement ! Réessaie dans un instant.' }
});
const playerKey = req => {
    const user = verifyAccess(req);
    if (user) return `u:${user.id}`;
    return `g:${readCookie(req, 'oc_guest') || req.ip}`;
};
const playLimiter = limiter(60 * 1000, 120, playerKey);
const addressLimiter = limiter(60 * 1000, 600, req => req.ip);
const guestLimiter = limiter(60 * 60 * 1000, 20, req => req.ip);

router.use(addressLimiter);

const fail = (res, error, what) => {
    log('error', what, { errorMessage: error.message });
    res.status(500).json({ message: 'Le serveur de jeu ne répond pas, réessaie.' });
};

// Joueur obligatoire : sans compte ni carnet invité, 401 NO_PLAYER (le front crée alors un carnet)
const withPlayer = handler => async (req, res) => {
    try {
        const owner = await players.resolve(req);
        if (!owner) return res.status(401).json({ message: 'Aucune partie', code: 'NO_PLAYER' });
        await handler(req, res, owner, await book.load());
    } catch (error) {
        fail(res, error, `Jeu ${req.path}`);
    }
};

// Familles : seulement leur taille (les noms des éléments inconnus ne sortent pas)
const familiesOf = b => b.totals;

router.post('/guest', guestLimiter, async (req, res) => {
    try {
        const owner = (await players.resolve(req)) || (await players.createGuest(res));
        res.json({ kind: owner.kind });
    } catch (error) {
        fail(res, error, 'Création du carnet invité');
    }
});

// Carnet de l'Infini, avec ce qu'il faut pour l'afficher
router.get('/state', playLimiter, withPlayer(async (req, res, owner, b) => {
    const elements = await players.elements(owner);
    res.json({
        kind: owner.kind,
        elements,
        known: book.describe(b, elements),
        families: familiesOf(b),
        unexplored: book.unexplored(b, elements),
        // Nombre d'éléments inconnus créables tout de suite (le nombre seul, jamais les noms)
        reachable: book.nearby(b, elements).length
    });
}));

// Le Livre : chapitres et pages ; une page à portée ne révèle jamais le nom de l'élément inconnu
router.get('/book', playLimiter, withPlayer(async (req, res, owner, b) => {
    const misses = owner.kind === 'user' ? await bookTries.missesByPage(owner.id) : {};
    res.json(bookPages.view(b, await players.elements(owner), misses));
}));

// Le Monde : l'île du joueur (compte requis : ses écus sont gardés par le serveur)
const ACCOUNT_ONLY = { message: 'Ton île t’attend : crée un compte pour la bâtir.', code: 'ACCOUNT' };
async function worldView(owner, b) {
    const owned = await players.elements(owner);
    return world.view(owner.id, owned.length - book.BASE_ELEMENTS.length, names => book.describe(b, names));
}
router.get('/world', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (owner.kind !== 'user') return res.status(402).json(ACCOUNT_ONLY);
    res.json(await worldView(owner, b));
}));
router.post('/world/place', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (owner.kind !== 'user') return res.status(402).json(ACCOUNT_ONLY);
    const { element } = req.body;
    if (typeof element !== 'string' || !NAME.test(element)) return res.status(400).json({ message: 'Élément invalide' });
    const placed = await world.place(owner.id, await players.elements(owner), element, Number(req.body.x), Number(req.body.y));
    if (placed.status) return res.status(placed.status).json({ message: placed.message });
    res.json(await worldView(owner, b));
}));
router.post('/world/remove', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (owner.kind !== 'user') return res.status(402).json(ACCOUNT_ONLY);
    const x = Number(req.body.x), y = Number(req.body.y);
    if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < 32)) return res.status(400).json({ message: 'Case invalide' });
    await world.remove(owner.id, x, y);
    res.json(await worldView(owner, b));
}));
router.post('/world/collect', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (owner.kind !== 'user') return res.status(402).json(ACCOUNT_ONLY);
    const { gained, coins } = await world.collect(owner.id);
    res.json({ gained, coins, world: await worldView(owner, b) });
}));

// Début d'une question de l'Épreuve (services/trial.js) : les éléments en main
router.post('/run', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (req.body.mode !== 'timer') return res.status(400).json({ message: 'Mode invalide' });
    const questionId = Number(req.body.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) return res.status(400).json({ message: 'Question invalide' });
    const q = await trial.question(questionId);
    if (!q) return res.status(404).json({ message: 'Question inconnue' });
    const started = await trial.start(owner, q, req.body.launch === true);
    res.json({ elements: started.inventory, known: book.describe(b, started.inventory), freeJokers: started.freeJokers, required: started.required });
}));

// Un mélange : les ingrédients doivent être en main ; seul le serveur ajoute le résultat
router.post('/combine', playLimiter, withPlayer(async (req, res, owner, b) => {
    const { mode, ingredients } = req.body;
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
    // Livre : mélange visé sur une page à portée ; si ce n'est pas elle, combien d'ingrédients sont justes
    let aim = null;
    const page = req.body.page;
    if (mode === 'infinite' && typeof page === 'string' && PAGE.test(page)) {
        const aimed = bookPages.aim(b, [...inHand], page, ingredients);
        if (aimed && aimed.name !== result) {
            const misses = owner.kind === 'user' ? await bookTries.record(owner.id, page, book.keyOf(ingredients)) : null;
            // Premiers chapitres : l'ingrédient est déjà offert, l'encre n'entre pas en jeu
            const rules = bookPages.difficultyOf(b.meta.get(aimed.name)?.family);
            const need = rules.given ? null : rules.freeInkAfter;
            aim = { page, right: aimed.right, of: aimed.of, misses, need, freeInk: need !== null && misses !== null && misses >= need };
        }
    }
    if (!result) return res.json(aim ? { result: null, aim } : { result: null });

    const isNew = run ? await players.addToRun(owner, mode, result) : await players.addElement(owner, result);
    const reply = { result, ...book.describe(b, [result])[result], isNew };
    if (aim) reply.aim = aim;
    // Page trouvée : ses essais ratés n'ont plus d'usage
    if (mode === 'infinite' && isNew && owner.kind === 'user') await bookTries.clear(owner.id, bookPages.pageId(result));
    // Épreuve : le serveur juge la question (réussite, points, progression « 2 / 3 »)
    if (mode === 'timer') reply.trial = await trial.judge(owner, [...run.inventory, result]);
    if (mode === 'infinite' && isNew) {
        reply.unexplored = book.unexplored(b, [...inHand, result]);
        reply.reachable = book.nearby(b, [...inHand, result]).length;
        if (owner.kind === 'user') await achievementService.syncAchievements(owner.id);
    }
    res.json(reply);
}));

// Fiche d'un élément du carnet : les recettes à portée qui le donnent
router.get('/origins', playLimiter, withPlayer(async (req, res, owner, b) => {
    const name = String(req.query.name || '');
    const elements = await players.elements(owner);
    if (!elements.includes(name)) return res.status(404).json({ message: 'Élément inconnu' });
    const all = book.origins(b, elements, name);
    res.json({ origins: all.slice(0, MAX_ORIGINS), more: Math.max(0, all.length - MAX_ORIGINS) });
}));

// Débit d'une aide : compte seulement (les écus d'un invité n'existent pas côté serveur)
async function pay(owner, reason) {
    if (owner.kind !== 'user') return { status: 402, message: 'Les aides payantes demandent un compte.' };
    const coins = await ledger.debit(owner.id, HELP_PRICE, reason);
    if (coins === null) return { status: 400, message: `Il te faut ${HELP_PRICE} écus.` };
    return { coins };
}

// Piste de l'Infini : le nom d'un élément inconnu à une seule fusion
router.post('/hint', playLimiter, withPlayer(async (req, res, owner, b) => {
    const near = book.nearby(b, await players.elements(owner));
    if (!near.length) return res.status(409).json({ message: 'Aucune piste : il te faut d’abord de nouveaux éléments.' });
    const paid = await pay(owner, 'piste');
    if (paid.status) return res.status(paid.status).json({ message: paid.message });
    res.json({ name: near[Math.floor(Math.random() * near.length)], coins: paid.coins });
}));

// Encre du Livre : révèle un ingrédient (déjà possédé) d'une page à portée ;
// offerte d'emblée dans les premiers chapitres (l'ingrédient y est déjà donné),
// ailleurs après quelques mélanges ratés différents sur cette page (barème du chapitre)
router.post('/ink', playLimiter, withPlayer(async (req, res, owner, b) => {
    const id = String(req.body.page || '');
    if (!PAGE.test(id)) return res.status(400).json({ message: 'Page invalide' });
    const target = bookPages.reachableById(b, await players.elements(owner), id);
    if (!target) return res.status(404).json({ message: 'Cette page n’est pas à portée.' });
    const rules = bookPages.difficultyOf(b.meta.get(target.name)?.family);
    const free = owner.kind === 'user' && (rules.given || await bookTries.misses(owner.id, id) >= rules.freeInkAfter);
    const paid = free ? { coins: await ledger.balance(owner.id) } : await pay(owner, 'encre');
    if (paid.status) return res.status(paid.status).json({ message: paid.message });
    res.json({ page: id, ingredient: bookPages.telling(target.parts), coins: paid.coins, free });
}));

// Joker de l'Épreuve : une étape, un ingrédient, ou du temps ; offert s'il en reste, sinon payé
router.post('/joker', playLimiter, withPlayer(async (req, res, owner, b) => {
    const { kind } = req.body;
    if (!['step', 'ingredient', 'time'].includes(kind)) return res.status(400).json({ message: 'Joker inconnu' });
    const run = await players.getRun(owner, 'timer');
    if (!run) return res.status(409).json({ message: 'Aucune épreuve en cours', code: 'NO_RUN' });

    let step = null;
    if (kind !== 'time') {
        const { rows } = await db.query('SELECT valid_answers FROM timer_questions WHERE id = $1', [Number(run.context)]);
        step = book.nextStep(b, run.inventory, rows[0]?.valid_answers || []);
        if (!step) return res.status(409).json({ message: 'Aucune étape à révéler.' });
    }

    const reply = {};
    const free = await players.takeFreeJoker(owner);
    if (free === null) {
        const paid = await pay(owner, 'joker');
        if (paid.status) return res.status(paid.status).json({ message: paid.message });
        reply.coins = paid.coins;
        reply.freeJokers = 0;
    } else {
        reply.freeJokers = free;
    }
    if (kind === 'time') await trial.addTime(owner, JOKER_TIME);
    if (kind === 'step') reply.ingredients = step.ingredients;
    if (kind === 'ingredient') reply.ingredient = step.ingredients.find(p => !book.BASE_ELEMENTS.includes(p)) || step.ingredients[0];
    res.json(reply);
}));

// Fin du sablier : score compté par le serveur, bonus de record versé s'il monte
router.post('/timer/finish', playLimiter, withPlayer(async (req, res, owner) => {
    res.json(await trial.finish(owner));
}));

module.exports = router;
