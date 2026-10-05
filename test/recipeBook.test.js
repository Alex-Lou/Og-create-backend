// Indices calculés par le serveur : fonctions pures sur un petit livre de recettes
const test = require('node:test');
const assert = require('node:assert/strict');
const { combine, unexplored, nextStep, keyOf } = require('../src/services/recipeBook');

const RULES = { 'Eau+Feu': 'Vapeur', 'Air+Vapeur': 'Nuage', 'Eau+Nuage': 'Pluie', 'Feu+Terre': 'Lave' };
const recipes = new Map(Object.entries(RULES).map(([key, result]) => [keyOf(key.split('+')), result]));
const BOOK = { recipes, entries: [...recipes].map(([key, result]) => [key.split('+'), result]) };
const BASE = ['Eau', 'Feu', 'Terre', 'Air'];

test('un mélange ne dépend pas de l’ordre des ingrédients', () => {
  assert.equal(combine(BOOK, ['Feu', 'Eau']), 'Vapeur');
  assert.equal(combine(BOOK, ['Eau', 'Eau']), null);
});

test('l’étape suivante remonte vers une fusion faisable tout de suite', () => {
  assert.deepEqual(nextStep(BOOK, BASE, ['Pluie']), { ingredients: ['Eau', 'Feu'], result: 'Vapeur' });
  assert.deepEqual(nextStep(BOOK, [...BASE, 'Vapeur'], ['Pluie']), { ingredients: ['Air', 'Vapeur'], result: 'Nuage' });
  assert.equal(nextStep(BOOK, ['Eau'], ['Pluie']), null);
});

test('recettes inexplorées par élément possédé', () => {
  assert.deepEqual(unexplored(BOOK, [...BASE, 'Vapeur']), { Air: 1, Vapeur: 1, Eau: 1, Feu: 1, Terre: 1 });
});

test('fusion de la progression de l’Épreuve', () => {
  const { merge } = require('../src/services/timerProgress');
  const merged = merge(
    { completedQuestions: { Facile: { A: [1] } }, unlockedCategories: { Facile: ['A'] }, bestScores: { Facile: 5 } },
    { completedQuestions: { Moyen: { B: [2] } }, unlockedCategories: { Facile: ['A', 'B'], Moyen: ['C'] }, bestScores: { Facile: 3, Moyen: 2 } });
  // Les records envoyés par le navigateur ne sont pas gardés
  assert.deepEqual(merged, {
    completedQuestions: { Facile: { A: [1] }, Moyen: { B: [2] } },
    unlockedCategories: { Facile: ['A', 'B'], Moyen: ['C'], Difficile: [] }
  });
});

test('le Livre : pages trouvées, pages à portée sans nom, chapitres scellés', () => {
  const { view, reachableById, pageId } = require('../src/services/bookPages');
  const meta = new Map([
    ['Eau', { emoji: '💧', family: 'Elements Fondamentaux' }], ['Feu', { emoji: '🔥', family: 'Elements Fondamentaux' }],
    ['Terre', { emoji: '🌱', family: 'Elements Fondamentaux' }], ['Air', { emoji: '💨', family: 'Elements Fondamentaux' }],
    ['Vapeur', { emoji: '♨️', family: 'Matériaux', riddle: 'Je m’élève en soupirant.' }], ['Nuage', { emoji: '☁️', family: 'Phénomènes Naturels' }],
    ['Pluie', { emoji: '🌧️', family: 'Phénomènes Naturels' }], ['Lave', { emoji: '🌋', family: 'Matériaux' }]
  ]);
  const b = { ...BOOK, meta };
  const start = view(b, BASE);
  assert.equal(start.stars, 0);
  const [one, two, three] = start.chapters;
  assert.equal(one.pages.filter(p => p.status === 'found').length, 4);
  assert.equal(one.far, 2);
  const reach = two.pages.filter(p => p.status === 'reach');
  assert.equal(reach.length, 2);
  // Aucune page à portée ne porte de nom ni d'emoji : seulement famille, longueur et indice de familles
  for (const page of reach) {
    assert.equal(page.name, undefined);
    assert.equal(page.emoji, undefined);
    assert.deepEqual(page.clue, ['Elements Fondamentaux', 'Elements Fondamentaux']);
  }
  // L'énigme de l'élément accompagne sa page ; un élément sans énigme n'en porte pas
  assert.equal(reach.find(p => p.id === pageId('Vapeur')).riddle, 'Je m’élève en soupirant.');
  assert.equal(reach.find(p => p.id === pageId('Lave')).riddle, undefined);
  assert.ok(two.verse);
  assert.equal(three.open, false);
  assert.deepEqual(three.pages, []);
  // L'identifiant d'une page à portée retrouve son élément côté serveur seulement
  assert.equal(reachableById(b, BASE, pageId('Vapeur')).name, 'Vapeur');
  assert.equal(reachableById(b, BASE, pageId('Pluie')), null);
  // Une page trouvée montre sa recette
  const after = view(b, [...BASE, 'Vapeur']);
  const vapeur = after.chapters[1].pages.find(p => p.name === 'Vapeur');
  assert.deepEqual(vapeur.recipe, ['Eau', 'Feu']);
  assert.equal(vapeur.riddle, 'Je m’élève en soupirant.');
  assert.equal(after.stars, 1);
});

