// Le Monde : l'île du joueur, sur une carte commune (worldMap.js) : la Grève ouverte d'office, onze quartiers à acheter
// (écus + chapitre du Livre). Les chantiers se construisent puis évoluent avec un plan découvert dans le Livre et des
// ressources tirées de la Récolte. Les bâtiments de production rapportent ressources et écus, avec leurs annexes
// (annexes.js : champs, filons, viviers… posés autour d'eux) ; les décorations s'achètent et embellissent, sans rien
// produire.
// Tout ce qui compte (stock, quartiers, parties, gains, écus, coffres) est décidé ici, dans des transactions verrouillées.
const crypto = require('crypto');
const db = require('../config/db');
const ledger = require('./ledger');
const harvest = require('./harvest');
const map = require('./worldMap');
const shop = require('./worldShop');
const quests = require('./quests');
const loot = require('./loot');
const annexes = require('./annexes');
const signs = require('./signs');
const minigames = require('./minigames');
const villagers = require('./villagers');
const crafts = require('./crafts');
const naming = require('./naming');
const landmarks = require('./landmarks');
const finds = require('./finds');
const anya = require('./anya');
const {
    SIZE, CAP_HOURS, REGEN_MS, RUN_TTL_MS, RENAME_LEVEL, GAME_TTL_MS, GAME_SLACK_MS, FIRST_RUN_MOVES, FIRST_RUN_KINDS,
    RESOURCES, DECO_PRICES, HARVEST_COIN_EVERY, UNDO_SECONDS, random, CHAPTER_OF_LEVEL, PRODUCE_PER_LEVEL,
    COINS_PER_LEVEL, SITES, MAP_VERSION, effectOf, keyOf, pendingOf, chargesAt, effectsOf, productionOf, fullInOf, perHourOf, productionAll, cashOf
} = require('./world/rules');
const {
    itemsOf, skinsOf, signsOf, namesOf, avatarOf, friendsOf, needRowsOf, settlersOf, gamesOf, annexesOf, levelsOf, stockOf,
    zonesOf, findsOf, depositsOf, blightsOf, foundOf, claimedOf, helianeOfUser, runsOf, countOf, discoveredOf, craftsOf,
    placedOf, addStock, balanceOf
} = require('./world/reads');
const { migrate } = require('./world/migrate');
const { openedOf, chestsView, grant, openChest, openAll } = require('./world/chests');
const {
    SLEEPERS, presenceOf, residentsOf, hungryOf, HUNGRY_AGO, moodsOf, withMoods, withLandmarks, withBlights, prodSteps,
    runsSince, visitorNow, visitorView, befriend, fillNeeds, satisfyVisitor, settleVisitor
} = require('./world/people');
const { bonusesFor, gather, payWith, collect } = require('./world/produce');
const { anyaOf, breathRefused, brumeSavoirOf, talkBrume, revealAnya, breatheAnya } = require('./world/anyaBrume');
const {
    isKnown, coreMissing, expeditionCost, expeditionOf, startExpedition, findLandmark, craftBonusOf, gatherDeposit
} = require('./world/lands');
const {
    craftCtx, stowCrafts, epreuvesOf, craftsView, startCraft, finishCraft, placeCraft, moveCraft, storeCraft
} = require('./world/creations');
const { annexSpotOk, annexSpots, annexesView, placeAnnex, moveAnnex } = require('./world/annexPlots');
const { campOfUser, cellsOfCamp } = require('./world/camp');
const { startNights, repelCreature, repairSite, nightsView } = require('./world/nights');
const { feedBeast, collectBeasts, beastsView } = require('./world/beasts');

