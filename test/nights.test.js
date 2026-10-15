// Les nuits de créatures (bible du dépôt front, § 6.15, v6 ; décisions du 6 octobre 2026) : l'horloge du jeu, chemins
// depuis la brume, défenses, camarades, toucher, une panne au plus, réparation (fonctions pures)
const test = require('node:test');
const assert = require('node:assert/strict');
const nights = require('../src/services/nights');
const clock = require('../src/services/gameClock');
const map = require('../src/services/worldMap');

const at = s => Date.parse(s);
const MIN = 60 * 1000;
// Une nuit de l'horloge du jeu, n° de son cycle (services/gameClock.js) : la première d'octobre 2026, puis k après
const N = k => clock.cycleOf(at('2026-10-06T12:00:00Z')) + k;
const step = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test('l’horloge du jeu : un cycle d’1 h 30, la même pour tous ; la nuit, ses 20 dernières minutes (21 h à 6 h sur l’île)', () => {
  const c = clock.cycleOf(at('2026-10-15T12:00:00Z'));
  const start = clock.startOf(c);
  assert.equal(clock.CYCLE_MS, 90 * MIN);
  assert.equal(clock.cycleOf(clock.EPOCH), 0);
  assert.equal(clock.cycleOf(start), c);
  assert.equal(clock.cycleOf(start - 1), c - 1);
  // L'heure de l'île : l'aube de 6 h à 7 h (5 min), le jour jusqu'à 19 h (60 min), le crépuscule jusqu'à 21 h (5 min),
  // la nuit jusqu'à 6 h (20 min) ; le jour de l'île change à minuit
  assert.deepEqual([0, 5, 35, 65, 70, 90].map(clock.hourIn), [6, 7, 13, 19, 21, 30]);
  // (même vecteur que tests/gameClock.test.js du jeu : l'île y voit la même heure)
  assert.deepEqual(['2026-10-15T12:00:00Z', '2026-10-15T13:10:00Z'].map(t => clock.dayHourOf(at(t))), [{ day: 4600, hour: 6 }, { day: 4600, hour: 21 }]);
  assert.deepEqual([clock.dayHourOf(start).hour, clock.dayHourOf(start + 35 * MIN).hour], [6, 13]);
  assert.equal(clock.dayHourOf(start + 80 * MIN).day, clock.dayHourOf(start).day + 1);
  assert.ok(clock.dayHourOf(start + 80 * MIN).hour < 6);
  // Une nuit se nomme par son cycle
  assert.deepEqual(nights.boundsOf(c), { start: start + 70 * MIN, end: start + 90 * MIN });
  // La nuit en cours ; le jour, aucune ; la nuit en cours ou la prochaine : celle du cycle
  assert.equal(nights.nightAt(start + 70 * MIN), c);
  assert.equal(nights.nightAt(start + 89 * MIN), c);
  assert.equal(nights.nightAt(start + 69 * MIN), null);
  assert.equal(nights.nightAt(start + 90 * MIN), null);
  assert.deepEqual([start + 10 * MIN, start + 80 * MIN].map(nights.nightNear), [c, c]);
});

test('les nuits finies entre deux passages, dans l’ordre, quatorze au plus', () => {
  const c = clock.cycleOf(at('2026-10-15T12:00:00Z'));
  const end = night => nights.boundsOf(night).end;
  assert.deepEqual(nights.endedBetween(clock.startOf(c) + MIN, clock.startOf(c + 1) + MIN), [c]);
  // La fin exacte compte une fois : exclue au départ, comprise à l'arrivée
  assert.deepEqual(nights.endedBetween(end(c), end(c + 1)), [c + 1]);
  assert.deepEqual(nights.endedBetween(clock.startOf(c) + MIN, clock.startOf(c) + 80 * MIN), []);
  assert.deepEqual(nights.endedBetween(clock.startOf(c) + MIN, clock.startOf(c + 3) + MIN), [c, c + 1, c + 2]);
  const long = nights.endedBetween(at('2026-01-01T12:00:00Z'), clock.startOf(c) + MIN);
  assert.equal(long.length, 14);
  assert.equal(long[13], c - 1);
});

