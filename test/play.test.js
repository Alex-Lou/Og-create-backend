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

test('les routes de l’ancien Registre (piste, origines) n’existent plus', async () => {
  const player = await newPlayer({ coins: 60 });
  assert.equal((await api('POST', '/play/hint', {}, player)).status, 404);
  assert.equal((await api('GET', '/play/origins?name=Eau', null, player)).status, 404);
  assert.equal(await coinsOf(player), 60);
  assert.equal((await api('POST', '/coins/spend', { reason: 'piste' }, player)).status, 404);
});

test('la progression de l’Épreuve fusionne ; les records envoyés par le navigateur sont ignorés', async () => {
  const player = await newPlayer();
  await api('POST', '/timer/update-timer-progress', { timerProgress: { bestScores: { Facile: 4 }, unlockedCategories: { Facile: ['A'] } } }, player);
  await api('POST', '/progress/save', { timerProgress: { bestScores: { Facile: 2, Moyen: 1 }, unlockedCategories: { Facile: ['B'] } } }, player);
  const loaded = await api('GET', '/timer/load-progress', null, player);
  assert.deepEqual(loaded.data.bestScores, { Facile: 0, Moyen: 0, Difficile: 0 });
  assert.deepEqual(loaded.data.unlockedCategories.Facile, ['A', 'B']);
  // Un ancien record gonflé resté en base n'est plus lu
  await sql(`UPDATE progress SET timer_progress = timer_progress || '{"bestScores":{"Facile":80}}' WHERE user_id = $1`, [player.userId]);
  const progress = await api('GET', '/progress/load', null, player);
  assert.equal(progress.data.coins, 0);
  assert.deepEqual(progress.data.timerProgress.bestScores, { Facile: 0, Moyen: 0, Difficile: 0 });
  assert.equal((await api('POST', '/timer/update-timer-progress', {}, player)).status, 400);
  assert.equal((await api('POST', '/timer/save-elements', { elements: ['Eau'] }, player)).status, 404);
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
  // Le record affiché est celui compté par le serveur
  const records = await api('GET', '/timer/load-progress', null, player);
  assert.equal(records.data.bestScores[q.level], 1);
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

// Joueur avec cinq découvertes faites des seuls éléments premiers : le chapitre III s'ouvre
async function withStars(player) {
  const rules = await sql(`SELECT r.key, r.value FROM game_data g, jsonb_each_text(g.rules->'rules') r WHERE g.active`);
  const easy = [...new Set(rules.filter(r => r.key.split('+').every(p => BASE.includes(p.trim()))).map(r => r.value.trim()))].slice(0, 5);
  const owned = [...BASE, ...easy];
  await sql('UPDATE progress SET infinite_elements = $1 WHERE user_id = $2', [JSON.stringify(owned), player.userId]);
  return { rules, owned };
}
// Recette possédée d'une page, retrouvée côté test par l'identifiant de page
function recipeOfPage(rules, owned, id) {
  const { pageId } = require('../src/services/bookPages');
  const rule = rules.find(r => pageId(r.value.trim()) === id && r.key.split('+').every(p => owned.includes(p.trim())));
  return rule && { result: rule.value.trim(), ingredients: rule.key.split('+').map(p => p.trim()) };
}
const chapterPages = async (who, id) => (await api('GET', '/play/book', null, who)).data.chapters.find(c => c.id === id).pages.filter(p => p.status === 'reach');

test('l’Encre du Livre : payée d’emblée, compte requis, page à portée seulement', async () => {
  const visitor = await guest();
  const [visitorPage] = await chapterPages(visitor, 'I');
  assert.equal((await api('POST', '/play/ink', { page: visitorPage.id }, visitor)).status, 402);

  // Chapitre I : aucun ingrédient n'est donné sur la page, l'encre n'est pas offerte d'emblée
  const poor = await newPlayer({ coins: 10 });
  const [easy] = await chapterPages(poor, 'I');
  assert.equal(easy.given, undefined);
  assert.equal(easy.freeInkAfter, 3);
  assert.equal((await api('POST', '/play/ink', { page: easy.id }, poor)).status, 400);
  assert.equal(await coinsOf(poor), 10);

  // Chapitre III : l'encre se paie, et refuse un joueur sans écus
  const broke = await newPlayer({ coins: 10 });
  await withStars(broke);
  assert.equal((await api('POST', '/play/ink', { page: (await chapterPages(broke, 'III'))[0].id }, broke)).status, 400);
  const player = await newPlayer({ coins: 120 });
  await withStars(player);
  assert.equal((await api('POST', '/play/ink', { page: 'nimporte-quoi' }, player)).status, 404);
  const [page] = await chapterPages(player, 'III');
  const ink = await api('POST', '/play/ink', { page: page.id }, player);
  assert.equal(ink.status, 200);
  assert.equal(ink.data.free, false);
  assert.equal(ink.data.coins, 70);
  assert.equal(await coinsOf(player), 70);
});

test('le Livre : pages ouvertes bornées, plateau d’éléments possédés, aides selon le chapitre', async () => {
  const { DIFFICULTY } = require('../src/services/bookPages');
  const player = await newPlayer();
  const { owned } = await withStars(player);
  const book = (await api('GET', '/play/book', null, player)).data;
  for (const chapter of book.chapters.filter(c => c.open)) {
    const reach = chapter.pages.filter(p => p.status === 'reach');
    assert.ok(reach.length <= DIFFICULTY[chapter.id].open, chapter.id);
    for (const page of reach) {
      assert.ok(page.tray.length > 0 && page.tray.every(name => owned.includes(name)), chapter.id);
      assert.equal(page.given, undefined);
      assert.equal(page.freeInkAfter, DIFFICULTY[chapter.id].freeInkAfter);
      // Chaque page a son énigme (db/content/riddles.py)
      assert.ok(page.riddle && page.riddle.length <= 80, chapter.id);
      assert.equal(Boolean(page.first), DIFFICULTY[chapter.id].letter);
    }
  }
});

test('le Livre : un mélange visé dit combien d’ingrédients sont justes, puis l’encre devient offerte', async () => {
  const player = await newPlayer();
  const { rules, owned } = await withStars(player);
  const target = (await chapterPages(player, 'III')).find(p => recipeOfPage(rules, owned, p.id));
  const recipe = recipeOfPage(rules, owned, target.id);
  const page = target.id;
  assert.ok(target.first);
  // Le plateau porte les ingrédients de la recette montrée (une des recettes de l'élément)
  const recipesOf = rules.filter(r => r.value.trim() === recipe.result).map(r => r.key.split('+').map(p => p.trim()));
  assert.ok(recipesOf.some(parts => parts.every(name => target.tray.includes(name))));
  assert.equal(target.misses, 0);
  assert.equal(target.freeInkAfter, 3);
  const makes = new Set(rules.filter(r => r.value.trim() === recipe.result).map(r => r.key.split('+').map(p => p.trim()).sort().join('+')));
  const pairs = [];
  BASE.forEach((a, i) => BASE.slice(i).forEach(b => pairs.push([a, b])));
  const wrong = pairs.filter(pair => !makes.has([...pair].sort().join('+')));

  const aimAt = (who, ingredients, at = page) => api('POST', '/play/combine', { mode: 'infinite', ingredients, page: at }, who);
  const first = await aimAt(player, wrong[0]);
  assert.equal(first.status, 200);
  assert.ok(first.data.aim.right < first.data.aim.of);
  assert.equal(first.data.aim.misses, 1);
  assert.equal(first.data.aim.need, 3);
  // Le même mélange ne compte qu'une fois
  assert.equal((await aimAt(player, wrong[0])).data.aim.misses, 1);
  await aimAt(player, wrong[1]);
  const third = await aimAt(player, wrong[2]);
  assert.equal(third.data.aim.misses, 3);
  assert.equal(third.data.aim.freeInk, true);

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

  // Un invité : verdict sans compteur ni encre offerte
  const visitor = await guest();
  const [easy] = await chapterPages(visitor, 'I');
  const easyRecipe = recipeOfPage(rules, BASE, easy.id);
  const easyMakes = new Set(rules.filter(r => r.value.trim() === easyRecipe.result).map(r => r.key.split('+').map(p => p.trim()).sort().join('+')));
  const miss = pairs.find(pair => !easyMakes.has([...pair].sort().join('+')));
  const seen = await aimAt(visitor, miss, easy.id);
  assert.equal(seen.data.aim.misses, null);
  assert.equal(seen.data.aim.need, null);
  assert.equal(seen.data.aim.freeInk, false);
  const elsewhere = await aimAt(visitor, miss, 'nimporte-quoi');
  assert.equal(elsewhere.data.aim, undefined);
});

test('le Monde : compte requis, décorations achetées dans un quartier possédé, déplacées gratuitement', async () => {
  const visitor = await guest();
  assert.equal((await api('GET', '/play/world', null, visitor)).status, 402);

  const player = await newPlayer();
  const start = await api('GET', '/play/world', null, player);
  assert.equal(start.status, 200);
  assert.equal(start.data.size, 48);
  assert.deepEqual(start.data.tiles, []);
  assert.equal(start.data.map.grid.length, 48);
  assert.deepEqual([start.data.map.height.length, start.data.map.ground.length, start.data.map.region.length], [48, 48, 48]);
  assert.deepEqual(start.data.map.zones.filter(z => z.owned).map(z => z.id), ['coeur']);
  assert.equal(start.data.decoPrices.I, 10);

  assert.equal((await api('POST', '/play/world/place', { element: 'Dragon', x: 31, y: 35 }, player)).status, 403);
  // Mer, place d'un chantier (le Foyer, sur la Grève), chemin, arbre, quartier non acheté
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 0, y: 0 }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 30, y: 32 }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 27, y: 31 }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 30, y: 35 }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 24, y: 33 }, player)).status, 403);
  // Une décoration s'achète : sans écus, refusée ; avec, payée une fois
  assert.equal((await api('POST', '/play/world/place', { element: 'Eau', x: 31, y: 35 }, player)).status, 400);
  await sql('UPDATE progress SET coins = 25 WHERE user_id = $1', [player.userId]);
  const placed = await api('POST', '/play/world/place', { element: 'Eau', x: 31, y: 35 }, player);
  assert.equal(placed.status, 200);
  assert.deepEqual(placed.data.tiles.map(t => [t.element, t.x, t.y]), [['Eau', 31, 35]]);
  assert.ok(placed.data.tiles[0].emoji);
  assert.equal(placed.data.coins, 15);
  assert.equal(await coinsOf(player), 15);
  // Case occupée par un autre élément : refusé ; même élément ailleurs : déplacé, sans payer
  assert.equal((await api('POST', '/play/world/place', { element: 'Feu', x: 31, y: 35 }, player)).status, 409);
  const moved = await api('POST', '/play/world/place', { element: 'Eau', x: 32, y: 35 }, player);
  assert.deepEqual(moved.data.tiles.map(t => [t.element, t.x, t.y]), [['Eau', 32, 35]]);
  assert.equal(await coinsOf(player), 15);
  // Les décorations ne produisent rien
  await sql(`UPDATE world_tiles SET placed_at = NOW() - INTERVAL '3 hours' WHERE user_id = $1`, [player.userId]);
  assert.equal((await api('GET', '/play/world', null, player)).data.pending, 0);
  const removed = await api('POST', '/play/world/remove', { x: 32, y: 35 }, player);
  assert.deepEqual(removed.data.tiles, []);
});

