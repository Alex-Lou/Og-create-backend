// L'arc du Phare (choix de l'auteur, 15 oct. : ecriture/arc_phare.md) : l'objectif de fond « Rallumer le phare », dès
// la fin du tutoriel, avec l'étape de l'acte en cours ; les scènes de l'histoire vues une fois par compte (le conseil,
// la traversée manquée), sans rien donner ni retirer ; la Route des feux, un feu par lieu remarquable découvert,
// rallumé d'un geste (sauf le Lac de lave)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const quests = require('../src/services/quests');
const landmarks = require('../src/services/landmarks');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('l’objectif de fond : rien pendant le tutoriel, puis l’étape de l’acte en cours, puis atteint', () => {
  const ids = until => new Set(quests.QUESTS.slice(0, quests.QUESTS.findIndex(q => q.id === until) + 1).map(q => q.id));
  assert.equal(quests.goalOf(ids('puits-ondin')), null);
  const first = quests.goalOf(ids('chemin'));
  assert.deepEqual([first.label, first.act], ['Rallumer le phare', 'I']);
  assert.ok(first.step.length > 0 && first.step.length <= 140);
  // (l'acte IV en cours : la traversée vers l'îlot)
  const lastOf = act => quests.QUESTS.filter(q => q.act === act).pop().id;
  assert.equal(quests.goalOf(ids(lastOf('III'))).act, 'IV');
  const end = quests.goalOf(new Set(quests.QUESTS.map(q => q.id)));
  assert.equal(end.act, null);
  assert.ok(end.step);
});

test('la Route des feux : chaque lieu a son feu, sauf le Lac de lave ; la lanterne du Saule attend l’acte VII', () => {
  assert.equal(landmarks.LANDMARKS.filter(l => landmarks.hasFire(l.id)).length, 11);
  assert.equal(landmarks.LANDMARKS.filter(l => landmarks.hasFire(l.id, ['VII'])).length, 12);
  assert.deepEqual([landmarks.hasFire('cratere'), landmarks.hasFire('grotte'), landmarks.hasFire('nulle')], [false, true, false]);
  assert.deepEqual([landmarks.hasFire('saule', ['I', 'VI']), landmarks.hasFire('saule', ['VII']), landmarks.hasFire('cratere', ['VII'])], [false, true, false]);
});

test('la lanterne d’Héliane, au Saule, reste vide jusqu’à la fin : découverte, elle ne se rallume qu’une fois l’acte VII fini', async () => {
  const player = await newPlayer();
  const fire = id => api('POST', '/play/world/landmark/fire', { id }, player);
  const saule = async () => (await api('GET', '/play/world', null, player)).data.landmarks.find(l => l.id === 'saule');
  await sql(`INSERT INTO world_expeditions (user_id, zone, ends_at) VALUES ($1, 'roselieres', NOW() - INTERVAL '1 hour')`, [player.userId]);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'roselieres')`, [player.userId]);
  await sql(`INSERT INTO world_landmarks (user_id, landmark) VALUES ($1, 'saule')`, [player.userId]);
  assert.deepEqual([(await saule()).found, (await saule()).fire], [true, false]);
  assert.match((await fire('saule')).data.message, /aucun feu/);
  const lastOfVII = quests.QUESTS.filter(q => q.act === 'VII').pop().id;
  const upTo = quests.QUESTS.slice(0, quests.QUESTS.findIndex(q => q.id === lastOfVII) + 1).map(q => q.id);
  await sql(`INSERT INTO world_quests (user_id, quest) SELECT $1, unnest($2::text[])`, [player.userId, upTo]);
  assert.equal((await saule()).fire, true);
  const lit = await fire('saule');
  assert.deepEqual([lit.status, lit.data.fresh], [200, true]);
});

test('les scènes de l’arc : pas avant leur quête, puis vues une fois par compte, sans rien donner', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const seen = id => api('POST', '/play/world/scene', { id }, player);
  const start = await view();
  assert.deepEqual([start.brume.scenes, start.brume.goal], [{ seen: [], due: [] }, null]);
  assert.equal((await seen('nulle')).status, 404);
  assert.equal((await seen('DROP')).status, 400);
  assert.equal((await seen('conseil')).status, 409);
  // Le tutoriel fini (le premier chemin) : le conseil se joue ; l'objectif de fond paraît
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'chemin')`, [player.userId]);
  assert.deepEqual((await view()).brume.scenes, { seen: [], due: ['conseil'] });
  const twice = await Promise.all([seen('conseil'), seen('conseil')]);
  assert.deepEqual(twice.map(r => r.status), [200, 200]);
  const after = await view();
  assert.deepEqual([after.brume.scenes, after.brume.goal.act, after.stock], [{ seen: ['conseil'], due: [] }, 'I', start.stock]);
  assert.equal((await api('GET', '/play/world/brume', null, player)).data.goal.label, 'Rallumer le phare');
  // La traversée manquée : au Bateau écrit (souvenir-aster)
  assert.equal((await seen('traversee')).status, 409);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'souvenir-aster')`, [player.userId]);
  assert.deepEqual((await view()).brume.scenes.due, ['traversee']);
  assert.equal((await seen('traversee')).status, 200);
  assert.deepEqual((await view()).brume.scenes, { seen: ['conseil', 'traversee'], due: [] });
});

test('la traversée manquée n’est plus due une fois l’acte IV fini (un compte déjà plus loin ne la voit pas)', async () => {
  const player = await newPlayer();
  const lastOfIV = quests.QUESTS.filter(q => q.act === 'IV').pop().id;
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, $2)`, [player.userId, lastOfIV]);
  const scenes = (await api('GET', '/play/world', null, player)).data.brume.scenes;
  assert.deepEqual(scenes, { seen: [], due: ['conseil'] });
});

