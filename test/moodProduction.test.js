// Production juste : chaque heure produite compte avec l'humeur de son moment (un besoin qui arrive à échéance en cours
// de route ne change que les heures d'après). Calculs purs, sans base : rules (productionOf, boostedHours,
// productionAll) et people (moodTimes, prodSteps, sameSteps)
const test = require('node:test');
const assert = require('node:assert/strict');
const { productionOf, boostedHours, productionAll, cashOf, fullInOf, NO_BONUS, NO_ANNEX } = require('../src/services/world/rules');
const { moodTimes, prodSteps, sameSteps } = require('../src/services/world/people');
const landmarks = require('../src/services/landmarks');
const map = require('../src/services/worldMap');

const H = 3600000;
const T = Date.UTC(2026, 9, 6, 12);
const at = hours => T - hours * H;

test('heures pondérées : chaque morceau avec sa part en plus', () => {
  // 8 h à +10 % : 8,8 ; 4 h contente puis 4 h triste : 4 + 4 × 0,9 = 7,6
  assert.equal(boostedHours(at(8), 8, [{ at: at(8), prod: 0.1 }]), 8.8);
  assert.equal(boostedHours(at(8), 8, [{ at: at(8), prod: 0 }, { at: at(4), prod: -0.1 }]), 7.6);
  // Un changement d'avant la fenêtre vaut pour toute la fenêtre ; un changement d'après ne compte pas
  assert.equal(boostedHours(at(8), 8, [{ at: at(20), prod: 0.1 }, { at: at(10), prod: -0.1 }]), 7.2);
  assert.equal(boostedHours(at(8), 8, [{ at: at(8), prod: 0 }, { at: at(-1), prod: -0.1 }]), 8);
  // Rien à compter
  assert.equal(boostedHours(at(8), 0, [{ at: at(8), prod: 0.1 }]), 0);
});

test('Potager I : contente puis affamée depuis 6 h ; seules les heures d’après sont tristes', () => {
  // Récolté il y a 10 h, réserve de 8 h : de −10 h à −2 h, 4 h contente puis 4 h triste
  const steps = [{ at: at(10), prod: 0 }, { at: at(6), prod: -0.1 }];
  assert.deepEqual(productionOf('potager', 1, new Date(at(20)), new Date(at(10)), T, { prod: -0.1, coins: 0 }, [], steps),
    { resource: 'food', amount: 22, coins: 15 });
  // Avant : tout au tarif du ramassage (triste) : 8 × 3 × 0,9 = 21,6 vivres, 8 × 2 × 0,9 = 14,4 écus
  assert.deepEqual(productionOf('potager', 1, new Date(at(20)), new Date(at(10)), T, { prod: -0.1, coins: 0 }),
    { resource: 'food', amount: 21, coins: 14 });
});

test('la réserve se remplit pendant ses premières heures : l’humeur d’après ne compte plus', () => {
  // Carrière V (15 pierres et 10 écus par heure), récoltée il y a 12 h : la réserve (8 h) est pleine depuis 4 h
  const flat = productionOf('carriere', 5, new Date(at(30)), new Date(at(12)), T, { prod: 0, coins: 0 });
  assert.deepEqual(flat, { resource: 'stone', amount: 120, coins: 80 });
  // Triste depuis 3 h : la réserve était déjà pleine
  assert.deepEqual(productionOf('carriere', 5, new Date(at(30)), new Date(at(12)), T, { prod: -0.1, coins: 0 }, [], [{ at: at(12), prod: 0 }, { at: at(3), prod: -0.1 }]), flat);
  // Heureuse jusqu'à il y a 10 h : 2 h à +10 %, puis 6 h : 8,2 × 15 = 123 pierres, 8,2 × 10 = 82 écus
  assert.deepEqual(productionOf('carriere', 5, new Date(at(30)), new Date(at(12)), T, { prod: 0, coins: 0 }, [], [{ at: at(12), prod: 0.1 }, { at: at(10), prod: 0 }]),
    { resource: 'stone', amount: 123, coins: 82 });
});