test('Anya, un jour de son passage : à chaque aube, ou à chaque crépuscule, de l’horloge du jeu ce jour-là', () => {
  const dawns = nights.anyaTimesOn('2026-10-15', 'aube');
  const dusks = nights.anyaTimesOn('2026-10-15', 'crepuscule');
  assert.equal(dawns.length, 16);
  for (const t of dawns) assert.equal((t - clock.EPOCH) % clock.CYCLE_MS, 0);
  assert.deepEqual(dusks.map(t => t - clock.DUSK_MS), dawns);
  assert.ok(dawns[0] >= at('2026-10-14T22:00:00Z') && dawns.at(-1) < at('2026-10-15T22:00:00Z'));
});

test('ils sortent du bord de la brume et marchent droit vers le bâtiment le plus proche', () => {
  const owned = new Set(['coeur', 'source']);
  const border = nights.borderOf(owned);
  assert.ok(border.length > 0);
  for (const c of border) assert.ok(owned.has(map.zoneAt(c.x, c.y)));
  // Plus l'île grandit, plus le bord avance : une case du bord touche toujours un quartier pas encore à soi
  const near = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.isLand(c.x + dx, c.y + dy) && map.zoneAt(c.x + dx, c.y + dy) && !owned.has(map.zoneAt(c.x + dx, c.y + dy)));
  assert.ok(border.every(near));
  // Un trait : de case en case, ses deux bouts compris
  const line = nights.lineOf({ x: 2, y: 3 }, { x: 9, y: 5 });
  assert.deepEqual([line[0], line.at(-1)], [{ x: 2, y: 3 }, { x: 9, y: 5 }]);
  line.slice(1).forEach((c, i) => assert.equal(step(c, line[i]), 1));

  // (la première nuit, écrite : trois Sans-Nom, qui marchent du bord de la brume)
  const island = { owned, sites: [{ id: 'foyer', level: 1 }, { id: 'puits', level: 1 }], acts: 0, first: nights.boundsOf(N(0)).start };
  const plan = nights.planOf(42, N(0), island);
  // La même graine, le même plan (tous les appareils voient la même nuit) ; une autre nuit, un autre
  assert.deepEqual(nights.planOf(42, N(0), island), plan);
  assert.notDeepEqual(nights.planOf(42, N(1), island).map(c => c.path), plan.map(c => c.path));
  assert.equal(plan.length, nights.countOf(0));
  const { start, end } = nights.boundsOf(N(0));
  for (const [k, c] of plan.entries()) {
    assert.equal(c.id, `${N(0)}:${k}`);
    assert.ok(border.some(b => b.x === c.path[0].x && b.y === c.path[0].y));
    const f = map.footprintOf(c.site, 1);
    const last = c.path.at(-1);
    assert.ok(last.x >= f.x && last.x < f.x + f.w && last.y >= f.y && last.y < f.y + f.h);
    // Dans la première moitié de la nuit, une case toutes les 3 minutes
    assert.ok(c.at >= start && c.at <= start + (end - start) / 2);
    assert.equal(c.arrives - c.at, (c.path.length - 1) * nights.MS_PER_CELL);
  }
  // Plus nombreux à chaque acte : 3, un de plus par acte, 8 au plus (choix de l'auteur, 13 oct.)
  assert.deepEqual([0, 1, 2, 4, 5, 8, 12].map(nights.countOf), [3, 4, 5, 7, 8, 8, 8]);
  // Ni bâtiment ni bord : personne
  assert.deepEqual(nights.planOf(42, N(0), { ...island, sites: [] }), []);
});

