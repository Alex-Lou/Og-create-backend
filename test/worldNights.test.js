// Les nuits de créatures, avec la base (bible du dépôt front, § 6.15, v6) : présentées par Brume, un jour de grâce, une
// panne au plus et un seul bâtiment embrumé à la fois, défenses, camarades, toucher, réparation, production arrêtée,
// Anya qui guérit, sur l'horloge du jeu (cycles d'1 h 30). Les heures sont fixées (now) : les nuits sont choisies dans le
// futur, que l'horloge réelle n'atteint pas
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const db = require('../src/config/db');
const nights = require('../src/services/nights');
const anya = require('../src/services/anya');
const clock = require('../src/services/gameClock');
const worldNights = require('../src/services/world/nights');
const { stockOf } = require('../src/services/world/reads');

let server;
test.before(async () => { server = await startServer(); });
test.after(async () => { server?.kill(); await db.pool.end(); });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const CYCLE = clock.CYCLE_MS;
const iso = ms => new Date(ms).toISOString();
const settle = (userId, now) => db.transaction(async conn => worldNights.settleNights(userId, conn, await stockOf(userId, conn, true), now));
const view = (userId, now) => worldNights.nightsView(userId, db, now);
const blightsOf = async userId => (await sql('SELECT blights FROM world_nights WHERE user_id = $1', [userId]))[0].blights;
// Le bilan d'une nuit (ce que Brume dit au matin) : combien de chaque sort
const countsOf = ({ fates }) => Object.values(fates).reduce((out, f) => ({ ...out, [f.end]: out[f.end] + 1 }), { luciole: 0, barre: 0, dort: 0, coq: 0, camarade: 0, touche: 0, arrive: 0, revenu: 0 });

