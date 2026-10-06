// Créations d'île : catalogue, découpe des pièces, vérification d'un assemblage, paliers, règles de pose
const test = require('node:test');
const assert = require('node:assert/strict');
const crafts = require('../src/services/crafts');
const bookPages = require('../src/services/bookPages');

test('30 créations sur cinq paliers (dont 12 de climat), chacune après des créations existantes, gabarit d’un seul tenant', () => {
  assert.equal(crafts.CRAFTS.length, 30);
  assert.equal(new Set(crafts.CRAFTS.map(c => c.id)).size, 30);
  assert.deepEqual(crafts.TIERS.map(t => crafts.CRAFTS.filter(c => c.tier === t).length), [2, 6, 6, 4, 12]);
  const rank = t => crafts.TIERS.indexOf(t);
  for (const c of crafts.CRAFTS) {
    for (const id of c.after) assert.ok(crafts.CRAFT_BY_ID[id] && rank(crafts.CRAFT_BY_ID[id].tier) <= rank(c.tier), `${c.id} après ${id}`);
    const cells = crafts.cellsOf(c.shape);
    const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
    const queue = [cells[0]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && cells.some(([cx, cy]) => `${cx},${cy}` === k)) { seen.add(k); queue.push([x + dx, y + dy]); }
      }
    }
    assert.equal(seen.size, cells.length, `${c.id} d’un seul tenant`);
  }
});

test('les pièces couvrent exactement le gabarit (2 cases au moins), toujours la même découpe pour une graine', () => {
  for (const c of crafts.CRAFTS) {
    for (const seed of [1, 42, 9999]) {
      const pieces = crafts.piecesOf(c.shape, seed, c.tier);
      assert.deepEqual(crafts.piecesOf(c.shape, seed, c.tier), pieces);
      assert.equal(pieces.flat().length, crafts.cellsOf(c.shape).length, c.id);
      assert.ok(pieces.every(p => p.length >= 2), c.id);
    }
  }
  assert.deepEqual(crafts.turn([[0, 0], [1, 0]], 1), [[0, 0], [0, 1]]);
  assert.deepEqual(crafts.turn([[0, 0], [1, 0], [1, 1]], 4), crafts.turn([[0, 0], [1, 0], [1, 1]], 0));
});

test('un assemblage se vérifie : pièces toutes posées, dans le gabarit, sans chevauchement, gabarit rempli', () => {
  const shape = ['xx', 'xx'];
  const pieces = [[[0, 0], [1, 0]], [[0, 0], [1, 0]]];
  assert.deepEqual(crafts.check(shape, pieces, [{ piece: 0, rot: 0, x: 0, y: 0 }, { piece: 1, rot: 0, x: 0, y: 1 }]), { ok: true });
  assert.deepEqual(crafts.check(shape, pieces, [{ piece: 0, rot: 1, x: 0, y: 0 }, { piece: 1, rot: 1, x: 1, y: 0 }]), { ok: true });
  assert.match(crafts.check(shape, pieces, [{ piece: 0, rot: 0, x: 0, y: 0 }]).error, /manque/);
  assert.match(crafts.check(shape, pieces, [{ piece: 0, rot: 0, x: 0, y: 0 }, { piece: 0, rot: 0, x: 0, y: 1 }]).error, /invalide/);
  assert.match(crafts.check(shape, pieces, [{ piece: 0, rot: 0, x: 1, y: 0 }, { piece: 1, rot: 0, x: 0, y: 1 }]).error, /dépasse/);
  assert.match(crafts.check(shape, pieces, [{ piece: 0, rot: 0, x: 0, y: 0 }, { piece: 1, rot: 1, x: 0, y: 0 }]).error, /chevauchent/);
  assert.match(crafts.check(shape, pieces, 'rien').error, /manque/);
});

