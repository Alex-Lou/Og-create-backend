// Serveur de jeu : les recettes ne sortent jamais, seul un mélange réussi enrichit un carnet
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, coinsOf, randomPassword } = require('./helpers');

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
  assert.equal(typeof first.data.reachable, 'number');
  const again = await api('POST', '/play/combine', { mode: 'infinite', ingredients: [...recipe.ingredients].reverse() }, player);
  assert.equal(again.data.isNew, false);

  const miss = await api('POST', '/play/combine', { mode: 'infinite', ingredients: ['Eau', 'Eau', 'Eau', 'Eau'] }, player);
  assert.equal(miss.status, 200);
  assert.equal((await api('POST', '/play/combine', { mode: 'infinite', ingredients: ['Eau'] }, player)).status, 400);

  const state = await api('GET', '/play/state', null, player);
  assert.ok(state.data.elements.includes(recipe.result));
  assert.equal(state.data.known[recipe.result].emoji, first.data.emoji);
  assert.equal(state.data.reachable, first.data.reachable);
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

test('l’Expédition a disparu : ni mode de jeu, ni carte, ni routes', async () => {
  const player = await newPlayer();
  assert.equal((await api('POST', '/play/run', { mode: 'explorer', regionId: 1 }, player)).status, 400);
  assert.equal((await api('POST', '/play/combine', { mode: 'explorer', ingredients: ['Eau', 'Feu'] }, player)).status, 400);
  assert.equal((await api('GET', '/play/regions')).status, 404);
  assert.equal((await api('GET', '/explorer/init', null, player)).status, 404);
});

test('le Livre ne livre aucun nom d’élément inconnu', async () => {
  const player = await newPlayer();
  const { status, data } = await api('GET', '/play/book', null, player);
  assert.equal(status, 200);
  assert.equal(data.chapters.length, 7);
  const pages = data.chapters.flatMap(c => c.pages);
  assert.ok(pages.some(p => p.status === 'reach'));
  for (const page of pages.filter(p => p.status === 'reach')) {
    assert.equal(page.name, undefined);
    assert.equal(page.emoji, undefined);
    assert.equal(page.recipe, undefined);
  }
  const owned = pages.filter(p => p.status === 'found').map(p => p.name).sort();
  assert.deepEqual(owned, [...BASE].sort());
});

test('l’Encre du Livre se paie au serveur, demande un compte, et ne vise qu’une page à portée', async () => {
  const visitor = await guest();
  const pageOf = async who => (await api('GET', '/play/book', null, who)).data.chapters.flatMap(c => c.pages).find(p => p.status === 'reach');
  const free = await api('POST', '/play/ink', { page: (await pageOf(visitor)).id }, visitor);
  assert.equal(free.status, 402);

  const poor = await newPlayer({ coins: 10 });
  assert.equal((await api('POST', '/play/ink', { page: (await pageOf(poor)).id }, poor)).status, 400);

  const player = await newPlayer({ coins: 120 });
  assert.equal((await api('POST', '/play/ink', { page: 'nimporte-quoi' }, player)).status, 404);
  const page = await pageOf(player);
  const ink = await api('POST', '/play/ink', { page: page.id }, player);
  assert.equal(ink.status, 200);
  assert.ok(BASE.includes(ink.data.ingredient));
  assert.equal(ink.data.coins, 70);
  assert.equal(await coinsOf(player), 70);
});

