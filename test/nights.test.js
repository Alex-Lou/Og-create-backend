// Les nuits de créatures (bible du dépôt front, § 6.15, v6 ; décisions du 6 octobre 2026) : heures de Paris, chemins
// depuis la brume, défenses, camarades, toucher, une panne au plus, réparation (fonctions pures)
const test = require('node:test');
const assert = require('node:assert/strict');
const nights = require('../src/services/nights');
const map = require('../src/services/worldMap');

const at = s => Date.parse(s);
const step = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test('une nuit va de 21 h à 6 h, heure de Paris, changements d’heure compris', () => {
  // Hiver (UTC+1), été (UTC+2), et la nuit où l'on recule d'une heure (25 octobre 2026, 3 h → 2 h)
  assert.deepEqual(nights.boundsOf('2026-01-10'), { start: at('2026-01-10T20:00:00Z'), end: at('2026-01-11T05:00:00Z') });
  assert.deepEqual(nights.boundsOf('2026-07-10'), { start: at('2026-07-10T19:00:00Z'), end: at('2026-07-11T04:00:00Z') });
  assert.deepEqual(nights.boundsOf('2026-10-24'), { start: at('2026-10-24T19:00:00Z'), end: at('2026-10-25T05:00:00Z') });
  assert.deepEqual(nights.boundsOf('2026-03-28'), { start: at('2026-03-28T20:00:00Z'), end: at('2026-03-29T04:00:00Z') });
  // La nuit en cours : le soir, celle du jour ; avant 6 h, celle de la veille ; le jour, aucune
  assert.equal(nights.nightAt(at('2026-10-06T20:30:00Z')), '2026-10-06');
  assert.equal(nights.nightAt(at('2026-10-07T03:59:00Z')), '2026-10-06');
  assert.equal(nights.nightAt(at('2026-10-07T04:00:00Z')), null);
  assert.equal(nights.nightAt(at('2026-10-07T12:00:00Z')), null);
  // La nuit en cours, ou la prochaine
  assert.equal(nights.nightNear(at('2026-10-07T12:00:00Z')), '2026-10-07');
  assert.equal(nights.nightNear(at('2026-10-07T02:00:00Z')), '2026-10-06');
  assert.equal(nights.nightNear(at('2026-10-07T22:00:00Z')), '2026-10-07');
});

test('les nuits finies entre deux passages, dans l’ordre, quatorze au plus', () => {
  const end = night => nights.boundsOf(night).end;
  assert.deepEqual(nights.endedBetween(at('2026-10-06T12:00:00Z'), at('2026-10-07T12:00:00Z')), ['2026-10-06']);
  // La fin exacte compte une fois : exclue au départ, comprise à l'arrivée
  assert.deepEqual(nights.endedBetween(end('2026-10-06'), end('2026-10-07')), ['2026-10-07']);
  assert.deepEqual(nights.endedBetween(at('2026-10-06T12:00:00Z'), at('2026-10-06T23:00:00Z')), []);
  assert.deepEqual(nights.endedBetween(at('2026-10-01T12:00:00Z'), at('2026-10-04T12:00:00Z')), ['2026-10-01', '2026-10-02', '2026-10-03']);
  const long = nights.endedBetween(at('2026-01-01T12:00:00Z'), at('2026-10-07T12:00:00Z'));
  assert.equal(long.length, 14);
  assert.equal(long[13], '2026-10-06');
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

  const island = { owned, sites: [{ id: 'foyer', level: 1 }, { id: 'puits', level: 1 }], acts: 0 };
  const plan = nights.planOf(42, '2026-10-06', island);
  // La même graine, le même plan (tous les appareils voient la même nuit) ; une autre nuit, un autre
  assert.deepEqual(nights.planOf(42, '2026-10-06', island), plan);
  assert.notDeepEqual(nights.planOf(42, '2026-10-07', island).map(c => c.path), plan.map(c => c.path));
  assert.equal(plan.length, nights.countOf(0));
  const { start, end } = nights.boundsOf('2026-10-06');
  for (const [k, c] of plan.entries()) {
    assert.equal(c.id, `2026-10-06:${k}`);
    assert.ok(border.some(b => b.x === c.path[0].x && b.y === c.path[0].y));
    const f = map.footprintOf(c.site, 1);
    const last = c.path.at(-1);
    assert.ok(last.x >= f.x && last.x < f.x + f.w && last.y >= f.y && last.y < f.y + f.h);
    // Dans la première moitié de la nuit, une case toutes les 3 minutes
    assert.ok(c.at >= start && c.at <= start + (end - start) / 2);
    assert.equal(c.arrives - c.at, (c.path.length - 1) * nights.MS_PER_CELL);
  }
  // Plus coriaces à chaque acte : de 2 à 6
  assert.deepEqual([0, 1, 2, 4, 8, 12].map(nights.countOf), [2, 2, 3, 4, 6, 6]);
  // Ni bâtiment ni bord : personne
  assert.deepEqual(nights.planOf(42, '2026-10-06', { ...island, sites: [] }), []);
});

test('la lumière les change en lucioles (3 cases), la clôture barre sa case, le feu du Foyer éclaire', () => {
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

test('réparer : de la pierre ou du bois, 3 au palier I puis 2 de plus par palier', () => {
  assert.deepEqual(nights.repairOf('puits', 1), { resource: 'stone', amount: 3 });
  assert.deepEqual(nights.repairOf('puits', 2), { resource: 'stone', amount: 5 });
  assert.deepEqual(nights.repairOf('bosquet', 4), { resource: 'wood', amount: 9 });
  assert.deepEqual(nights.repairOf('foyer', 1), { resource: 'stone', amount: 3 });
});