test('le Livre : difficulté par chapitre (pages ouvertes, profondeur, plateau, aides)', () => {
  const { view, pageId, DIFFICULTY } = require('../src/services/bookPages');
  const meta = new Map(BASE.map(name => [name, { emoji: '·', family: 'Elements Fondamentaux' }]));
  const entries = [];
  // Chapitre I : cinq phénomènes à un mélange des éléments premiers, un sixième à deux mélanges
  const pairs = [['Eau', 'Eau'], ['Eau', 'Feu'], ['Air', 'Eau'], ['Feu', 'Feu'], ['Air', 'Air']];
  pairs.forEach((parts, i) => { meta.set(`Phéno${i}`, { emoji: '·', family: 'Phénomènes Naturels' }); entries.push([parts, `Phéno${i}`]); });
  meta.set('Profond', { emoji: '·', family: 'Phénomènes Naturels' });
  entries.push([['Eau', 'Phéno0'], 'Profond']);
  // Chapitre V : 25 matériaux possédés ouvrent le chapitre ; une création à portée
  const fillers = Array.from({ length: 25 }, (_, i) => `Matière${i}`);
  fillers.forEach(name => meta.set(name, { emoji: '·', family: 'Matériaux' }));
  meta.set('Outil', { emoji: '·', family: 'Créations Humaines' });
  entries.push([['Matière0', 'Terre'], 'Outil']);
  const b = { meta, entries };

  const start = view(b, BASE);
  const one = start.chapters[0];
  const reach = one.pages.filter(p => p.status === 'reach');
  assert.equal(reach.length, DIFFICULTY.I.open);
  assert.equal(one.sealed, 5 - DIFFICULTY.I.open);
  for (const page of reach) {
    // Premiers chapitres : première lettre ; aucun ingrédient offert d'emblée, l'encre l'est après quelques ratés
    assert.equal(page.first, 'P');
    assert.equal(page.given, undefined);
    assert.equal(page.freeInkAfter, DIFFICULTY.I.freeInkAfter);
    // Plateau : seulement des éléments possédés, bons ingrédients compris, leurres bornés
    assert.ok(page.tray.every(name => BASE.includes(name)));
    assert.ok(page.tray.length <= new Set(page.groups).size + DIFFICULTY.I.decoys);
  }
  // Le plateau ne bouge pas d'un chargement à l'autre
  assert.deepEqual(view(b, BASE).chapters[0].pages.map(p => p.tray), one.pages.map(p => p.tray));

  // Profondeur : avec Phéno0 en main, l'élément à deux mélanges passe après ceux à un mélange
  const later = view(b, [...BASE, 'Phéno0']).chapters[0];
  assert.ok(!later.pages.some(p => p.id === pageId('Profond')));
  assert.equal(later.sealed, 2);

  // Chapitre V : ni première lettre ni ingrédient offert, encre offerte plus tard, plateau plus large
  const deep = view(b, [...BASE, ...fillers]).chapters[4];
  assert.equal(deep.open, true);
  const outil = deep.pages.find(p => p.status === 'reach');
  assert.equal(outil.first, undefined);
  assert.equal(outil.given, undefined);
  assert.equal(outil.freeInkAfter, DIFFICULTY.V.freeInkAfter);
  assert.equal(outil.tray.length, 2 + DIFFICULTY.V.decoys);
  assert.ok(outil.tray.includes('Matière0') && outil.tray.includes('Terre'));
});