test('la lumière les change en lucioles (3 cases, la torche 2), la clôture barre sa case d’abord, le feu du Foyer éclaire', () => {
  const walker = { id: 'n:0', site: 'puits', path: nights.lineOf({ x: 10, y: 10 }, { x: 20, y: 10 }), at: 0, arrives: 10 * nights.MS_PER_CELL };
  const none = nights.defenseOf([], {});
  assert.deepEqual(nights.fateOf(walker, none), { end: 'arrive', step: 10 });
  // Une lanterne à 3 cases du chemin : luciole dès la première case à portée ; à 4, rien
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'lanterne', x: 15, y: 13 }], {})), { end: 'luciole', step: 2 });
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'lanterne', x: 15, y: 14 }], {})), { end: 'arrive', step: 10 });
  // Une clôture sur le chemin ; à côté, rien
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'cloture', x: 14, y: 10 }], {})), { end: 'barre', step: 4 });
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'muret', x: 14, y: 11 }], {})), { end: 'arrive', step: 10 });
  // D'autres créations ne défendent pas
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'banc', x: 14, y: 10 }], {})), { end: 'arrive', step: 10 });
  // Le feu du Foyer : son emprise compte comme une lumière
  const foyer = map.footprintOf('foyer', 1);
  const toFoyer = { ...walker, path: nights.lineOf({ x: foyer.x - 6, y: foyer.y }, { x: foyer.x, y: foyer.y }) };
  assert.deepEqual(nights.fateOf(toFoyer, nights.defenseOf([], { foyer: 1 })), { end: 'luciole', step: 3 });
  // La barrière d'abord (choix de l'auteur, 13 oct.) : l'enclos du Feu, dans sa lumière, l'arrête
  const ring = { craft: 'cloture', x: foyer.x - 1, y: foyer.y };
  assert.deepEqual(nights.fateOf(toFoyer, nights.defenseOf([ring], { foyer: 1 })), { end: 'barre', step: 5 });
  // Une torche éclaire à 2 cases ; à 3, rien
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'torche', x: 15, y: 12 }], {})), { end: 'luciole', step: 3 });
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'torche', x: 15, y: 13 }], {})), { end: 'arrive', step: 10 });
});

test('sous la pluie, le feu de camp ne porte qu’à une case ; le Foyer à l’Abri le couvre ; les lanternes ne changent pas', () => {
  const foyer = map.footprintOf('foyer', 1);
  const toFoyer = { id: 'n:0', site: 'foyer', path: nights.lineOf({ x: foyer.x - 6, y: foyer.y }, { x: foyer.x, y: foyer.y }), at: 0, arrives: 0 };
  const wet = () => true;
  assert.deepEqual(nights.fateOf(toFoyer, nights.defenseOf([], { foyer: 1 }, undefined, wet)), { end: 'luciole', step: 5 });
  // (il ne pleut qu'à partir de la 2e case : à la 3e, le feu crachote déjà)
  assert.deepEqual(nights.fateOf(toFoyer, nights.defenseOf([], { foyer: 1 }, undefined, at => at >= 2 * nights.MS_PER_CELL)), { end: 'luciole', step: 5 });
  assert.deepEqual(nights.fateOf(toFoyer, nights.defenseOf([], { foyer: 2 }, undefined, wet)), { end: 'luciole', step: 3 });
  const walker = { id: 'n:1', site: 'puits', path: nights.lineOf({ x: 10, y: 10 }, { x: 20, y: 10 }), at: 0, arrives: 0 };
  assert.deepEqual(nights.fateOf(walker, nights.defenseOf([{ craft: 'lanterne', x: 15, y: 13 }], {}, undefined, wet)), { end: 'luciole', step: 2 });
});

test('la météo du serveur est celle du jeu (même vecteur que tests/sky.test.js) ; la pluie et l’orage mouillent', () => {
  const weather = require('../src/services/weather');
  const days = Array.from({ length: 12 }, (_, i) => [0, 1, 2, 3].map(slot => weather.slotKind(280 + i, slot)[0]).join(''));
  assert.deepEqual(days.join(' '), 'ccbc vccc cvvc vvvv vvvv pppv vccv bcbb vccc vpvv cccc bccb');
  // Sur l'horloge du jeu : le créneau de 6 h de l'heure de l'île (le jour de l'île change à minuit)
  for (let t = at('2026-10-15T00:00:00Z'); t < at('2026-10-16T00:00:00Z'); t += 7 * MIN) {
    const { day, hour } = clock.dayHourOf(t);
    assert.equal(weather.kindAt(t), weather.slotKind(day, Math.floor(hour / 6)));
    assert.equal(weather.rainAt(t), ['pluie', 'orage'].includes(weather.kindAt(t)));
  }
});

