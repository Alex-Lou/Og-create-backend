// Serveur de jeu : les recettes ne sortent jamais, seul un mélange réussi enrichit un carnet
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, coinsOf, randomPassword, recipeBook } = require('./helpers');
const { combine } = require('../src/services/recipeBook');
const path = require('node:path');
const REGIONS = require(path.join(__dirname, '../src/public/data/regionChallenges.json')).regions;

const BASE = ['Eau', 'Feu', 'Terre', 'Air'];

let server;
let recipe; // une recette faite des seuls éléments de base
let secret; // un élément qu'un nouveau joueur ne connaît pas
test.before(async () => {
  server = await startServer();
  const rules = await sql(`SELECT r.key, r.value FROM game_data g, jsonb_each_text(g.rules->'rules') r WHERE g.active`);
  const base = rules.find(r => r.key.split('+').every(p => BASE.includes(p)));
  recipe = { ingredients: base.key.split('+'), result: base.value };
  secret = rules.find(r => !r.key.split('+').every(p => BASE.includes(p)) && r.value !== base.value).value;
});
test.after(() => server?.kill());

const guest = async () => {
  const player = { cookies: {} };
  assert.equal((await api('POST', '/play/guest', {}, player)).status, 200);
  return player;
};

test('un invité reçoit un carnet, sans recette ni nom d’élément inconnu', async () => {
  const nobody = { cookies: {} };
  const none = await api('GET', '/play/state', null, nobody);
  assert.equal(none.status, 401);
  assert.equal(none.data.code, 'NO_PLAYER');

  const player = await guest();
  assert.ok(player.cookies.oc_guest);
  const state = await api('GET', '/play/state', null, player);
  assert.equal(state.status, 200);
  assert.deepEqual(state.data.elements.sort(), [...BASE].sort());
  assert.ok(Object.values(state.data.families).every(n => Number.isInteger(n)));
  const text = JSON.stringify(state.data);
  assert.ok(!text.includes(secret), 'un élément inconnu a fuité');
  assert.ok(!text.includes('+'), 'une recette a fuité');
});

test('les anciennes routes de contenu ne livrent plus les recettes', async () => {
  for (const route of ['/game-data/materiaux_elementaires', '/game-data/humains_craft_rules', '/game-data/load-game-data', '/game-data/elements']) {
    const response = await api('GET', route);
    assert.ok(!JSON.stringify(response.data).includes(`"${recipe.ingredients.join('+')}"`), route);
  }
  assert.equal((await api('POST', '/game-data/combine', { elements: recipe.ingredients })).status, 404);
  assert.equal((await api('GET', '/game-data/timer-questions')).status, 200);
  assert.equal((await api('GET', '/game-data/timer_questions')).status, 200);
});

test('un mélange n’accepte que des ingrédients du carnet, et seul le serveur l’enrichit', async () => {
  const player = await guest();
  const cheat = await api('POST', '/play/combine', { mode: 'infinite', ingredients: [secret, 'Eau'] }, player);
  assert.equal(cheat.status, 403);

  const first = await api('POST', '/play/combine', { mode: 'infinite', ingredients: recipe.ingredients }, player);
  assert.equal(first.status, 200);
  assert.equal(first.data.result, recipe.result);
  assert.equal(first.data.isNew, true);
  assert.ok(first.data.emoji && first.data.family);
  assert.ok(first.data.unexplored);
  const again = await api('POST', '/play/combine', { mode: 'infinite', ingredients: [...recipe.ingredients].reverse() }, player);
  assert.equal(again.data.isNew, false);

  const miss = await api('POST', '/play/combine', { mode: 'infinite', ingredients: ['Eau', 'Eau', 'Eau', 'Eau'] }, player);
  assert.equal(miss.status, 200);
  assert.equal((await api('POST', '/play/combine', { mode: 'infinite', ingredients: ['Eau'] }, player)).status, 400);

  const state = await api('GET', '/play/state', null, player);
  assert.ok(state.data.elements.includes(recipe.result));
  assert.equal(state.data.known[recipe.result].emoji, first.data.emoji);
});

test('un compte ne peut plus écrire son carnet par la sauvegarde', async () => {
  const player = await newPlayer();
  await api('POST', '/progress/save', { discoveredElements: [...BASE, secret], gameMode: 'infinite' }, player);
  assert.equal((await api('POST', '/progress/update-discovered-elements', { discoveredElements: [secret] }, player)).status, 404);
  const [row] = await sql('SELECT infinite_elements FROM progress WHERE user_id = $1', [player.userId]);
  assert.ok(!row.infinite_elements.includes(secret));
  const state = await api('GET', '/play/state', null, player);
  assert.equal(state.data.kind, 'user');
  assert.ok(!state.data.elements.includes(secret));
});

