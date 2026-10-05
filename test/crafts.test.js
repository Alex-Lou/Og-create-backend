// Créations d'île : catalogue, découpe des pièces, vérification d'un assemblage, paliers, règles de pose
const test = require('node:test');
const assert = require('node:assert/strict');
const crafts = require('../src/services/crafts');
const bookPages = require('../src/services/bookPages');

test('18 créations sur quatre paliers, chacune après des créations existantes, gabarit d’un seul tenant', () => {
  assert.equal(crafts.CRAFTS.length, 18);
  assert.equal(new Set(crafts.CRAFTS.map(c => c.id)).size, 18);
  assert.deepEqual(crafts.TIERS.map(t => crafts.CRAFTS.filter(c => c.tier === t).length), [2, 6, 6, 4]);
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
  assert.deepEqual([...crafts.tiersOpen(new Set(), 9)], ['start']);
  assert.deepEqual([...crafts.tiersOpen(new Set(), 10)], ['start', 'I']);
  assert.deepEqual([...crafts.tiersOpen(new Set(['I', 'II']), 0)], ['start', 'I', 'II']);
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

test('un chapitre est fini quand toutes ses pages sont trouvées', () => {
  const b = { meta: new Map([['Air', { family: 'Elements Fondamentaux' }], ['Eau', { family: 'Elements Fondamentaux' }], ['Pluie', { family: 'Phénomènes Naturels' }], ['Or', { family: 'Matériaux' }]]) };
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau'])], []);
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau', 'Pluie'])], ['I']);
  assert.deepEqual([...bookPages.finishedChapters(b, ['Air', 'Eau', 'Pluie', 'Or'])], ['I', 'II']);
});
