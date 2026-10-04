// Le Livre : chapitres et pages (services/bookPages.js), et l'encre qui révèle un ingrédient.
const express = require('express');
const players = require('../../services/players');
const ledger = require('../../services/ledger');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const bookLetters = require('../../services/bookLetters');
const hangman = require('../../services/hangman');
const { PAGE, playLimiter, withPlayer, pay } = require('./shared');

const router = express.Router();

// Une page à portée ne révèle jamais le nom de l'élément inconnu
router.get('/book', playLimiter, withPlayer(async (req, res, owner, b) => {
    const misses = owner.kind === 'user' ? await bookTries.missesByPage(owner.id) : {};
    res.json(bookPages.view(b, await players.elements(owner), misses, await bookLetters.byPage(owner)));
}));

// Encre : révèle un ingrédient (déjà possédé) d'une page à portée ; offerte à un compte
// après quelques mélanges ratés différents sur cette page, payée sinon
router.post('/ink', playLimiter, withPlayer(async (req, res, owner, b) => {
    const id = String(req.body.page || '');
    if (!PAGE.test(id)) return res.status(400).json({ message: 'Page invalide' });
    const target = bookPages.reachableById(b, await players.elements(owner), id);
    if (!target) return res.status(404).json({ message: 'Cette page n’est pas à portée.' });
    const rules = bookPages.difficultyOf(b.meta.get(target.name)?.family);
    const free = owner.kind === 'user' && await bookTries.misses(owner.id, id) >= rules.freeInkAfter;
    const paid = free ? { coins: await ledger.balance(owner.id) } : await pay(owner, 'encre');
    if (paid.status) return res.status(paid.status).json({ message: paid.message });
    res.json({ page: id, ingredient: bookPages.telling(target.parts), coins: paid.coins, free });
}));

// Pendu : la page visée, ses règles (erreurs permises, première lettre donnée) et l'état à renvoyer
async function letterTarget(req, res, owner, b) {
    const id = String(req.body.page || '');
    if (!PAGE.test(id)) return res.status(400).json({ message: 'Page invalide' }) && null;
    const target = bookPages.reachableById(b, await players.elements(owner), id);
    if (!target) return res.status(404).json({ message: 'Cette page n’est pas à portée.' }) && null;
    const info = b.meta.get(target.name);
    const max = hangman.maxMisses(bookPages.chapterOf(info.family).id);
    const first = bookPages.difficultyOf(info.family).letter;
    return { id, name: target.name, max, first, view: row => hangman.state(target.name, row, max, first, info.emoji) };
}

// Pendu : une lettre proposée pour le nom d'une page à portée ; le serveur seul connaît le mot
router.post('/letter', playLimiter, withPlayer(async (req, res, owner, b) => {
    const letter = String(req.body.letter || '').toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return res.status(400).json({ message: 'Lettre invalide' });
    const target = await letterTarget(req, res, owner, b);
    if (!target) return;
    const played = await bookLetters.guess(owner, target.id, target.name, letter, target.max, target.first);
    if (played.blocked) return res.status(409).json({ message: 'Partie perdue : reviens demain, ou rejoue contre des écus.', page: target.id, hangman: target.view(played.blocked) });
    res.json({ page: target.id, hangman: target.view(played.row) });
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
