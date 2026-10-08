// Le Monde : l'île du joueur (services/world.js), compte requis.
const express = require('express');
const book = require('../../services/recipeBook');
const players = require('../../services/players');
const world = require('../../services/world');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const villagers = require('../../services/villagers');
const anya = require('../../services/anya');
const { PAGE, playLimiter, withAccount } = require('./shared');

const router = express.Router();
router.use('/world', playLimiter);

// Les calques de la carte (relief, sol, quartiers : 85 Ko) ne voyagent que si le navigateur ne les a pas déjà : il
// envoie la clé des siens (X-Map-Key) ; la vue (seule ou dans world) part alors sans eux, avec la même clé
const LAYERS = ['grid', 'height', 'ground', 'region'];
function withoutKnownMap(body, known) {
    const view = body && (body.map ? body : body.world);
    if (!view || !view.map || view.map.key !== known) return body;
    const map = Object.fromEntries(Object.entries(view.map).filter(([k]) => !LAYERS.includes(k)));
    const light = { ...view, map };
    return body.map ? light : { ...body, world: light };
}
router.use('/world', (req, res, next) => {
    const known = req.get('X-Map-Key');
    if (known) {
        const json = res.json.bind(res);
        res.json = body => json(withoutKnownMap(body, known));
    }
    next();
});

// Chapitres ouverts du joueur (un joueur d'avant la bible garde le chapitre II ouvert d'emblée)
const chaptersOf = async (owner, b, owned) => bookPages.openChapters(b, owned, await players.isVeteran(owner));

// Vue de l'île. Les décorations de l'ancienne règle sont remboursées au premier passage (lot 8) : refund { count,
// coins } accompagne alors la vue, une fois
async function worldView(owner, b) {
    const owned = await players.elements(owner);
    const refund = await world.refundDecorations(owner.id, element => decoPrice(b, element));
    const view = await world.view(owner.id, owned, {
        describe: names => book.describe(b, names), openChapters: await chaptersOf(owner, b, owned), stars: bookPages.starsOf(b, owned),
        ariane: bookPages.arianeOf(b, owned, await world.arianeTargets(owner.id)),
        finished: bookPages.finishedChapters(b, owned)
    });
    return refund.count ? { ...view, refund } : view;
}

// Prix qu'avait coûté une décoration (ancienne règle) : selon le chapitre de la famille de l'élément
const decoPrice = (b, element) => world.DECO_PRICES[bookPages.chapterOf(b.meta.get(element)?.family)?.id] || 0;

router.get('/world', withAccount(async (req, res, owner, b) => {
    res.json(await worldView(owner, b));
}));

// Solde d'écus quand une action a d'abord encaissé la production (changement d'humeur : produce.gatherBefore)
const coinsOf = done => (done.coins !== undefined ? { coins: done.coins } : {});