test('les découvertes d’un invité rejoignent son nouveau compte', async () => {
  const player = await guest();
  await api('POST', '/play/combine', { mode: 'infinite', ingredients: recipe.ingredients }, player);
  const email = `adopt-${process.pid}-${Date.now()}@exemple.fr`;
  const created = await api('POST', '/auth/register', { email, password: randomPassword() }, player);
  assert.equal(created.status, 201);
  const cleared = created.setCookies.find(line => line.startsWith('oc_guest='));
  assert.ok(/expires=thu, 01 jan 1970/i.test(cleared) && !/max-age=[1-9]/i.test(cleared), cleared);
  const [row] = await sql('SELECT infinite_elements FROM progress WHERE user_id = $1', [created.data.userId]);
  assert.ok(row.infinite_elements.includes(recipe.result));
});

test('la piste de l’Infini se paie au serveur, et demande un compte', async () => {
  assert.equal((await api('POST', '/play/hint', {}, await guest())).status, 402);

  const player = await newPlayer({ coins: 60 });
  const hint = await api('POST', '/play/hint', {}, player);
  assert.equal(hint.status, 200);
  assert.equal(hint.data.coins, 10);
  assert.equal(typeof hint.data.name, 'string');
  assert.equal((await api('POST', '/play/hint', {}, player)).status, 400);
  assert.equal(await coinsOf(player), 10);
  assert.equal((await api('POST', '/coins/spend', { reason: 'piste' }, player)).status, 404);
});

test('l’Épreuve : éléments de la question, deux jokers offerts puis payants', async () => {
  const player = await newPlayer({ coins: 60 });
  const [question] = await sql('SELECT id, initial_elements FROM timer_questions ORDER BY id LIMIT 1');
  const run = await api('POST', '/play/run', { mode: 'timer', questionId: question.id, launch: true }, player);
  assert.equal(run.status, 200);
  assert.equal(run.data.freeJokers, 2);
  for (const name of question.initial_elements.required || []) assert.ok(run.data.elements.includes(name));

  // Un élément du carnet Infini absent de la question ne se mélange pas
  const outside = await api('POST', '/play/combine', { mode: 'timer', ingredients: [secret, 'Eau'] }, player);
  assert.equal(outside.status, 403);

  assert.equal((await api('POST', '/play/joker', { kind: 'time' }, player)).data.freeJokers, 1);
  assert.equal((await api('POST', '/play/joker', { kind: 'time' }, player)).data.freeJokers, 0);
  const paid = await api('POST', '/play/joker', { kind: 'time' }, player);
  assert.equal(paid.data.coins, 10);
  assert.equal((await api('POST', '/play/joker', { kind: 'time' }, player)).status, 400);
  assert.equal(await coinsOf(player), 10);

  // Question suivante sans relance : les jokers offerts ne reviennent pas
  const next = await api('POST', '/play/run', { mode: 'timer', questionId: question.id }, player);
  assert.equal(next.data.freeJokers, 0);
});

test('un joker d’étape montre une fusion faisable avec les éléments en main', async () => {
  const player = await guest();
  const questions = await sql('SELECT id FROM timer_questions ORDER BY id LIMIT 10');
  let step = null;
  for (const { id } of questions) {
    const run = await api('POST', '/play/run', { mode: 'timer', questionId: id, launch: true }, player);
    const reply = await api('POST', '/play/joker', { kind: 'step' }, player);
    if (reply.status === 200) {
      step = { reply: reply.data, elements: run.data.elements };
      break;
    }
    assert.equal(reply.status, 409);
  }
  assert.ok(step, 'aucune question avec une étape');
  assert.ok(step.reply.ingredients.every(p => step.elements.includes(p)));
  assert.equal(step.reply.freeJokers, 1);
});

test('l’Expédition : compte requis, région visitée, éléments de la région seulement', async () => {
  assert.equal((await api('POST', '/play/run', { mode: 'explorer', regionId: 1 }, await guest())).status, 401);
  const player = await newPlayer();
  await api('GET', '/explorer/init', null, player);
  assert.equal((await api('POST', '/play/run', { mode: 'explorer', regionId: 1 }, player)).status, 403);
  await api('POST', '/explorer/visit/1', {}, player);
  const run = await api('POST', '/play/run', { mode: 'explorer', regionId: 1 }, player);
  assert.equal(run.status, 200);
  assert.ok(run.data.elements.length >= 2 && run.data.required.length >= 1);
  assert.equal((await api('POST', '/play/run', { mode: 'explorer', regionId: 999 }, player)).status, 404);
  const outside = await api('POST', '/play/combine', { mode: 'explorer', ingredients: [secret, run.data.elements[0]] }, player);
  assert.equal(outside.status, 403);
});