test('le Monde : un quartier s’achète avec des écus et un chapitre ouvert, une seule fois', async () => {
  const player = await newPlayer();
  const zone = id => api('POST', '/play/world/zone', { zone: id }, player);
  assert.equal((await zone('coeur')).status, 404);
  assert.equal((await zone('nimporte')).status, 404);
  // La Côte est demande le chapitre III : pas encore ouvert
  assert.equal((await zone('est')).status, 403);
  assert.equal((await zone('colline')).status, 400);
  await sql('UPDATE progress SET coins = 300 WHERE user_id = $1', [player.userId]);
  const [a, b] = await Promise.all([zone('colline'), zone('colline')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  assert.equal(ok.data.bought, 'La Colline');
  assert.equal(ok.data.coins, 50);
  assert.ok(ok.data.world.map.zones.find(z => z.id === 'colline').owned);
  assert.equal(ok.data.world.sites.find(s => s.id === 'carriere').locked, false);
  assert.equal(await coinsOf(player), 50);
});

test('le Monde : les bâtiments produisent ressources et écus, encaissés une seule fois', async () => {
  const player = await newPlayer({ coins: 0 });
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'colline')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level, built_at) VALUES ($1, 'carriere', 1, NOW() - INTERVAL '3 hours')`, [player.userId]);
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '5 hours' WHERE user_id = $1`, [player.userId]);
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.equal(view.pending, 6);
  assert.equal(view.pendingStock.stone, 9);
  assert.deepEqual(view.sites.find(s => s.id === 'carriere').pending, { coins: 6, stone: 9 });
  const [first, second] = await Promise.all([
    api('POST', '/play/world/collect', null, player),
    api('POST', '/play/world/collect', null, player)
  ]);
  assert.equal(first.data.gained + second.data.gained, 6);
  assert.equal(await coinsOf(player), 6);
  const after = (await api('GET', '/play/world', null, player)).data;
  assert.equal(after.pending, 0);
  assert.equal(after.stock.stone, 9);
});

