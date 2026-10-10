// Quêtes de Brume : la chaîne de la bible est cohérente avec l'île et le Grimoire, l'avancée se lit dans l'état, et
// un joueur d'avant la bible ne recule jamais
const test = require('node:test');
const assert = require('node:assert/strict');
const { QUESTS, LEGACY, QUEST_CHESTS, BEASTS, doneOf, firstNightDoneOf, progressOf, active, boardOf, actsDoneOf } = require('../src/services/quests');
const { islandModeOf } = require('../src/services/players');
const map = require('../src/services/worldMap');
const { SITES } = require('../src/services/world');
const { CRAFT_BY_ID } = require('../src/services/crafts');
const { LANDMARKS } = require('../src/services/landmarks');
const { VILLAGERS, NEEDS } = require('../src/services/villagers');

const ACTS = ['T', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const facts = (extra = {}) => ({
  crafts: 0, placed: new Set(), runs: 0, stars: 0, elements: new Set(['Eau', 'Feu', 'Terre', 'Air']), zones: new Set(['coeur']),
  levels: { foyer: 1 }, annexes: 0, houses: 0, met: new Set(), awake: new Set(), hearts: 0, expeditions: 0, landmarks: new Set(),
  gathered: 0, pickups: 0, hensFed: 0, visitors: 0, settled: 0, named: false, ...extra
});
// Les 21 anciennes quêtes, dans leur ordre d'avant la bible
const OLD = ['deco', 'recolte', 'source', 'puits', 'lisiere', 'cabane', 'livre5', 'colline', 'mine', 'livre12', 'jardins', 'serre', 'maison',
  'crique', 'ponton', 'livre45', 'hameau', 'deco10', 'phare', 'livre70', 'legendes'];

test('chaque quête désigne un vrai quartier, palier, création, lieu ou habitant, avec un texte et une récompense', () => {
  assert.equal(QUESTS.length, 60);
  assert.equal(new Set(QUESTS.map(q => q.id)).size, QUESTS.length);
  for (const q of QUESTS) {
    assert.match(q.id, /^[a-z0-9-]{1,30}$/);
    assert.ok(ACTS.includes(q.act), q.id);
    // Une bulle de Brume : 140 caractères au plus (bible, § 7.4)
    assert.ok(q.say.length > 20 && q.say.length <= 140 && q.label.length > 5, q.id);
    // La nuit se passe sans rien gagner : la seule étape du tutoriel sans récompense
    assert.ok(Number.isInteger(q.coins) && (q.goal.kind === 'sleep' ? q.coins === 0 : q.coins > 0), q.id);
    const { goal } = q;
    if (goal.kind === 'zone') {
      assert.ok(map.ZONE_BY_ID[goal.zone], q.id);
      assert.ok(q.label.includes(map.ZONE_BY_ID[goal.zone].name), q.id);
    }
    if (goal.kind === 'level') {
      const tier = SITES[goal.site]?.levels[goal.need - 1];
      assert.ok(tier, q.id);
      assert.ok(q.label.includes(tier.name), q.id);
    }
    if (goal.kind === 'craft') assert.ok(CRAFT_BY_ID[goal.craft], q.id);
    if (goal.kind === 'landmark' && goal.landmark) assert.ok(LANDMARKS.some(l => l.id === goal.landmark), q.id);
    if (['wake', 'need'].includes(goal.kind)) assert.ok(VILLAGERS[goal.villager], q.id);
    if (goal.kind === 'need') assert.ok(NEEDS[goal.what].cost, q.id);
    if (goal.kind === 'element') assert.ok(goal.element || goal.any.length, q.id);
  }
  // Le prologue, puis les actes, dans l'ordre ; les huit coffres de fin d'acte
  const acts = QUESTS.map(q => ACTS.indexOf(q.act));
  assert.deepEqual(acts, [...acts].sort((a, b) => a - b));
  assert.deepEqual(QUESTS.filter(q => q.chest).map(q => q.act), ACTS);
  assert.equal(QUESTS.reduce((sum, q) => sum + q.coins, 0), 5125);
  assert.ok(BEASTS.includes('Poisson') && !BEASTS.includes('Lapin'));
});

test('chaque objectif est atteignable quand sa quête devient active (quartier acheté avant, chapitre de l’acte)', () => {
  const zones = new Set(['coeur']);
  for (const q of QUESTS) {
    const act = ACTS.indexOf(q.act);
    if (q.goal.kind === 'zone') {
      const zone = map.ZONE_BY_ID[q.goal.zone];
      // Le chapitre d'un quartier demandé n'est jamais au-delà de l'acte (sinon Brume dit lequel ouvrir : world.boardWith)
      assert.ok(!zone.chapter || ACTS.indexOf(zone.chapter) <= Math.max(1, act), `${q.id} : chapitre ${zone.chapter}`);
      zones.add(zone.id);
    }
    if (q.goal.kind === 'level') {
      assert.ok(zones.has(map.siteZone(q.goal.site)), `${q.id} : quartier pas encore acheté`);
      assert.ok(ACTS.indexOf(SITES[q.goal.site].levels[q.goal.need - 1].chapter) <= Math.max(1, act), `${q.id} : chapitre du palier`);
    }
    // Un dormeur se réveille dans son quartier à soi
    if (q.goal.kind === 'wake') assert.ok(zones.has(map.siteZone(q.goal.villager)), `${q.id} : quartier du dormeur`);
  }
});

test('avancée de chaque objectif, plafonnée', () => {
  const check = (goal, extra, have, need = 1) => assert.deepEqual(progressOf(goal, facts(extra)), { have, need }, goal.kind);
  check({ kind: 'crafts', need: 10 }, { crafts: 3 }, 3, 10);
  check({ kind: 'craft', craft: 'lanterne' }, { placed: new Set(['cloture']) }, 0);
  check({ kind: 'craft', craft: 'lanterne' }, { placed: new Set(['lanterne']) }, 1);
  check({ kind: 'stars', need: 3 }, { stars: 9 }, 3, 3);
  check({ kind: 'element', element: 'Vie' }, {}, 0);
  check({ kind: 'element', element: 'Vie' }, { elements: new Set(['Vie']) }, 1);
  check({ kind: 'element', any: BEASTS }, { elements: new Set(['Grenouille']) }, 1);
  check({ kind: 'zone', zone: 'source' }, {}, 0);
  check({ kind: 'zone', zone: 'source' }, { zones: new Set(['coeur', 'source']) }, 1);
  check({ kind: 'level', site: 'foyer', need: 2 }, {}, 1, 2);
  check({ kind: 'runs', need: 1 }, { runs: 4 }, 1);
  check({ kind: 'annex', need: 1 }, { annexes: 2 }, 1);
  check({ kind: 'house', need: 1 }, {}, 0);
  check({ kind: 'need', villager: 'foyer', what: 'manger' }, { met: new Set(['foyer:manger']) }, 1);
  check({ kind: 'wake', villager: 'puits' }, { awake: new Set(['foyer']) }, 0);
  check({ kind: 'wake', villager: 'puits' }, { awake: new Set(['puits']) }, 1);
  check({ kind: 'heart', need: 1 }, { hearts: 2 }, 1);
  check({ kind: 'expedition', need: 1 }, { expeditions: 1 }, 1);
  check({ kind: 'landmark', need: 1 }, { landmarks: new Set(['saule']) }, 1);
  check({ kind: 'landmark', landmark: 'menhirs' }, { landmarks: new Set(['saule']) }, 0);
  check({ kind: 'gather', need: 1 }, { gathered: 3 }, 1);
  check({ kind: 'pickup', need: 3 }, { pickups: 2 }, 2, 3);
  check({ kind: 'hens', need: 1 }, {}, 0);
  check({ kind: 'hens', need: 1 }, { hensFed: 3 }, 1);
  check({ kind: 'visitor', need: 1 }, { visitors: 1 }, 1);
  check({ kind: 'settle', need: 1 }, { settled: 0 }, 0);
  check({ kind: 'name' }, { named: true }, 1);
});

test('la quête active est la première pas encore faite ; à la fin, Brume se repose', () => {
  const first = active(new Set(), facts());
  assert.deepEqual(QUESTS.slice(0, 5).map(q => q.id), ['pages', 'ramasser', 'feu', 'nuit', 'recolte']);
  assert.match(QUESTS.find(q => q.id === 'feu').say, /sur la plage de Brumelune/);
  assert.deepEqual([first.id, first.act, first.step, first.total, first.kind, first.done], ['pages', 'T', 1, 60, 'element', false]);
  assert.equal(active(new Set(), facts({ elements: new Set([...facts().elements, 'Vent']) })).done, true);
  const ondin = active(new Set(['deco']), facts());
  assert.deepEqual([ondin.id, ondin.target], ['eveil-ondin', { villager: 'puits' }]);
  const souvenir = active(new Set(['eveil-ondin']), facts());
  assert.deepEqual([souvenir.id, souvenir.kind, souvenir.element], ['souvenir-ondin', 'element', 'Puits']);
  const puits = active(new Set(['souvenir-ondin']), facts());
  assert.deepEqual([puits.target, puits.chest], [{ site: 'puits' }, 'rare']);
  // Le Puits bâti : le premier chemin, du Puits au Feu (Brume attend au Puits)
  const road = active(new Set(['puits-ondin']), facts());
  assert.deepEqual([road.id, road.act, road.kind, road.target, road.done], ['chemin', 'I', 'link', { site: 'puits' }, false]);
  assert.equal(active(new Set(['puits-ondin']), facts({ links: new Set(['puits-foyer']) })).done, true);
  assert.equal(active(new Set(['lumiere']), facts()).craft, 'lanterne');
  assert.deepEqual(active(new Set(['ecriture']), facts()).target, { landmark: 'menhirs' });
  assert.equal(active(new Set(QUESTS.map(q => q.id)), facts()), null);
  const board = boardOf(new Set(['phare-brume']), facts());
  assert.equal(board.quest, null);
  assert.equal(board.done, QUESTS.length);
  assert.ok(board.rested.length > 10);
  assert.deepEqual(board.acts, ACTS);
});

test('les actes finis se lisent dans les quêtes faites (veillées, étape de civilisation)', () => {
  assert.deepEqual(actsDoneOf(doneOf(new Set())), []);
  // Le Puits réclamé : le prologue est fini ; la lanterne : l'acte I aussi
  assert.deepEqual(actsDoneOf(doneOf(new Set(['puits-ondin']))), ['T']);
  assert.deepEqual(actsDoneOf(doneOf(new Set(['lanterne']))), ['T', 'I']);
  assert.deepEqual(boardOf(new Set(['cabane']), facts()).acts, ['T', 'I', 'II']);
  // Un joueur d'avant la bible : ses anciennes quêtes rangées comptent
  assert.deepEqual(actsDoneOf(doneOf(new Set(['source', 'puits', 'lisiere', 'cabane']))), ['T', 'I', 'II']);
});

test('un joueur d’avant la bible ne recule jamais : ses anciennes quêtes se rangent dans la nouvelle chaîne', () => {
  const ids = new Set(QUESTS.map(q => q.id));
  // Chaque ancienne quête est dans la nouvelle chaîne, ou se range à une place qui y existe
  for (const id of OLD) assert.ok(ids.has(id) || ids.has(LEGACY[id]?.at), id);
  // Une quête placée avant la plus avancée réclamée compte comme faite (sans récompense de plus)
  const veteran = doneOf(new Set(['deco', 'recolte', 'source']));
  assert.ok(['pages', 'feu', 'recolte', 'soupe', 'deco'].every(id => veteran.has(id)));
  assert.equal(active(new Set(['deco', 'recolte', 'source']), facts()).id, 'eveil-ondin');
  // Plus loin dans l'ancienne chaîne, jamais plus tôt dans la nouvelle
  let before = -1;
  for (let i = 0; i < OLD.length; i++) {
    const step = active(new Set(OLD.slice(0, i + 1)), facts())?.step ?? QUESTS.length + 1;
    assert.ok(step >= before, OLD[i]);
    before = step;
  }
  assert.equal(active(new Set(OLD), facts()).id, 'feu-follet');
  // Les coffres des anciennes quêtes restent dus ; une nouvelle quête ne reprend jamais l'identifiant d'une ancienne
  // dont le coffre a changé
  const chests = new Map(QUEST_CHESTS.map(q => [q.id, q.chest]));
  assert.deepEqual(['source', 'mine', 'ponton', 'deco10', 'legendes'].map(id => chests.get(id)), ['rare', 'epique', 'epique', 'legendaire', 'legendaire']);
  for (const id of Object.keys(LEGACY)) assert.ok(!ids.has(id), id);
  assert.deepEqual(['cabane', 'serre'].map(id => chests.get(id)), ['rare', 'epique']);
});

test('tout compte dont la première nuit est incomplète reprend la séquence de la plage de Brumelune', () => {
  const old = '2026-01-01T00:00:00Z';
  const recent = '2026-12-01T00:00:00Z';
  assert.equal(firstNightDoneOf(new Set()), false);
  assert.equal(firstNightDoneOf(new Set(['feu'])), false);
  assert.equal(firstNightDoneOf(new Set(['recolte'])), true);
  // Une ancienne quête située après la Récolte confirme aussi que le joueur a dépassé cette étape.
  assert.equal(firstNightDoneOf(new Set(['source'])), true);
  assert.deepEqual(islandModeOf({ createdAt: old, claimed: [] }), { firstNightDone: false, veteran: false, fresh: true });
  assert.deepEqual(islandModeOf({ createdAt: old, claimed: ['feu'] }), { firstNightDone: false, veteran: false, fresh: true });
  assert.deepEqual(islandModeOf({ createdAt: old, claimed: ['recolte'] }), { firstNightDone: true, veteran: true, fresh: false });
  assert.deepEqual(islandModeOf({ createdAt: old, marked: true }), { firstNightDone: true, veteran: true, fresh: false });
  assert.deepEqual(islandModeOf({ createdAt: recent, claimed: ['recolte'] }), { firstNightDone: true, veteran: false, fresh: true });
  assert.deepEqual(islandModeOf({ createdAt: old, restarted: true, claimed: [] }), { firstNightDone: false, veteran: false, fresh: true });
});