test('paliers : I par le chapitre I fini ou 10 questions de l’Épreuve ; II et III par leur chapitre fini', () => {
  assert.deepEqual([...crafts.tiersOpen(new Set(), 9)], ['start', 'climat']);
  assert.deepEqual([...crafts.tiersOpen(new Set(), 10)], ['start', 'I', 'climat']);
  assert.deepEqual([...crafts.tiersOpen(new Set(['I', 'II']), 0)], ['start', 'I', 'II', 'climat']);
  const ctx = (over = {}) => ({ made: {}, owned: new Set(['Feu']), stock: { wood: 50, stone: 50 }, open: new Set(['start', 'I']), ...over });
  const lanterne = crafts.CRAFT_BY_ID.lanterne;
  assert.match(crafts.blockOf(lanterne, ctx()), /Lumière/);
  assert.equal(crafts.blockOf(lanterne, ctx({ owned: new Set(['Feu', 'Lumière']) })), null);
  assert.match(crafts.blockOf(crafts.CRAFT_BY_ID.banc, ctx()), /Clôture/);
  assert.match(crafts.blockOf(crafts.CRAFT_BY_ID.fontaine, ctx()), /chapitre II/);
  assert.match(crafts.blockOf(crafts.CRAFT_BY_ID.cloture, ctx({ stock: {} })), /ressources/);
});

test('règles de pose : sol, bord de chemin, près d’un bâtiment, près d’une autre création', () => {
  const ground = (x, y) => (y === 0 ? 'p' : x > 5 ? 's' : 'g');
  const ctx = (placed = []) => ({ ground, free: (x, y) => x >= 0 && y >= 0 && x < 10 && y < 10, site: id => (id === 'potager' ? { x: 0, y: 5, w: 2, h: 2 } : null), placed });
  const by = id => crafts.CRAFT_BY_ID[id];
  assert.equal(crafts.spotBlock(by('cloture'), 3, 3, ctx()), null);
  assert.match(crafts.spotBlock(by('cloture'), 20, 3, ctx()), /occupée/);
  assert.match(crafts.spotBlock(by('massif'), 7, 3, ctx()), /herbe/);
  assert.equal(crafts.spotBlock(by('longuevue'), 7, 3, ctx()), null);
  assert.equal(crafts.spotBlock(by('lanterne'), 3, 1, ctx()), null);
  assert.match(crafts.spotBlock(by('lanterne'), 3, 3, ctx()), /chemin/);
  assert.equal(crafts.spotBlock(by('epouvantail'), 4, 6, ctx()), null);
  assert.match(crafts.spotBlock(by('epouvantail'), 5, 1, ctx()), /bâtiment/);
  assert.match(crafts.spotBlock(by('nichoir'), 3, 3, ctx()), /bâtiment/);
  assert.match(crafts.spotBlock(by('banc'), 3, 3, ctx()), /Lanterne/);
  assert.equal(crafts.spotBlock(by('banc'), 3, 3, ctx([{ x: 4, y: 4, craft: 'lanterne' }])), null);
  assert.match(crafts.placeText(by('epouvantail'), () => 'Serre'), /3 cases au plus de « Serre »/);
  assert.equal(crafts.placeText(by('cloture')), 'Se pose sur n’importe quelle case libre.');
});