// Un habitant arrive comblé (Cannelle, pendant le prologue, affamée : hungryOf) : la première vue de l'île après son
// arrivée inscrit l'heure de ses besoins (ou de celui qui apparaît, travailler avec l'Atelier), une seule fois
async function welcome(userId, moods, filled, presence, now = Date.now()) {
    const fresh = Object.entries(moods).flatMap(([id, m]) => m.needs.filter(n => n.cost && !filled[id]?.[n.id]).map(n => [id, n.id]));
    for (const [villager, need] of fresh) {
        const at = need === 'manger' && hungryOf(villager, presence) ? new Date(now - HUNGRY_AGO) : new Date(now);
        await db.query('INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [userId, villager, need, at]);
    }
}
// Parties d'un jeu à l'instant now (une de plus toutes les 2 h, 3 au plus) : { count, since }
const playsOf = (row, now) => chargesAt({ charges: row ? row.plays : minigames.PLAYS, charges_at: row ? row.plays_at : now }, minigames.PLAYS, now, minigames.PLAY_REGEN_MS);

// Ce que lisent les objectifs des quêtes (quests.HAVE) : owned = éléments du Grimoire ; stars = ses découvertes.
// moods : besoins des habitants déjà calculés (la vue de l'île), sinon calculés ici
async function factsOf(userId, owned, stars, conn = db, moods = null) {
    const { levels } = await levelsOf(userId, conn);
    const zones = await zonesOf(userId, conn);
    const placed = placedOf(await craftsOf(userId, conn));
    const filled = await needRowsOf(userId, conn);
    if (!moods) {
        const presence = await presenceOf(userId, conn);
        const residents = residentsOf(levels, zones, await settlersOf(userId, conn), presence);
        moods = moodsOf(residents, levels, zones, placed, filled, presence);
    }
    // Un besoin comblé depuis l'ouverture de la quête en cours (la dernière réclamée) reste fait pour elle, même s'il
    // revient avant qu'on la réclame. La faim de Cannelle à son arrivée (welcome, datée d'avant) ne compte pas
    const { rows: [last] } = await conn.query('SELECT MAX(claimed_at) AS at FROM world_quests WHERE user_id = $1', [userId]);
    const fedSince = Object.entries(filled).flatMap(([id, needs]) => Object.entries(needs)
        .filter(([, at]) => !last.at || new Date(at) >= last.at).map(([need]) => `${id}:${need}`));
    const friends = await friendsOf(userId, conn);
    const best = Math.max(0, ...Object.values(friends).map(f => f.points));
    return {
        crafts: placed.length, placed: new Set(placed.map(t => t.craft)), runs: await runsOf(userId, conn), stars,
        elements: new Set(owned), zones, levels,
        annexes: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_annexes WHERE user_id = $1', [userId]),
        houses: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_annexes WHERE user_id = $1 AND annex = $2', [userId, 'maison']),
        met: new Set([...Object.entries(moods).flatMap(([id, m]) => m.needs.filter(n => n.met).map(n => `${id}:${n.id}`)), ...fedSince]),
        awake: new Set(Object.entries(friends).filter(([, f]) => f.points > 0).map(([id]) => id)),
        hearts: villagers.heartsOf(best),
        expeditions: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_expeditions WHERE user_id = $1 AND ends_at <= NOW()', [userId]),
        landmarks: new Set((await foundOf(userId, conn)).keys()),
        gathered: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_deposits WHERE user_id = $1', [userId]),
        visitors: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_visitors WHERE user_id = $1 AND satisfied_at IS NOT NULL', [userId]),
        settled: await countOf(conn, 'SELECT COUNT(*)::int AS n FROM world_visitors WHERE user_id = $1 AND settled_at IS NOT NULL', [userId]),
        named: Boolean((await namesOf(userId, conn)).peuple)
    };
}

// Les cibles du fil d'Ariane (bible, § 6.1 à 6.3) : ce que demande la quête active. L'élément à écrire (ou l'une des
// bêtes), le plan du prochain palier du bâtiment demandé (une invention), les savoir-faire de la création demandée ;
// [] sinon. bookPages.arianeOf en tire le chemin le plus court
async function arianeTargets(userId) {
    const quest = quests.currentOf(await claimedOf(userId));
    const goal = quest && quest.goal;
    if (!goal) return [];
    if (goal.kind === 'element') return goal.any || [goal.element];
    if (goal.kind === 'craft') return crafts.CRAFT_BY_ID[goal.craft].elements;
    if (goal.kind !== 'level') return [];
    const level = (await levelsOf(userId)).levels[goal.site] || 0;
    const plan = level < goal.need ? SITES[goal.site].levels[level]?.plan : null;
    return plan ? [plan] : [];
}

// Le tableau de Brume, avec le chapitre encore fermé qu'attend la quête active (un quartier ou un palier d'un
// chapitre pas encore ouvert : le joueur doit d'abord écrire des découvertes). openChapters : Set des chapitres ouverts
function boardWith(claimed, facts, openChapters) {
    const out = quests.boardOf(claimed, facts);
    const quest = out.quest;
    if (!quest || quest.done) return out;
    const { goal } = quests.QUESTS[quest.step - 1];
    const next = goal.kind === 'level' && (facts.levels[goal.site] || 0) === goal.need - 1 ? SITES[goal.site].levels[goal.need - 1] : null;
    const chapter = goal.kind === 'zone' ? map.ZONE_BY_ID[goal.zone].chapter : next?.chapter;
    if (chapter && !openChapters.has(chapter)) quest.chapter = chapter;
    return out;
}
// Brume seule (quête active), sans le reste de l'île : le Grimoire la consulte après une découverte ; avec le nom du
// peuple, pour l'étape de civilisation (l'Ex libris du Grimoire)
async function board(userId, owned, stars, openChapters) {
    const out = boardWith(await claimedOf(userId), await factsOf(userId, owned, stars), openChapters);
    // Anya : le Grimoire allume sa gemme une fois la Révélation vue
    return { ...out, people: (await namesOf(userId)).peuple || null, anya: await anyaOf(userId) };
}

// Vue de l'île pour le navigateur. book = { describe(noms), openChapters: Set des chapitres ouverts, stars, finished }
async function view(userId, owned, book) {
    await migrate(userId);
    const { levels, builtAt } = await levelsOf(userId);
    const items = await itemsOf(userId);
    const skins = await skinsOf(userId);
    const signed = await signsOf(userId);
    const played = await gamesOf(userId);
    const friends = await friendsOf(userId);
    const named = await namesOf(userId);
    const annexRows = await annexesOf(userId);
    const shopBonuses = shop.bonusesOf(items);
    const stock = await stockOf(userId);
    const zones = await zonesOf(userId);
    const annexCells = new Set(annexRows.map(keyOf));
    const craftRows = await stowCrafts(userId, await craftsOf(userId), levels, zones, annexRows);
    const decor = placedOf(craftRows);
    const filled = await needRowsOf(userId);
    const settlers = await settlersOf(userId);
    const presence = await presenceOf(userId);
    const residents = residentsOf(levels, zones, settlers, presence);
    const moods = moodsOf(residents, levels, zones, decor, filled, presence);
    await welcome(userId, moods, filled, presence);
    const found = await foundOf(userId);
    const lmBonuses = landmarks.bonusesOf(found.keys());
    const { bonuses, extra } = withLandmarks(withMoods(shopBonuses, annexes.bonusesOf(annexRows), moods), lmBonuses);
    const effects = effectsOf(levels, bonuses, extra);
    const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
    // Le camp des naufragés sur la Grève (world/camp.js) : ses cases sont réservées (ni annexe ni création)
    const camp = await campOfUser(userId, db, { levels, annexRows, craftRows });
    const campCells = cellsOfCamp(camp);
    const taken = new Set([...annexCells, ...decor.map(keyOf), ...campCells]);
    const have = new Set(owned);
    const plans = Object.values(SITES).flatMap(s => s.levels.map(l => l.plan)).filter(Boolean);
    const known = book.describe(plans);
    // Production en attente : chaque heure avec l'humeur de son moment, comme au ramassage (prodSteps) ; un bâtiment
    // embrumé ne produit plus (withBlights)
    const now = Date.now();
    const blights = await blightsOf(userId);
    const island = { levels, zones, settlers, presence, decor, filled, blights };
    const steps = prodSteps(island, { bonuses: shopBonuses, extra: annexes.bonusesOf(annexRows) }, lmBonuses, stock.collected_at, now);
    const blighted = withBlights(bonuses, blights, now);
    const production = productionAll(levels, builtAt, stock.collected_at, now, blighted, extra, steps);
    const sites = Object.entries(SITES).map(([id, site]) => {
        const level = levels[id] || 0;
        const next = site.levels[level];
        const place = map.footprintOf(id, level);
        const zone = map.siteZone(id);
        const made = production.find(p => p.site === id);
        const step = l => ({
            name: l.name, plan: l.plan, planOwned: !l.plan || have.has(l.plan), planEmoji: l.plan ? known[l.plan]?.emoji || null : null,
            cost: l.cost, coins: l.coins, chapter: l.chapter, chapterOpen: book.openChapters.has(l.chapter), effect: l.effect
        });
        return {
            id, x: place.x, y: place.y, w: place.w, h: place.h, level, maxLevel: site.levels.length, zone, locked: !zones.has(zone),
            // Nom choisi par le joueur (dès le palier III), sinon celui du palier
            name: named[`site:${id}`] || (level ? site.levels[level - 1].name : site.levels[0].name),
            baseName: level ? site.levels[level - 1].name : site.levels[0].name,
            renamed: Boolean(named[`site:${id}`]), renameLevel: RENAME_LEVEL,
            effect: level ? site.levels[level - 1].effect : null,
            emoji: level && site.levels[level - 1].plan ? known[site.levels[level - 1].plan]?.emoji || null : null,
            produce: site.produce || null,
            // Boutique de l'atelier : articles (possédés ou non), skin porté, bonus de production
            shop: shop.ITEMS.filter(item => item.site === id).map(item => ({
                id: item.id, kind: item.kind, name: item.name, price: item.price, minLevel: item.minLevel, rare: Boolean(item.rare),
                ...(item.chapter ? { chapter: item.chapter } : {}),
                effect: shop.effectText(item), gain: item.effect || null, owned: items.has(item.id)
            })),
            skin: skins[id] || null,
            // Style de son enseigne (dès le palier V ; la planche de bois tant qu'aucun autre n'est choisi)
            sign: level >= signs.SIGN_LEVEL ? signed.worn[id] || 'bois' : null,
            bonus: Math.round((shopBonuses.prod[id] || 0) * 100),
            // Part de production en plus apportée par les lieux remarquables découverts
            landmarkBonus: Math.round((lmBonuses.prod[id] || 0) * 100),
            // Part de production en plus (ou en moins) selon l'humeur de son habitant
            moodBonus: site.produce ? Object.values(moods).filter(m => m.site === id && m.built).reduce((sum, m) => sum + villagers.moodSign(m.mood), 0) * Math.round(villagers.MOOD_STEP.prod * 100) : 0,
            // Tous les paliers, pour la fiche du bâtiment (atteints, suivant, à venir)
            levels: site.levels.map(step),
            pending: made ? { coins: made.coins, [made.resource]: made.amount } : null,
            // Rendement horaire avec les bonus de la boutique et les annexes (pour la fiche), heures de production gardées
            perHour: site.produce && level ? perHourOf(level, blighted.prod[id] || 0, bonuses.coins[id] || 0, extra.site[id] || []) : null,
            capHours: CAP_HOURS + (extra.cap[id] || 0),
            // Temps avant que sa réserve soit pleine (0 : pleine, la production attend le ramassage)
            fullIn: site.produce && level ? fullInOf(builtAt[id], stock.collected_at, CAP_HOURS + (extra.cap[id] || 0), now) : null,
            // Annexes : catalogue du bâtiment et cases libres où en poser une (dès le palier II)
            annexes: annexesView(id, annexRows),
            spots: level >= 2 && zones.has(zone) ? annexSpots(id, taken) : [],
            next: next ? step(next) : null
        };
    });
    // Ce que « Tout ramasser » donnerait maintenant, avec ce qui restait du dernier ramassage (world_stock.carry)
    const cash = cashOf(production, stock.carry);
    const pendingStock = cash.stock;
    // Ce qui paie une création : les réserves et ce qui attend (encaissé d'abord à l'assemblage)
    const paidStock = { ...stock, ...Object.fromEntries(RESOURCES.map(r => [r, stock[r] + pendingStock[r]])) };
    const claimed = await claimedOf(userId);
    const facts = await factsOf(userId, owned, book.stars ?? 0, db, moods);
    const visiting = await visitorNow(userId);
    const epreuves = await epreuvesOf(userId);
    const discovered = await discoveredOf(userId);
    const going = await expeditionOf(userId);
    const stockFinds = await findsOf(userId);
    const gathered = await depositsOf(userId);
    const hidden = map.ZONES.filter(z => !isKnown(z, discovered)).map(z => z.code).sort();
    const veil = map.veiled(new Set(hidden));
    // Les terres alentour restent fermées tant que le cœur de l'île n'est pas à soi : ce qui en manque, par noms
    const coreLeft = coreMissing(zones);
    const closedLands = coreLeft.length > 0;
    return {
        size: SIZE,
        map: {
            // Calques de la grande carte (relief, sol, quartiers : voir islandV5.js) ; grid : index des quartiers. Les
            // quartiers encore inconnus n'y montrent que leur côte et leur relief (worldMap.veiled). key : ce qui les
            // décide (la carte et ce qui reste voilé) ; un navigateur qui a déjà ces calques ne les reçoit plus
            // (routes/play/world.js, X-Map-Key)
            key: `${MAP_VERSION}:${hidden.join('')}`,
            grid: map.GRID,
            height: veil.height,
            ground: veil.ground,
            region: map.REGION,
            // Les quartiers du cœur de l'île pas encore à soi (noms) : tant qu'il en reste, les terres alentour sont fermées
            coreLeft,
            // Un quartier inconnu ne dit ni son nom, ni son climat, ni son prix : seulement s'il peut être exploré
            // (voisin d'un quartier à soi), en combien d'heures, et ce qu'emporte l'expédition
            zones: map.ZONES.map(z => (isKnown(z, discovered) ? {
                id: z.id, name: named[`zone:${z.id}`] || z.name, baseName: z.name, renamed: Boolean(named[`zone:${z.id}`]),
                price: z.price, chapter: z.chapter, code: z.code, anchor: map.ANCHORS[z.id], climate: z.climate, known: true,
                owned: zones.has(z.id), open: !z.chapter || book.openChapters.has(z.chapter)
            } : {
                id: z.id, name: null, code: z.code, anchor: map.ANCHORS[z.id], known: false, owned: false, open: false,
                // closed : le cœur de l'île n'est pas encore à soi (les terres alentour s'ouvrent après)
                trip: z.trip, cost: expeditionCost(z), closed: closedLands,
                explorable: !going && !closedLands && map.NEIGHBORS[z.id].some(id => zones.has(id))
            }))
        },
        // Lieux remarquables : ceux des quartiers connus (case, nom, ce qu'ils racontent et font, découverts ou non) ;
        // ceux des quartiers inconnus ne disent rien, sinon qu'ils existent
        landmarks: landmarks.LANDMARKS.map(l => (isKnown(map.ZONE_BY_ID[l.zone], discovered) ? {
            id: l.id, name: l.name, zone: l.zone, x: l.x, y: l.y, text: l.text, effect: landmarks.effectText(l), chest: l.chest,
            found: found.has(l.id), foundAt: found.get(l.id) || null
        } : { id: l.id, zone: l.zone, known: false })),
        // Trouvailles de climat (réserve à part) : nom, climat, nombre
        finds: finds.FINDS.map(f => ({ id: f.id, name: f.name, climate: f.climate, amount: stockFinds[f.id] })),
        // Gisements des quartiers connus : case, trouvaille, temps avant de repousser (ms, 0 : prêt), trouvailles de plus
        // grâce aux créations de climat de leur quartier
        deposits: finds.DEPOSITS.filter(d => isKnown(map.ZONE_BY_ID[d.zone], discovered))
            .map(d => ({ id: d.id, zone: d.zone, find: d.find, x: d.x, y: d.y, readyIn: finds.readyIn(gathered.get(d.id), Date.now(), presence.blessed ? anya.BLESSING.regrowMs : finds.REGROW_MS), bonus: craftBonusOf(decor, d.zone) })),
        // Expédition en route : vers quel quartier, retour dans combien de temps (ms)
        expedition: going ? { zone: going.zone, endsIn: Math.max(0, new Date(going.ends_at).getTime() - Date.now()) } : null,
        sites,
        stock: Object.fromEntries(RESOURCES.map(r => [r, stock[r]])),
        charges: { count: charges.count, max: effects.maxCharges, nextIn: charges.count < effects.maxCharges ? Math.max(0, charges.since + effects.regenMs - Date.now()) : null },
        harvest: { maxMoves: effects.maxMoves, kinds: effects.kinds, boosts: effects.boosts, coinEvery: HARVEST_COIN_EVERY },
        rates: { produce: PRODUCE_PER_LEVEL, coins: COINS_PER_LEVEL },
        capHours: CAP_HOURS,
        pending: cash.coins,
        pendingStock,
        // Créations d'île : paliers, catalogue, réserve et cases où poser, créations posées
        crafts: craftsView(craftRows, craftCtx(levels, zones, annexRows, craftRows, null, campCells), {
            owned: have, stock: paidStock, open: crafts.tiersOpen(book.finished || new Set(), epreuves, book.stars ?? 0), epreuves, stars: book.stars ?? 0, have: stockFinds
        }, id => sites.find(site => site.id === id)?.name || id),
        // Habitants (la troupe rencontrée, les visiteurs installés) : prénom, goûts, amitié, déjà vus ou gâtés
        // aujourd'hui ; leurs besoins, leur humeur et ce qu'elle fait ; built : son bâtiment est bâti (sinon il vit au
        // camp, ou dort dans son quartier) ; asleep : un dormeur qu'on n'a pas encore réveillé (bible, § 6.7)
        villagers: (() => {
            const { day } = loot.parisOf(Date.now());
            // Maisons dans l'ordre où elles sont posées : le premier visiteur installé loge dans la première
            const houses = annexRows.filter(r => r.annex === 'maison');
            return residents.map(v => {
                const friend = friends[v.id] || { points: 0 };
                const hearts = villagers.heartsOf(friend.points);
                const { needs, mood } = moods[v.id];
                const produces = Boolean(SITES[v.site].produce);
                const settled = v.seed !== undefined;
                const home = settled ? houses[settlers.findIndex(row => `v${row.id}` === v.id)] : null;
                return {
                    id: v.id, name: v.name, role: v.role, loves: v.loves, likes: v.likes, site: v.site, points: friend.points, hearts,
                    built: v.built, asleep: SLEEPERS.includes(v.id) && !v.built && !friend.points,
                    next: villagers.HEARTS[hearts] ?? null, talked: friend.talked === day, gifted: friend.gifted === day,
                    needs, mood, moodEffect: villagers.moodEffect(v.site, produces, mood), happyEffect: villagers.moodEffect(v.site, produces, 'heureux'),
                    ...(settled ? { seed: v.seed, home: home ? { x: home.x, y: home.y } : null } : {})
                };
            });
        })(),
        // Maisons du Foyer : posées, occupées par des visiteurs installés
        houses: { total: annexRows.filter(r => r.annex === 'maison').length, used: settlers.length },
        friendship: { talk: villagers.TALK, gift: villagers.GIFT, hearts: villagers.HEARTS, rewards: villagers.REWARDS },
        // Visiteur arrivé en bateau au Ponton (ou null) : sa demande, son départ
        visitor: visitorView(visiting, visiting ? await runsSince(userId, visiting.arrived_at) : 0),
        // Besoins : nom, durée et prix de chacun (se distraire : décorations, à tant de cases)
        needs: {
            kinds: Object.fromEntries(Object.entries(villagers.NEEDS).map(([id, n]) => [id, { label: n.label, ...(n.hours ? { hours: n.hours, cost: n.cost } : { decos: n.decos, reach: n.reach }) }]))
        },
        // Mini-jeux des bâtiments : ouverts au palier III, parties en réserve, multiplicateur d'écus du palier
        games: Object.entries(minigames.GAMES).map(([id, game]) => {
            const level = levels[game.site] || 0;
            const plays = playsOf(played[id], Date.now());
            return {
                id, site: game.site, name: game.name, text: game.text, level: minigames.GAME_LEVEL, open: level >= minigames.GAME_LEVEL,
                plays: plays.count, max: minigames.PLAYS, nextIn: plays.count < minigames.PLAYS ? Math.max(0, plays.since + minigames.PLAY_REGEN_MS - Date.now()) : null,
                mult: minigames.multOf(level), cap: Math.round(minigames.CAP * minigames.multOf(level))
            };
        }),
        // Enseignes : le nom écrit dessus, le palier où elles viennent, les styles (offert, acheté ou à acheter)
        signs: {
            name: signed.name, level: signs.SIGN_LEVEL, nameMax: signs.NAME_MAX,
            styles: signs.STYLES.map(st => ({ id: st.id, name: st.name, price: st.price, text: st.text, owned: !st.price || signed.owned.has(st.id) }))
        },
        annexes: annexRows.filter(r => annexes.ANNEX_BY_ID[r.annex]).map(r => ({ x: r.x, y: r.y, annex: r.annex, site: annexes.ANNEX_BY_ID[r.annex].site })),
        // Le camp des naufragés : [{ id, art (dessin de camp.json), x, y, w, h }]
        camp,
        // Le nom du peuple (bible, § 6.11), une fois choisi ; le nom du joueur (§ 9, étape 2) et son avatar (§ 6.17)
        people: named.peuple || null,
        player: named.joueur || null,
        avatar: await avatarOf(userId),
        // Brume, le feu follet : la quête active (ou son dernier mot)
        brume: (() => {
            const out = boardWith(claimed, facts, book.openChapters);
            // Le fil d'Ariane de la quête active : la cible et les pages qui restent (le Grimoire montre la page marquée)
            if (out.quest && !out.quest.done && book.ariane) out.quest.ariane = { target: book.ariane.target, remaining: book.ariane.remaining };
            return out;
        })(),
        // Le Savoir de Brume, une fois le Phare allumé : { open, talked }
        brumeSavoir: await brumeSavoirOf(userId),
        // Coffres : en attente, du jour, bouteille à la mer
        chests: chestsView(await openedOf(userId, Date.now()), book.openChapters, claimed, found),
        // Les mots d'Héliane déjà lus (la Chronique) et l'acte dont le mot attend la prochaine bouteille
        heliane: await helianeOfUser(userId),
        // Anya : ses traces, son éveil, la Révélation vue, son Souffle du jour
        anya: await anyaOf(userId),
        // Les nuits de créatures (v6, § 6.15) : présentées ou non, la nuit en cours ou la prochaine, ses égarés et leur
        // sort, le bâtiment embrumé et le prix de sa réparation
        nights: await nightsView(userId),
        // Les bêtes de ferme (v6, § 6.16) : le prix d'un repas, et pour chacune, contente ou non, sa bulle
        beasts: await beastsView(userId)
    };
}

// Réclame la récompense de la quête active de Brume : c'est bien elle, son objectif est atteint, versée une seule
// fois (même en double clic). owned : éléments du Grimoire ; stars : ses découvertes. { status, message } si refus
async function claimQuest(userId, questId, owned, stars) {
    await migrate(userId);
    return db.transaction(async conn => {
        const quest = quests.active(await claimedOf(userId, conn), await factsOf(userId, owned, stars, conn));
        if (!quest || quest.id !== questId) return db.rollback({ status: 409, message: 'Ce n’est pas la quête en cours.' });
        if (!quest.done) return db.rollback({ status: 403, message: `Pas encore : ${quest.label.toLowerCase()} (${quest.have}/${quest.need}).` });
        const added = await conn.query('INSERT INTO world_quests (user_id, quest) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING quest', [userId, questId]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Récompense déjà reçue.' });
        const { coins } = await ledger.credit(userId, quest.coins, 'quete', questId, conn);
        return { gained: quest.coins, coins };
    });
}

// Achat d'un quartier : chapitre ouvert, écus débités une fois (même en double clic) ; { status, message } si refus
async function buyZone(userId, zoneId, openChapters) {
    const zone = map.ZONE_BY_ID[zoneId];
    if (!zone || zone.id === 'coeur') return { status: 404, message: 'Quartier inconnu.' };
    await migrate(userId);
    // Inconnu : rien n'en est dit (pas même son chapitre)
    if (!isKnown(zone, await discoveredOf(userId))) return { status: 403, message: 'Envoie d’abord une expédition découvrir ce quartier.' };
    if (zone.chapter && !openChapters.has(zone.chapter)) return { status: 403, message: `Ouvre d’abord le chapitre ${zone.chapter} du Grimoire.` };
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const added = await conn.query('INSERT INTO world_zones (user_id, zone) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING zone', [userId, zone.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Ce quartier est déjà à toi.' });
        // Les écus qui attendent dans les bâtiments sont encaissés d'abord : ils comptent pour payer
        await payWith(userId, conn, stock);
        const coins = await ledger.debit(userId, zone.price, `quartier:${zone.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${zone.price} écus.` });
        return { bought: zone.name, coins };
    });
}

// Construit le palier suivant d'un chantier : chapitre du palier ouvert dans le Livre, plan découvert, ressources,
// écus (débités une seule fois, même en double clic). openChapters : Set des chapitres ouverts.
// Les décorations prises dans une emprise agrandie sont déplacées au prochain affichage (settle). { status, message } si refus
async function build(userId, owned, siteId, openChapters = new Set()) {
    const site = SITES[siteId];
    if (!site) return { status: 404, message: 'Chantier inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(siteId))) return db.rollback({ status: 403, message: 'Achète d’abord ce quartier de l’île.' });
        const { levels } = await levelsOf(userId, conn);
        const level = levels[siteId] || 0;
        const next = site.levels[level];
        if (!next) return db.rollback({ status: 409, message: 'Ce chantier est déjà achevé.' });
        if (!openChapters.has(next.chapter)) return db.rollback({ status: 403, message: `Ouvre d’abord le chapitre ${next.chapter} du Grimoire.` });
        if (next.plan && !owned.includes(next.plan)) return db.rollback({ status: 403, message: `Il te faut le plan : découvre « ${next.plan} » dans le Grimoire.` });
        // Ce que les bâtiments avaient produit est encaissé d'abord : cela compte pour payer (et la production du bâtiment
        // repart de zéro à l'évolution)
        const gathered = await gather(userId, conn, stock);
        const missing = Object.entries(next.cost).filter(([r, n]) => stock[r] + (gathered.stock[r] || 0) < n);
        if (missing.length) return db.rollback({ status: 400, message: 'Il te manque des ressources : joue une Récolte.' });
        const costs = RESOURCES.map(r => next.cost[r] || 0);
        let coins;
        if (next.coins) {
            coins = await ledger.debit(userId, next.coins, `chantier:${siteId}:${level + 1}`, conn);
            if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${next.coins} écus.` });
        }
        await conn.query('UPDATE world_stock SET stone = stone - $2, wood = wood - $3, water = water - $4, food = food - $5 WHERE user_id = $1', [userId, ...costs]);
        await conn.query(
            `INSERT INTO world_buildings (user_id, site, level) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, site) DO UPDATE SET level = EXCLUDED.level, built_at = NOW()`, [userId, siteId, level + 1]);
        return { built: next.name, ...(coins !== undefined ? { coins } : {}) };
    });
}

// Nouvelle partie de Récolte : une partie de la réserve, une graine, la configuration figée de l'île
function startRun(userId) {
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        const { bonuses, extra } = await bonusesFor(userId, conn);
        const effects = effectsOf(levels, bonuses, extra);
        const charges = chargesAt(stock, effects.maxCharges, Date.now(), effects.regenMs);
        if (charges.count < 1) return db.rollback({ status: 409, message: 'Plus de partie en réserve : la prochaine revient bientôt.' });
        await conn.query('UPDATE world_stock SET charges = $2, charges_at = $3 WHERE user_id = $1', [userId, charges.count - 1, new Date(charges.since)]);
        const seed = crypto.randomInt(1, 2147483647);
        const first = !(await conn.query('SELECT 1 FROM world_runs WHERE user_id = $1 LIMIT 1', [userId])).rows.length;
        const { boosts } = effects;
        const kinds = first ? FIRST_RUN_KINDS : effects.kinds;
        const maxMoves = effects.maxMoves + (first ? FIRST_RUN_MOVES : 0);
        // Heure prise après le verrou de la réserve (et non au début de la transaction) : un achat passé avant ce
        // départ est toujours plus ancien (undoItem)
        const { rows } = await conn.query(
            'INSERT INTO world_runs (user_id, seed, config, created_at) VALUES ($1, $2, $3, clock_timestamp()) RETURNING id',
            [userId, seed, JSON.stringify({ kinds, maxMoves, boosts })]);
        return { run: { id: Number(rows[0].id), seed, kinds, maxMoves, boosts } };
    });
}

// Fin de partie : le serveur rejoue les coups ; la partie ne se rend qu'une fois, même refusée
function finishRun(userId, runId, moves) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'SELECT seed, config, created_at FROM world_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cette partie est déjà rendue.' });
        // played : les coups joués ; une partie quittée sans jouer ne compte ni pour les quêtes ni pour les visiteurs
        await conn.query(`UPDATE world_runs SET finished_at = NOW(), config = config || jsonb_build_object('played', $2::int) WHERE id = $1`,
            [runId, Array.isArray(moves) ? moves.length : 0]);
        const { seed, config, created_at: createdAt } = rows[0];
        const played = Date.now() - new Date(createdAt).getTime() > RUN_TTL_MS
            ? { ok: false, error: 'Partie expirée' }
            : harvest.replay(seed, config.kinds, moves, config.maxMoves, config.boosts);
        if (!played.ok) return { status: 400, message: `Partie refusée : ${played.error.toLowerCase()}.` };
        await stockOf(userId, conn, true);
        const g = played.gains;
        await addStock(userId, g, conn);
        // Et des écus : 1 par tranche de 10 ressources gagnées, versés une seule fois pour cette partie
        const earned = Math.floor((g.stone + g.wood + g.water + g.food) / HARVEST_COIN_EVERY);
        if (earned > 0) await ledger.credit(userId, earned, 'recolte', runId, conn);
        // Parfois un coffre (sûr avec une grande chaîne)
        const rarity = loot.harvestChest(moves.length, Math.max(0, ...moves.map(path => path.length)), random);
        const chest = rarity ? await grant(userId, `recolte:${runId}`, rarity, conn) : null;
        // coins : le solde (écus de la partie et du coffre compris)
        return { gains: g, earned, coins: await balanceOf(userId, conn), chest };
    });
}

// Nouvelle partie d'un mini-jeu (bâtiment au palier III ou plus) : une partie de sa réserve, une graine. { run } ou
// { status, message }
async function startGame(userId, gameId) {
    const game = minigames.GAMES[gameId];
    if (!game) return { status: 404, message: 'Mini-jeu inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const level = (await levelsOf(userId, conn)).levels[game.site] || 0;
        if (level < minigames.GAME_LEVEL) return db.rollback({ status: 403, message: `${game.name} : au palier III du bâtiment.` });
        const now = Date.now();
        const plays = playsOf((await gamesOf(userId, conn))[gameId], now);
        if (plays.count < 1) return db.rollback({ status: 409, message: 'Plus de partie en réserve : la prochaine revient bientôt.' });
        await conn.query(`INSERT INTO world_games (user_id, game, plays, plays_at) VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, game) DO UPDATE SET plays = EXCLUDED.plays, plays_at = EXCLUDED.plays_at`, [userId, gameId, plays.count - 1, new Date(plays.since)]);
        const seed = crypto.randomInt(1, 2147483647);
        const { rows } = await conn.query('INSERT INTO world_game_runs (user_id, game, seed, level) VALUES ($1, $2, $3, $4) RETURNING id', [userId, gameId, seed, level]);
        return { run: { id: Number(rows[0].id), game: gameId, seed, level } };
    });
}

// Fin d'une partie de mini-jeu : le serveur rejoue les gestes et verse les écus (une seule fois : la partie se rend
// une fois, même refusée). { earned, raw, detail, coins } ou { status, message }
function finishGame(userId, runId, input) {
    return db.transaction(async conn => {
        const { rows } = await conn.query(
            'SELECT game, seed, level, created_at FROM world_game_runs WHERE id = $1 AND user_id = $2 AND finished_at IS NULL FOR UPDATE', [runId, userId]);
        if (!rows.length) return db.rollback({ status: 404, message: 'Cette partie est déjà rendue.' });
        await conn.query('UPDATE world_game_runs SET finished_at = NOW() WHERE id = $1', [runId]);
        const { game, seed, level, created_at: createdAt } = rows[0];
        const elapsed = Date.now() - new Date(createdAt).getTime();
        if (elapsed > GAME_TTL_MS) return { status: 400, message: 'Partie refusée : partie expirée.' };
        const played = minigames.replay(game, seed, input);
        if (!played.ok) return { status: 400, message: `Partie refusée : ${played.error}.` };
        if (played.last > elapsed + GAME_SLACK_MS) return { status: 400, message: 'Partie refusée : partie trop rapide.' };
        const earned = minigames.earnedOf(played.raw, level);
        if (earned > 0) await ledger.credit(userId, earned, `jeu:${game}`, runId, conn);
        return { earned, raw: played.raw, detail: played.detail, coins: await balanceOf(userId, conn) };
    });
}

// Décorations de l'ancienne règle (éléments du Livre posés n'importe où) : remboursées au prix payé, une seule fois,
// puis retirées de l'île (lot 8). priceOf(élément) : prix selon son chapitre. { count, coins, balance } (count 0 : rien
// à faire ; balance : solde après remboursement)
async function refundDecorations(userId, priceOf) {
    const seen = await db.query('SELECT 1 FROM world_tiles WHERE user_id = $1 LIMIT 1', [userId]);
    if (!seen.rows.length) return { count: 0, coins: 0 };
    // Les cartes d'avant d'abord : leur passage paie encore les écus dus par les décorations
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        const { rows } = await conn.query('SELECT element FROM world_tiles WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!rows.length) return { count: 0, coins: 0 };
        const coins = rows.reduce((sum, r) => sum + (priceOf(r.element) || 0), 0);
        if (coins > 0) await ledger.credit(userId, coins, 'remboursement', 'decorations', conn);
        await conn.query('DELETE FROM world_tiles WHERE user_id = $1', [userId]);
        return { count: rows.length, coins, balance: await balanceOf(userId, conn) };
    });
}

// Achat d'un article de la boutique d'un atelier : bâtiment construit (au niveau demandé) dans un quartier possédé,
// écus débités une seule fois. La production en cours est encaissée d'abord (le bonus ne vaut que pour la suite).
async function buyItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 403, message: 'Cette pièce rare ne s’achète pas : elle se trouve dans les butins.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        const { levels } = await levelsOf(userId, conn);
        if (!(await zonesOf(userId, conn)).has(map.siteZone(item.site)) || !(levels[item.site] || 0)) return db.rollback({ status: 403, message: 'Bâtis d’abord ce bâtiment.' });
        if (levels[item.site] < item.minLevel) return db.rollback({ status: 403, message: `Il faut le palier ${CHAPTER_OF_LEVEL[item.minLevel - 1]} de ce bâtiment.` });
        const added = await conn.query('INSERT INTO world_items (user_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item', [userId, item.id]);
        if (!added.rows.length) return db.rollback({ status: 409, message: 'Tu l’as déjà.' });
        await gather(userId, conn, stock);
        const coins = await ledger.debit(userId, item.price, `boutique:${item.id}`, conn);
        if (coins === null) return db.rollback({ status: 400, message: `Il te faut ${item.price} écus.` });
        // Un skin acheté est porté tout de suite
        if (item.kind === 'skin') {
            await conn.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
                ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, item.site, item.id]);
        }
        return { bought: item.name, coins };
    });
}

// Effets de la boutique figés au départ d'une partie de Récolte ou d'une expédition : coups, réserve, recharge
const RUN_EFFECTS = ['moves', 'charges', 'regenMs'];
// Une partie de Récolte ou une expédition partie depuis `since` ?
async function startedSince(userId, conn, since) {
    const { rows } = await conn.query(
        `SELECT 1 FROM world_runs WHERE user_id = $1 AND created_at >= $2
         UNION ALL SELECT 1 FROM world_expeditions WHERE user_id = $1 AND started_at >= $2 LIMIT 1`, [userId, since]);
    return rows.length > 0;
}

// Annulation d'un achat de la boutique juste après (achat en un toucher) : l'article est rendu, ses écus remboursés
// une seule fois (même en double clic), son skin retiré s'il était porté. Un article gagné dans un coffre ne se rend
// pas, ni un article qui a déjà servi (une partie ou une expédition partie depuis l'achat a emporté ses coups, sa
// réserve ou sa recharge). { status, message } si refus ou trop tard
async function undoItem(userId, itemId) {
    const item = shop.ITEM_BY_ID[itemId];
    if (!item) return { status: 404, message: 'Article inconnu.' };
    if (item.rare) return { status: 409, message: 'Une pièce rare ne se rend pas.' };
    return db.transaction(async conn => {
        // La production jusqu'ici compte encore avec l'article
        await gather(userId, conn, await stockOf(userId, conn, true));
        const removed = await conn.query(
            `DELETE FROM world_items WHERE user_id = $1 AND item = $2 AND source = 'boutique' AND bought_at > NOW() - make_interval(secs => $3) RETURNING bought_at`,
            [userId, item.id, UNDO_SECONDS]);
        if (!removed.rows.length) return db.rollback({ status: 409, message: 'Trop tard pour annuler cet achat.' });
        if (RUN_EFFECTS.some(effect => item.effect?.[effect]) && await startedSince(userId, conn, removed.rows[0].bought_at)) {
            return db.rollback({ status: 409, message: 'Cet article a déjà servi à une partie : il ne se rend plus.' });
        }
        await conn.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2 AND skin = $3', [userId, item.site, item.id]);
        const { coins } = await ledger.credit(userId, item.price, 'boutique-annulee', `${item.id}:${removed.rows[0].bought_at.getTime()}`, conn);
        return { undone: item.name, coins };
    });
}

// Skin porté par un bâtiment : un skin possédé de ce bâtiment, ou aucun (apparence d'origine)
async function chooseSkin(userId, siteId, skinId) {
    if (!SITES[siteId]) return { status: 404, message: 'Bâtiment inconnu.' };
    if (!skinId) {
        await db.query('DELETE FROM world_skins WHERE user_id = $1 AND site = $2', [userId, siteId]);
        return {};
    }
    const item = shop.ITEM_BY_ID[skinId];
    if (!item || item.kind !== 'skin' || item.site !== siteId) return { status: 400, message: 'Ce skin ne va pas sur ce bâtiment.' };
    // L'article reste verrouillé le temps de le porter : une annulation de son achat (undoItem) attend, ou se fait
    // attendre puis le retire ; sans ce verrou, un skin remboursé pouvait rester porté
    return db.transaction(async conn => {
        const owned = await conn.query('SELECT 1 FROM world_items WHERE user_id = $1 AND item = $2 FOR SHARE', [userId, skinId]);
        if (!owned.rows.length) return db.rollback({ status: 403, message: item.rare ? 'Trouve d’abord cette pièce rare dans les butins.' : 'Achète d’abord ce skin.' });
        await conn.query(`INSERT INTO world_skins (user_id, site, skin) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, site) DO UPDATE SET skin = EXCLUDED.skin`, [userId, siteId, skinId]);
        return {};
    });
}

// Le nom du peuple (bible, § 6.11 ; la quête « peuple » de l'acte V) : même règle que les autres noms, rangé dans
// world_names sous la cible 'peuple' ; il peut changer, jamais s'effacer. { name } ou { status, message }
async function namePeople(userId, raw) {
    const name = naming.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    await db.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, 'peuple', $2)
        ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return { name };
}

// Le nom du joueur (bible, § 9, étape 2 : « écris-le dans le Grimoire ») : même règle que les autres noms, rangé dans
// world_names sous la cible 'joueur' ; il peut changer, jamais s'effacer. { name } ou { status, message }
async function namePlayer(userId, raw) {
    const name = naming.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    await db.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, 'joueur', $2)
        ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return { name };
}

// L'avatar du joueur (bible, § 6.17), choisi sur sa carte d'embarquement au tutoriel : l'un des exemples dessinés par la
// bibliothèque du front, en attendant son générateur (H9.4). Il peut changer. { look } ou { status, message }
const LOOK = /^avatar-(0[1-9]|1[0-2])$/;
async function chooseAvatar(userId, look) {
    if (typeof look !== 'string' || !LOOK.test(look)) return { status: 400, message: 'Avatar inconnu.' };
    await db.query(`INSERT INTO world_avatars (user_id, look) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET look = EXCLUDED.look, chosen_at = NOW()`, [userId, look]);
    return { look };
}

// Nom d'un bâtiment (dès son palier III) ou d'un quartier à soi ; un nom vide rend celui d'origine.
// kind : 'site' | 'zone'. { status, message } si refus
async function rename(userId, kind, id, raw) {
    const known = kind === 'site' ? Boolean(SITES[id]) : kind === 'zone' && map.ZONES.some(z => z.id === id);
    if (!known) return { status: 404, message: kind === 'zone' ? 'Quartier inconnu.' : 'Bâtiment inconnu.' };
    const reset = !String(raw ?? '').trim();
    const name = reset ? null : naming.cleanName(raw);
    if (!reset && !name) return { status: 400, message: `Un nom de 2 à ${naming.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await migrate(userId);
    return db.transaction(async conn => {
        await stockOf(userId, conn, true);
        if (kind === 'site') {
            const site = SITES[id];
            if (((await levelsOf(userId, conn)).levels[id] || 0) < RENAME_LEVEL) return db.rollback({ status: 403, message: 'Un bâtiment se renomme dès son palier III.' });
            if (!(await zonesOf(userId, conn)).has(map.siteZone(id))) return db.rollback({ status: 403, message: `${site.levels[0].name} : achète d’abord son quartier.` });
        } else if (!(await zonesOf(userId, conn)).has(id)) {
            return db.rollback({ status: 403, message: 'Achète d’abord ce quartier pour le renommer.' });
        }
        const target = `${kind}:${id}`;
        if (reset) await conn.query('DELETE FROM world_names WHERE user_id = $1 AND target = $2', [userId, target]);
        else await conn.query(`INSERT INTO world_names (user_id, target, name) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, target) DO UPDATE SET name = EXCLUDED.name`, [userId, target, name]);
        return {};
    });
}

// Nom écrit sur les enseignes de l'île. { status, message } si le nom ne convient pas
async function nameSigns(userId, raw) {
    const name = signs.cleanName(raw);
    if (!name) return { status: 400, message: `Un nom de 2 à ${signs.NAME_MAX} lettres ou chiffres (espace, tiret ou apostrophe entre deux).` };
    await db.query(`INSERT INTO world_sign_names (user_id, name) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name`, [userId, name]);
    return {};
}

// Style de l'enseigne d'un bâtiment au palier V ou plus : acheté au passage s'il ne l'est pas encore (payé une seule
// fois, même en double clic), puis porté. { coins } après un achat, {} sinon, ou { status, message } si refus
async function chooseSign(userId, siteId, styleId) {
    if (!SITES[siteId]) return { status: 404, message: 'Bâtiment inconnu.' };
    const style = signs.STYLE_BY_ID[styleId];
    if (!style) return { status: 404, message: 'Style d’enseigne inconnu.' };
    await migrate(userId);
    return db.transaction(async conn => {
        const stock = await stockOf(userId, conn, true);
        if (((await levelsOf(userId, conn)).levels[siteId] || 0) < signs.SIGN_LEVEL) return db.rollback({ status: 403, message: 'L’enseigne vient au palier V du bâtiment.' });
        let coins;
        if (style.price) {
            const bought = await conn.query('INSERT INTO world_sign_styles (user_id, style) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING style', [userId, style.id]);
            if (bought.rows.length) {
                // Les écus qui attendent dans les bâtiments sont encaissés d'abord : ils comptent pour payer
                await payWith(userId, conn, stock);
                coins = await ledger.debit(userId, style.price, 'enseigne', conn);
                if (coins === null) return db.rollback({ status: 400, message: `Ce style coûte ${style.price} écus.` });
            }
        }
        await conn.query(`INSERT INTO world_signs (user_id, site, style) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, site) DO UPDATE SET style = EXCLUDED.style`, [userId, siteId, style.id]);
        return coins === undefined ? {} : { coins };
    });
}

module.exports = {
    SIZE, CAP_HOURS, REGEN_MS, DECO_PRICES, SITES, effectOf, pendingOf, chargesAt, effectsOf, productionOf,
    view, build, buyZone, buyItem, undoItem, chooseSkin, startRun, finishRun, collect, migrate, claimQuest, board, openChest, openAll,
    placeAnnex, moveAnnex, annexSpotOk, nameSigns, chooseSign, startGame, finishGame, befriend, fillNeeds, satisfyVisitor, settleVisitor, rename, namePeople, namePlayer, chooseAvatar, arianeTargets,
    refundDecorations, startCraft, finishCraft, placeCraft, moveCraft, storeCraft, startExpedition, findLandmark, gatherDeposit,
    anyaOf, breathRefused, revealAnya, breatheAnya, brumeSavoirOf, talkBrume, startNights, repelCreature, repairSite,
    feedBeast, collectBeasts
};
