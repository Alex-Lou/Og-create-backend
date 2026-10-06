// Les nuits de créatures, avec la base (bible du dépôt front, § 6.15, v6) : présentées par Brume, un jour de grâce, une
// panne au plus et un seul bâtiment embrumé à la fois, défenses, camarades, toucher, réparation, production arrêtée,
// Anya qui guérit. Les heures sont fixées (now) : les nuits sont choisies dans le futur, que l'horloge réelle n'atteint pas
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const db = require('../src/config/db');
const nights = require('../src/services/nights');
const anya = require('../src/services/anya');
const worldNights = require('../src/services/world/nights');
const { stockOf } = require('../src/services/world/reads');

let server;
test.before(async () => { server = await startServer(); });
test.after(async () => { server?.kill(); await db.pool.end(); });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
const settle = (userId, now) => db.transaction(async conn => worldNights.settleNights(userId, conn, await stockOf(userId, conn, true), now));
const view = (userId, now) => worldNights.nightsView(userId, db, now);
const blightsOf = async userId => (await sql('SELECT blights FROM world_nights WHERE user_id = $1', [userId]))[0].blights;

// Une île : la Grève et la Source, le Puits bâti ; sans défense posée ; ses habitants tristes, sans repas depuis un mois
// (aucun camarade content : un habitant sans ligne de besoins arrive comblé, donc content)
const ISLAND = { owned: new Set(['coeur', 'source']), sites: [{ id: 'foyer', level: 1 }, { id: 'puits', level: 1 }], acts: 0 };
const FIRE = nights.defenseOf([], { foyer: 1 });
async function islandPlayer() {
  const player = await newPlayer();
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'source')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level, built_at) VALUES ($1, 'puits', 1, NOW() - INTERVAL '30 days')`, [player.userId]);
  await sql(`INSERT INTO world_needs (user_id, villager, need, filled_at) VALUES ($1, 'puits', 'manger', NOW() - INTERVAL '30 days'), ($1, 'foyer', 'manger', NOW() - INTERVAL '30 days')`, [player.userId]);
  return player;
}
// La première nuit, dès from, où pick(plan) est vrai (le plan tiré de la graine du joueur)
function nightWhere(userId, from, pick) {
  for (let night = nights.nightNear(from), i = 0; i < 90; night = nights.nextDay(night), i++) {
    const plan = nights.planOf(userId, night, ISLAND);
    if (pick(plan)) return { night, plan, ...nights.boundsOf(night) };
  }
  throw new Error('aucune nuit qui convienne');
}
// Les nuits présentées juste avant celle-ci (sa veille est encore la grâce)
const startBefore = (userId, start) => sql('UPDATE world_nights SET started_at = $2, seen_until = $2 WHERE user_id = $1', [userId, iso(start - DAY - MINUTE)]);

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
  await sql('UPDATE world_nights SET started_at = $2, seen_until = $2 WHERE user_id = $1', [id, iso(start - 12 * HOUR)]);
  await settle(id, end + HOUR);
  assert.equal((await view(id, end + HOUR)).blight, null);
  // Présentées la veille : la nuit vient
  await startBefore(id, start);
  // Le soir, on voit par où ils viendront, et ce qu'ils embrumeraient ; rien n'est encore réglé
  const evening = await view(id, start - HOUR);
  assert.deepEqual(evening.night, { id: night, start, end });
  assert.deepEqual(evening.creatures.map(c => c.id), plan.map(c => c.id));
  assert.deepEqual(evening.panne, panne);
  await settle(id, start + HOUR);
  assert.equal((await view(id, start + HOUR)).blight, null);
  // Au matin : le premier arrivé a embrumé son bâtiment
  await settle(id, end + HOUR);
  const morning = await view(id, end + HOUR);
  assert.deepEqual(morning.blight, { site: panne.site, since: panne.at, repair: nights.repairOf(panne.site, 1) });
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
  // La lanterne à côté du Puits (59, 57 : 2 × 2 cases)
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'lanterne', 58, 56)`, [id]);
  const evening = await view(id, start - HOUR);
  assert.ok(evening.creatures.filter(c => c.site === 'puits').every(c => c.end === 'luciole'));
  assert.equal(evening.panne, null);
  await settle(id, end + HOUR);
  assert.equal((await view(id, end + HOUR)).blight, null);
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
  await settle(id, end + HOUR);
  const morning = await view(id, end + HOUR);
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
  await settle(id, end + HOUR);
  const morning = await view(id, end + HOUR);
  assert.deepEqual(morning.blight && { site: morning.blight.site, at: morning.blight.since }, expected.panne);
  // La route : un égaré mal écrit est refusé ; un bien écrit, à l'heure réelle, ne trouve personne (jour ou grâce)
  assert.equal((await api('POST', '/play/world/nights/repel', { id: 'x' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/nights/repel', { id: `${night}:0` }, player)).status, 409);
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
  // La panne compte encore à la récolte (de sa venue à la réparation) ; récoltée, elle s'efface
  const collected = await api('POST', '/play/world/collect', {}, player);
  assert.ok(Math.abs(collected.data.stock.water - oneHour) <= 1, `${collected.data.stock.water} ≈ ${oneHour}`);
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
    .map(day => anya.slotOn(id, day) && nights.parisAt(day, nights.ANYA_HOURS[anya.slotOn(id, day)]))
    .find(at => at && at > since);
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
