// Butins : raretés, coffres de Récolte et du jour, lots selon l'île, jour de Paris
const test = require('node:test');
const assert = require('node:assert/strict');
const loot = require('../src/services/loot');
const shop = require('../src/services/worldShop');
const { QUESTS } = require('../src/services/quests');

// Hasard rejoué : une suite de valeurs, puis 0
const seq = (...values) => () => (values.length ? values.shift() : 0);
const ALL_RARES = shop.ITEMS.filter(item => item.rare).map(item => item.id);

test('la rareté suit les poids, du commun au légendaire', () => {
  const odds = loot.HARVEST.odds; // 60 / 28 / 10 / 2
  assert.equal(loot.rarityOf(odds, seq(0)), 'commun');
  assert.equal(loot.rarityOf(odds, seq(0.59)), 'commun');
  assert.equal(loot.rarityOf(odds, seq(0.6)), 'rare');
  assert.equal(loot.rarityOf(odds, seq(0.9)), 'epique');
  assert.equal(loot.rarityOf(odds, seq(0.985)), 'legendaire');
  // Une rareté sans poids ne sort jamais
  assert.equal(loot.rarityOf(loot.BOTTLE.odds, seq(0.9999)), 'epique');
});

test('Récolte : un coffre une fois sur trois dès 5 coups, sûr et au moins rare avec une grande chaîne', () => {
  assert.equal(loot.harvestChest(4, 12, seq(0)), null);
  assert.equal(loot.harvestChest(5, 3, seq(0.5)), null);
  assert.equal(loot.harvestChest(5, 3, seq(0.1, 0)), 'commun');
  assert.equal(loot.harvestChest(5, 8, seq(0)), 'rare');
  assert.equal(loot.harvestChest(5, 8, seq(0.95)), 'epique');
});

test('coffre du jour : la série monte du commun au légendaire', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(loot.dailyRarity), ['commun', 'commun', 'rare', 'rare', 'rare', 'rare', 'epique']);
  assert.equal(loot.dailyRarity(8), 'commun');
  assert.equal(loot.dailyRarity(14), 'epique');
  assert.equal(loot.dailyRarity(28), 'legendaire');
});

test('chaque chapitre du II au VII offre sa pièce rare ; les quêtes de fin d’acte, un coffre', () => {
  assert.deepEqual(Object.keys(loot.CHAPTER_RARES), ['II', 'III', 'IV', 'V', 'VI', 'VII']);
  for (const id of Object.values(loot.CHAPTER_RARES)) assert.ok(shop.ITEM_BY_ID[id].rare, id);
  const acts = QUESTS.filter(q => q.chest).map(q => q.act);
  assert.deepEqual(acts, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  for (const q of QUESTS.filter(q => q.chest)) assert.ok(loot.RARITIES.includes(q.chest), q.id);
});

test('légendaire : une pièce rare qui manque, d’abord celle promise, sinon des écus', () => {
  const levels = { foyer: 1, potager: 2 };
  const promised = loot.prizeOf('legendaire', { levels, owned: new Set() }, seq(0), 'papillons');
  assert.deepEqual(promised, { kind: 'rare', item: 'papillons', site: 'potager', name: 'Papillons' });
  // Promise mais déjà là : une pièce des coffres d'un bâtiment construit (pas une pièce de chapitre)
  const other = loot.prizeOf('legendaire', { levels, owned: new Set(['papillons']) }, seq(0), 'papillons');
  assert.equal(other.kind, 'rare');
  assert.ok(['tournesols', 'lierre'].includes(other.item), other.item);
  assert.ok(!Object.values(loot.CHAPTER_RARES).includes(other.item));
  // Toutes là : des écus
  assert.deepEqual(loot.prizeOf('legendaire', { levels, owned: new Set(ALL_RARES) }, seq(0)), { kind: 'coins', amount: loot.LEGEND_COINS });
});

test('épique : une teinte d’un bâtiment construit à son palier, sinon des écus', () => {
  const state = { levels: { foyer: 1 }, owned: new Set() };
  const tint = loot.prizeOf('epique', state, seq(0, 0));
  assert.equal(tint.kind, 'tint');
  assert.equal(tint.site, 'foyer');
  assert.ok(shop.ITEM_BY_ID[tint.item].minLevel <= 1);
  // Plus de teinte possible au palier I du Foyer : des écus
  const owned = new Set(shop.ITEMS.filter(i => i.tint && i.site === 'foyer' && i.minLevel <= 1).map(i => i.id));
  const coins = loot.prizeOf('epique', { levels: { foyer: 1 }, owned }, seq(0, 0));
  assert.equal(coins.kind, 'coins');
  assert.ok(coins.amount >= 200 && coins.amount <= 300);
});

test('commun et rare : des écus ou des ressources, dans leurs bornes', () => {
  const state = { levels: {}, owned: new Set() };
  assert.deepEqual(loot.prizeOf('commun', state, seq(0.1, 0)), { kind: 'coins', amount: 15 });
  assert.deepEqual(loot.prizeOf('commun', state, seq(0.9, 0.3, 0.99)), { kind: 'stock', stock: { wood: 30 } });
  assert.deepEqual(loot.prizeOf('rare', state, seq(0.1, 0.999)), { kind: 'coins', amount: 90 });
  const two = loot.prizeOf('rare', state, seq(0.9, 0, 0, 0, 0));
  assert.deepEqual(two, { kind: 'stock', stock: { stone: 25, wood: 25 } });
});

test('jour de Paris : changement d’heure, minuit et veille', () => {
  // Été (UTC+2) et hiver (UTC+1)
  assert.deepEqual(loot.parisOf(Date.parse('2026-07-01T21:59:00Z')), { day: '2026-07-01', slot: 3 });
  assert.deepEqual(loot.parisOf(Date.parse('2026-07-01T22:00:00Z')), { day: '2026-07-02', slot: 0 });
  assert.deepEqual(loot.parisOf(Date.parse('2026-12-31T23:30:00Z')), { day: '2027-01-01', slot: 0 });
  assert.deepEqual(loot.parisOf(Date.parse('2026-12-01T11:00:00Z')), { day: '2026-12-01', slot: 2 });
  assert.equal(loot.dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(loot.dayBefore('2027-01-01'), '2026-12-31');
});