test('le Monde : la boutique d’un atelier vend outils, objets et skins, une seule fois, avec leurs effets', async () => {
  const player = await newPlayer({ coins: 0 });
  const buy = item => api('POST', '/play/world/item', { item }, player);
  const skin = (site, value) => api('POST', '/play/world/skin', { site, skin: value }, player);
  await api('GET', '/play/world', null, player);
  assert.equal((await buy('nimporte')).status, 404);
  // Bâtiment pas encore construit : refusé
  assert.equal((await buy('pioche')).status, 403);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'colline'), ($1, 'est')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'carriere', 1), ($1, 'atelier', 1)`, [player.userId]);
  assert.equal((await buy('pioche')).status, 400);
  await sql('UPDATE progress SET coins = 600 WHERE user_id = $1', [player.userId]);
  const [a, b] = await Promise.all([buy('pioche'), buy('pioche')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  assert.equal(ok.data.coins, 520);
  const carriere = ok.data.world.sites.find(s => s.id === 'carriere');
  assert.equal(carriere.bonus, 20);
  // Rendement affiché dans la fiche : 3 pierres et 2 écus par heure au niveau 1, +20 %
  assert.deepEqual(carriere.perHour, { amount: 3.6, coins: 2.4 });
  assert.equal(ok.data.world.sites.find(s => s.id === 'atelier').perHour, null);
  assert.ok(carriere.shop.find(i => i.id === 'pioche').owned);
  // Niveau 2 requis pour les rails
  assert.equal((await buy('rails')).status, 403);
  // Un skin acheté est porté ; on peut l'ôter ; un skin non possédé ou d'un autre bâtiment est refusé
  const worn = await buy('roche-ocre');
  assert.equal(worn.data.world.sites.find(s => s.id === 'carriere').skin, 'roche-ocre');
  assert.equal((await skin('carriere', '')).data.sites.find(s => s.id === 'carriere').skin, null);
  assert.equal((await skin('carriere', 'roche-granit')).status, 403);
  assert.equal((await skin('carriere', 'voile-rouge')).status, 400);
  assert.equal((await skin('carriere', 'roche-ocre')).data.sites.find(s => s.id === 'carriere').skin, 'roche-ocre');
  // L'établi ajoute un coup à la Récolte (Atelier : +3, établi : +1)
  const bench = await buy('etabli');
  assert.equal(bench.data.world.harvest.maxMoves, 19);
  // Production avec la pioche : +20 %
  await sql(`UPDATE world_buildings SET built_at = NOW() - INTERVAL '5 hours' WHERE user_id = $1`, [player.userId]);
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '3 hours' WHERE user_id = $1`, [player.userId]);
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(view.sites.find(s => s.id === 'carriere').pending, { coins: 7, stone: 10 });
});