// Une question qu'une seule fusion des éléments de départ résout, avec la recette qui la résout
async function oneStepQuestion() {
  const rules = await sql(`SELECT r.key, r.value FROM game_data g, jsonb_each_text(g.rules->'rules') r WHERE g.active`);
  const questions = await sql(`SELECT id, level, category, points, valid_answers, initial_elements FROM timer_questions
                               WHERE initial_elements->>'validationMode' = 'any' ORDER BY id`);
  for (const q of questions) {
    const have = new Set([...BASE, ...(q.initial_elements.required || []), ...(q.initial_elements.additional || [])]);
    const rule = rules.find(r => q.valid_answers.includes(r.value) && r.key.split('+').every(p => have.has(p)));
    if (rule) return { ...q, ingredients: rule.key.split('+') };
  }
  throw new Error('aucune question en une fusion');
}

test('les questions de l’Épreuve arrivent sans leurs réponses', async () => {
  const { data } = await api('GET', '/game-data/timer_questions');
  assert.equal(data.allEmojis, undefined);
  const questions = Object.values(data.levels).flatMap(level => Object.values(level.categories).flatMap(c => c.questions));
  assert.ok(questions.length > 0);
  assert.ok(questions.every(q => q.validAnswers === undefined && q.initialElements && q.text));
  // Une question à plusieurs réponses : aucune ne figure dans ce que reçoit le navigateur
  const [multiple] = await sql(`SELECT id, valid_answers FROM timer_questions WHERE initial_elements->>'validationMode' = 'multiple' LIMIT 1`);
  const sent = JSON.stringify(questions.find(q => q.id === multiple.id));
  assert.ok(multiple.valid_answers.every(answer => !sent.includes(answer)), sent);
});

test('l’Épreuve : le serveur juge la réponse et paie une seule fois', async () => {
  const q = await oneStepQuestion();
  const player = await newPlayer();
  await api('POST', '/play/run', { mode: 'timer', questionId: q.id, launch: true }, player);
  const won = await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  assert.equal(won.status, 200);
  assert.equal(won.data.trial.solved, true);
  assert.equal(won.data.trial.coins, q.points);
  // Déjà résolue : rien de plus
  const again = await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  assert.equal(again.data.trial, null);
  // Même question rejouée plus tard : elle compte au score, mais ses points ne sont versés qu’une fois
  await api('POST', '/play/run', { mode: 'timer', questionId: q.id }, player);
  const replay = await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  assert.equal(replay.data.trial.solved, true);
  assert.equal(replay.data.trial.credited, false);
  assert.equal(await coinsOf(player), q.points);
  assert.equal((await api('POST', '/coins/claim/timer-question', { questionId: q.id }, player)).status, 404);
});

test('l’Épreuve : une réponse après la fin du sablier ne compte pas', async () => {
  const q = await oneStepQuestion();
  const player = await newPlayer();
  await api('POST', '/play/run', { mode: 'timer', questionId: q.id, launch: true }, player);
  await sql(`UPDATE play_runs SET deadline = NOW() - INTERVAL '1 minute' WHERE owner = $1 AND mode = 'timer'`, [`u:${player.userId}`]);
  const late = await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  assert.equal(late.data.trial.late, true);
  assert.equal(await coinsOf(player), 0);
  // Le joker de temps rallonge aussi le sablier du serveur
  await sql(`UPDATE play_runs SET deadline = NOW() - INTERVAL '10 seconds' WHERE owner = $1 AND mode = 'timer'`, [`u:${player.userId}`]);
  await api('POST', '/play/joker', { kind: 'time' }, player);
  const saved = await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  assert.equal(saved.data.trial.solved, true);
});

test('l’Épreuve : le bonus de record vient du score compté par le serveur', async () => {
  const q = await oneStepQuestion();
  const player = await newPlayer();
  await api('POST', '/play/run', { mode: 'timer', questionId: q.id, launch: true }, player);
  await api('POST', '/play/combine', { mode: 'timer', ingredients: q.ingredients }, player);
  const end = await api('POST', '/play/timer/finish', { score: 999 }, player);
  assert.equal(end.data.score, 1);
  assert.equal(end.data.coins, q.points + 5);
  // Rejouer la fin ne paie rien : la partie est close
  const twice = await api('POST', '/play/timer/finish', {}, player);
  assert.equal(twice.data.score, 0);
  assert.equal(await coinsOf(player), q.points + 5);
  assert.equal((await api('POST', '/coins/claim/timer-record', { level: q.level, score: 9 }, player)).status, 404);
});

