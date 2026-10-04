// Le Monde : l'île du joueur (services/world.js), compte requis.
const express = require('express');
const book = require('../../services/recipeBook');
const players = require('../../services/players');
const world = require('../../services/world');
const { NAME, playLimiter, withAccount } = require('./shared');

const router = express.Router();
router.use('/world', playLimiter);

async function worldView(owner, b) {
    return world.view(owner.id, await players.elements(owner), names => book.describe(b, names));
}

router.get('/world', withAccount(async (req, res, owner, b) => {
    res.json(await worldView(owner, b));
}));

router.post('/world/place', withAccount(async (req, res, owner, b) => {
    const { element } = req.body;
    if (typeof element !== 'string' || !NAME.test(element)) return res.status(400).json({ message: 'Élément invalide' });
    const placed = await world.place(owner.id, await players.elements(owner), element, Number(req.body.x), Number(req.body.y));
    if (placed.status) return res.status(placed.status).json({ message: placed.message });
    res.json(await worldView(owner, b));
}));

router.post('/world/remove', withAccount(async (req, res, owner, b) => {
    const x = Number(req.body.x), y = Number(req.body.y);
    if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < 32)) return res.status(400).json({ message: 'Case invalide' });
    await world.remove(owner.id, x, y);
    res.json(await worldView(owner, b));
}));

router.post('/world/collect', withAccount(async (req, res, owner, b) => {
    const { gained, coins } = await world.collect(owner.id);
    res.json({ gained, coins, world: await worldView(owner, b) });
}));

// Chantier : niveau suivant, avec son plan (élément du Livre) et ses ressources
router.post('/world/build', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    if (!/^[a-z]{1,20}$/.test(site)) return res.status(400).json({ message: 'Chantier invalide' });
    const done = await world.build(owner.id, await players.elements(owner), site);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ built: done.built, world: await worldView(owner, b) });
}));

// Récolte : une partie de la réserve contre une graine ; les coups reviennent à la fin et le serveur les rejoue
router.post('/world/harvest/start', withAccount(async (req, res, owner) => {
    const started = await world.startRun(owner.id);
    if (started.status) return res.status(started.status).json({ message: started.message });
    res.json(started.run);
}));

router.post('/world/harvest/finish', withAccount(async (req, res, owner, b) => {
    const run = Number(req.body.run);
    if (!Number.isSafeInteger(run) || run <= 0 || !Array.isArray(req.body.moves)) return res.status(400).json({ message: 'Partie invalide' });
    const done = await world.finishRun(owner.id, run, req.body.moves);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ gains: done.gains, world: await worldView(owner, b) });
}));

module.exports = router;
