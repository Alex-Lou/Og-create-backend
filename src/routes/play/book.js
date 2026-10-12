// Le Livre : chapitres et pages (services/bookPages.js), et l'encre qui révèle un ingrédient.
const express = require('express');
const players = require('../../services/players');
const ledger = require('../../services/ledger');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const bookLetters = require('../../services/bookLetters');
const world = require('../../services/world');
const hangman = require('../../services/hangman');
const book = require('../../services/recipeBook');
const { PAGE, playLimiter, withPlayer, payOnce, discovered } = require('./shared');

const router = express.Router();

// Une page à portée ne révèle jamais le nom de l'élément inconnu
router.get('/book', playLimiter, withPlayer(async (req, res, owner, common) => {
    // (le livre du joueur : ses emplacements d'Athanor, qui ont pu grandir avec l'histoire)
    const b = await world.bookFor(owner, common);
    const misses = owner.kind === 'user' ? await bookTries.missesByPage(owner.id) : {};
    const owned = await players.elements(owner);
    // Le fil d'Ariane suit ce que le joueur a choisi de suivre depuis un verrou de l'île (follow : un élément du livre,
    // pas encore écrit ; choix de l'auteur, 12 oct.), sinon la quête active de l'île (compte seulement)
    const wanted = typeof req.query.follow === 'string' && req.query.follow.length <= 60 ? req.query.follow : '';
    const follow = owner.kind === 'user' && wanted && b.meta.has(wanted) && !owned.includes(wanted)
        ? bookPages.arianeOf(b, owned, [wanted]) : null;
    const ariane = follow || (owner.kind === 'user' ? bookPages.arianeOf(b, owned, await world.arianeTargets(owner.id)) : null);
    // (la recette que dit la quête, sur la page marquée ; rien pour ce qu'on suit soi-même)
    if (ariane) ariane.hint = follow ? null : await world.elementHintOf(owner.id);
    if (follow) follow.followed = true;
    // Pages où l'Encre a déjà servi : leur ingrédient se revoit sur tout appareil
    const inked = owner.kind === 'user' ? await ledger.refsOf(owner.id, 'encre') : new Set();
    // (la page guidée du tutoriel, sans leurre, Encre offerte : seulement sur le ruban de la quête)
    const guided = !follow && owner.kind === 'user' && await world.guidedPageOf(owner.id);
    const ink = !follow && owner.kind === 'user' && await world.guidedInkOf(owner.id);
    res.json({ ...bookPages.view(b, owned, misses, await bookLetters.byPage(owner), ariane, inked, guided, ink), athanor: bookPages.slotsFor(b, owned) });
}));

// Encre : révèle un ingrédient (déjà possédé) d'une page à portée ; offerte à un compte
// après quelques mélanges ratés différents sur cette page, ou sur la page que marque le ruban pendant une quête du
// tutoriel au Grimoire (quests.GUIDED_INK), payée sinon. Retenue au grand livre (référence : la page) :
// elle se revoit sur tout appareil et ne se paie qu'une fois
router.post('/ink', playLimiter, withPlayer(async (req, res, owner, common) => {
    const b = await world.bookFor(owner, common);
    const id = String(req.body.page || '');
    if (!PAGE.test(id)) return res.status(400).json({ message: 'Page invalide' });
    const owned = await players.elements(owner);
    const target = bookPages.reachableById(b, owned, id);
    if (!target) return res.status(404).json({ message: 'Cette page n’est pas à portée.' });
    const rules = bookPages.difficultyOf(b.meta.get(target.name)?.family);
    const guided = owner.kind === 'user' && await world.guidedInkOf(owner.id)
        && bookPages.arianeOf(b, owned, await world.arianeTargets(owner.id))?.next === target.name;
    const free = owner.kind === 'user' && (guided || await bookTries.misses(owner.id, id) >= rules.freeInkAfter);
    const paid = free ? await ledger.credit(owner.id, 0, 'encre', id) : await payOnce(owner, 'encre', id);
    if (paid.status) return res.status(paid.status).json({ message: paid.message });
    res.json({ page: id, ingredient: bookPages.telling(target.parts), coins: paid.coins, free });
}));

// Pendu : la page visée, ses règles (erreurs permises, première lettre donnée) et l'état à renvoyer
async function letterTarget(req, res, owner, common) {
    const b = await world.bookFor(owner, common);
    const id = String(req.body.page || '');
    if (!PAGE.test(id)) return res.status(400).json({ message: 'Page invalide' }) && null;
    const target = bookPages.reachableById(b, await players.elements(owner), id);
    if (!target) return res.status(404).json({ message: 'Cette page n’est pas à portée.' }) && null;
    const info = b.meta.get(target.name);
    const max = hangman.maxMisses(bookPages.chapterOf(info.family).id);
    const first = bookPages.difficultyOf(info.family).letter;
    return { id, name: target.name, max, first, view: row => hangman.state(target.name, row, max, first, info.emoji) };
}

// Pendu : une lettre posée dans une case du nom d'une page à portée ; le serveur seul connaît le mot.
// Mot complet : l'élément est inscrit au carnet, comme après un mélange.
router.post('/letter', playLimiter, withPlayer(async (req, res, owner, b) => {
    const letter = String(req.body.letter || '').toUpperCase();
    const position = Number(req.body.position);
    if (!/^[A-Z]$/.test(letter)) return res.status(400).json({ message: 'Lettre invalide' });
    const target = await letterTarget(req, res, owner, b);
    if (!target) return;
    if (!Number.isInteger(position) || position < 0 || position >= [...target.name].length || !hangman.fold([...target.name][position])) {
        return res.status(400).json({ message: 'Case invalide' });
    }
    const played = await bookLetters.guess(owner, target.id, target.name, position, letter, target.max, target.first);
    if (played.invalid) return res.status(409).json({ message: 'Cette case est déjà remplie.' });
    if (played.blocked) return res.status(409).json({ message: 'Partie perdue : reviens demain, ou rejoue contre des écus.', page: target.id, hangman: target.view(played.blocked) });
    const reply = { page: target.id, verdict: played.verdict, hangman: target.view(played.row) };
    if (played.solved) {
        const owned = await players.elements(owner);
        const isNew = await players.addElement(owner, target.name);
        reply.inscribed = { result: target.name, ...book.describe(b, [target.name])[target.name], isNew, unexplored: await discovered(owner, b, owned, target.name) };
    }
    res.json(reply);
}));

// Pendu : rejouer tout de suite une partie perdue, contre des écus (compte)
router.post('/letter/retry', playLimiter, withPlayer(async (req, res, owner, b) => {
    if (owner.kind !== 'user') return res.status(402).json({ message: 'Rejouer contre des écus demande un compte.' });
    const target = await letterTarget(req, res, owner, b);
    if (!target) return;
    const done = await bookLetters.retry(owner, target.id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ page: target.id, coins: done.coins, hangman: target.view(done.row) });
}));

module.exports = router;