// Créations d'île (lot 8) : assembler (début : les pièces ; fin : la disposition, vérifiée), poser, déplacer, ranger
const craftId = body => String(body.craft || '');
const craftDone = async (res, owner, b, done, extra = {}) => {
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ ...extra, ...coinsOf(done), world: await worldView(owner, b) });
};
router.post('/world/craft/start', withAccount(async (req, res, owner, b) => {
    const craft = craftId(req.body);
    if (!/^[a-z]{1,20}$/.test(craft)) return res.status(400).json({ message: 'Création invalide' });
    const owned = await players.elements(owner);
    const done = await world.startCraft(owner.id, craft, owned, bookPages.finishedChapters(b, owned), bookPages.starsOf(b, owned));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ run: done.run, ...coinsOf(done) });
}));
router.post('/world/craft/finish', withAccount(async (req, res, owner, b) => {
    const run = Number(req.body.run);
    if (!Number.isSafeInteger(run) || run <= 0 || !Array.isArray(req.body.layout) || req.body.layout.length > 40) return res.status(400).json({ message: 'Assemblage invalide' });
    const owned = await players.elements(owner);
    const done = await world.finishCraft(owner.id, run, req.body.layout, owned, bookPages.finishedChapters(b, owned), bookPages.starsOf(b, owned));
    await craftDone(res, owner, b, done, { made: done.made, craft: done.craft });
}));
router.post('/world/craft/place', withAccount(async (req, res, owner, b) => {
    const craft = craftId(req.body);
    const x = Number(req.body.x), y = Number(req.body.y);
    const { flip = false } = req.body;
    if (!/^[a-z]{1,20}$/.test(craft) || !cellOk(x, y) || typeof flip !== 'boolean') return res.status(400).json({ message: 'Pose invalide' });
    await craftDone(res, owner, b, await world.placeCraft(owner.id, craft, x, y, flip));
}));
// Création posée : pivoter (miroir)
router.post('/world/craft/turn', withAccount(async (req, res, owner, b) => {
    const x = Number(req.body.x), y = Number(req.body.y);
    if (!cellOk(x, y) || typeof req.body.flip !== 'boolean') return res.status(400).json({ message: 'Pose invalide' });
    await craftDone(res, owner, b, await world.turnCraft(owner.id, x, y, req.body.flip));
}));
router.post('/world/craft/move', withAccount(async (req, res, owner, b) => {
    const [x, y, toX, toY] = ['x', 'y', 'toX', 'toY'].map(k => Number(req.body[k]));
    if (!cellOk(x, y, toX, toY)) return res.status(400).json({ message: 'Case invalide' });
    await craftDone(res, owner, b, await world.moveCraft(owner.id, x, y, toX, toY));
}));
router.post('/world/craft/store', withAccount(async (req, res, owner, b) => {
    const x = Number(req.body.x), y = Number(req.body.y);
    if (!cellOk(x, y)) return res.status(400).json({ message: 'Case invalide' });
    await craftDone(res, owner, b, await world.storeCraft(owner.id, x, y));
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

// Nom d'un bâtiment (dès son palier III) ou d'un quartier à soi ; un nom vide rend celui d'origine
router.post('/world/name', withAccount(async (req, res, owner, b) => {
    const kind = String(req.body.kind || '');
    const id = String(req.body.id || '');
    if (!['site', 'zone'].includes(kind) || !/^[a-z0-9-]{1,20}$/.test(id) || typeof (req.body.name ?? '') !== 'string') return res.status(400).json({ message: 'Nom invalide' });
    const done = await world.rename(owner.id, kind, id, req.body.name);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Le nom du peuple (bible, § 6.11)
router.post('/world/people', withAccount(async (req, res, owner, b) => {
    if (typeof (req.body.name ?? '') !== 'string') return res.status(400).json({ message: 'Nom invalide' });
    const done = await world.namePeople(owner.id, req.body.name);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Le nom du joueur, écrit dans le Grimoire au tutoriel (bible, § 9, étape 2)
router.post('/world/player', withAccount(async (req, res, owner, b) => {
    if (typeof (req.body.name ?? '') !== 'string') return res.status(400).json({ message: 'Nom invalide' });
    const done = await world.namePlayer(owner.id, req.body.name);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// L'avatar du joueur, composé sur sa carte d'embarquement au tutoriel (bible, § 6.17) : { choices } (vérifiés un à un,
// services/avatarChoices.js), ou { look } (l'un des exemples de la bibliothèque)
router.post('/world/avatar', withAccount(async (req, res, owner, b) => {
    const done = await world.chooseAvatar(owner.id, { look: req.body.look, choices: req.body.choices });
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Enseignes (dès le palier V) : le nom écrit dessus, puis le style de celle d'un bâtiment (acheté au passage)
router.post('/world/sign/name', withAccount(async (req, res, owner, b) => {
    const done = await world.nameSigns(owner.id, req.body.name);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));
router.post('/world/sign', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    const style = String(req.body.style || '');
    if (!/^[a-z]{1,20}$/.test(site) || !/^[a-z]{1,20}$/.test(style)) return res.status(400).json({ message: 'Enseigne invalide' });
    const done = await world.chooseSign(owner.id, site, style);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ coins: done.coins, world: await worldView(owner, b) });
}));

// Annexe d'un bâtiment : pose de l'exemplaire suivant sur une case libre autour de lui
const cellOk = (...values) => values.every(v => Number.isInteger(v) && v >= 0 && v < world.SIZE);
// Miroir et couleur d'une annexe (pose, ou changement après coup) : flip booléen, look n° de variante (null : celle de
// son rang) ; absents : inchangés. null si la demande est mal formée
function poseOf(body) {
    const { flip, look } = body;
    if (flip !== undefined && typeof flip !== 'boolean') return null;
    if (look !== undefined && look !== null && !(Number.isInteger(look) && look >= 0 && look < 10)) return null;
    return { flip, look };
}
router.post('/world/annex', withAccount(async (req, res, owner, b) => {
    const annex = String(req.body.annex || '');
    const x = Number(req.body.x), y = Number(req.body.y);
    const pose = poseOf(req.body);
    if (!/^[a-z]{1,20}$/.test(annex) || !cellOk(x, y) || !pose) return res.status(400).json({ message: 'Annexe invalide' });
    const done = await world.placeAnnex(owner.id, annex, x, y, { flip: pose.flip ?? false, look: pose.look ?? null });
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

// Annexe : pivoter (miroir) ou changer de couleur, sans rien payer
router.post('/world/annex/pose', withAccount(async (req, res, owner, b) => {
    const x = Number(req.body.x), y = Number(req.body.y);
    const pose = poseOf(req.body);
    if (!cellOk(x, y) || !pose || (pose.flip === undefined && pose.look === undefined)) return res.status(400).json({ message: 'Pose invalide' });
    const done = await world.poseAnnex(owner.id, x, y, pose);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(await worldView(owner, b));
}));

// Quartier : écus et chapitre du Livre ouvert
router.post('/world/zone', withAccount(async (req, res, owner, b) => {
    const zone = String(req.body.zone || '');
    if (!/^[a-z]{1,20}$/.test(zone)) return res.status(400).json({ message: 'Quartier invalide' });
    const owned = await players.elements(owner);
    const done = await world.buyZone(owner.id, zone, await chaptersOf(owner, b, owned), owned);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ bought: done.bought, coins: done.coins, world: await worldView(owner, b) });
}));

// Expédition vers un quartier inconnu des terres nouvelles (lot 9) : { expedition: { zone, endsAt }, coins?, world }
router.post('/world/expedition', withAccount(async (req, res, owner, b) => {
    const zone = String(req.body.zone || '');
    if (!/^[a-z]{1,20}$/.test(zone)) return res.status(400).json({ message: 'Quartier invalide' });
    const done = await world.startExpedition(owner.id, zone);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ expedition: { zone: done.zone, endsAt: done.endsAt }, ...coinsOf(done), world: await worldView(owner, b) });
}));

// Les nuits de créatures (v6, § 6.15) : Brume les présente (une fois ; la première nuit vient un jour après) → { world }
router.post('/world/nights/start', withAccount(async (req, res, owner, b) => {
    await world.startNights(owner.id);
    res.json({ world: await worldView(owner, b) });
}));

// Repousser un égaré d'un toucher, la nuit, sur son chemin → { id, world }
router.post('/world/nights/repel', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^\d{4}-\d{2}-\d{2}:\d$/.test(id)) return res.status(400).json({ message: 'Égaré invalide' });
    const done = await world.repelCreature(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ id: done.id, world: await worldView(owner, b) });
}));

// Réparer le bâtiment embrumé (un peu de pierre ou de bois) → { site, cost, coins?, world }
router.post('/world/repair', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    if (!/^[a-z]{1,20}$/.test(site)) return res.status(400).json({ message: 'Bâtiment invalide' });
    const done = await world.repairSite(owner.id, site);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ site: done.site, cost: done.cost, ...coinsOf(done), world: await worldView(owner, b) });
}));

// Lieu remarquable d'un quartier à soi (lot 9c) : le découvrir → { landmark, fresh, world } (fresh : première fois)
router.post('/world/landmark', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^[a-z]{1,20}$/.test(id)) return res.status(400).json({ message: 'Lieu invalide' });
    const done = await world.findLandmark(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ landmark: done.landmark, fresh: done.fresh, world: await worldView(owner, b) });
}));