test('une nuit embrume au plus un bâtiment : le premier arrivé ; un camarade content en repousse un, le toucher aussi', () => {
  const walk = (id, site, at) => ({ id, site, path: nights.lineOf({ x: 0, y: 0 }, { x: 4, y: 0 }), at, arrives: at + 4 * nights.MS_PER_CELL });
  const plan = [walk('n:0', 'bosquet', 2000), walk('n:1', 'puits', 1000), walk('n:2', 'puits', 3000)];
  const open = nights.defenseOf([], {});
  // Sans défense : le premier arrivé (n:1) embrume le Puits ; les autres arrivent aussi, sans seconde panne
  const bare = nights.outcomeOf(plan, open);
  assert.deepEqual(bare.panne, { site: 'puits', at: plan[1].arrives });
  assert.deepEqual(Object.values(bare.fates).map(f => f.end), ['arrive', 'arrive', 'arrive']);
  // Le camarade du Puits en repousse un (le premier) ; le second passe : panne plus tard
  const helped = nights.outcomeOf(plan, open, new Set(['puits']));
  assert.equal(helped.fates['n:1'].end, 'camarade');
  assert.deepEqual(helped.panne, { site: 'bosquet', at: plan[0].arrives });
  // Le toucher : celui-là boude et repart
  const touched = nights.outcomeOf(plan, open, new Set(['puits']), new Set(['n:0']));
  assert.deepEqual(touched.fates['n:0'], { end: 'touche', step: null });
  assert.deepEqual(touched.panne, { site: 'puits', at: plan[2].arrives });
  // Tout tenu : aucune panne
  assert.equal(nights.outcomeOf(plan, open, new Set(['puits', 'bosquet']), new Set(['n:2'])).panne, null);
});

test('le coq chante une fois par nuit : le premier qui arriverait à sa vue (4 cases) boude et repart', () => {
  // Trois égarés vers le Puits, en ligne (y = 0), qui passent près du poulailler en (4, 3)
  const walk = (id, site, at) => ({ id, site, path: nights.lineOf({ x: 0, y: 0 }, { x: 8, y: 0 }), at, arrives: at + 8 * nights.MS_PER_CELL });
  const plan = [walk('n:0', 'puits', 2000), walk('n:1', 'puits', 1000), walk('n:2', 'puits', 3000)];
  const open = nights.defenseOf([], {});
  const coop = { x: 4, y: 3 };
  // Il voit le premier (n:1) dès la case (0, 0), à 4 cases : il chante, l'égaré boude là ; la panne vient du suivant
  const crowed = nights.outcomeOf(plan, open, new Set(), new Set(), coop);
  assert.deepEqual(crowed.fates['n:1'], { end: 'coq', step: 0 });
  assert.deepEqual([crowed.fates['n:0'].end, crowed.fates['n:2'].end], ['arrive', 'arrive']);
  assert.deepEqual(crowed.panne, { site: 'puits', at: plan[0].arrives });
  // Trop loin (5 cases) : il ne voit rien ; sans coq non plus
  assert.equal(Object.values(nights.outcomeOf(plan, open, new Set(), new Set(), { x: 4, y: 5 }).fates).filter(f => f.end === 'coq').length, 0);
  assert.equal(Object.values(nights.outcomeOf(plan, open).fates).filter(f => f.end === 'coq').length, 0);
  // Un camarade content renvoie d'abord le sien (n:1) : le coq chasse le suivant à arriver (n:0) ; le dernier embrume
  const helped = nights.outcomeOf(plan, open, new Set(['puits']), new Set(), coop);
  assert.deepEqual([helped.fates['n:1'].end, helped.fates['n:0'].end, helped.fates['n:2'].end], ['camarade', 'coq', 'arrive']);
  assert.deepEqual(helped.panne, { site: 'puits', at: plan[2].arrives });
  // Une lumière qui les change tous en lucioles : le coq n'a rien à faire
  const lit = nights.defenseOf([{ craft: 'lanterne', x: 1, y: 1 }], {});
  assert.deepEqual(Object.values(nights.outcomeOf(plan, lit, new Set(), new Set(), coop).fates).map(f => f.end), ['luciole', 'luciole', 'luciole']);
});