test('annexes et écus de la boutique : l’annexe suit l’humeur du bâtiment, les écus de la boutique non', () => {
  // Potager II (6 vivres, 4 écus par heure) depuis 10 h, réserve 12 h, un champ (3 vivres, 2 écus) posé il y a 2 h,
  // la boutique (+1 écu par heure) ; heureuse jusqu'à il y a 1 h, puis contente
  const champ = [{ rate: 3, earn: 2, at: new Date(at(2)) }];
  const steps = [{ at: 0, prod: 0.1 }, { at: at(1), prod: 0 }];
  // Bâtiment : 9 × 1,1 + 1 = 10,9 h ; champ : 1 × 1,1 + 1 = 2,1 h
  // vivres 6 × 10,9 + 3 × 2,1 = 71,7 ; écus 4 × 10,9 + 2 × 2,1 + 10 × 1 = 57,8
  assert.deepEqual(productionOf('potager', 2, new Date(at(10)), null, T, { prod: 0, coins: 1, cap: 4 }, champ, steps),
    { resource: 'food', amount: 71, coins: 57 });
});

test('une part qui ne change pas donne exactement le calcul d’avant (20 000 cas tirés au hasard)', () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 20000; i++) {
    const level = 1 + Math.floor(rnd() * 9);
    const prod = [-0.2, -0.1, 0, 0.1, 0.25, 0.4, 0.5][Math.floor(rnd() * 7)];
    const bonus = { prod, coins: [0, 1, 3][Math.floor(rnd() * 3)], cap: Math.floor(rnd() * 9) };
    const built = new Date(at(rnd() * 30));
    const collected = rnd() < 0.2 ? null : new Date(at(rnd() * 30));
    const annexList = Array.from({ length: Math.floor(rnd() * 3) }, () => ({ rate: 1 + Math.floor(rnd() * 5), earn: Math.floor(rnd() * 4), at: new Date(at(rnd() * 30)) }));
    const steps = [{ at: 0, prod }, { at: at(rnd() * 30), prod }];
    const site = ['potager', 'carriere', 'bosquet', 'puits'][i % 4];
    assert.deepEqual(productionOf(site, level, built, collected, T, bonus, annexList, steps), productionOf(site, level, built, collected, T, bonus, annexList), `cas ${i}`);
  }
});

test('productionAll : seul le bâtiment dont la part change est compté morceau par morceau', () => {
  const levels = { foyer: 1, potager: 1, carriere: 2 };
  const builtAt = { potager: new Date(at(20)), carriere: new Date(at(20)) };
  const bonuses = { ...NO_BONUS, prod: { potager: -0.1, carriere: 0.1 } };
  const steps = [{ at: at(10), prod: { potager: 0, carriere: 0.1 } }, { at: at(6), prod: { potager: -0.1, carriere: 0.1 } }];
  const made = productionAll(levels, builtAt, new Date(at(10)), T, bonuses, NO_ANNEX, steps);
  assert.deepEqual(made.map(p => [p.site, p.amount, p.coins]), [['carriere', 52, 35], ['potager', 22, 15]]);
  // Sans changement : comme avant
  assert.deepEqual(productionAll(levels, builtAt, new Date(at(10)), T, bonuses, NO_ANNEX, [steps[1]]), productionAll(levels, builtAt, new Date(at(10)), T, bonuses, NO_ANNEX));
});

test('cashOf : les fractions de chaque ramassage sont gardées pour le suivant ; rien ne se perd', () => {
  const made = [{ resource: 'stone', exact: { amount: 1.0004, coins: 0.6669 } }, { resource: 'food', exact: { amount: 2.5, coins: 0.5 } }];
  const first = cashOf(made, {});
  assert.deepEqual([first.coins, first.stock, first.made], [1, { stone: 1, wood: 0, water: 0, food: 2 }, true]);
  assert.deepEqual(first.carry, { coins: 0.1669, stone: 0.0004, wood: 0, water: 0, food: 0.5 });
  // Le ramassage suivant reprend ce qui restait
  const second = cashOf([{ resource: 'food', exact: { amount: 0.5, coins: 0.8331 } }], first.carry);
  assert.deepEqual([second.coins, second.stock.food, second.carry.coins, second.carry.food], [1, 1, 0, 0]);
  // Rien de produit depuis : made est faux (rien à écrire)
  assert.equal(cashOf([{ resource: 'stone', exact: { amount: 0, coins: 0 } }], first.carry).made, false);
});

test('fullInOf : la réserve se remplit depuis la pose ou la dernière récolte', () => {
  assert.equal(fullInOf(new Date(at(3)), new Date(at(5)), 8, T), 5 * H);
  assert.equal(fullInOf(new Date(at(30)), new Date(at(2)), 12, T), 10 * H);
  assert.equal(fullInOf(new Date(at(30)), null, 8, T), 0);
});