// Gisement d'un quartier de climat à soi (lot 9d) : ramasser ses trouvailles → { find, amount, world }
router.post('/world/deposit', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^[a-z]{1,16}-\d$/.test(id)) return res.status(400).json({ message: 'Gisement invalide' });
    const done = await world.gatherDeposit(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ find: done.find, amount: done.amount, world: await worldView(owner, b) });
}));

// Ce que la mer a rendu sur la Grève : un toucher le ramasse (services/pickups.js)
router.post('/world/pickup', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^greve-[a-z]{1,12}-\d$/.test(id)) return res.status(400).json({ message: 'Trouvaille invalide' });
    const done = await world.pickUp(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ kind: done.kind, gives: done.gives, world: await worldView(owner, b) });
}));

// Chantier : niveau suivant, avec son plan (élément du Livre) et ses ressources
router.post('/world/build', withAccount(async (req, res, owner, b) => {
    const site = String(req.body.site || '');
    if (!/^[a-z]{1,20}$/.test(site)) return res.status(400).json({ message: 'Chantier invalide' });
    const owned = await players.elements(owner);
    const done = await world.build(owner.id, owned, site, await chaptersOf(owner, b, owned));
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

// Mini-jeux des bâtiments (dès le palier III) : une partie (graine), puis les gestes du joueur, rejoués par le serveur
router.post('/world/game/start', withAccount(async (req, res, owner, b) => {
    const game = String(req.body.game || '');
    if (!/^[a-z]{1,20}$/.test(game)) return res.status(400).json({ message: 'Mini-jeu invalide' });
    const started = await world.startGame(owner.id, game);
    if (started.status) return res.status(started.status).json({ message: started.message });
    res.json({ run: started.run, world: await worldView(owner, b) });
}));
router.post('/world/game/finish', withAccount(async (req, res, owner, b) => {
    const run = Number(req.body.run);
    if (!Number.isSafeInteger(run) || run <= 0 || !Array.isArray(req.body.input)) return res.status(400).json({ message: 'Partie invalide' });
    const done = await world.finishGame(owner.id, run, req.body.input);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ earned: done.earned, raw: done.raw, detail: done.detail, coins: done.coins, world: await worldView(owner, b) });
}));

// Habitants : leur parler, leur offrir des ressources (chacun une fois par jour) ; les cœurs gagnés sont récompensés
const befriended = async (res, owner, b, done, extra = {}) => {
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ gained: done.gained, points: done.points, hearts: done.hearts, rewards: done.rewards, coins: done.coins, ...extra, world: await worldView(owner, b) });
};
// La Révélation d'Anya vue (une seule fois, d'un appareil à l'autre)
router.post('/world/anya/reveal', withAccount(async (req, res, owner, b) => {
    const done = await world.revealAnya(owner.id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ anya: done.anya, world: await worldView(owner, b) });
}));
// Pages dont l'appareil a déjà un indice (envoyées avec le bavardage) : identifiants valides, liste bornée
const pagesOf = list => (Array.isArray(list) ? list.slice(-400).filter(id => typeof id === 'string' && PAGE.test(id)) : []);
// Ce qu'il faut pour le Savoir d'un maître : éléments écrits, essais ratés par page, fil d'Ariane
async function savoirInputs(owner, b) {
    const owned = await players.elements(owner);
    return { owned, misses: await bookTries.missesByPage(owner.id), veteran: await players.isVeteran(owner), ariane: bookPages.arianeOf(b, owned, await world.arianeTargets(owner.id)) };
}
// Bavarder avec un maître (bible, § 6.4) : son Savoir n'est soufflé que si le bavardage compte (une fois par jour).
// Anya, une fois éveillée (§ 6.14) : son Souffle, une fois par jour, un ingrédient sur n'importe quelle page à portée
router.post('/world/villager/talk', withAccount(async (req, res, owner, b) => {
    const villager = String(req.body.villager || '');
    if (!/^[a-z0-9]{1,20}$/.test(villager)) return res.status(400).json({ message: 'Habitant invalide' });
    // Brume, une fois le Phare allumé : un indice par jour sur les Légendes (rien n'est compté s'il n'y a pas de page)
    if (villager === 'brume') {
        const state = await world.brumeSavoirOf(owner.id);
        if (!state.open) return res.status(403).json({ message: 'Brume garde son Savoir pour la fin : allume d’abord le Phare.' });
        if (state.talked) return res.status(409).json({ message: 'Brume t’a déjà soufflé un Savoir aujourd’hui.' });
        const inputs = await savoirInputs(owner, b);
        const savoir = bookPages.savoir(b, inputs.owned, ['Légendes'], { ...inputs, strong: true, known: pagesOf(req.body.known), heard: pagesOf(req.body.heard) });
        if (savoir) {
            const done = await world.talkBrume(owner.id);
            if (done.status) return res.status(done.status).json({ message: done.message });
        }
        return res.json({ savoir, world: await worldView(owner, b) });
    }
    // Anya, la Révélation vue, de passage : son Souffle n'est compté que s'il y a une page à souffler
    if (villager === anya.TARGET) {
        const refused = world.breathRefused(await world.anyaOf(owner.id));
        if (refused) return res.status(refused.status).json({ message: refused.message });
        const inputs = await savoirInputs(owner, b);
        const savoir = bookPages.savoir(b, inputs.owned, bookPages.FAMILIES, { ...inputs, strong: true, known: pagesOf(req.body.known), heard: pagesOf(req.body.heard) });
        if (savoir) {
            const done = await world.breatheAnya(owner.id);
            if (done.status) return res.status(done.status).json({ message: done.message });
        }
        return res.json({ savoir, world: await worldView(owner, b) });
    }
    const families = villagers.SAVOIRS[villager];
    const inputs = families ? await savoirInputs(owner, b) : null;
    const done = await world.befriend(owner.id, villager);
    const savoir = inputs && !done.status
        ? bookPages.savoir(b, inputs.owned, families, { ...inputs, strong: done.hearts >= villagers.SAVOIR_HEARTS, known: pagesOf(req.body.known), heard: pagesOf(req.body.heard) })
        : null;
    await befriended(res, owner, b, done, { savoir });
}));
router.post('/world/villager/gift', withAccount(async (req, res, owner, b) => {
    const villager = String(req.body.villager || '');
    const resource = String(req.body.resource || '');
    if (!/^[a-z0-9]{1,20}$/.test(villager) || !/^[a-z]{1,10}$/.test(resource)) return res.status(400).json({ message: 'Cadeau invalide' });
    await befriended(res, owner, b, await world.befriend(owner.id, villager, resource));
}));
// Besoins des habitants : en combler un (manger, travailler), ou tout ce qui peut l'être d'un coup
const fed = async (res, owner, b, done) => {
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ filled: done.filled, ...coinsOf(done), world: await worldView(owner, b) });
};
router.post('/world/villager/need', withAccount(async (req, res, owner, b) => {
    const villager = String(req.body.villager || '');
    const need = String(req.body.need || '');
    if (!/^[a-z0-9]{1,20}$/.test(villager) || !/^[a-z]{1,10}$/.test(need)) return res.status(400).json({ message: 'Besoin invalide' });
    await fed(res, owner, b, await world.fillNeeds(owner.id, [{ villager, need }]));
}));
router.post('/world/villagers/needs', withAccount(async (req, res, owner, b) => {
    await fed(res, owner, b, await world.fillNeeds(owner.id));
}));
// Bêtes de ferme (v6, § 6.16) : en nourrir une depuis sa fiche (sa bulle est ramassée d'abord) → { beast, collected, coins?, world }
router.post('/world/beast/feed', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.beast || '');
    if (!/^[a-z-]{1,20}$/.test(id)) return res.status(400).json({ message: 'Bête invalide' });
    const done = await world.feedBeast(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ beast: done.beast, collected: done.collected, ...coinsOf(done), world: await worldView(owner, b) });
}));
// Ramasser les bulles de toutes les bêtes → { food, world }
router.post('/world/beasts/collect', withAccount(async (req, res, owner, b) => {
    const { food } = await world.collectBeasts(owner.id);
    res.json({ food, world: await worldView(owner, b) });
}));
// La cage des poules, au camp : l'ouvrir (une fois) → { hens, world }
router.post('/world/beasts/cage', withAccount(async (req, res, owner, b) => {
    const done = await world.openCage(owner.id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ hens: done.hens, world: await worldView(owner, b) });
}));
// Visiteur : combler sa demande (livrer, ou ses Récoltes faites) → { reward, coins, world }
router.post('/world/visitor', withAccount(async (req, res, owner, b) => {
    const id = Number(req.body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Visiteur invalide' });
    const done = await world.satisfyVisitor(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ reward: done.reward, coins: done.coins, world: await worldView(owner, b) });
}));
// Visiteur comblé : il reste, dans une maison libre → { settled, coins?, world }
router.post('/world/visitor/settle', withAccount(async (req, res, owner, b) => {
    const id = Number(req.body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Visiteur invalide' });
    const done = await world.settleVisitor(owner.id, id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ settled: done.settled, ...coinsOf(done), world: await worldView(owner, b) });
}));