test('le Livre : la recette d’une page grandit avec le chapitre, sans dépasser les emplacements', () => {
  const { view, reachableById, aim, pageId } = require('../src/services/bookPages');
  const meta = new Map(BASE.map(name => [name, { emoji: '·', family: 'Elements Fondamentaux' }]));
  const add = (name, family) => meta.set(name, { emoji: '·', family });
  // Trois familles possédées : l'Athanor a 3 emplacements ; cinq découvertes ouvrent le chapitre III
  ['Brume', 'Rosée', 'Givre'].forEach(name => add(name, 'Phénomènes Naturels'));
  ['Sel', 'Argile'].forEach(name => add(name, 'Matériaux'));
  add('Étoile', 'Cosmos');
  add('Comète', 'Cosmos');
  const entries = [
    [['Air', 'Feu'], 'Étoile'],
    [['Air', 'Feu', 'Brume'], 'Étoile'],
    [['Eau', 'Feu', 'Sel', 'Argile'], 'Comète']
  ];
  const b = { meta, entries };
  const owned = [...BASE, 'Brume', 'Rosée', 'Givre', 'Sel', 'Argile'];
  const three = view(b, owned).chapters[2];
  const etoile = three.pages.find(p => p.id === pageId('Étoile'));
  // Chapitre III : la recette à 3 ingrédients plutôt que la paire
  assert.deepEqual(etoile.groups, [0, 1, 2]);
  assert.deepEqual(reachableById(b, owned, pageId('Étoile')).parts, ['Air', 'Feu', 'Brume']);
  assert.deepEqual(aim(b, owned, pageId('Étoile'), ['Air', 'Feu']), { name: 'Étoile', right: 2, of: 3 });
  // Une recette à 4 ne tient pas dans 3 emplacements : la page reste loin
  assert.equal(three.pages.some(p => p.id === pageId('Comète')), false);
  assert.equal(reachableById(b, owned, pageId('Comète')), null);
  assert.equal(three.far, 1);
});

test('le pendu : lettre posée dans une case, verdicts, masque et illustration', () => {
  const { fold, state, judge, solvedBy, maxMisses } = require('../src/services/hangman');
  assert.equal(fold('É'), 'E');
  assert.equal(fold('ç'), 'C');
  assert.equal(fold('-'), null);
  assert.equal(fold('œ'), null);
  assert.equal(maxMisses('I'), 3);
  assert.equal(maxMisses('V'), 2);
  // Juste, présente ailleurs, absente (accents ignorés)
  assert.equal(judge('Éclair', 0, 'E'), 'hit');
  assert.equal(judge('Éclair', 1, 'E'), 'elsewhere');
  assert.equal(judge('Éclair', 1, 'Z'), 'miss');
  // Rien de posé : la première lettre (donnée par la page) et les tirets, ni emoji ni nom
  const start = state('Arc-en-ciel', null, 3, true, '🌈');
  assert.deepEqual(start.mask, ['A', null, null, '-', null, null, '-', null, null, null, null]);
  assert.equal(start.emoji, undefined);
  assert.equal(start.name, undefined);
  // Une lettre posée : seulement sa case, et l'illustration commence à paraître
  const one = state('Éclair', { letters: 'EQ', revealed: [0], misses: 1 }, 3, false, '⚡');
  assert.deepEqual(one.mask, ['É', null, null, null, null, null]);
  assert.deepEqual(one.absent, ['Q']);
  assert.equal(one.emoji, '⚡');
  assert.ok(Math.abs(one.share - 1 / 6) < 1e-9);
  // Mot complet (première lettre donnée comprise)
  assert.equal(solvedBy('Vent', [1, 2, 3], true), true);
  assert.equal(solvedBy('Vent', [1, 2], true), false);
  // Partie perdue : rejouable 24 h plus tard, avec toutes ses vies
  const now = new Date('2026-10-04T12:00:00Z');
  const lost = state('Vent', { letters: 'XYZ', revealed: [], misses: 3, failed_at: new Date('2026-10-04T11:00:00Z') }, 3, true, '🌬️', now);
  assert.equal(lost.failedUntil, '2026-10-05T11:00:00.000Z');
  const later = state('Vent', { letters: 'XYZ', revealed: [], misses: 3, failed_at: new Date('2026-10-03T10:00:00Z') }, 3, true, '🌬️', now);
  assert.equal(later.failedUntil, null);
  assert.equal(later.misses, 0);
});