test('la carte de l’Expédition ne livre ni les éléments ni les règles de combat', async () => {
  const { data } = await api('GET', '/play/regions');
  assert.equal(data.regions.length, REGIONS.length);
  for (const region of data.regions) {
    for (const key of ['requiredElements', 'availableElements', 'damagePerElement', 'bossCombatRules', 'elementsWithGifs']) {
      assert.equal(region[key], undefined, `${region.id} ${key}`);
    }
  }
  const player = await newPlayer();
  const listed = (await api('GET', '/explorer/regions', null, player)).data;
  assert.ok(listed.length > 0 && listed.every(r => r.unlocked_elements === undefined));
});

test('l’Expédition : le gardien se bat sur le serveur, sa victoire se mérite', async () => {
  const boss = REGIONS.find(r => r.is_boss && r.maxHealth);
  const player = await newPlayer();
  await api('GET', '/explorer/init', null, player);
  await sql(`INSERT INTO user_regions (user_id, region_id, visited) VALUES ($1, $2, TRUE)
             ON CONFLICT (user_id, region_id) DO UPDATE SET visited = TRUE`, [player.userId, boss.id]);
  const run = await api('POST', '/play/run', { mode: 'explorer', regionId: boss.id }, player);
  assert.deepEqual(run.data.boss, { bossHp: boss.maxHealth, playerHp: boss.maxHealth, maxHealth: boss.maxHealth });

  // Victoire déclarée sans combat : refusée, rien n'est versé
  assert.equal((await api('POST', `/explorer/complete/${boss.id}`, { isBossVictory: true }, player)).status, 403);
  assert.equal((await api('POST', `/explorer/complete/${boss.id}`, {}, player)).status, 403);
  assert.equal(await coinsOf(player), 0);

  // Un mélange raté coûte des points de vie
  const book = await recipeBook();
  const pairs = run.data.elements.flatMap(x => run.data.elements.map(y => [x, y]));
  const miss = pairs.find(p => !combine(book, p));
  const hit = pairs.find(p => combine(book, p));
  const missed = await api('POST', '/play/combine', { mode: 'explorer', ingredients: miss }, player);
  assert.equal(missed.data.fight.playerHp, boss.maxHealth - 10);

  // Le gardien tombe sous les coups (préparé presque vaincu), la victoire est payée une fois
  await sql(`UPDATE play_runs SET boss_hp = 1 WHERE owner = $1 AND mode = 'explorer'`, [`u:${player.userId}`]);
  const blow = await api('POST', '/play/combine', { mode: 'explorer', ingredients: hit }, player);
  assert.equal(blow.data.fight.defeated, true);
  assert.equal((await api('POST', '/play/combine', { mode: 'explorer', ingredients: hit }, player)).status, 409);
  const won = await api('POST', `/explorer/complete/${boss.id}`, { isBossVictory: true }, player);
  assert.equal(won.status, 200);
  const [{ coin_reward: reward }] = await sql('SELECT coin_reward FROM explorer_regions WHERE id = $1', [boss.id]);
  assert.equal(await coinsOf(player), reward);
});

test('l’Expédition : un joueur vaincu ne peut plus frapper ni réclamer', async () => {
  const boss = REGIONS.find(r => r.is_boss && r.maxHealth);
  const player = await newPlayer();
  await api('GET', '/explorer/init', null, player);
  await sql(`INSERT INTO user_regions (user_id, region_id, visited) VALUES ($1, $2, TRUE)
             ON CONFLICT (user_id, region_id) DO UPDATE SET visited = TRUE`, [player.userId, boss.id]);
  const run = await api('POST', '/play/run', { mode: 'explorer', regionId: boss.id }, player);
  const book = await recipeBook();
  const miss = run.data.elements.flatMap(x => run.data.elements.map(y => [x, y])).find(p => !combine(book, p));
  await sql(`UPDATE play_runs SET player_hp = 5 WHERE owner = $1 AND mode = 'explorer'`, [`u:${player.userId}`]);
  const lost = await api('POST', '/play/combine', { mode: 'explorer', ingredients: miss }, player);
  assert.equal(lost.data.fight.lost, true);
  assert.equal((await api('POST', '/play/combine', { mode: 'explorer', ingredients: miss }, player)).status, 409);
  assert.equal((await api('POST', `/explorer/complete/${boss.id}`, { isBossVictory: true }, player)).status, 403);
});