test('règle « près de » tenue au déplacement et au rangement : la Lanterne garde son Banc à portée', () => {
  const lanterne = { id: 1, x: 4, y: 4, craft: 'lanterne' };
  const banc = { id: 2, x: 3, y: 3, craft: 'banc' };
  const placed = [lanterne, banc];
  // Ranger la Lanterne, ou l'éloigner : non ; la déplacer à 2 cases du Banc : oui
  assert.equal(crafts.leaveBlock(lanterne, null, null, placed), '« Banc » a besoin de « Lanterne » à 2 cases au plus : déplace ou range d’abord « Banc ».');
  assert.match(crafts.leaveBlock(lanterne, 9, 9, placed), /Banc/);
  assert.equal(crafts.leaveBlock(lanterne, 5, 5, placed), null);
  // Ce que la Lanterne garde à portée (la vue le dit au navigateur) : le Banc ; le Banc, lui, ne garde rien
  assert.deepEqual(crafts.strandedBy(lanterne, null, null, placed), [banc]);
  assert.deepEqual(crafts.strandedBy(banc, null, null, placed), []);
  // Une autre Lanterne à portée du Banc : la première peut partir
  assert.equal(crafts.leaveBlock(lanterne, null, null, [...placed, { id: 3, x: 1, y: 2, craft: 'lanterne' }]), null);
  // Le Banc lui-même, ou une création dont rien ne dépend, part librement
  assert.equal(crafts.leaveBlock(banc, null, null, placed), null);
  const fence = { id: 4, x: 0, y: 0, craft: 'cloture' };
  assert.equal(crafts.leaveBlock(fence, null, null, [...placed, fence]), null);
  // Un Banc déjà loin de toute Lanterne (posé avant cette règle) ne bloque rien
  assert.equal(crafts.leaveBlock(lanterne, 5, 5, [...placed, { id: 5, x: 9, y: 9, craft: 'banc' }]), null);
  // La Fontaine garde son Bassin, à 3 cases
  const fontaine = { id: 6, x: 0, y: 0, craft: 'fontaine' };
  assert.match(crafts.leaveBlock(fontaine, null, null, [fontaine, { id: 7, x: 3, y: 3, craft: 'bassin' }]), /« Bassin » a besoin de « Fontaine » à 3 cases/);
  assert.equal(crafts.leaveBlock(fontaine, 1, 0, [fontaine, { id: 7, x: 3, y: 3, craft: 'bassin' }]), null);
});

test('créations de climat : deux par climat, payées aussi en trouvailles, posées seulement dans leur climat et sur leur sol', () => {
  const map = require('../src/services/worldMap');
  const finds = require('../src/services/finds');
  const climate = crafts.CRAFTS.filter(c => c.tier === 'climat');
  for (const f of finds.FINDS) {
    const mine = climate.filter(c => c.place.climate === f.climate);
    assert.equal(mine.length, 2, f.climate);
    assert.ok(mine.every(c => c.finds[f.id] > 0), f.id);
    assert.deepEqual(mine[1].after, [mine[0].id]);
  }
  assert.ok(crafts.CRAFTS.filter(c => c.tier !== 'climat').every(c => !Object.keys(c.finds).length && !c.place.climate));
  const igloo = crafts.CRAFT_BY_ID.igloo;
  const ctx = (over = {}) => ({ made: {}, owned: new Set(['Neige']), stock: { wood: 50 }, open: new Set(['climat']), have: { glace: 8 }, ...over });
  assert.equal(crafts.blockOf(igloo, ctx()), null);
  assert.match(crafts.blockOf(igloo, ctx({ have: { glace: 7 } })), /8 glace.*Cimes/);
  assert.equal(crafts.placeText(igloo), 'Se pose dans Les Cimes, sur la neige.');
  const spot = { ground: () => 'n', free: () => true, site: () => null, placed: [], climate: () => 'cimes' };
  assert.equal(crafts.spotBlock(igloo, 1, 1, spot), null);
  assert.match(crafts.spotBlock(igloo, 1, 1, { ...spot, climate: () => 'landes' }), /Les Cimes/);
  assert.match(crafts.spotBlock(igloo, 1, 1, { ...spot, ground: () => 'r' }), /neige/);
  assert.equal(map.CLIMATES.cimes, 'Les Cimes');
});

test('un chapitre est fini quand toutes ses pages sont trouvées', () => {
  const b = { meta: new Map([['Air', { family: 'Elements Fondamentaux' }], ['Eau', { family: 'Elements Fondamentaux' }], ['Pluie', { family: 'Phénomènes Naturels' }], ['Or', { family: 'Matériaux' }]]) };
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau'])], []);
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau', 'Pluie'])], ['I']);
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau', 'Pluie', 'Or'])], ['I', 'II']);
});