test('le Livre : un mélange visé dit combien d’ingrédients sont justes, puis l’encre devient offerte', async () => {
  const { pageId } = require('../src/services/bookPages');
  const rules = await sql(`SELECT r.key, r.value FROM game_data g, jsonb_each_text(g.rules->'rules') r WHERE g.active`);
  const makes = new Set(rules.filter(r => r.value === recipe.result).map(r => r.key.split('+').map(p => p.trim()).sort().join('+')));
  const pairs = [];
  BASE.forEach((a, i) => BASE.slice(i).forEach(b => pairs.push([a, b])));
  const wrong = pairs.filter(pair => !makes.has([...pair].sort().join('+')));
  const page = pageId(recipe.result);

  const player = await newPlayer();
  const before = (await api('GET', '/play/book', null, player)).data;
  const target = before.chapters.flatMap(c => c.pages).find(p => p.id === page);
  assert.equal(target.status, 'reach');
  assert.equal(target.first, [...recipe.result][0]);
  assert.equal(target.groups.length, target.clue.length);
  assert.equal(target.misses, 0);
  assert.equal(before.freeInkAfter, 3);

  const aimAt = (who, ingredients) => api('POST', '/play/combine', { mode: 'infinite', ingredients, page }, who);
  const first = await aimAt(player, wrong[0]);
  assert.equal(first.status, 200);
  assert.equal(first.data.aim.of, recipe.ingredients.length === 2 ? 2 : first.data.aim.of);
  assert.ok(first.data.aim.right < first.data.aim.of);
  assert.equal(first.data.aim.misses, 1);
  // Le même mélange ne compte qu'une fois
  assert.equal((await aimAt(player, wrong[0])).data.aim.misses, 1);
  await aimAt(player, wrong[1]);
  const third = await aimAt(player, wrong[2]);
  assert.equal(third.data.aim.misses, 3);
  assert.equal(third.data.aim.freeInk, true);
  const misses = (await api('GET', '/play/book', null, player)).data.chapters.flatMap(c => c.pages).find(p => p.id === page).misses;
  assert.equal(misses, 3);

  // Encre offerte : sans écus, sans débit
  const ink = await api('POST', '/play/ink', { page }, player);
  assert.equal(ink.status, 200);
  assert.equal(ink.data.free, true);
  assert.equal(await coinsOf(player), 0);

  // La bonne recette inscrit la page : pas de verdict, et les essais s'effacent
  const found = await aimAt(player, recipe.ingredients);
  assert.equal(found.data.result, recipe.result);
  assert.equal(found.data.aim, undefined);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM book_tries WHERE user_id = $1', [player.userId]))[0].n, 0);

  // Un invité a le verdict, sans compteur ; une page hors de portée n'en donne aucun
  const visitor = await guest();
  const seen = await aimAt(visitor, wrong[0]);
  assert.equal(seen.data.aim.misses, null);
  assert.equal(seen.data.aim.freeInk, false);
  const elsewhere = await api('POST', '/play/combine', { mode: 'infinite', ingredients: wrong[0], page: 'nimporte-quoi' }, visitor);
  assert.equal(elsewhere.data.aim, undefined);
});

test('le Monde : compte requis, pose d’éléments possédés, déplacement et retrait', async () => {
  const visitor = await guest();
  assert.equal((await api('GET', '/play/world', null, visitor)).status, 402);

  const player = await newPlayer();
  const start = await api('GET', '/play/world', null, player);
  assert.equal(start.status, 200);
  assert.equal(start.data.size, 6);
  assert.deepEqual(start.data.tiles, []);

  assert.equal((await api('POST', '/play/world/place', { element: 'Dragon', x: 0, y: 0 }, player)).status, 403);
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 6, y: 0 }, player)).status, 400);
  const placed = await api('POST', '/play/world/place', { element: 'Eau', x: 1, y: 2 }, player);
  assert.equal(placed.status, 200);
  assert.deepEqual(placed.data.tiles.map(t => [t.element, t.x, t.y]), [['Eau', 1, 2]]);
  assert.ok(placed.data.tiles[0].emoji);
  // Case occupée par un autre élément : refusé ; même élément ailleurs : déplacé
  assert.equal((await api('POST', '/play/world/place', { element: 'Feu', x: 1, y: 2 }, player)).status, 409);
  const moved = await api('POST', '/play/world/place', { element: 'Eau', x: 4, y: 4 }, player);
  assert.deepEqual(moved.data.tiles.map(t => [t.element, t.x, t.y]), [['Eau', 4, 4]]);
  const removed = await api('POST', '/play/world/remove', { x: 4, y: 4 }, player);
  assert.deepEqual(removed.data.tiles, []);
});

test('le Monde : la récolte paie les écus produits, une seule fois', async () => {
  const player = await newPlayer({ coins: 0 });
  await api('POST', '/play/world/place', { element: 'Eau', x: 0, y: 0 }, player);
  await api('POST', '/play/world/place', { element: 'Feu', x: 1, y: 0 }, player);
  // Posés il y a 3 h (simulé) : 2 objets × 3 h × 1 écu
  await sql(`UPDATE world_tiles SET placed_at = NOW() - INTERVAL '3 hours' WHERE user_id = $1`, [player.userId]);
  const view = await api('GET', '/play/world', null, player);
  assert.equal(view.data.pending, 6);
  const [first, second] = await Promise.all([
    api('POST', '/play/world/collect', null, player),
    api('POST', '/play/world/collect', null, player)
  ]);
  assert.equal(first.data.gained + second.data.gained, 6);
  assert.equal(await coinsOf(player), 6);
  assert.equal((await api('GET', '/play/world', null, player)).data.pending, 0);
});