test('échéances des besoins : dans la fenêtre, dans l’ordre, sans doublon', () => {
  const filled = {
    potager: { manger: new Date(at(30)), outils: new Date(at(50)) }, // échus il y a 6 h et 2 h
    carriere: { manger: new Date(at(30)) }, // il y a 6 h aussi
    foyer: { manger: new Date(at(33)) }, // il y a 9 h
    bosquet: { manger: new Date(at(40)) }, // il y a 16 h : avant la fenêtre
    puits: { manger: new Date(at(10)) } // dans 14 h : après
  };
  assert.deepEqual(moodTimes(filled, at(10), T), [at(10), at(9), at(6), at(2)]);
  assert.deepEqual(moodTimes({}, at(10), T), [at(10)]);
});

test('prodSteps : la part du Potager à chaque échéance ; un visiteur installé compte ; la Bénédiction aussi', () => {
  const base = { bonuses: NO_BONUS, extra: NO_ANNEX };
  const lm = landmarks.bonusesOf([]);
  const island = {
    levels: { foyer: 1, potager: 1 }, zones: new Set(['coeur', 'jardins']), settlers: [],
    presence: { veteran: true, done: new Set(), blessed: false }, decor: [], filled: { potager: { manger: new Date(at(30)) } }
  };
  // Mélisse : contente (sans créations autour), puis triste quand son repas échoit, il y a 6 h
  const steps = prodSteps(island, base, lm, new Date(at(10)), T);
  assert.deepEqual(steps.map(s => [s.at, s.prod.potager]), [[at(10), 0], [at(6), -0.1]]);
  const made = productionAll(island.levels, { potager: new Date(at(20)) }, new Date(at(10)), T, { ...NO_BONUS, prod: { potager: -0.1 } }, NO_ANNEX, steps);
  assert.deepEqual(made.map(p => [p.amount, p.coins]), [[22, 15]]);
  // Jamais récolté : la fenêtre part de zéro
  assert.equal(prodSteps(island, base, lm, null, T)[0].at, 0);
  // Un visiteur installé au Potager : sans créations autour, il n'est que content (rien ne change, rien à encaisser
  // d'abord) ; avec trois créations autour du Potager, Mélisse et lui sont heureux : +10 % chacun
  const window = isl => prodSteps(isl, base, lm, new Date(at(10)), T);
  const settler = [{ id: 7, seed: 1234, site: 'potager', settled_at: new Date(T) }];
  assert.equal(sameSteps(steps, window({ ...island, settlers: settler })), true);
  const fp = map.footprintOf('potager', 1);
  const decorated = { ...island, decor: [0, 1, 2].map(i => ({ id: i + 1, craft: 'cloture', x: fp.x + i, y: fp.y - 1 })) };
  assert.deepEqual(window(decorated).map(s => s.prod.potager), [0.1, 0]);
  assert.deepEqual(window({ ...decorated, settlers: settler }).map(s => s.prod.potager), [0.2, 0.1]);
  assert.equal(sameSteps(window(decorated), window({ ...decorated, settlers: settler })), false);
  // Une création loin du Potager ne change rien
  assert.equal(sameSteps(steps, window({ ...island, decor: [{ id: 9, craft: 'cloture', x: fp.x + 9, y: fp.y }] })), true);
  // La Bénédiction d'Anya : jamais triste
  const blessed = prodSteps({ ...island, presence: { ...island.presence, blessed: true } }, base, lm, new Date(at(10)), T);
  assert.deepEqual(blessed.map(s => s.prod.potager), [0, 0]);
});

test('sameSteps : même part à chaque instant, quels que soient les découpages', () => {
  const a = [{ at: 0, prod: { potager: 0 } }, { at: 10, prod: { potager: -0.1 } }];
  assert.equal(sameSteps(a, a), true);
  assert.equal(sameSteps(a, [{ at: 0, prod: { potager: 0 } }, { at: 5, prod: { potager: 0 } }, { at: 10, prod: { potager: -0.1, carriere: 0 } }]), true);
  assert.equal(sameSteps(a, [{ at: 0, prod: { potager: 0 } }]), false);
  assert.equal(sameSteps(a, [{ at: 0, prod: { potager: 0 } }, { at: 11, prod: { potager: -0.1 } }]), false);
  assert.equal(sameSteps(a, [{ at: 0, prod: { potager: 0, carriere: 0.1 } }, { at: 10, prod: { potager: -0.1 } }]), false);
});