// Une île : Brumelune et la Source, le Puits bâti ; sans défense posée ; ses habitants tristes, sans repas depuis un mois
// (aucun camarade content : un habitant sans ligne de besoins arrive comblé, donc content). Le Puits est posé loin du
// Feu (un quartier à part) : c'est ainsi que les nuits se testent, quelle que soit la disposition du campement.
const PLACES = { foyer: { x: 95, y: 86 }, puits: { x: 87, y: 84 } };
const ISLAND = { owned: new Set(['coeur', 'source']), sites: [{ id: 'foyer', level: 1 }, { id: 'puits', level: 1 }], acts: 0, places: PLACES };
// (la même météo que le serveur : sous la pluie, le feu de camp porte moins loin ; services/weather.js)
const FIRE = nights.defenseOf([], { foyer: 1 }, undefined, require('../src/services/weather').rainAt);
async function islandPlayer() {
  const player = await newPlayer({ settled: true });
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level, built_at) VALUES ($1, 'puits', 1, NOW() - INTERVAL '30 days')`, [player.userId]);
  // Le Feu et le Puits aux places de PLACES (le Puits loin du Feu) : les nuits se testent sur un bâtiment qu'elles
  // atteignent, et le serveur tire les mêmes nuits que ce test (un joueur neuf est sur l'île à la plage, son Feu ailleurs)
  await sql(`INSERT INTO world_site_places (user_id, site, x, y) VALUES ($1, 'foyer', $2, $3), ($1, 'puits', $4, $5)`,
    [player.userId, PLACES.foyer.x, PLACES.foyer.y, PLACES.puits.x, PLACES.puits.y]);
  await sql(`INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, 'puits', 'manger', NOW() - INTERVAL '30 days'), ($1, 'foyer', 'manger', NOW() - INTERVAL '30 days')`, [player.userId]);
  return player;
}
// Le plan d'une nuit tel que le serveur le tire, les nuits présentées juste avant (startBefore : la n-ième, index ; la
// première, celle des trois Sans-Nom, par défaut ; le Puits bâti, le Noyé peut sortir)
const planAt = (userId, night, index) => nights.planOf(userId, night, { ...ISLAND, first: nights.boundsOf(night).start - MINUTE - index * CYCLE, unlocks: { noye: 0 } });
// La première nuit, dès from, où pick(plan) est vrai (le plan tiré de la graine du joueur)
function nightWhere(userId, from, pick, index = 0) {
  for (let night = nights.nightNear(from), i = 0; i < 90; night += 1, i++) {
    const plan = planAt(userId, night, index);
    if (pick(plan)) return { night, plan, ...nights.boundsOf(night) };
  }
  throw new Error('aucune nuit qui convienne');
}
// Les nuits présentées juste avant celle-ci (le cycle d'avant est encore la grâce)
const startBefore = (userId, start, index = 0) => sql('UPDATE world_nights SET started_at = $2, seen_until = $2 WHERE user_id = $1', [userId, iso(start - CYCLE - MINUTE - index * CYCLE)]);

test('pas de nuit avant que Brume les présente, puis un jour de grâce ; ensuite une panne au plus, le premier arrivé', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  // Sans présentation : rien, même des semaines plus tard
  await settle(id, Date.now() + 30 * DAY);
  assert.deepEqual(await view(id, Date.now()), { started: false });
  // Brume les présente ; une seconde fois, rien ne change
  const started = await api('POST', '/play/world/nights/start', {}, player);
  assert.equal(started.status, 200);
  assert.equal(started.data.world.nights.started, true);
  const { startedAt } = await worldNights.startNights(id);
  assert.equal(started.data.world.nights.first, new Date(startedAt).getTime() + worldNights.GRACE_MS);

  const { night, plan, start, end } = nightWhere(id, Date.now() + 2 * DAY, p => nights.outcomeOf(p, FIRE).panne);
  const { panne } = nights.outcomeOf(plan, FIRE);
  // Présentées trop tard pour cette nuit (la grâce la couvre) : rien au matin
  await sql('UPDATE world_nights SET started_at = $2, seen_until = $2 WHERE user_id = $1', [id, iso(start - 30 * MINUTE)]);
  await settle(id, end + 10 * MINUTE);
  assert.equal((await view(id, end + 10 * MINUTE)).blight, null);
  // Présentées un cycle plus tôt : la nuit vient
  await startBefore(id, start);
  // Le soir, on voit par où ils viendront, et ce qu'ils embrumeraient ; rien n'est encore réglé
  const evening = await view(id, start - HOUR);
  assert.deepEqual(evening.night, { id: night, start, end });
  assert.deepEqual(evening.creatures.map(c => c.id), plan.map(c => c.id));
  assert.deepEqual(evening.panne, panne);
  await settle(id, start + 10 * MINUTE);
  assert.equal((await view(id, start + 10 * MINUTE)).blight, null);
  // Au matin : le premier arrivé a embrumé son bâtiment
  await settle(id, end + 10 * MINUTE);
  const morning = await view(id, end + 10 * MINUTE);
  assert.deepEqual(morning.blight, { site: panne.site, since: panne.at, repair: nights.repairOf(panne.site, 1) });
  // Brume en fait le bilan au matin : le sort de chacun, le bâtiment embrumé
  assert.deepEqual(morning.last, { id: night, counts: countsOf(nights.outcomeOf(plan, FIRE)), kinds: { fantome: 3 }, panne: panne.site });
  // Les nuits suivantes n'en embrument pas un second tant qu'il n'est pas réparé
  await settle(id, end + 6 * DAY);
  assert.equal((await blightsOf(id)).length, 1);
  assert.equal((await view(id, end + 6 * DAY)).panne, null);
});

test('une lumière près du Puits change en lucioles ceux qui y vont : aucune panne', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await worldNights.startNights(id);
  const toWell = p => p.some(c => c.site === 'puits' && nights.fateOf(c, FIRE).end === 'arrive');
  const { start, end } = nightWhere(id, Date.now() + 2 * DAY, toWell);
  await startBefore(id, start);
  // La lanterne au coin de la grande emprise du Puits, à côté de sa petite (2 × 2 cases)
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'lanterne', $2, $3)`, [id, PLACES.puits.x, PLACES.puits.y]);
  const evening = await view(id, start - HOUR);
  assert.ok(evening.creatures.filter(c => c.site === 'puits').every(c => c.end === 'luciole'));
  assert.equal(evening.panne, null);
  await settle(id, end + 10 * MINUTE);
  assert.equal((await view(id, end + 10 * MINUTE)).blight, null);
});

test('un camarade content repousse un égaré par nuit', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await worldNights.startNights(id);
  const helped = p => JSON.stringify(nights.outcomeOf(p, FIRE).panne) !== JSON.stringify(nights.outcomeOf(p, FIRE, new Set(['puits'])).panne);
  const { plan, start, end } = nightWhere(id, Date.now() + 2 * DAY, helped);
  await startBefore(id, start);
  // L'habitant du Puits a mangé (il ne lui manque que ses décorations) : il est content au matin
  await sql(`UPDATE world_needs SET filled_at = $2 WHERE user_id = $1 AND villager = 'puits' AND need = 'manger'`, [id, iso(end)]);
  const expected = nights.outcomeOf(plan, FIRE, new Set(['puits']));
  const evening = await view(id, start - HOUR);
  assert.ok(evening.creatures.some(c => c.end === 'camarade'));
  await settle(id, end + 10 * MINUTE);
  const morning = await view(id, end + 10 * MINUTE);
  assert.deepEqual(morning.blight && { site: morning.blight.site, at: morning.blight.since }, expected.panne);
});