test('l’intérieur du phare à la clé trouvée (plus dû l’acte VI fini) ; le navire au Phare de Brume allumé', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data.brume.scenes;
  const seen = id => api('POST', '/play/world/scene', { id }, player);
  assert.equal((await seen('phare')).status, 409);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'cle')`, [player.userId]);
  assert.deepEqual((await view()).due, ['conseil', 'phare']);
  assert.equal((await seen('phare')).status, 200);
  assert.equal((await seen('navire')).status, 409);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'phare-brume')`, [player.userId]);
  assert.deepEqual(await view(), { seen: ['phare'], due: ['conseil', 'navire'] });
  // (un compte déjà au-delà de l'acte VI sans avoir vu l'intérieur du phare : il n'est plus dû)
  const later = await newPlayer();
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'phare-brume')`, [later.userId]);
  assert.deepEqual((await api('GET', '/play/world', null, later)).data.brume.scenes.due, ['conseil', 'navire']);
});

test('rallumer un feu : un lieu découvert, une fois, gratuit ; le Lac de lave n’en a pas', async () => {
  const player = await newPlayer();
  const fire = id => api('POST', '/play/world/landmark/fire', { id }, player);
  const landmarkOf = (world, id) => world.landmarks.find(l => l.id === id);
  assert.equal((await fire('nulle')).status, 404);
  assert.equal((await fire('DROP')).status, 400);
  assert.equal((await fire('cratere')).status, 409);
  assert.match((await fire('menhirs')).data.message, /Découvre d’abord/);
  await sql(`INSERT INTO world_expeditions (user_id, zone, ends_at) VALUES ($1, 'menhirs', NOW() - INTERVAL '1 hour')`, [player.userId]);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'menhirs')`, [player.userId]);
  const before = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual([landmarkOf(before, 'menhirs').fire, landmarkOf(before, 'menhirs').lit], [true, false]);
  await sql(`INSERT INTO world_landmarks (user_id, landmark) VALUES ($1, 'menhirs')`, [player.userId]);
  const twice = await Promise.all([fire('menhirs'), fire('menhirs')]);
  assert.deepEqual(twice.map(r => r.status), [200, 200]);
  assert.deepEqual(twice.map(r => r.data.fresh).sort(), [false, true]);
  const lit = twice[0].data.world;
  assert.deepEqual([landmarkOf(lit, 'menhirs').lit, lit.stock], [true, before.stock]);
});