test('le Monde : une île de l’ancienne carte passe à la nouvelle sans rien perdre', async () => {
  const player = await newPlayer({ coins: 0 });
  await api('GET', '/play/world', null, player);
  // Île v1 simulée : une décoration en (1, 2) posée il y a 3 h, un Potager bâti, rien encore récolté
  await sql(`UPDATE world_stock SET map_version = 1, collected_at = NULL WHERE user_id = $1`, [player.userId]);
  await sql(`INSERT INTO world_tiles (user_id, x, y, element, placed_at) VALUES ($1, 1, 2, 'Eau', NOW() - INTERVAL '3 hours')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 1)`, [player.userId]);
  const [a, b] = await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  const view = a.data;
  // v1 → v2 (décalée de 3 cases : la Lisière) → v3 (dans la Lisière de la grande île, au plus près de son panneau),
  // quartiers offerts, écus dus par la décoration versés une seule fois
  assert.deepEqual(view.tiles.map(t => [t.element, t.x, t.y]), [['Eau', 13, 34]]);
  assert.deepEqual(b.data.tiles.map(t => [t.x, t.y]), [[13, 34]]);
  const owned = view.map.zones.filter(z => z.owned).map(z => z.id).sort();
  assert.deepEqual(owned, ['coeur', 'jardins', 'lisiere']);
  assert.equal(await coinsOf(player), 3);
  await api('GET', '/play/world', null, player);
  assert.equal(await coinsOf(player), 3);
});