test('le Monde : écus dus (ancienne règle), parties qui reviennent, effets et production des bâtiments', () => {
  const { pendingOf, chargesAt, effectsOf, productionOf, isFree, CAP_HOURS, REGEN_MS } = require('../src/services/world');
  const now = Date.parse('2026-10-03T12:00:00Z');
  const hoursAgo = h => new Date(now - h * 3600000).toISOString();
  const tiles = [{ placed_at: hoursAgo(3) }, { placed_at: hoursAgo(20) }];
  // Ancienne règle, payée une dernière fois à la migration : 3 h + réservoir plein (8 h) pour le second
  assert.equal(pendingOf(tiles, null, now), 3 + CAP_HOURS);
  assert.equal(pendingOf(tiles, hoursAgo(1), now), 2);

  // Parties : une toutes les 30 min, plafonnées ; la progression partielle est gardée
  const stock = { charges: 0, charges_at: new Date(now - REGEN_MS * 1.5).toISOString() };
  assert.deepEqual(chargesAt(stock, 3, now), { count: 1, since: now - REGEN_MS * 0.5 });
  assert.equal(chargesAt({ charges: 2, charges_at: hoursAgo(5) }, 3, now).count, 3);

  // Effets : Foyer seul, puis niveau 1 (×2, +3 coups), puis niveau 2 (×3, Forge +5, Port +2)
  assert.deepEqual(effectsOf({ foyer: 1 }), { maxCharges: 3, maxMoves: 15, kinds: ['stone', 'wood', 'water', 'food'], boosts: {}, regenMs: REGEN_MS });
  const grown = effectsOf({ foyer: 3, atelier: 1, ponton: 1, carriere: 1 });
  assert.equal(grown.maxCharges, 5);
  assert.equal(grown.maxMoves, 18);
  assert.ok(grown.kinds.includes('fish'));
  assert.deepEqual(grown.boosts, { stone: 2 });
  const evolved = effectsOf({ atelier: 2, ponton: 2, carriere: 2, potager: 2 });
  assert.equal(evolved.maxMoves, 22);
  assert.deepEqual(evolved.boosts, { stone: 3, food: 3 });

  // Production : 3 ressources et 2 écus par heure et par niveau, réservoir de 8 h ; l'Atelier ne produit rien
  assert.deepEqual(productionOf('potager', 1, hoursAgo(3), null, now), { resource: 'food', amount: 9, coins: 6 });
  assert.deepEqual(productionOf('carriere', 2, hoursAgo(20), null, now), { resource: 'stone', amount: 48, coins: 32 });
  assert.deepEqual(productionOf('potager', 1, hoursAgo(3), hoursAgo(1), now), { resource: 'food', amount: 3, coins: 2 });
  assert.equal(productionOf('atelier', 1, hoursAgo(3), null, now), null);

  // Cases libres : terre, hors chantier, dans un quartier possédé
  const core = new Set(['coeur']);
  // Le cœur (la grande île, décalée) : herbe de la Grève libre ; chantier du Foyer, mer, chemin et arbre refusés ; la
  // Source à acheter
  const { OFFSET } = require('../src/services/worldMap');
  const free = (x, y, zones = core) => isFree(x + OFFSET.x, y + OFFSET.y, zones);
  assert.equal(free(30, 32), false);
  assert.equal(free(31, 35), true);
  assert.equal(isFree(0, 0, core), false);
  assert.equal(free(27, 31), false);
  assert.equal(free(30, 35), false);
  assert.equal(free(24, 33), false);
  assert.equal(free(24, 33, new Set(['coeur', 'source'])), true);
});