test('qui sort : les trois premières nuits écrites, puis un mélange de ce qui existe ; le premier Noyé, la première Racine', () => {
  const island = { owned: new Set(['coeur', 'source']), sites: [{ id: 'foyer', level: 1 }], acts: 0, first: nights.boundsOf(N(0)).start };
  const kinds = (night, more = {}) => nights.kindsOf(42, night, { ...island, ...more }, 3);
  // La n-ième nuit depuis la première possible (présentées le jour : la nuit du cycle ; la nuit : la suivante)
  assert.deepEqual([N(0), N(3)].map(n => nights.indexOf(n, island.first)), [0, 3]);
  assert.equal(nights.indexOf(N(1), nights.boundsOf(N(0)).start + 1), 0);
  assert.deepEqual([N(0), N(1), N(2)].map(n => kinds(n)), nights.SCRIPT);
  // Au-delà : jamais de Noyé ni de Racine tant qu'ils ne peuvent pas sortir
  const later = Array.from({ length: 40 }, (_, k) => kinds(N(3 + k))).flat();
  assert.ok(later.every(k => nights.KINDS.includes(k) && !['noye', 'racine'].includes(k)));
  assert.ok(new Set(later).size >= 3);
  // Léo arrivé le jour du cycle N(20) : sa nuit, le premier Noyé sort à coup sûr ; le Bosquet bâti au N(21), la Racine
  const unlocks = { noye: clock.startOf(N(20)) + 10 * MIN, racine: clock.startOf(N(21)) + 10 * MIN };
  assert.notEqual(kinds(N(19), { unlocks })[0], 'noye');
  assert.equal(kinds(N(20), { unlocks })[0], 'noye');
  assert.equal(kinds(N(21), { unlocks })[0], 'racine');
  // (0 : depuis toujours, sans nuit « première »)
  const always = Array.from({ length: 30 }, (_, k) => kinds(N(100 + k), { unlocks: { noye: 0, racine: 0 } })).flat();
  assert.ok(always.includes('noye') && always.includes('racine'));
});

test('d’où ils sortent et à quel pas : le Noyé de la mer, la Racine de la lisière ; le Dormeur lent, la bête vive', () => {
  const owned = new Set(['coeur', 'source', 'lisiere']);
  const island = { owned, sites: [{ id: 'foyer', level: 1 }, { id: 'puits', level: 1 }], acts: 5, unlocks: { noye: 0, racine: 0 } };
  const all = Array.from({ length: 30 }, (_, k) => nights.planOf(7, N(200 + k), island)).flat();
  const near = (c, what) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => what(c.x + dx, c.y + dy));
  const of = kind => all.filter(c => c.kind === kind && !c.back);
  assert.ok(of('noye').length && of('noye').every(c => near(c.path[0], (x, y) => map.groundAt(x, y) === '~')));
  const woods = (x, y) => ['f', 't'].includes(map.groundAt(x, y));
  assert.ok(of('racine').length && of('racine').every(c => woods(c.path[0].x, c.path[0].y) && near(c.path[0], (x, y) => map.isLand(x, y) && !woods(x, y))));
  for (const c of all) assert.equal(c.arrives - c.at, (c.path.length - 1) * c.pace);
  assert.deepEqual(['fantome', 'zombie', 'bete'].map(nights.paceOf), [nights.MS_PER_CELL, 1.5 * nights.MS_PER_CELL, 0.75 * nights.MS_PER_CELL]);
  // L'Esprit a son retour prévu, d'ailleurs, après l'instant où il serait arrivé
  for (const c of of('esprit')) {
    const back = all.find(r => r.back === c.id);
    assert.equal(back.id, `${c.id}:retour`);
    assert.equal(back.at, c.arrives + nights.RETURN_MS);
  }
});

