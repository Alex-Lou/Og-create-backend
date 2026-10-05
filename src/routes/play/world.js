// Le Monde : l'île du joueur (services/world.js), compte requis.
const express = require('express');
const book = require('../../services/recipeBook');
const players = require('../../services/players');
const world = require('../../services/world');
const bookPages = require('../../services/bookPages');
const { NAME, playLimiter, withAccount } = require('./shared');

const router = express.Router();
router.use('/world', playLimiter);

async function worldView(owner, b) {
    const owned = await players.elements(owner);
    return world.view(owner.id, owned, {
        describe: names => book.describe(b, names), openChapters: bookPages.openChapters(b, owned), stars: bookPages.starsOf(b, owned)
    });
}

// Prix d'une décoration : selon le chapitre de la famille de l'élément
const decoPrice = (b, element) => world.DECO_PRICES[bookPages.chapterOf(b.meta.get(element)?.family).id];

router.get('/world', withAccount(async (req, res, owner, b) => {
    res.json(await worldView(owner, b));
}));

router.post('/world/place', withAccount(async (req, res, owner, b) => {
    const { element } = req.body;
    if (typeof element !== 'string' || !NAME.test(element)) return res.status(400).json({ message: 'Élément invalide' });
    const placed = await world.place(owner.id, await players.elements(owner), element, Number(req.body.x), Number(req.body.y), decoPrice(b, element));
    if (placed.status) return res.status(placed.status).json({ message: placed.message });
    // Solde après achat (absent pour un simple déplacement)
    res.json({ ...(await worldView(owner, b)), ...(placed.coins !== undefined ? { coins: placed.coins } : {}) });
}));

router.post('/world/remove', withAccount(async (req, res, owner, b) => {
    const x = Number(req.body.x), y = Number(req.body.y);
    if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < world.SIZE)) return res.status(400).json({ message: 'Case invalide' });
    await world.remove(owner.id, x, y);
    res.json(await worldView(owner, b));
}));

router.post('/world/collect', withAccount(async (req, res, owner, b) => {
    const { gained, stock, coins } = await world.collect(owner.id);
    res.json({ gained, stock, coins, world: await worldView(owner, b) });
}));

// Boutique d'un atelier : achat d'un article
router.post('/world/item', withAccount(async (req, res, owner, b) => {
    const item = String(req.body.item || '');
    if (!/^[a-z-]{1,30}$/.test(item)) return res.status(400).json({ message: 'Article invalide' });
    const done = await world.buyItem(owner.id, item);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ bought: done.bought, coins: done.coins, world: await worldView(owner, b) });
}));

// Boutique : annuler un achat juste après (achat en un toucher)
router.post('/world/item/undo', withAccount(async (req, res, owner, b) => {
    const item = String(req.body.item || '');
    if (!/^[a-z-]{1,30}$/.test(item)) return res.status(400).json({ message: 'Article invalide' });
    const done = await world.undoItem(owner.id, item);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ undone: done.undone, coins: done.coins, world: await worldView(owner, b) });
}));

// Skin porté par un bâtiment (vide : apparence d'origine)
router.post('/world/skin', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    const skin = String(req.body.skin || '');
    if (!/^[a-z]{1,20}$/.test(site) || !/^[a-z-]{0,30}$/.test(skin)) return res.status(400).json({ message: 'Skin invalide' });
    const done = await world.chooseSkin(owner.id, site, skin);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Annexe d'un bâtiment : pose de l'exemplaire suivant sur une case libre autour de lui
const cellOk = (...values) => values.every(v => Number.isInteger(v) && v >= 0 && v < world.SIZE);
router.post('/world/annex', withAccount(async (req, res, owner, b) => {
    const annex = String(req.body.annex || '');
    const x = Number(req.body.x), y = Number(req.body.y);
    if (!/^[a-z]{1,20}$/.test(annex) || !cellOk(x, y)) return res.status(400).json({ message: 'Annexe invalide' });
    const done = await world.placeAnnex(owner.id, annex, x, y);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ built: done.built, coins: done.coins, world: await worldView(owner, b) });
}));

// Annexe : déplacement gratuit vers une autre case libre autour de son bâtiment
router.post('/world/annex/move', withAccount(async (req, res, owner, b) => {
    const [x, y, toX, toY] = ['x', 'y', 'toX', 'toY'].map(k => Number(req.body[k]));
    if (!cellOk(x, y, toX, toY)) return res.status(400).json({ message: 'Case invalide' });
    const done = await world.moveAnnex(owner.id, x, y, toX, toY);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Quartier : écus et chapitre du Livre ouvert
router.post('/world/zone', withAccount(async (req, res, owner, b) => {
    const zone = String(req.body.zone || '');
    if (!/^[a-z]{1,20}$/.test(zone)) return res.status(400).json({ message: 'Quartier invalide' });
    const done = await world.buyZone(owner.id, zone, bookPages.openChapters(b, await players.elements(owner)));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ bought: done.bought, coins: done.coins, world: await worldView(owner, b) });
}));

// Chantier : niveau suivant, avec son plan (élément du Livre) et ses ressources
router.post('/world/build', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    if (!/^[a-z]{1,20}$/.test(site)) return res.status(400).json({ message: 'Chantier invalide' });
    const owned = await players.elements(owner);
    const done = await world.build(owner.id, owned, site, bookPages.openChapters(b, owned));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ built: done.built, ...(done.coins !== undefined ? { coins: done.coins } : {}), world: await worldView(owner, b) });
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
    res.json({ gains: done.gains, earned: done.earned, coins: done.coins, chest: done.chest, world: await worldView(owner, b) });
}));

// Coffre qui attend : du jour, bouteille à la mer, chapitre du Livre ouvert, quête de Brume réclamée
router.post('/world/chest', withAccount(async (req, res, owner, b) => {
    const source = String(req.body.source || '');
    if (!/^(jour|bouteille|chapitre:[IVX]{1,4}|quete:[a-z0-9]{1,30})$/.test(source)) return res.status(400).json({ message: 'Coffre invalide' });
    const done = await world.openChest(owner.id, source, bookPages.openChapters(b, await players.elements(owner)));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ chest: done.chest, coins: done.coins, world: await worldView(owner, b) });
}));

// Brume seule (la quête active), pour le Livre : une quête accomplie y est annoncée
router.get('/world/brume', withAccount(async (req, res, owner, b) => {
    res.json(await world.board(owner.id, bookPages.starsOf(b, await players.elements(owner))));
}));

// Quête de Brume : réclamer la récompense de la quête active
router.post('/world/quest', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^[a-z0-9]{1,30}$/.test(id)) return res.status(400).json({ message: 'Quête invalide' });
    const done = await world.claimQuest(owner.id, id, bookPages.starsOf(b, await players.elements(owner)));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ gained: done.gained, coins: done.coins, world: await worldView(owner, b) });
}));

module.exports = router;
