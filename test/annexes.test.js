// Annexes : catalogue, exemplaires et prix, effets sur la production et la Récolte, cases autorisées
const test = require('node:test');
const assert = require('node:assert/strict');
const annexes = require('../src/services/annexes');
const world = require('../src/services/world');
const map = require('../src/services/worldMap');

const hoursAgo = (h, now) => new Date(now - h * 3600000);

test('trois annexes par bâtiment : petite (palier II), réserve (IV), grande (VI) ; le Foyer a aussi ses maisons', () => {
  assert.equal(annexes.ANNEXES.length, 28);
  for (const site of Object.keys(world.SITES)) {
    const own = annexes.ANNEXES.filter(a => a.site === site && a.kind !== 'house' && a.kind !== 'climate');
    assert.deepEqual(own.map(a => a.kind), ['small', 'reserve', 'grand'], site);
    assert.deepEqual(own.map(a => annexes.levelFor(a, 0)), [2, 4, 6], site);
  }
  assert.deepEqual(annexes.ANNEXES.filter(a => a.kind === 'house').map(a => [a.id, a.site]), [['maison', 'foyer']]);
  assert.equal(new Set(annexes.ANNEXES.map(a => a.id)).size, 28);
});

test('annexes de climat : une par trouvaille, au palier III, payées aussi en trouvailles', () => {
  const finds = require('../src/services/finds');
  const climate = annexes.ANNEXES.filter(a => a.kind === 'climate');
  assert.deepEqual(climate.map(a => Object.keys(a.finds)[0]).sort(), finds.FINDS.map(f => f.id).sort());
  for (const a of climate) {
    assert.equal(annexes.maxOf(a), 1);
    assert.equal(annexes.levelFor(a, 0), 3);
    assert.deepEqual(annexes.priceOf(a, 0), { cost: a.cost, coins: 500, finds: { [Object.keys(a.finds)[0]]: 15 } });
  }
  assert.equal(annexes.effectText(annexes.ANNEX_BY_ID.glaciere, ['seaux d’eau'], 8), 'Garde 12 h de production au lieu de 8');
  assert.equal(annexes.effectText(annexes.ANNEX_BY_ID.serre, ['vivres'], 8), '+5 vivres et +4 écus par heure');
  assert.equal(annexes.effectText(annexes.ANNEX_BY_ID.metier, [], 8), '+1 partie de Récolte en réserve');
});

test('quatre maisons au Foyer (paliers II à V), leur coût double ; chacune loge un visiteur', () => {
  const maison = annexes.ANNEX_BY_ID.maison;
  assert.equal(annexes.maxOf(maison), 4);
  assert.deepEqual([0, 1, 2, 3].map(k => annexes.levelFor(maison, k)), [2, 3, 4, 5]);
  assert.deepEqual(annexes.priceOf(maison, 0), { cost: { wood: 30, stone: 20 }, coins: 80, finds: {} });
  assert.deepEqual(annexes.priceOf(maison, 3), { cost: { wood: 240, stone: 160 }, coins: 800, finds: {} });
  assert.equal(annexes.effectText(maison, [], 8), 'Loge un visiteur qui veut rester sur l’île');
  // Une maison ne change ni la production ni la Récolte
  const extra = annexes.bonusesOf([{ annex: 'maison', built_at: new Date() }]);
  assert.deepEqual([extra.charges, extra.moves, extra.regenCut, extra.site, extra.cap], [0, 0, 0, {}, {}]);
});

test('la petite annexe d’un bâtiment qui produit se pose 6 fois (paliers II, III, V, VI, VII, VII), son coût double', () => {
  const champ = annexes.ANNEX_BY_ID.champ;
  assert.equal(annexes.maxOf(champ), 6);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(k => annexes.levelFor(champ, k)), [2, 3, 5, 6, 7, 7]);
  assert.deepEqual(annexes.priceOf(champ, 0), { cost: { wood: 20, water: 20 }, coins: 100, finds: {} });
  assert.deepEqual(annexes.priceOf(champ, 2), { cost: { wood: 80, water: 80 }, coins: 600, finds: {} });
  assert.deepEqual(annexes.priceOf(champ, 3), { cost: { wood: 160, water: 160 }, coins: 1200, finds: {} });
  assert.deepEqual(annexes.priceOf(champ, 5), { cost: { wood: 640, water: 640 }, coins: 3000, finds: {} });
  ['filon', 'coupe', 'citerne', 'vivier'].forEach(id => assert.equal(annexes.maxOf(annexes.ANNEX_BY_ID[id]), 6, id));
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

test('une annexe se pose n’importe où dans le quartier de son bâtiment, hors des emprises', () => {
  const at = map.SITE_BIG.potager;
  // Juste à côté de l'emprise 3 × 3 : oui si le sol s'y prête ; dans l'emprise : jamais
  assert.equal(world.annexSpotOk('potager', at.x + 1, at.y + 1), false);
  const ring = [];
  for (let y = at.y - 2; y <= at.y + 4; y++) for (let x = at.x - 2; x <= at.x + 4; x++) if (world.annexSpotOk('potager', x, y)) ring.push({ x, y });
  assert.ok(ring.length >= 10, `cases autour du Potager : ${ring.length}`);
  for (const c of ring) assert.equal(map.zoneAt(c.x, c.y), map.siteZone('potager'));
  // Loin du bâtiment mais dans son quartier : oui ; dans un autre quartier : non
  let far = null, other = null;
  for (let y = 0; y < map.SIZE; y++) {
    for (let x = 0; x < map.SIZE; x++) {
      if (!map.buildable(x, y) || map.inSite(x, y)) continue;
      if (!far && map.zoneAt(x, y) === 'jardins' && annexes.reachOf(x, y, at) > 8) far = { x, y };
      if (!other && map.zoneAt(x, y) === 'coeur') other = { x, y };
    }
  }
  assert.ok(far && other);
  assert.equal(world.annexSpotOk('potager', far.x, far.y), true);
  assert.equal(world.annexSpotOk('potager', other.x, other.y), false);
  assert.equal(world.annexSpotOk('nulle-part', at.x, at.y), false);
  // Chaque bâtiment a la place de toutes ses annexes (6 exemplaires de la petite, réserve, grande, climat)
  for (const site of Object.keys(world.SITES)) {
    let n = 0;
    for (let y = 0; y < map.SIZE; y++) for (let x = 0; x < map.SIZE; x++) if (world.annexSpotOk(site, x, y)) n++;
    assert.ok(n >= 20, `${site} : ${n} cases`);
  }
});