test('chacun sa manière : le Sans-Nom dévie vers la lumière, le Dormeur s’endort contre la clôture, la Racine passe dessous, l’Esprit revient', () => {
  const path = nights.lineOf({ x: 10, y: 10 }, { x: 20, y: 10 });
  const walker = kind => ({ id: 'n:0', kind, site: 'puits', path, at: 0, pace: nights.paceOf(kind), arrives: 10 * nights.paceOf(kind) });
  // Une lanterne à 5 cases au-dessus du chemin (hors de portée : 3) : le Sans-Nom la voit, y va, devient luciole
  const lamp = nights.defenseOf([{ craft: 'lanterne', x: 15, y: 15 }], {});
  assert.equal(nights.fateOf(walker('bete'), lamp).end, 'arrive');
  const ghost = nights.fateOf(walker('fantome'), lamp);
  assert.equal(ghost.end, 'luciole');
  assert.deepEqual([ghost.path[0], ghost.path.at(-1)], [{ x: 10, y: 10 }, { x: 15, y: 15 }]);
  assert.equal(nights.fateOf(walker('fantome'), nights.defenseOf([], {})).path, undefined);
  // Le Dormeur : la lumière ne lui fait rien ; une clôture l'endort
  const near = nights.defenseOf([{ craft: 'lanterne', x: 15, y: 12 }], {});
  assert.equal(nights.fateOf(walker('zombie'), near).end, 'arrive');
  const fence = nights.defenseOf([{ craft: 'cloture', x: 14, y: 10 }], {});
  assert.deepEqual(nights.fateOf(walker('zombie'), fence), { end: 'dort', step: 4 });
  // La Racine passe sous la clôture ; la lumière la change
  assert.equal(nights.fateOf(walker('racine'), fence).end, 'arrive');
  assert.equal(nights.fateOf(walker('racine'), near).end, 'luciole');
  // (au matin, Brume dit qu'elle est passée sous une clôture : seulement si une clôture était sur son chemin avant son arrêt)
  const under = defense => nights.underFence(walker('racine'), nights.fateOf(walker('racine'), defense), defense);
  const both = nights.defenseOf([{ craft: 'cloture', x: 14, y: 10 }, { craft: 'lanterne', x: 15, y: 12 }], {});
  assert.deepEqual([under(fence), under(near), under(both)], [true, false, false]);
  assert.equal(nights.underFence(walker('zombie'), nights.fateOf(walker('zombie'), fence), fence), false);
  // L'Esprit : repoussé (clôture, toucher), il revient ; changé en luciole, jamais
  const spirit = walker('esprit');
  const back = { ...walker('esprit'), id: 'n:0:retour', back: 'n:0', at: spirit.arrives + nights.RETURN_MS, arrives: spirit.arrives + nights.RETURN_MS + 10 * nights.MS_PER_CELL };
  const plan = [spirit, back];
  assert.deepEqual(nights.outcomeOf(plan, fence).fates['n:0:retour'], { end: 'barre', step: 4 });
  assert.deepEqual(nights.outcomeOf(plan, near).fates['n:0:retour'], { end: 'absent', step: null });
  const touched = nights.outcomeOf(plan, nights.defenseOf([], {}), new Set(), new Set(['n:0']));
  assert.deepEqual(touched.fates['n:0:retour'], { end: 'arrive', step: 10 });
  assert.deepEqual(touched.panne, { site: 'puits', at: back.arrives });
  // Chassé par le coq, il revient aussi (et le coq ne chante qu'une fois)
  const crowed = nights.outcomeOf(plan, nights.defenseOf([], {}), new Set(), new Set(), { x: 10, y: 12 });
  assert.deepEqual([crowed.fates['n:0'].end, crowed.fates['n:0:retour'].end], ['coq', 'arrive']);
});

test('réparer : de la pierre ou du bois, 3 au palier I puis 2 de plus par palier', () => {
  assert.deepEqual(nights.repairOf('puits', 1), { resource: 'stone', amount: 3 });
  assert.deepEqual(nights.repairOf('puits', 2), { resource: 'stone', amount: 5 });
  assert.deepEqual(nights.repairOf('bosquet', 4), { resource: 'wood', amount: 9 });
  assert.deepEqual(nights.repairOf('foyer', 1), { resource: 'stone', amount: 3 });
});