test('la boutique des ateliers : bonus additionnés et plafonnés, effets sur la Récolte et la production', () => {
  const shop = require('../src/services/worldShop');
  const { effectsOf, productionOf, REGEN_MS } = require('../src/services/world');
  assert.equal(new Set(shop.ITEMS.map(i => i.id)).size, shop.ITEMS.length);
  const potager = shop.bonusesOf(['pelle', 'arrosoir', 'ruche', 'poulailler']);
  assert.ok(Math.abs(potager.prod.potager - 0.7) < 1e-9);
  assert.equal(potager.coins.potager, 1);
  // Plafond : +100 % par bâtiment
  assert.equal(shop.bonusesOf(['pioche', 'wagonnet', 'lanterne-mine', 'rails', 'pioche', 'rails']).prod.carriere, 1);
  const home = shop.bonusesOf(['etabli', 'enclume', 'soufflet', 'lit', 'cuisine', 'chat', 'toit-rouge']);
  assert.equal(home.moves, 4);
  assert.equal(home.charges, 1);
  assert.equal(home.regenMs, 25 * 60 * 1000);
  const eff = effectsOf({ foyer: 1, atelier: 1 }, home);
  assert.equal(eff.maxMoves, 15 + 3 + 4);
  assert.equal(eff.maxCharges, 4);
  assert.equal(eff.regenMs, 25 * 60 * 1000);
  assert.equal(effectsOf({ foyer: 1 }).regenMs, REGEN_MS);
  // Production : +40 % et +1 écu par heure sur 3 h
  const now = Date.parse('2026-10-03T12:00:00Z');
  const ago = new Date(now - 3 * 3600000).toISOString();
  assert.deepEqual(productionOf('potager', 1, ago, null, now, { prod: 0.4, coins: 1 }), { resource: 'food', amount: 12, coins: 11 });
  assert.equal(shop.effectText(shop.ITEM_BY_ID.pelle), '+20 % de production');
});

test('la boutique par palier : de I à VII, un article neuf aux paliers V, VI et VII, tout le bonus de production utile', () => {
  const shop = require('../src/services/worldShop');
  const { SITES } = require('../src/services/world');
  for (const site of Object.keys(SITES)) {
    const items = shop.ITEMS.filter(i => i.site === site);
    assert.ok(items.every(i => Number.isInteger(i.minLevel) && i.minLevel >= 1 && i.minLevel <= 7), site);
    // Outils aux paliers I et II, puis un article par palier V, VI et VII, de plus en plus cher
    assert.deepEqual(items.filter(i => i.kind === 'outil' && i.minLevel <= 2).map(i => i.minLevel).sort(), [1, 2], site);
    const late = [5, 6, 7].map(level => items.filter(i => i.minLevel === level && i.kind !== 'skin'));
    assert.ok(late.every(list => list.length === 1), site);
    assert.ok(late[0][0].price < late[1][0].price && late[1][0].price < late[2][0].price, site);
    // Les bonus de production d'un bâtiment atteignent tout juste le plafond
    if (SITES[site].produce) {
      const all = shop.bonusesOf(items.map(i => i.id));
      assert.ok(Math.abs(all.prod[site] - shop.PROD_CAP) < 1e-9, site);
      assert.equal(all.coins[site], 3 + 5 + (site === 'potager' ? 1 : 0), site);
    }
  }
  assert.equal(shop.effectText(shop.ITEM_BY_ID.golem), '+5 écus par heure');
  assert.equal(shop.effectText(shop.ITEM_BY_ID.poulailler), '+1 écu par heure');
  assert.equal(shop.bonusesOf(['cuisine', 'sablier']).regenMs, 20 * 60 * 1000);
});