test('le Monde : une île de la carte v2 passe à la grande île, chaque décoration dans son quartier', async () => {
  const player = await newPlayer({ coins: 0 });
  await api('GET', '/play/world', null, player);
  // Île v2 simulée : décorations dans le Cœur, la Lisière, les Jardins et la Crique ; quartiers et bâtiment achetés
  await sql(`UPDATE world_stock SET map_version = 2 WHERE user_id = $1`, [player.userId]);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'lisiere'), ($1, 'jardins'), ($1, 'crique')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 2)`, [player.userId]);
  await sql(`INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, 8, 8, 'Eau'), ($1, 12, 12, 'Feu'), ($1, 4, 5, 'Terre'), ($1, 4, 12, 'Air'), ($1, 14, 14, 'Boue')`, [player.userId]);
  const before = await coinsOf(player);
  const [a, b] = await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  const map = require('../src/services/worldMap');
  for (const view of [a.data, b.data]) {
    assert.equal(view.size, 48);
    // Rien de perdu : cinq décorations, chacune sur une case libre de son ancien quartier
    const zones = view.tiles.map(t => [t.element, map.zoneAt(t.x, t.y)]).sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1]));
    assert.deepEqual(zones, [['Air', 'jardins'], ['Boue', 'crique'], ['Eau', 'coeur'], ['Feu', 'coeur'], ['Terre', 'lisiere']]);
    view.tiles.forEach(t => assert.ok(map.buildable(t.x, t.y) && !map.inFootprint(t.x, t.y, { ponton: 2 }), `${t.x},${t.y}`));
    assert.deepEqual(view.map.zones.filter(z => z.owned).map(z => z.id).sort(), ['coeur', 'crique', 'jardins', 'lisiere']);
    assert.equal(view.sites.find(s => s.id === 'ponton').level, 2);
  }
  // Une seule migration (rien ne bouge à la vue suivante), aucun écu versé ni pris
  const again = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(again.tiles.map(t => [t.x, t.y]), a.data.tiles.map(t => [t.x, t.y]));
  assert.equal(await coinsOf(player), before);
  assert.equal((await sql('SELECT map_version FROM world_stock WHERE user_id = $1', [player.userId]))[0].map_version, 3);
});

// Première chaîne jouable d'un plateau (recherche en profondeur), pour jouer comme un joueur
function firstChain(board) {
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const path = [[x, y]];
      const seen = new Set([y * 6 + x]);
      const extend = () => {
        if (path.length >= 3) return true;
        const [cx, cy] = path[path.length - 1];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx > 5 || ny > 5 || seen.has(ny * 6 + nx) || board[ny][nx] !== board[y][x]) continue;
            seen.add(ny * 6 + nx);
            path.push([nx, ny]);
            if (extend()) return true;
            path.pop();
            seen.delete(ny * 6 + nx);
          }
        }
        return false;
      };
      if (extend()) return path;
    }
  }
  return null;
}
function playRun(run, count) {
  const h = require('../src/services/harvest');
  const game = h.create(run.seed, run.kinds);
  const moves = [];
  for (let i = 0; i < count; i++) {
    const path = firstChain(game.board);
    moves.push(path);
    h.play(game, path);
  }
  return { moves, expected: h.replay(run.seed, run.kinds, moves, run.maxMoves, run.boosts).gains };
}

test('le Monde : la Récolte se joue contre une partie de la réserve, rejouée et payée une seule fois', async () => {
  const visitor = await guest();
  assert.equal((await api('POST', '/play/world/harvest/start', {}, visitor)).status, 402);

  const player = await newPlayer();
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(view.stock, { stone: 0, wood: 0, water: 0, food: 0 });
  assert.equal(view.charges.count, 3);
  assert.equal(view.harvest.maxMoves, 15);

  const runs = [];
  for (let i = 0; i < 3; i++) runs.push((await api('POST', '/play/world/harvest/start', {}, player)).data);
  assert.equal((await api('POST', '/play/world/harvest/start', {}, player)).status, 409);
  assert.ok(Number.isInteger(runs[0].seed) && runs[0].kinds.length === 4);

  // Partie jouée : le gain est celui que le serveur recalcule ; la rendre deux fois ne paie qu'une fois
  const { moves, expected } = playRun(runs[0], 6);
  const [a, b] = await Promise.all([
    api('POST', '/play/world/harvest/finish', { run: runs[0].id, moves }, player),
    api('POST', '/play/world/harvest/finish', { run: runs[0].id, moves }, player)
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 404]);
  const paid = a.status === 200 ? a : b;
  assert.deepEqual(paid.data.gains, expected);
  assert.deepEqual(paid.data.world.stock, expected);
  // Et des écus : 1 par tranche de 10 ressources
  const earned = Math.floor(Object.values(expected).reduce((sum, n) => sum + n, 0) / 10);
  assert.equal(paid.data.coins, earned);
  assert.equal(await coinsOf(player), earned);

  // Coups truqués : partie refusée et perdue
  const cheat = await api('POST', '/play/world/harvest/finish', { run: runs[1].id, moves: [[[0, 0], [0, 1]]] }, player);
  assert.equal(cheat.status, 400);
  assert.equal((await api('POST', '/play/world/harvest/finish', { run: runs[1].id, moves: [] }, player)).status, 404);
  // La partie d'un autre joueur ne se rend pas
  const other = await newPlayer();
  assert.equal((await api('POST', '/play/world/harvest/finish', { run: runs[2].id, moves: [] }, other)).status, 404);

  // Réserve : une partie revient toutes les 30 minutes
  await sql(`UPDATE world_stock SET charges = 0, charges_at = NOW() - INTERVAL '65 minutes' WHERE user_id = $1`, [player.userId]);
  assert.equal((await api('GET', '/play/world', null, player)).data.charges.count, 2);
});

test('le Monde : un chantier demande son quartier, son plan du Livre et ses ressources, puis évolue', async () => {
  const player = await newPlayer();
  const siteOf = (world, id) => world.sites.find(s => s.id === id);
  const start = (await api('GET', '/play/world', null, player)).data;
  assert.equal(siteOf(start, 'foyer').level, 1);
  const carriere = siteOf(start, 'carriere');
  assert.equal(carriere.level, 0);
  assert.equal(carriere.locked, true);
  assert.equal(carriere.next.plan, 'Pierre');
  assert.deepEqual(carriere.levels.map(l => l.name), ['Carrière', 'Mine', 'Galerie', 'Puits de mine', 'Mine de cristal', 'Mine à vapeur', 'Mine des Géants']);
  assert.deepEqual(carriere.levels.map(l => l.chapter), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  assert.deepEqual([carriere.w, carriere.h], [2, 2]);
  assert.equal(carriere.next.planOwned, false);
  assert.deepEqual(carriere.next.cost, { wood: 5 });

  // Quartier pas encore à soi : refusé avant tout
  assert.equal((await api('POST', '/play/world/build', { site: 'carriere' }, player)).status, 403);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'colline'), ($1, 'est')`, [player.userId]);
  assert.equal((await api('POST', '/play/world/build', { site: 'carriere' }, player)).status, 403);
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Pierre", "Four", "Marteau"]'::jsonb WHERE user_id = $1`, [player.userId]);
  assert.equal((await api('POST', '/play/world/build', { site: 'carriere' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/build', { site: 'nimporte' }, player)).status, 404);

  await sql('UPDATE world_stock SET wood = 7 WHERE user_id = $1', [player.userId]);
  const built = await api('POST', '/play/world/build', { site: 'carriere' }, player);
  assert.equal(built.status, 200);
  assert.equal(built.data.built, 'Carrière');
  assert.equal(built.data.world.stock.wood, 2);
  assert.equal(siteOf(built.data.world, 'carriere').level, 1);
  assert.deepEqual(built.data.world.harvest.boosts, { stone: 2 });
  // Niveau 2 : la Mine (plan « Marteau »), pierre ×3
  assert.equal(siteOf(built.data.world, 'carriere').next.name, 'Mine');
  await sql('UPDATE world_stock SET stone = 30, wood = 20 WHERE user_id = $1', [player.userId]);
  const mine = await api('POST', '/play/world/build', { site: 'carriere' }, player);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.built, 'Mine');
  assert.deepEqual(mine.data.world.harvest.boosts, { stone: 3 });
  // Palier III : le chapitre III du Livre doit être ouvert (5 découvertes)
  const galerie = await api('POST', '/play/world/build', { site: 'carriere' }, player);
  assert.equal(galerie.status, 403);
  assert.match(galerie.data.message, /chapitre III/);
  assert.equal(siteOf(mine.data.world, 'carriere').next.chapterOpen, false);

  // L'Atelier ajoute 3 coups ; deux constructions simultanées ne paient pas deux fois
  // (la seconde vise alors la Forge, dont le plan manque)
  await sql('UPDATE world_stock SET stone = 15, wood = 10 WHERE user_id = $1', [player.userId]);
  const both = await Promise.all([
    api('POST', '/play/world/build', { site: 'atelier' }, player),
    api('POST', '/play/world/build', { site: 'atelier' }, player)
  ]);
  assert.deepEqual(both.map(r => r.status).sort(), [200, 403]);
  const after = (await api('GET', '/play/world', null, player)).data;
  assert.equal(after.harvest.maxMoves, 18);
  assert.equal(after.stock.wood, 0);
  // La Cabane demande son plan
  await sql('UPDATE world_stock SET stone = 10, wood = 20 WHERE user_id = $1', [player.userId]);
  assert.equal((await api('POST', '/play/world/build', { site: 'foyer' }, player)).status, 403);
});

test('le Monde : les paliers III à VII demandent chapitre et écus, le palier IV agrandit l’emprise et déplace les décorations', async () => {
  const player = await newPlayer({ coins: 0 });
  const siteOf = (world, id) => world.sites.find(s => s.id === id);
  const build = () => api('POST', '/play/world/build', { site: 'carriere' }, player);
  // Assez de découvertes pour ouvrir les chapitres III et IV (pas le V), avec les plans des paliers III et IV
  const names = (await sql(`SELECT DISTINCT r.value AS name FROM game_data g, jsonb_each_text(g.rules->'rules') r WHERE g.active`)).map(r => r.name.trim());
  const plans = ['Pierre', 'Marteau', 'Rails', 'Poulie', 'Bronze'];
  const owned = [...new Set([...BASE, ...plans, ...names.filter(n => !BASE.includes(n) && !plans.includes(n)).slice(0, 15)])];
  await sql('UPDATE progress SET infinite_elements = $1 WHERE user_id = $2', [JSON.stringify(owned), player.userId]);
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'colline')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'carriere', 2)`, [player.userId]);
  await sql('UPDATE world_stock SET stone = 500, wood = 500, water = 500, food = 500 WHERE user_id = $1', [player.userId]);

  // Palier III : ressources et 150 écus ; sans écus, rien n'est pris
  const before = (await api('GET', '/play/world', null, player)).data;
  assert.equal(siteOf(before, 'carriere').next.coins, 150);
  assert.equal(siteOf(before, 'carriere').next.chapterOpen, true);
  const poor = await build();
  assert.equal(poor.status, 400);
  assert.match(poor.data.message, /150 écus/);
  assert.equal((await api('GET', '/play/world', null, player)).data.stock.wood, 500);
  await sql('UPDATE progress SET coins = 1000 WHERE user_id = $1', [player.userId]);
  const third = await build();
  assert.equal(third.status, 200);
  assert.equal(third.data.built, 'Galerie');
  assert.equal(third.data.coins, 850);
  assert.equal(await coinsOf(player), 850);
  assert.deepEqual(third.data.world.stock, { stone: 470, wood: 455, water: 500, food: 485 });
  assert.deepEqual(third.data.world.harvest.boosts, { stone: 4 });
  const galerie = siteOf(third.data.world, 'carriere');
  assert.deepEqual([galerie.x, galerie.y, galerie.w, galerie.h], [25, 21, 2, 2]);

  // Une décoration posée là où la Mine va s'étendre est déplacée quand l'emprise s'agrandit
  const placed = await api('POST', '/play/world/place', { element: 'Bronze', x: 24, y: 20 }, player);
  assert.equal(placed.status, 200);
  const fourth = await build();
  assert.equal(fourth.status, 200);
  assert.equal(fourth.data.built, 'Puits de mine');
  assert.equal(fourth.data.coins, 850 - 15 - 300);
  const big = siteOf(fourth.data.world, 'carriere');
  assert.deepEqual([big.x, big.y, big.w, big.h], [24, 20, 3, 3]);
  const bronze = fourth.data.world.tiles.find(t => t.element === 'Bronze');
  assert.ok(bronze && !(bronze.x >= 24 && bronze.x < 27 && bronze.y >= 20 && bronze.y < 23), 'décoration sortie de l’emprise');
  assert.equal((await api('POST', '/play/world/place', { element: 'Bronze', x: 24, y: 21 }, player)).status, 400);
  // Palier V : chapitre V encore fermé
  const fifth = await build();
  assert.equal(fifth.status, 403);
  assert.match(fifth.data.message, /chapitre V/);
});

test('le pendu : lettre posée case par case, erreur douce, trois erreurs, rejouer contre des écus, élément inscrit', async () => {
  const player = await newPlayer();
  const { rules, owned } = await withStars(player);
  const page = (await chapterPages(player, 'I')).find(p => recipeOfPage(rules, owned, p.id));
  const { result: name } = recipeOfPage(rules, owned, page.id);
  const fold = c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const chars = [...name].map(fold);
  // Cases à jouer : lettres A-Z, hors première lettre donnée par la page
  const cells = chars.map((c, i) => i).filter(i => /^[A-Z]$/.test(chars[i]) && i !== 0);
  const wrong = [...'ZXWKQJVYBHFG'].filter(c => !chars.includes(c));
  assert.equal(page.hangman.max, 3);
  assert.equal(page.hangman.mask[0], name[0]);
  const put = (position, letter, who = player, at = page.id) => api('POST', '/play/letter', { page: at, position, letter }, who);

  assert.equal((await put(cells[0], '1')).status, 400);
  assert.equal((await put(99, 'E')).status, 400);
  assert.equal((await put(0, chars[0])).status, 409);
  // Absente : une goutte, une seule fois par lettre
  const miss = await put(cells[0], wrong[0]);
  assert.equal(miss.data.verdict, 'miss');
  assert.equal(miss.data.hangman.misses, 1);
  assert.equal((await put(cells[0], wrong[0])).data.hangman.misses, 1);
  // Présente mais ailleurs : aucune goutte (si le mot a au moins deux lettres différentes à jouer)
  const other = cells.find(i => chars[i] !== chars[cells[0]]);
  if (other !== undefined) {
    const elsewhere = await put(cells[0], chars[other]);
    assert.equal(elsewhere.data.verdict, 'elsewhere');
    assert.equal(elsewhere.data.hangman.misses, 1);
    assert.equal(elsewhere.data.hangman.mask[cells[0]], null);
  }
  // Juste : seulement cette case, et l'illustration paraît
  const hit = await put(cells[0], chars[cells[0]]);
  assert.equal(hit.data.verdict, 'hit');
  assert.equal(hit.data.hangman.mask[cells[0]], name[cells[0]]);
  assert.ok(hit.data.hangman.emoji);
  await put(cells[1] ?? cells[0], wrong[1]);
  const lost = await put(cells[1] ?? cells[0], wrong[2]);
  assert.ok(lost.data.hangman.failedUntil);
  assert.equal((await put(cells[1] ?? cells[0], chars[cells[1] ?? cells[0]])).status, 409);

  // Rejouer : compte et écus requis, une seule fois payé
  assert.equal((await api('POST', '/play/letter/retry', { page: page.id }, player)).status, 400);
  await sql('UPDATE progress SET coins = 30 WHERE user_id = $1', [player.userId]);
  const again = await api('POST', '/play/letter/retry', { page: page.id }, player);
  assert.equal(again.status, 200);
  assert.equal(again.data.coins, 10);
  assert.equal(again.data.hangman.misses, 0);
  assert.equal((await api('POST', '/play/letter/retry', { page: page.id }, player)).status, 409);

  // Toutes les cases : l'élément est inscrit au carnet, sa page devient trouvée
  let last;
  for (const i of cells.slice(1)) last = await put(i, chars[i]);
  if (!last) last = hit;
  assert.equal(last.data.inscribed.result, name);
  assert.equal(last.data.inscribed.isNew, true);
  assert.ok(last.data.inscribed.unexplored);
  const [row] = await sql('SELECT infinite_elements FROM progress WHERE user_id = $1', [player.userId]);
  assert.ok(row.infinite_elements.includes(name));
  assert.ok((await api('GET', '/play/book', null, player)).data.chapters[0].pages.some(p => p.status === 'found' && p.name === name));
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM book_letters WHERE owner = $1', [`u:${player.userId}`]))[0].n, 0);

  // Un invité joue aussi, mais ne peut pas payer pour rejouer
  const visitor = await guest();
  const [easy] = await chapterPages(visitor, 'I');
  assert.equal((await put(1, 'E', visitor, easy.id)).status, 200);
  assert.equal((await api('POST', '/play/letter/retry', { page: easy.id }, visitor)).status, 402);
  assert.equal((await put(1, 'E', visitor, 'nimporte-quoi')).status, 404);
});

test('quêtes de Brume : la quête active se réclame une fois, son objectif atteint ; pas une autre', async () => {
  const player = await newPlayer();
  const start = await api('GET', '/play/world', null, player);
  assert.equal(start.status, 200);
  assert.equal(start.data.brume.quest.id, 'deco');
  assert.equal(start.data.brume.quest.done, false);
  assert.equal(start.data.brume.done, 0);
  // Objectif pas encore atteint ; quête qui n'est pas l'active ; identifiant invalide
  assert.equal((await api('POST', '/play/world/quest', { id: 'deco' }, player)).status, 403);
  assert.equal((await api('POST', '/play/world/quest', { id: 'source' }, player)).status, 409);
  assert.equal((await api('POST', '/play/world/quest', { id: 'DROP TABLE' }, player)).status, 400);
  // Une décoration posée : deux réclamations simultanées, une seule récompense
  await sql(`INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, 31, 35, 'Eau')`, [player.userId]);
  const [a, b] = await Promise.all([1, 2].map(() => api('POST', '/play/world/quest', { id: 'deco' }, player)));
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  assert.equal(ok.data.gained, 20);
  assert.equal(ok.data.coins, 20);
  assert.equal(await coinsOf(player), 20);
  assert.equal(ok.data.world.brume.quest.id, 'recolte');
  assert.equal(ok.data.world.brume.done, 1);
  assert.equal((await api('POST', '/play/world/quest', { id: 'deco' }, player)).status, 409);
});

