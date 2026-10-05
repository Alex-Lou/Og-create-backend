// Annexes : catalogue, exemplaires et prix, effets sur la production et la Récolte, cases autorisées
const test = require('node:test');
const assert = require('node:assert/strict');
const annexes = require('../src/services/annexes');
const world = require('../src/services/world');
const map = require('../src/services/worldMap');

const hoursAgo = (h, now) => new Date(now - h * 3600000);

test('trois annexes par bâtiment : petite (palier II), réserve (IV), grande (VI)', () => {
  assert.equal(annexes.ANNEXES.length, 21);
  for (const site of Object.keys(world.SITES)) {
    const own = annexes.ANNEXES.filter(a => a.site === site);
    assert.deepEqual(own.map(a => a.kind), ['small', 'reserve', 'grand'], site);
    assert.deepEqual(own.map(a => annexes.levelFor(a, 0)), [2, 4, 6], site);
  }
  assert.equal(new Set(annexes.ANNEXES.map(a => a.id)).size, 21);
});

test('la petite annexe d’un bâtiment qui produit se pose 3 fois (paliers II, III, V), son coût double', () => {
  const champ = annexes.ANNEX_BY_ID.champ;
  assert.equal(annexes.maxOf(champ), 3);
  assert.deepEqual([0, 1, 2].map(k => annexes.levelFor(champ, k)), [2, 3, 5]);
  assert.deepEqual(annexes.priceOf(champ, 0), { cost: { wood: 20, water: 20 }, coins: 100 });
  assert.deepEqual(annexes.priceOf(champ, 2), { cost: { wood: 80, water: 80 }, coins: 600 });
  // Foyer et Atelier : un seul exemplaire
  assert.equal(annexes.maxOf(annexes.ANNEX_BY_ID.jardin), 1);
  assert.equal(annexes.maxOf(annexes.ANNEX_BY_ID.charbon), 1);
  assert.deepEqual(annexes.priceOf(annexes.ANNEX_BY_ID.enclos, 0).coins, 1200);
});

test('les annexes ajoutent production, heures gardées, parties, coups, et une partie revient plus vite', () => {
  const now = Date.now();
  const extra = annexes.bonusesOf([
    { annex: 'champ', built_at: hoursAgo(2, now) }, { annex: 'grenier', built_at: hoursAgo(1, now) },
    { annex: 'jardin', built_at: hoursAgo(1, now) }, { annex: 'four', built_at: hoursAgo(1, now) },
    { annex: 'fourneau', built_at: hoursAgo(1, now) }, { annex: 'inconnue', built_at: hoursAgo(1, now) }
  ]);
  assert.equal(extra.site.potager.length, 1);
  assert.deepEqual(extra.cap, { potager: 4 });
  const eff = world.effectsOf({ foyer: 1, atelier: 1 }, undefined, extra);
  assert.equal(eff.maxCharges, 4);
  assert.equal(eff.maxMoves, 15 + 3 + 2);
  assert.equal(eff.regenMs, world.REGEN_MS - 5 * 60000);
  // Jamais sous 10 minutes
  assert.equal(annexes.regenWith(12 * 60000, 5 * 60000), 10 * 60000);
  // Potager II depuis 10 h, réserve +4 h (plafond 12 h), un champ posé il y a 2 h : 60 + 6 vivres, 40 + 4 écus
  const made = world.productionOf('potager', 2, hoursAgo(10, now), null, now, { prod: 0, coins: 0, cap: 4 }, extra.site.potager);
  assert.deepEqual(made, { resource: 'food', amount: 66, coins: 44 });
  // Sans réserve, 8 h au plus ; la boutique (+50 %) compte aussi pour le champ
  const boosted = world.productionOf('potager', 2, hoursAgo(10, now), null, now, { prod: 0.5, coins: 0 }, extra.site.potager);
  assert.deepEqual(boosted, { resource: 'food', amount: Math.floor((48 + 6) * 1.5), coins: Math.floor((32 + 4) * 1.5) });
});

test('une annexe se pose dans le quartier de son bâtiment, à deux cases au plus, hors des emprises', () => {
  const at = map.SITE_BIG.potager;
  // Juste à côté de l'emprise 3 × 3 : oui si le sol s'y prête ; dans l'emprise : jamais
  assert.equal(world.annexSpotOk('potager', at.x + 1, at.y + 1), false);
  const ring = [];
  for (let y = at.y - 2; y <= at.y + 4; y++) for (let x = at.x - 2; x <= at.x + 4; x++) if (world.annexSpotOk('potager', x, y)) ring.push({ x, y });
  assert.ok(ring.length >= 10, `cases autour du Potager : ${ring.length}`);
  for (const c of ring) {
    assert.equal(map.zoneAt(c.x, c.y), map.siteZone('potager'));
    assert.ok(annexes.reachOf(c.x, c.y, at) <= annexes.REACH);
  }
  // Trois cases plus loin : non
  assert.equal(world.annexSpotOk('potager', at.x + 5, at.y), false);
  assert.equal(world.annexSpotOk('nulle-part', at.x, at.y), false);
  // Chaque bâtiment a la place de toutes ses annexes (5 exemplaires pour ceux qui produisent)
  for (const site of Object.keys(world.SITES)) {
    let n = 0;
    for (let y = 0; y < map.SIZE; y++) for (let x = 0; x < map.SIZE; x++) if (world.annexSpotOk(site, x, y)) n++;
    assert.ok(n >= 12, `${site} : ${n} cases`);
  }
});
