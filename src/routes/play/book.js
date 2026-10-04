// Le Livre : chapitres et pages (services/bookPages.js), et l'encre qui révèle un ingrédient.
const express = require('express');
const players = require('../../services/players');
const ledger = require('../../services/ledger');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const { PAGE, playLimiter, withPlayer, pay } = require('./shared');

const router = express.Router();

// Une page à portée ne révèle jamais le nom de l'élément inconnu
router.get('/book', playLimiter, withPlayer(async (req, res, owner, b) => {
    const misses = owner.kind === 'user' ? await bookTries.missesByPage(owner.id) : {};
    res.json(bookPages.view(b, await players.elements(owner), misses));
}));

// Encre : révèle un ingrédient (déjà possédé) d'une page à portée ; offerte d'emblée dans les premiers
// chapitres (l'ingrédient y est déjà donné), ailleurs après quelques mélanges ratés différents sur cette page
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

module.exports = router;