// Coffre qui attend : du jour, bouteille à la mer, chapitre du Livre ouvert, quête de Brume réclamée, lieu découvert
router.post('/world/chest', withAccount(async (req, res, owner, b) => {
    const source = String(req.body.source || '');
    if (!/^(jour|bouteille|chapitre:[IVX]{1,4}|quete:[a-z0-9-]{1,30}|lieu:[a-z]{1,20})$/.test(source)) return res.status(400).json({ message: 'Coffre invalide' });
    const done = await world.openChest(owner.id, source, await chaptersOf(owner, b, await players.elements(owner)));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ chest: done.chest, coins: done.coins, world: await worldView(owner, b) });
}));

// « Tout ouvrir » : tous les coffres qui attendent, d'un coup (le serveur dresse la liste)
router.post('/world/chests/all', withAccount(async (req, res, owner, b) => {
    const done = await world.openAll(owner.id, await chaptersOf(owner, b, await players.elements(owner)));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ chests: done.chests, coins: done.coins, world: await worldView(owner, b) });
}));

// Brume seule (la quête active), pour le Grimoire : une quête accomplie y est annoncée
router.get('/world/brume', withAccount(async (req, res, owner, b) => {
    const owned = await players.elements(owner);
    res.json(await world.board(owner.id, owned, bookPages.starsOf(b, owned), await chaptersOf(owner, b, owned)));
}));

// « Passer le tutoriel » : retenu sur le compte → { skipped: true }
router.post('/world/prologue/skip', withAccount(async (req, res, owner) => {
    await world.skipPrologue(owner.id);
    res.json({ skipped: true });
}));

// « Recommencer l'île », une fois par compte : le joueur l'écrit en toutes lettres (RECOMMENCER) → { restarted: true }
router.post('/world/restart', withAccount(async (req, res, owner) => {
    if (req.body.confirm !== 'RECOMMENCER') return res.status(400).json({ message: 'Écris RECOMMENCER pour confirmer.' });
    const done = await world.restartIsland(owner.id);
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json(done);
}));

// Quête de Brume : réclamer la récompense de la quête active
router.post('/world/quest', withAccount(async (req, res, owner, b) => {
    const id = String(req.body.id || '');
    if (!/^[a-z0-9-]{1,30}$/.test(id)) return res.status(400).json({ message: 'Quête invalide' });
    const owned = await players.elements(owner);
    const done = await world.claimQuest(owner.id, id, owned, bookPages.starsOf(b, owned));
    if (done.status) return res.status(done.status).json({ message: done.message });
    res.json({ gained: done.gained, coins: done.coins, world: await worldView(owner, b) });
}));

module.exports = router;