test('d’un toucher, la nuit, on repousse un égaré sur son chemin ; pas le jour, pas deux fois, pas avant qu’il sorte', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await worldNights.startNights(id);
  const { night, plan, start, end } = nightWhere(id, Date.now() + 2 * DAY, p => nights.outcomeOf(p, FIRE).panne);
  await startBefore(id, start);
  // Celui qui embrumerait son bâtiment
  const { panne } = nights.outcomeOf(plan, FIRE);
  const first = plan.find(c => c.site === panne.site && c.arrives === panne.at);
  // Le jour : personne dehors
  assert.equal((await worldNights.repelCreature(id, first.id, start - 2 * HOUR)).status, 409);
  // Pas encore sorti de la brume ; inconnu
  assert.equal((await worldNights.repelCreature(id, first.id, first.at - MINUTE)).status, 409);
  assert.equal((await worldNights.repelCreature(id, `${night}:9`, first.at + MINUTE)).status, 404);
  // Sur son chemin : il boude et repart ; une seconde fois, il est déjà parti
  assert.deepEqual(await worldNights.repelCreature(id, first.id, first.at + MINUTE), { id: first.id, night });
  assert.equal((await worldNights.repelCreature(id, first.id, first.at + 2 * MINUTE)).status, 409);
  const during = await view(id, first.at + MINUTE);
  assert.deepEqual(during.creatures.find(c => c.id === first.id).end, 'touche');
  // Au matin, la nuit se règle sans lui
  const expected = nights.outcomeOf(plan, FIRE, new Set(), new Set([first.id]));
  await settle(id, end + 10 * MINUTE);
  const morning = await view(id, end + 10 * MINUTE);
  assert.deepEqual(morning.blight && { site: morning.blight.site, at: morning.blight.since }, expected.panne);
  // Le bilan du matin compte celui qu'on a repoussé (gardé un jour après la nuit)
  assert.equal(morning.last.counts.touche, 1);
  assert.deepEqual(morning.last.counts, countsOf(expected));
  // La route : un égaré mal écrit est refusé ; un bien écrit, à l'heure réelle, ne trouve personne (jour ou grâce)
  assert.equal((await api('POST', '/play/world/nights/repel', { id: 'x' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/nights/repel', { id: `${night}:0` }, player)).status, 409);
});

test('la troisième nuit, un Esprit : repoussé d’un toucher, il revient par un autre chemin ; sinon, on ne peut toucher son retour', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await worldNights.startNights(id);
  // (la troisième nuit écrite : un Sans-Nom, un Dormeur, un Esprit qui marche au moins une case)
  const walking = p => p.some(c => c.kind === 'esprit' && !c.back && nights.fateOf(c, FIRE).step > 0);
  const { night, plan, start, end } = nightWhere(id, Date.now() + 2 * DAY, walking, 2);
  await startBefore(id, start, 2);
  assert.deepEqual(plan.filter(c => !c.back).map(c => c.kind), ['fantome', 'zombie', 'esprit']);
  const spirit = plan.find(c => c.kind === 'esprit' && !c.back);
  const back = plan.find(c => c.back === spirit.id);
  // Pas encore repoussé (luciole ou arrivée) : son retour n'est pas dehors, ni à toucher
  const evening = await view(id, start - HOUR);
  assert.ok(evening.creatures.every(c => c.kind && c.pace));
  assert.ok(!evening.creatures.some(c => c.id === back.id) || ['barre', 'coq', 'camarade'].includes(evening.creatures.find(c => c.id === spirit.id).end));
  if (!evening.creatures.some(c => c.id === back.id)) assert.equal((await worldNights.repelCreature(id, back.id, back.at + MINUTE)).status, 409);
  // Un toucher : il boude, puis revient
  assert.deepEqual(await worldNights.repelCreature(id, spirit.id, spirit.at + MINUTE), { id: spirit.id, night });
  const later = await view(id, back.at + MINUTE);
  assert.equal(later.creatures.find(c => c.id === back.id).back, spirit.id);
  // Au matin : trois égarés sortis (le retour ne compte pas pour un de plus), un Esprit revenu
  await settle(id, end + 10 * MINUTE);
  const morning = await view(id, end + 10 * MINUTE);
  assert.deepEqual(morning.last.kinds, { fantome: 1, zombie: 1, esprit: 1 });
  assert.equal(morning.last.counts.revenu, 1);
});

test('un bâtiment embrumé ne produit plus ; la réparation (selon son palier) le relance', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await sql(`UPDATE world_buildings SET level = 2 WHERE user_id = $1 AND site = 'puits'`, [id]);
  assert.equal((await api('GET', '/play/world', null, player)).status, 200);
  // Récolté il y a 5 h ; embrumé depuis 4 h
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '5 hours', stone = 4 WHERE user_id = $1`, [id]);
  await sql(`INSERT INTO world_nights (user_id, started_at, seen_until, blights) VALUES ($1, NOW() - INTERVAL '3 days', NOW(), $2)`,
    [id, JSON.stringify([{ site: 'puits', since: iso(Date.now() - 4 * HOUR), until: null }])]);
  const before = (await api('GET', '/play/world', null, player)).data;
  const well = before.sites.find(s => s.id === 'puits');
  assert.equal(well.perHour.amount, 0);
  assert.deepEqual(before.nights.blight.repair, { resource: 'stone', amount: 5 });
  // Une heure produite (avant la panne), pas cinq
  const oneHour = 3 * 2 * (1 + well.moodBonus / 100);
  assert.ok(Math.abs(well.pending.water - oneHour) <= 1, `${well.pending.water} ≈ ${oneHour}`);

  const repair = body => api('POST', '/play/world/repair', body, player);
  assert.equal((await repair({ site: 'Puits!' })).status, 400);
  assert.equal((await repair({ site: 'chateau' })).status, 404);
  assert.equal((await repair({ site: 'carriere' })).status, 409);
  assert.deepEqual([(await repair({ site: 'puits' })).status, (await repair({ site: 'puits' })).data.message], [400, 'Il te faut 5 pierres pour réparer.']);
  await sql('UPDATE world_stock SET stone = 5 WHERE user_id = $1', [id]);
  const done = await repair({ site: 'puits' });
  assert.equal(done.status, 200);
  assert.deepEqual(done.data.cost, { resource: 'stone', amount: 5 });
  assert.equal(done.data.world.stock.stone, 0);
  assert.equal(done.data.world.nights.blight, null);
  assert.ok(done.data.world.sites.find(s => s.id === 'puits').perHour.amount > 0);
  assert.equal((await repair({ site: 'puits' })).status, 409);
  // La réparation encaisse d'abord ce qui attendait, la panne comprise (de sa venue à la réparation) : une heure
  // produite, pas cinq ; la récolte suivante n'a rien de plus, et la panne, récoltée, s'efface
  const got = done.data.world.stock.water - before.stock.water;
  assert.ok(Math.abs(got - oneHour) <= 1, `${got} ≈ ${oneHour}`);
  const collected = await api('POST', '/play/world/collect', {}, player);
  assert.equal(collected.data.stock.water, 0);
  await api('GET', '/play/world', null, player);
  assert.deepEqual(await blightsOf(id), []);
});

test('Anya, le jour de son passage, guérit le bâtiment embrumé', async () => {
  const player = await islandPlayer();
  const id = player.userId;
  await sql(`INSERT INTO world_zones (user_id, zone) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [id, anya.CORE]);
  const since = Date.now() + 2 * DAY;
  // Aucune nuit à régler (présentées plus tard) : seulement son passage
  await sql(`INSERT INTO world_nights (user_id, started_at, seen_until, blights) VALUES ($1, $2, $3, $4)`,
    [id, iso(since + 30 * DAY), iso(since), JSON.stringify([{ site: 'puits', since: iso(since), until: null }])]);
  const passage = [...Array(10).keys()].map(k => nights.dayOf(since + k * DAY))
    .flatMap(day => (anya.slotOn(id, day) ? nights.anyaTimesOn(day, anya.slotOn(id, day)) : []))
    .find(at => at > since);
  // Pas encore révélée : elle n'erre pas
  await settle(id, since + 9 * DAY);
  assert.equal((await view(id, since + 9 * DAY)).blight.site, 'puits');
  // Révélée : son passage d'après la panne la guérit
  await sql('UPDATE world_nights SET seen_until = $2 WHERE user_id = $1', [id, iso(since)]);
  await sql(`INSERT INTO world_friends (user_id, villager) VALUES ($1, $2)`, [id, anya.TARGET]);
  await settle(id, passage - MINUTE);
  assert.equal((await view(id, passage - MINUTE)).blight.site, 'puits');
  await settle(id, passage + MINUTE);
  assert.equal((await view(id, passage + MINUTE)).blight, null);
  assert.deepEqual(await blightsOf(id), [{ site: 'puits', since: iso(since), until: iso(passage), by: 'anya' }]);
});