test('les teintes et les pièces rares : douze teintes par bâtiment de I à VII, deux pièces rares sans prix', () => {
  const shop = require('../src/services/worldShop');
  const { SITES } = require('../src/services/world');
  for (const site of Object.keys(SITES)) {
    const tints = shop.ITEMS.filter(i => i.site === site && i.tint);
    assert.equal(tints.length, 12, site);
    assert.ok(tints.every(i => i.kind === 'skin' && i.id.endsWith(`-${site}`) && i.id.length <= 30), site);
    // Un palier de plus coûte plus cher ; toutes les teintes s'ouvrent entre I et VII
    const levels = [...new Set(tints.map(i => i.minLevel))].sort();
    assert.deepEqual(levels, [1, 2, 3, 4, 5, 6, 7], site);
    for (const a of tints) for (const b of tints) if (a.minLevel < b.minLevel) assert.ok(a.price < b.price, `${a.id} < ${b.id}`);
    const rares = shop.ITEMS.filter(i => i.site === site && i.rare);
    assert.equal(rares.length, 2, site);
    assert.ok(rares.every(i => i.kind === 'skin' && i.price === null && i.minLevel === 1), site);
  }
  assert.equal(shop.effectText(shop.ITEM_BY_ID['sakura-foyer']), 'Recolore le bâtiment, à tous ses paliers.');
  assert.equal(shop.effectText(shop.ITEM_BY_ID.lampions), 'Pièce rare : offerte par le chapitre V du Livre.');
  assert.equal(shop.effectText(shop.ITEM_BY_ID.lierre), 'Pièce rare : elle se trouve dans les coffres légendaires.');
  // Cosmétiques : aucun bonus
  assert.deepEqual(shop.bonusesOf(shop.ITEMS.filter(i => i.tint || i.rare).map(i => i.id)), { prod: {}, coins: {}, moves: 0, charges: 0, regenMs: null });
});

test('la très grande île : calques cohérents, le cœur intact, chantiers à plat, anciens quartiers logés, voisinages', () => {
  const map = require('../src/services/worldMap');
  const legacy = require('../src/services/worldMapV2');
  const heart = require('../src/services/islandData');
  for (const layer of [map.GRID, map.HEIGHT, map.GROUND, map.REGION]) {
    assert.equal(layer.length, map.SIZE);
    assert.ok(layer.every(row => row.length === map.SIZE));
  }
  // Mer partout où il n'y a ni relief ni quartier (les ponts sur la mer exceptés) ; relief de 0 à 6
  for (let y = 0; y < map.SIZE; y++) {
    for (let x = 0; x < map.SIZE; x++) {
      const g = map.groundAt(x, y);
      assert.ok('~sdgmftrwpkbnvlxjao'.includes(g), `${x},${y} ${g}`);
      if (g === '~') assert.ok(map.heightAt(x, y) === -1 && map.zoneAt(x, y) === null, `${x},${y}`);
      else if (g === 'b') assert.ok(map.heightAt(x, y) === 0 && map.zoneAt(x, y) === null, `${x},${y}`);
      else assert.ok(map.heightAt(x, y) >= 0 && map.heightAt(x, y) <= 6 && map.zoneAt(x, y), `${x},${y}`);
    }
  }
  // Le cœur : chaque case de terre de la grande île, telle quelle, en OFFSET
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      if (heart.GROUND[y][x] === '~') continue;
      const X = x + map.OFFSET.x, Y = y + map.OFFSET.y;
      assert.deepEqual([map.GROUND[Y][X], map.HEIGHT[Y][X], map.REGION[Y][X]], [heart.GROUND[y][x], heart.HEIGHT[y][x], heart.REGION[y][x]], `${x},${y}`);
    }
  }
  // Chaque chantier : grande emprise 3 × 3 plate, constructible, dans un seul quartier ; la petite y est incluse
  for (const [id, p] of Object.entries(map.SITE_BIG)) {
    const cells = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) cells.push([p.x + dx, p.y + dy]);
    assert.equal(new Set(cells.map(([x, y]) => map.zoneAt(x, y))).size, 1, id);
    assert.equal(new Set(cells.map(([x, y]) => map.heightAt(x, y))).size, 1, id);
    assert.ok(cells.every(([x, y]) => map.buildable(x, y)), id);
    const small = map.footprintOf(id, 1);
    assert.ok(small.x >= p.x && small.y >= p.y && small.x + 2 <= p.x + 3 && small.y + 2 <= p.y + 3, id);
  }
  assert.equal(map.siteZone('foyer'), 'coeur');
  // La Mine s'adosse à la falaise de la Colline : du relief plus haut juste derrière elle
  const mine = map.SITE_BIG.carriere;
  assert.ok([0, 1, 2].some(d => map.heightAt(mine.x + d, mine.y - 1) > map.heightAt(mine.x, mine.y)));
  // Vingt-quatre quartiers, chacun avec son panneau ; ceux des terres nouvelles ont un climat et une durée d'expédition
  assert.equal(map.ZONES.length, 24);
  map.ZONES.forEach(z => assert.ok(map.ANCHORS[z.id], z.id));
  const fresh = map.ZONES.filter(z => z.trip);
  assert.equal(fresh.length, 12);
  assert.deepEqual([...new Set(fresh.map(z => z.climate))].sort(), ['cimes', 'dunes', 'jungle', 'landes', 'marais', 'volcan']);
  assert.ok(map.ZONES.filter(z => !z.trip).every(z => z.climate === 'tempere'));
  // Voisinages : on entre dans les terres nouvelles par le cœur (Roselières, Contreforts), puis de proche en proche
  // jusqu'au Cratère (le pont de la Cascade mène aux Coulées noires)
  assert.ok(map.NEIGHBORS.roselieres.includes('lisiere') && map.NEIGHBORS.contreforts.includes('hauteurs'));
  assert.ok(map.NEIGHBORS.coulees.includes('cascade'));
  const reached = new Set(map.ZONES.filter(z => !z.trip).map(z => z.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const z of fresh) if (!reached.has(z.id) && map.NEIGHBORS[z.id].some(id => reached.has(id))) { reached.add(z.id); grew = true; }
  }
  assert.equal(reached.size, 24);
  // Un quartier inconnu ne montre que sa côte : relief plat, sol inconnu
  const veil = map.veiled(new Set(['x']));
  const crater = [map.ANCHORS.cratere.x, map.ANCHORS.cratere.y];
  assert.deepEqual([veil.ground[crater[1]][crater[0]], veil.height[crater[1]][crater[0]]], ['u', '1']);
  assert.equal(veil.ground[map.SITE_BIG.foyer.y][map.SITE_BIG.foyer.x], map.GROUND[map.SITE_BIG.foyer.y][map.SITE_BIG.foyer.x]);
  // Chaque ancien quartier tient dans le nouveau, même avec tous les chantiers au plus grand
  const all = Object.fromEntries(Object.keys(map.SITE_BIG).map(id => [id, 7]));
  const old = {};
  for (let y = 0; y < legacy.SIZE; y++) for (let x = 0; x < legacy.SIZE; x++) { const z = legacy.zoneAt(x, y); if (z) old[z] = (old[z] || 0) + 1; }
  for (const [zone, count] of Object.entries(old)) assert.ok(map.freeSpots(zone, all).length >= count, zone);
  assert.equal(map.isLand(0, 0), false);
  assert.equal(map.isLand(map.SITE_BIG.foyer.x, map.SITE_BIG.foyer.y), true);
});
