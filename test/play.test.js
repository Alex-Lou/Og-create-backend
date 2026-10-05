// Serveur de jeu : les recettes ne sortent jamais, seul un mélange réussi enrichit un carnet
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, coinsOf, randomPassword } = require('./helpers');
const loot = require('../src/services/loot');
const minigames = require('../src/services/minigames');
// Cases du cœur : coordonnées de la grande île (v3) + décalage dans la très grande île (v4)
const { OFFSET } = require('../src/services/worldMap');
const X = x => x + OFFSET.x;
const Y = y => y + OFFSET.y;

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

test('le Monde : compte requis ; les décorations de l’ancienne règle sont remboursées une fois, puis retirées', async () => {
  const visitor = await guest();
  assert.equal((await api('GET', '/play/world', null, visitor)).status, 402);

  const player = await newPlayer({ coins: 0 });
  const start = await api('GET', '/play/world', null, player);
  assert.equal(start.status, 200);
  assert.equal(start.data.size, 96);
  assert.equal(start.data.tiles, undefined);
  assert.equal(start.data.refund, undefined);
  assert.equal(start.data.map.grid.length, 96);
  assert.deepEqual([start.data.map.height.length, start.data.map.ground.length, start.data.map.region.length], [96, 96, 96]);
  assert.deepEqual(start.data.map.zones.filter(z => z.owned).map(z => z.id), ['coeur']);
  // Deux décorations posées avec l'ancienne règle : Eau (chapitre I, 10 écus) et Boue (chapitre II, 15 écus)
  await sql(`INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, 31, 35, 'Eau'), ($1, 32, 35, 'Boue')`, [player.userId]);
  const both = await Promise.all([1, 2].map(() => api('GET', '/play/world', null, player)));
  assert.deepEqual(both.map(r => r.data.refund).filter(Boolean), [{ count: 2, coins: 25, balance: 25 }]);
  assert.equal(await coinsOf(player), 25);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_tiles WHERE user_id = $1', [player.userId]))[0].n, 0);
  assert.equal((await api('GET', '/play/world', null, player)).data.refund, undefined);
  assert.equal(await coinsOf(player), 25);
  // L'ancienne pose n'existe plus
  assert.notEqual((await api('POST', '/play/world/place', { element: 'Eau', x: 31, y: 35 }, player)).status, 200);
});

// Résout un assemblage comme un joueur (recherche exhaustive) : [{ piece, rot, x, y }]
function solveCraft(run) {
  const crafts = require('../src/services/crafts');
  const goal = crafts.cellsOf(run.shape).map(([x, y]) => `${x},${y}`);
  const inside = new Set(goal);
  const filled = new Set();
  const used = run.pieces.map(() => false);
  const layout = [];
  const fill = () => {
    const next = goal.find(k => !filled.has(k));
    if (!next) return true;
    const [fx, fy] = next.split(',').map(Number);
    for (let i = 0; i < run.pieces.length; i++) {
      if (used[i]) continue;
      for (let rot = 0; rot < 4; rot++) {
        const cells = crafts.turn(run.pieces[i], rot);
        const x = fx - cells[0][0];
        const y = fy - cells[0][1];
        const keys = cells.map(([cx, cy]) => `${cx + x},${cy + y}`);
        if (!keys.every(k => inside.has(k) && !filled.has(k))) continue;
        keys.forEach(k => filled.add(k));
        used[i] = true;
        layout.push({ piece: i, rot, x, y });
        if (fill()) return true;
        layout.pop();
        used[i] = false;
        keys.forEach(k => filled.delete(k));
      }
    }
    return false;
  };
  return fill() ? layout : null;
}

test('créations d’île : assembler (pièces vérifiées), payer à la réussite, poser selon la règle, déplacer, ranger', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const start = craft => api('POST', '/play/world/craft/start', { craft }, player);
  const finish = (run, layout) => api('POST', '/play/world/craft/finish', { run, layout }, player);
  const place = (craft, x, y) => api('POST', '/play/world/craft/place', { craft, x, y }, player);
  const make = async craft => {
    const { run } = (await start(craft)).data;
    return finish(run.id, solveCraft(run));
  };
  const first = await view();
  const cat = (world, id) => world.crafts.catalog.find(c => c.id === id);
  // Palier de départ ouvert ; palier I fermé (ni chapitre I fini, ni 10 questions de l'Épreuve)
  assert.deepEqual(first.crafts.open, ['start']);
  assert.deepEqual(first.crafts.epreuves, { have: 0, need: 10 });
  assert.equal(first.crafts.catalog.length, 18);
  assert.match(cat(first, 'muret').block, /Palier I/);
  assert.match(cat(first, 'cloture').block, /ressources/);
  assert.equal((await start('cloture')).status, 403);
  await sql('UPDATE world_stock SET wood = 60, stone = 60, water = 60, food = 60 WHERE user_id = $1', [player.userId]);
  // Un assemblage : le gabarit et ses pièces ; une disposition fausse est refusée (rien payé), l'assemblage est rendu
  const { run } = (await start('cloture')).data;
  assert.deepEqual(run.shape, ['x.x', 'xxx', 'x.x']);
  assert.ok(run.pieces.length >= 2 && run.pieces.every(p => p.length >= 2));
  assert.equal((await finish(run.id, [{ piece: 0, rot: 0, x: 9, y: 9 }])).status, 400);
  assert.equal((await finish(run.id, solveCraft(run))).status, 404);
  assert.equal((await view()).stock.wood, 60);
  // Résolu : 8 bûches payées, la Clôture attend en réserve, avec les cases où la poser
  const made = await make('cloture');
  assert.equal(made.status, 200);
  assert.deepEqual([made.data.made, made.data.craft, made.data.world.stock.wood], ['Clôture', 'cloture', 52]);
  const fence = cat(made.data.world, 'cloture');
  assert.deepEqual([fence.made, fence.reserve], [1, 1]);
  assert.ok(fence.spots.some(sp => sp.x === X(31) && sp.y === Y(35)));
  // Pose : chantier, chemin, quartier pas à soi refusés ; puis posée ; la réserve est vide
  assert.equal((await place('cloture', X(30), Y(32))).status, 400);
  assert.equal((await place('cloture', X(27), Y(31))).status, 400);
  assert.equal((await place('cloture', X(24), Y(33))).status, 400);
  const placed = await place('cloture', X(31), Y(35));
  assert.equal(placed.status, 200);
  assert.deepEqual(placed.data.world.crafts.placed, [{ x: X(31), y: Y(35), craft: 'cloture' }]);
  assert.equal((await place('cloture', X(32), Y(35))).status, 409);
  // Posée, elle garde ses cases (pour la déplacer), sans la sienne
  const fenceSpots = cat(placed.data.world, 'cloture').spots;
  assert.ok(fenceSpots.some(sp => sp.x === X(32) && sp.y === Y(35)) && !fenceSpots.some(sp => sp.x === X(31) && sp.y === Y(35)));
  // Déplacée gratuitement, puis rangée dans la réserve
  const moved = await api('POST', '/play/world/craft/move', { x: X(31), y: Y(35), toX: X(32), toY: Y(35) }, player);
  assert.deepEqual(moved.data.world.crafts.placed, [{ x: X(32), y: Y(35), craft: 'cloture' }]);
  const stored = await api('POST', '/play/world/craft/store', { x: X(32), y: Y(35) }, player);
  assert.deepEqual(stored.data.world.crafts.placed, []);
  assert.equal(cat(stored.data.world, 'cloture').reserve, 1);
  assert.equal((await api('POST', '/play/world/craft/store', { x: X(32), y: Y(35) }, player)).status, 404);
  // Palier I par l'Épreuve (10 questions) ; la Lanterne demande Feu et Lumière, et le bord d'un chemin
  await sql(`UPDATE progress SET timer_progress = jsonb_set(timer_progress, '{completedQuestions}', '{"Facile":{"A":[1,2,3,4,5,6,7,8,9,10]}}') WHERE user_id = $1`, [player.userId]);
  const opened = await view();
  assert.deepEqual(opened.crafts.open, ['start', 'I']);
  assert.match(cat(opened, 'lanterne').block, /Lumière/);
  await sql(`UPDATE progress SET infinite_elements = infinite_elements || '["Lumière"]'::jsonb WHERE user_id = $1`, [player.userId]);
  assert.equal((await make('lanterne')).status, 200);
  assert.equal((await place('lanterne', X(30), Y(30))).status, 400);
  assert.equal((await place('lanterne', X(28), Y(31))).status, 200);
  // Le Banc (après la Clôture) se pose près de la Lanterne, pas loin d'elle
  assert.equal((await make('banc')).status, 200);
  assert.equal((await place('banc', X(32), Y(35))).status, 400);
  assert.equal((await place('banc', X(29), Y(31))).status, 200);
  // Les créations comptent pour les quêtes de Brume ; entrées invalides ; compte requis
  assert.equal((await view()).brume.quest.done, true);
  assert.equal((await start('inconnue')).status, 404);
  assert.equal((await start('DROP')).status, 400);
  assert.equal((await finish('x', [])).status, 400);
  assert.equal((await place('cloture', -1, 3)).status, 400);
  assert.equal((await api('POST', '/play/world/craft/start', { craft: 'cloture' }, await guest())).status, 402);
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
  // Palier IV requis pour les rails
  const early = await buy('rails');
  assert.equal(early.status, 403);
  assert.match(early.data.message, /palier IV/);
  assert.deepEqual(carriere.shop.find(i => i.id === 'rails').gain, { prod: 0.3 });
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
  // Achat en un toucher : annulable juste après, remboursé une seule fois ; un skin porté est retiré ; trop tard, refusé
  const undo = item => api('POST', '/play/world/item/undo', { item }, player);
  const before = await coinsOf(player);
  const paid = (await buy('enseigne-doree')).data.coins;
  const [u1, u2] = await Promise.all([undo('enseigne-doree'), undo('enseigne-doree')]);
  assert.deepEqual([u1.status, u2.status].sort(), [200, 409]);
  const undone = u1.status === 200 ? u1 : u2;
  assert.equal(undone.data.coins, before);
  assert.ok(paid < before);
  const atelier = undone.data.world.sites.find(s => s.id === 'atelier');
  assert.equal(atelier.shop.find(i => i.id === 'enseigne-doree').owned, false);
  assert.notEqual(atelier.skin, 'enseigne-doree');
  assert.equal((await undo('nimporte')).status, 404);
  await sql(`UPDATE world_items SET bought_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND item = 'etabli'`, [player.userId]);
  assert.equal((await undo('etabli')).status, 409);
  assert.equal(await coinsOf(player), before);
  // Production avec la pioche : +20 %
  await sql(`UPDATE world_buildings SET built_at = NOW() - INTERVAL '5 hours' WHERE user_id = $1`, [player.userId]);
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '3 hours' WHERE user_id = $1`, [player.userId]);
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(view.sites.find(s => s.id === 'carriere').pending, { coins: 7, stone: 10 });
});

test('le Monde : une teinte s’achète et se porte ; une pièce rare ne s’achète pas mais se porte une fois trouvée', async () => {
  const player = await newPlayer({ coins: 500 });
  const buy = item => api('POST', '/play/world/item', { item }, player);
  const skin = (site, value) => api('POST', '/play/world/skin', { site, skin: value }, player);
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'est')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'atelier', 1)`, [player.userId]);
  // Teinte du palier I : achetée et portée ; celle du palier II attend le palier
  const tint = await buy('craie-atelier');
  assert.equal(tint.status, 200);
  assert.equal(tint.data.coins, 440);
  assert.equal(tint.data.world.sites.find(s => s.id === 'atelier').skin, 'craie-atelier');
  assert.equal((await buy('corail-atelier')).status, 403);
  // Pièce rare : refusée à l'achat et au port tant qu'elle n'est pas trouvée, sans toucher aux écus
  const rare = await buy('etincelles');
  assert.equal(rare.status, 403);
  assert.match(rare.data.message, /butins/);
  const notFound = await skin('atelier', 'etincelles');
  assert.equal(notFound.status, 403);
  assert.match(notFound.data.message, /butins/);
  assert.equal(await coinsOf(player), 440);
  // Trouvée (butin) : elle se porte, ne se rend pas, et la boutique la montre comme rare
  await sql(`INSERT INTO world_items (user_id, item) VALUES ($1, 'etincelles')`, [player.userId]);
  const worn = await skin('atelier', 'etincelles');
  const atelier = worn.data.sites.find(s => s.id === 'atelier');
  assert.equal(atelier.skin, 'etincelles');
  assert.deepEqual(atelier.shop.find(i => i.id === 'etincelles'), {
    id: 'etincelles', kind: 'skin', name: 'Gerbe d’étincelles', price: null, minLevel: 1, rare: true, chapter: 'II',
    effect: 'Pièce rare : offerte par le chapitre II du Livre.', gain: null, owned: true
  });
  assert.equal(atelier.shop.find(i => i.id === 'engrenages').chapter, 'VI');
  assert.equal(atelier.shop.find(i => i.id === 'craie-atelier').rare, false);
  assert.equal((await api('POST', '/play/world/item/undo', { item: 'etincelles' }, player)).status, 409);
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
  // v1 → v2 → v3 : quartiers offerts, écus dus par la décoration versés une seule fois (3) ; puis la décoration est
  // remboursée (lot 8 : Eau, chapitre I, 10 écus) et retirée
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_tiles WHERE user_id = $1', [player.userId]))[0].n, 0);
  const owned = view.map.zones.filter(z => z.owned).map(z => z.id).sort();
  assert.deepEqual(owned, ['coeur', 'jardins', 'lisiere']);
  assert.equal(await coinsOf(player), 13);
  await api('GET', '/play/world', null, player);
  assert.equal(await coinsOf(player), 13);
});

test('terres nouvelles : quartier inconnu masqué, expédition (voisinage, coût, une à la fois), découvert au retour', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const explore = zone => api('POST', '/play/world/expedition', { zone }, player);
  const zoneOf = (world, id) => world.map.zones.find(z => z.id === id);
  const groundAt = (world, { x, y }) => world.map.ground[y][x];
  const first = await view();
  // Inconnu : ni nom, ni climat, ni prix ; sa côte seulement (sol masqué) ; ni achat ni expédition sans quartier voisin
  const unknown = zoneOf(first, 'roselieres');
  assert.deepEqual([unknown.known, unknown.name, unknown.price, unknown.climate, unknown.trip, unknown.explorable], [false, null, undefined, undefined, 2, false]);
  assert.deepEqual(unknown.cost, { food: 20, wood: 10 });
  assert.equal(groundAt(first, unknown.anchor), 'u');
  assert.equal(zoneOf(first, 'lisiere').climate, 'tempere');
  assert.match((await api('POST', '/play/world/zone', { zone: 'roselieres' }, player)).data.message, /expédition/);
  assert.equal((await explore('roselieres')).status, 403);
  assert.equal((await explore('coeur')).status, 404);
  assert.equal((await explore('DROP')).status, 400);
  // La Lisière à soi : les Roselières, voisines, s'explorent ; il faut emporter vivres et bois
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'lisiere')`, [player.userId]);
  await sql('UPDATE world_stock SET food = 5, wood = 50 WHERE user_id = $1', [player.userId]);
  assert.equal(zoneOf(await view(), 'roselieres').explorable, true);
  assert.match((await explore('roselieres')).data.message, /20 vivres et 10 bûches/);
  await sql('UPDATE world_stock SET food = 50 WHERE user_id = $1', [player.userId]);
  const charges = first.charges.count;
  const sent = await explore('roselieres');
  assert.equal(sent.status, 200);
  assert.equal(sent.data.expedition.zone, 'roselieres');
  assert.ok(Math.abs(new Date(sent.data.expedition.endsAt).getTime() - Date.now() - 2 * 3600 * 1000) < 60000);
  const away = sent.data.world;
  assert.deepEqual([away.stock.food, away.stock.wood, away.charges.count], [30, 40, charges - 1]);
  assert.equal(away.expedition.zone, 'roselieres');
  assert.ok(away.expedition.endsIn > 2 * 3600 * 1000 - 60000);
  // Une à la fois, et pas deux fois vers le même quartier
  assert.equal(zoneOf(away, 'roselieres').explorable, false);
  assert.match((await explore('roselieres')).data.message, /déjà en route/);
  // Revenue : le quartier se découvre (nom, climat, relief, prix) ; l'achat demande alors son chapitre
  await sql(`UPDATE world_expeditions SET ends_at = NOW() - INTERVAL '1 second' WHERE user_id = $1`, [player.userId]);
  const back = await view();
  const found = zoneOf(back, 'roselieres');
  assert.deepEqual([found.known, found.name, found.climate, found.price, found.chapter], [true, 'Les Roselières', 'marais', 400, 'II']);
  assert.notEqual(groundAt(back, found.anchor), 'u');
  assert.equal(back.expedition, null);
  // (le chapitre II est déjà ouvert pour ce joueur : il manque les écus)
  assert.match((await api('POST', '/play/world/zone', { zone: 'roselieres' }, player)).data.message, /400 écus/);
  assert.match((await explore('roselieres')).data.message, /déjà découvert/);
  // Le Bayou, voisin des Roselières (pas encore à soi) : pas d'expédition
  assert.equal((await explore('bayou')).status, 403);
  assert.equal((await api('POST', '/play/world/expedition', { zone: 'roselieres' }, await guest())).status, 402);
});

test('lieux remarquables : cachés avec leur quartier, découverts une fois dans un quartier à soi, coffre et effet durable', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const find = id => api('POST', '/play/world/landmark', { id }, player);
  const chest = source => api('POST', '/play/world/chest', { source }, player);
  const landmarkOf = (world, id) => world.landmarks.find(l => l.id === id);
  const first = await view();
  // Quartier inconnu : le lieu ne dit ni son nom, ni sa case
  assert.equal(first.landmarks.length, 13);
  assert.deepEqual(landmarkOf(first, 'menhirs'), { id: 'menhirs', zone: 'menhirs', known: false });
  assert.equal((await find('menhirs')).status, 403);
  assert.equal((await find('nulle')).status, 404);
  assert.equal((await find('DROP')).status, 400);
  // Découvert (expédition revenue) mais pas encore acheté : visible, pas encore trouvé
  await sql(`INSERT INTO world_expeditions (user_id, zone, ends_at) VALUES ($1, 'menhirs', NOW() - INTERVAL '1 hour'), ($1, 'falaises', NOW() - INTERVAL '1 hour'),
    ($1, 'dunes', NOW() - INTERVAL '1 hour')`, [player.userId]);
  const seen = landmarkOf(await view(), 'menhirs');
  assert.deepEqual([seen.name, seen.x, seen.y, seen.found, seen.chest, seen.effect], ['Le Cercle de menhirs', 13, 22, false, 'rare', '+2 coups par Récolte']);
  assert.match((await find('menhirs')).data.message, /Achète d’abord/);
  assert.equal((await chest('lieu:menhirs')).status, 403);
  // À soi : un toucher le découvre, une seule fois (même en double clic) ; l'effet dure, le coffre attend
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'menhirs'), ($1, 'falaises'), ($1, 'dunes')`, [player.userId]);
  const twice = await Promise.all([find('menhirs'), find('menhirs')]);
  assert.deepEqual(twice.map(r => r.status), [200, 200]);
  assert.deepEqual(twice.map(r => r.data.fresh).sort(), [false, true]);
  const after = (await view());
  const lm = landmarkOf(after, 'menhirs');
  assert.equal(lm.found, true);
  assert.ok(Math.abs(new Date(lm.foundAt).getTime() - Date.now()) < 60000);
  assert.equal(after.harvest.maxMoves, first.harvest.maxMoves + 2);
  assert.deepEqual(after.chests.pending.filter(c => c.source.startsWith('lieu:')), [{ source: 'lieu:menhirs', rarity: 'rare', label: 'Lieu : Le Cercle de menhirs' }]);
  const opened = await chest('lieu:menhirs');
  assert.equal(opened.status, 200);
  assert.equal(opened.data.chest.rarity, 'rare');
  assert.equal((await chest('lieu:menhirs')).status, 409);
  assert.equal((await chest('lieu:nulle')).status, 404);
  // L'Arche : +10 % de production pour la Carrière (affiché sur sa fiche)
  assert.equal((await find('arche')).data.fresh, true);
  assert.equal((await view()).sites.find(s => s.id === 'carriere').landmarkBonus, 10);
  // La Pyramide est sur le sable : rien ne s'y pose ; son coffre légendaire part avec « Tout ouvrir »
  await sql(`INSERT INTO world_crafts (user_id, craft) VALUES ($1, 'longuevue')`, [player.userId]);
  const place = (x, y) => api('POST', '/play/world/craft/place', { craft: 'longuevue', x, y }, player);
  assert.match((await place(26, 88)).data.message, /occupée/);
  assert.equal((await place(27, 88)).status, 200);
  await find('pyramide');
  const all = await api('POST', '/play/world/chests/all', {}, player);
  assert.equal(all.status, 200);
  assert.ok(all.data.chests.some(c => c.source === 'lieu:pyramide' && c.rarity === 'legendaire'));
  assert.equal(all.data.world.harvest.maxMoves, first.harvest.maxMoves + 4);
});

test('le Monde : une île de la carte v3 devient le cœur de la très grande île ; tout ce qui est posé glisse', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  // Île v3 simulée : une maison et deux créations (une posée, une en réserve) aux coordonnées de la grande île
  await sql('UPDATE world_stock SET map_version = 3 WHERE user_id = $1', [player.userId]);
  await sql(`INSERT INTO world_annexes (user_id, x, y, annex) VALUES ($1, 28, 31, 'maison')`, [player.userId]);
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 31, 35), ($1, 'cloture', 32, 35), ($1, 'massif', NULL, NULL)`, [player.userId]);
  const [a, b] = await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  for (const world of [a.data, b.data]) {
    assert.deepEqual(world.annexes.map(r => [r.x, r.y, r.annex]), [[X(28), Y(31), 'maison']]);
    assert.deepEqual(world.crafts.placed.map(r => [r.x, r.y]).sort(), [[X(31), Y(35)], [X(32), Y(35)]]);
    assert.equal(world.crafts.catalog.find(c => c.id === 'massif').reserve, 1);
  }
  assert.equal((await sql('SELECT map_version FROM world_stock WHERE user_id = $1', [player.userId]))[0].map_version, 4);
});

test('le Monde : une île de la carte v2 passe à la grande île ; ses décorations sont remboursées', async () => {
  const player = await newPlayer({ coins: 0 });
  await api('GET', '/play/world', null, player);
  // Île v2 simulée : décorations dans le Cœur, la Lisière, les Jardins et la Crique ; quartiers et bâtiment achetés
  await sql(`UPDATE world_stock SET map_version = 2 WHERE user_id = $1`, [player.userId]);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'lisiere'), ($1, 'jardins'), ($1, 'crique')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 2)`, [player.userId]);
  await sql(`INSERT INTO world_tiles (user_id, x, y, element) VALUES ($1, 8, 8, 'Eau'), ($1, 12, 12, 'Feu'), ($1, 4, 5, 'Terre'), ($1, 4, 12, 'Air'), ($1, 14, 14, 'Boue')`, [player.userId]);
  const before = await coinsOf(player);
  const [a, b] = await Promise.all([api('GET', '/play/world', null, player), api('GET', '/play/world', null, player)]);
  for (const view of [a.data, b.data]) {
    assert.equal(view.size, 96);
    assert.deepEqual(view.map.zones.filter(z => z.owned).map(z => z.id).sort(), ['coeur', 'crique', 'jardins', 'lisiere']);
    assert.equal(view.sites.find(s => s.id === 'ponton').level, 2);
  }
  // Une seule migration ; les cinq décorations remboursées une fois (Eau, Feu, Terre, Air : 10 ; Boue : 15)
  await api('GET', '/play/world', null, player);
  assert.equal(await coinsOf(player), before + 55);
  assert.equal((await sql('SELECT map_version FROM world_stock WHERE user_id = $1', [player.userId]))[0].map_version, 4);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_tiles WHERE user_id = $1', [player.userId]))[0].n, 0);
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
  // Parfois un coffre (6 coups joués) : son lot s'ajoute au stock ou aux écus
  const prize = paid.data.chest?.prize || {};
  if (paid.data.chest) assert.equal(paid.data.chest.source, `recolte:${runs[0].id}`);
  assert.deepEqual(paid.data.world.stock, Object.fromEntries(Object.entries(expected).map(([r, n]) => [r, n + (prize.stock?.[r] || 0)])));
  // Et des écus : 1 par tranche de 10 ressources ; coins est le solde
  const earned = Math.floor(Object.values(expected).reduce((sum, n) => sum + n, 0) / 10);
  assert.equal(paid.data.earned, earned);
  const balance = earned + (prize.kind === 'coins' ? prize.amount : 0);
  assert.equal(paid.data.coins, balance);
  assert.equal(await coinsOf(player), balance);

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
  assert.deepEqual(carriere.levels.map(l => l.name), ['Fissure', 'Carrière', 'Mine', 'Galerie', 'Puits de mine', 'Mine de cristal', 'Cité minière']);
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
  assert.equal(built.data.built, 'Fissure');
  assert.equal(built.data.world.stock.wood, 2);
  assert.equal(siteOf(built.data.world, 'carriere').level, 1);
  assert.deepEqual(built.data.world.harvest.boosts, { stone: 2 });
  // Niveau 2 : la Carrière (plan « Marteau »), pierre ×3
  assert.equal(siteOf(built.data.world, 'carriere').next.name, 'Carrière');
  await sql('UPDATE world_stock SET stone = 30, wood = 20 WHERE user_id = $1', [player.userId]);
  const mine = await api('POST', '/play/world/build', { site: 'carriere' }, player);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.built, 'Carrière');
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
  // L'Abri demande son plan (Bois)
  await sql('UPDATE world_stock SET stone = 10, wood = 20 WHERE user_id = $1', [player.userId]);
  assert.equal((await api('POST', '/play/world/build', { site: 'foyer' }, player)).status, 403);
});

test('le Monde : les paliers III à VII demandent chapitre et écus, le palier IV agrandit l’emprise et range les créations', async () => {
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
  assert.equal(third.data.built, 'Mine');
  assert.equal(third.data.coins, 850);
  assert.equal(await coinsOf(player), 850);
  assert.deepEqual(third.data.world.stock, { stone: 470, wood: 455, water: 500, food: 485 });
  assert.deepEqual(third.data.world.harvest.boosts, { stone: 4 });
  const galerie = siteOf(third.data.world, 'carriere');
  assert.deepEqual([galerie.x, galerie.y, galerie.w, galerie.h], [X(25), Y(21), 2, 2]);

  // Une création posée là où la Mine va s'étendre est rangée dans la réserve quand l'emprise s'agrandit
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', $2, $3)`, [player.userId, X(24), Y(20)]);
  const fourth = await build();
  assert.equal(fourth.status, 200);
  assert.equal(fourth.data.built, 'Galerie');
  assert.equal(fourth.data.coins, 850 - 300);
  const big = siteOf(fourth.data.world, 'carriere');
  assert.deepEqual([big.x, big.y, big.w, big.h], [X(24), Y(20), 3, 3]);
  assert.deepEqual(fourth.data.world.crafts.placed, []);
  assert.equal(fourth.data.world.crafts.catalog.find(c => c.id === 'cloture').reserve, 1);
  assert.equal((await api('POST', '/play/world/craft/place', { craft: 'cloture', x: X(24), y: Y(21) }, player)).status, 400);
  // Palier V : chapitre V encore fermé
  const fifth = await build();
  assert.equal(fifth.status, 403);
  assert.match(fifth.data.message, /chapitre V/);
});

test('noms : un bâtiment se renomme dès son palier III, un quartier dès qu’il est à soi ; un nom vide rend l’original', async () => {
  const player = await newPlayer();
  const name = body => api('POST', '/play/world/name', body, player);
  const start = (await api('GET', '/play/world', null, player)).data;
  const coeur = start.map.zones.find(z => z.id === 'coeur');
  assert.deepEqual([coeur.name, coeur.baseName, coeur.renamed], ['La Grève', 'La Grève', false]);
  // Le quartier de départ, à soi d'office
  const plage = await name({ kind: 'zone', id: 'coeur', name: '  Ma   Plage ' });
  assert.equal(plage.status, 200);
  assert.deepEqual(['name', 'baseName', 'renamed'].map(k => plage.data.map.zones.find(z => z.id === 'coeur')[k]), ['Ma Plage', 'La Grève', true]);
  // Un quartier pas encore acheté : non
  const other = start.map.zones.find(z => z.id !== 'coeur');
  assert.equal((await name({ kind: 'zone', id: other.id, name: 'Ailleurs' })).status, 403);
  // Bâtiment : au palier III seulement
  assert.equal((await name({ kind: 'site', id: 'foyer', name: 'Chez Nous' })).status, 403);
  await sql(`UPDATE world_buildings SET level = 3 WHERE user_id = $1 AND site = 'foyer'`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'foyer', 3) ON CONFLICT (user_id, site) DO UPDATE SET level = 3`, [player.userId]);
  const home = await name({ kind: 'site', id: 'foyer', name: 'Chez Nous' });
  assert.equal(home.status, 200);
  const foyer = home.data.sites.find(s => s.id === 'foyer');
  assert.deepEqual([foyer.name, foyer.renamed, foyer.renameLevel], ['Chez Nous', true, 3]);
  assert.notEqual(foyer.baseName, 'Chez Nous');
  // Nom invalide ; nom vide : retour à l'original
  assert.equal((await name({ kind: 'site', id: 'foyer', name: '<script>' })).status, 400);
  assert.equal((await name({ kind: 'site', id: 'foyer', name: 'x'.repeat(23) })).status, 400);
  const back = await name({ kind: 'site', id: 'foyer', name: '' });
  assert.equal(back.data.sites.find(s => s.id === 'foyer').name, foyer.baseName);
  assert.equal(back.data.sites.find(s => s.id === 'foyer').renamed, false);
  // Entrées invalides ; compte requis
  assert.equal((await name({ kind: 'ile', id: 'coeur', name: 'X Y' })).status, 400);
  assert.equal((await name({ kind: 'site', id: 'nulle', name: 'X Y' })).status, 404);
  assert.equal((await name({ kind: 'zone', id: 'nulle', name: 'X Y' })).status, 404);
  assert.equal((await name({ kind: 'site', id: 'foyer', name: ['a'] })).status, 400);
  assert.equal((await api('POST', '/play/world/name', { kind: 'zone', id: 'coeur', name: 'Ma Plage' }, await guest())).status, 402);
});

test('habitants : on leur parle et on les gâte une fois par jour ; chaque cœur est récompensé une seule fois', async () => {
  const player = await newPlayer();
  const talk = villager => api('POST', '/play/world/villager/talk', { villager }, player);
  const gift = (villager, resource) => api('POST', '/play/world/villager/gift', { villager, resource }, player);
  const view = (await api('GET', '/play/world', null, player)).data;
  // Seule Paulette (Foyer) vit déjà sur l'île
  assert.deepEqual(view.villagers.map(w => [w.id, w.name, w.hearts, w.talked, w.gifted]), [['foyer', 'Paulette', 0, false, false]]);
  assert.deepEqual(view.friendship.hearts, [30, 80, 150, 250, 400]);
  assert.equal((await talk('potager')).status, 403);
  // Bavarder : +8, une fois par jour
  const hello = await talk('foyer');
  assert.equal(hello.status, 200);
  assert.deepEqual([hello.data.gained, hello.data.hearts, hello.data.rewards], [8, 0, []]);
  assert.equal(hello.data.world.villagers[0].talked, true);
  assert.equal((await talk('foyer')).status, 409);
  // Cadeau : 15 ressources ; Paulette adore la nourriture (+30) : premier cœur, 40 écus
  assert.equal((await gift('foyer', 'food')).status, 400);
  await sql('UPDATE world_stock SET food = 100, water = 100 WHERE user_id = $1', [player.userId]);
  const loved = await gift('foyer', 'food');
  assert.equal(loved.status, 200);
  assert.deepEqual([loved.data.gained, loved.data.points, loved.data.hearts], [30, 38, 1]);
  assert.deepEqual(loved.data.rewards, [{ level: 1, kind: 'coins', amount: 40 }]);
  assert.equal(loved.data.world.stock.food, 85);
  assert.equal(await coinsOf(player), 40);
  assert.equal((await gift('foyer', 'water')).status, 409);
  // Les jours suivants (dates effacées) : chaque cœur gagné donne sa récompense, une fois
  const nextDay = points => sql('UPDATE world_friends SET talked_on = NULL, gifted_on = NULL, points = $2 WHERE user_id = $1', [player.userId, points]);
  await nextDay(79);
  const second = await talk('foyer');
  assert.deepEqual([second.data.points, second.data.hearts], [87, 2]);
  assert.deepEqual(second.data.rewards.map(r => [r.level, r.kind, r.chest && r.chest.rarity]), [[2, 'chest', 'rare']]);
  await nextDay(149);
  const third = await gift('foyer', 'water');
  assert.deepEqual([third.data.gained, third.data.hearts, third.data.rewards], [15, 3, [{ level: 3, kind: 'coins', amount: 120 }]]);
  await nextDay(249);
  assert.deepEqual((await talk('foyer')).data.rewards.map(r => [r.level, r.chest && r.chest.rarity]), [[4, 'epique']]);
  await nextDay(390);
  const fifth = await gift('foyer', 'food');
  assert.deepEqual([fifth.data.gained, fifth.data.points, fifth.data.hearts], [10, 400, 5]);
  assert.deepEqual(fifth.data.rewards.map(r => [r.level, r.chest && r.chest.rarity]), [[5, 'legendaire']]);
  assert.equal((await sql(`SELECT COUNT(*)::int AS n FROM world_chests WHERE user_id = $1 AND source LIKE 'ami:foyer:%'`, [player.userId]))[0].n, 3);
  // Au plus haut, bavarder ne rapporte plus de points ; une récompense déjà versée ne revient jamais
  const top = await talk('foyer');
  assert.deepEqual([top.data.gained, top.data.hearts, top.data.rewards], [0, 5, []]);
  await nextDay(395);
  assert.deepEqual((await gift('foyer', 'food')).data.rewards, []);
  // Entrées invalides ; compte requis
  assert.equal((await talk('personne')).status, 404);
  assert.equal((await gift('foyer', 'or')).status, 400);
  assert.equal((await gift('foyer', 'OR!')).status, 400);
  assert.equal((await api('POST', '/play/world/villager/talk', { villager: 'foyer' }, await guest())).status, 402);
});

test('besoins des habitants : manger, travailler, se distraire ; l’humeur change la production', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const fill = (villager, need) => api('POST', '/play/world/villager/need', { villager, need }, player);
  const fillAll = () => api('POST', '/play/world/villagers/needs', {}, player);
  const ago = (villager, need, hours) => sql(
    'UPDATE world_needs SET filled_at = NOW() - make_interval(hours => $4::int) WHERE user_id = $1 AND villager = $2 AND need = $3',
    [player.userId, villager, need, hours]);
  const who = (world, id) => world.villagers.find(v => v.id === id);
  const deco = v => v.needs.find(n => n.id === 'deco');
  // Paulette arrive comblée : manger tient 24 h ; sans décoration autour du Foyer, elle n'est que contente
  const first = await view();
  const paulette = who(first, 'foyer');
  assert.deepEqual(paulette.needs.map(n => [n.id, n.met]), [['manger', true], ['deco', false]]);
  assert.equal(paulette.needs[0].refill, false);
  assert.ok(paulette.needs[0].left > 23.9 * 3600000);
  assert.deepEqual([paulette.mood, paulette.moodEffect, paulette.happyEffect], ['content', null, 'Une partie de Récolte revient 3 min plus vite']);
  assert.deepEqual(first.needs.kinds.manger, { label: 'Manger', hours: 24, cost: { food: 10 } });
  assert.deepEqual(first.needs.kinds.deco, { label: 'Se distraire', decos: 3, reach: 3 });
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_needs WHERE user_id = $1', [player.userId]))[0].n, 1);
  // Pas encore faim ; à mi-chemin, on peut la nourrir : 10 vivres
  assert.equal((await fill('foyer', 'manger')).status, 409);
  await ago('foyer', 'manger', 13);
  assert.equal(who(await view(), 'foyer').needs[0].refill, true);
  const poor = await fill('foyer', 'manger');
  assert.equal(poor.status, 400);
  assert.match(poor.data.message, /10 vivres/);
  await sql('UPDATE world_stock SET food = 100, stone = 100, wood = 100 WHERE user_id = $1', [player.userId]);
  const fed = await fill('foyer', 'manger');
  assert.equal(fed.status, 200);
  assert.deepEqual(fed.data.filled, [{ villager: 'foyer', need: 'manger' }]);
  assert.equal(fed.data.world.stock.food, 90);
  assert.equal(who(fed.data.world, 'foyer').needs[0].refill, false);
  // Affamée et sans décoration : triste (les parties de Récolte reviennent moins vite)
  await ago('foyer', 'manger', 25);
  const sad = who(await view(), 'foyer');
  assert.deepEqual([sad.mood, sad.moodEffect], ['triste', 'Une partie de Récolte revient 3 min plus lentement']);
  // Se distraire : trois créations d'île à 3 cases au plus du Foyer (celle du haut est trop loin)
  const decorate = cells => sql(`INSERT INTO world_crafts (user_id, craft, x, y) SELECT $1, 'cloture', c[1], c[2] FROM jsonb_to_recordset($2::jsonb) AS t(c int[])`,
    [player.userId, JSON.stringify(cells.map(([x, y]) => ({ c: [X(x), Y(y)] })))]);
  await decorate([[31, 35], [32, 35], [29, 27]]);
  assert.deepEqual(deco(who(await view(), 'foyer')), { id: 'deco', met: false, have: 2, need: 3, reach: 3 });
  await decorate([[33, 35]]);
  assert.equal(deco(who(await view(), 'foyer')).met, true);
  const happy = who((await fill('foyer', 'manger')).data.world, 'foyer');
  assert.deepEqual([happy.mood, happy.moodEffect], ['heureux', 'Une partie de Récolte revient 3 min plus vite']);
  // Rose (Potager, 10 h de production, plafonnées à 8) : contente, puis triste : −10 % de vivres et d'écus
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'jardins')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level, built_at) VALUES ($1, 'potager', 1, NOW() - INTERVAL '10 hours')`, [player.userId]);
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '10 hours' WHERE user_id = $1`, [player.userId]);
  const garden = await view();
  const potager = world => world.sites.find(s => s.id === 'potager');
  assert.equal(who(garden, 'potager').mood, 'content');
  assert.deepEqual([potager(garden).moodBonus, potager(garden).pending], [0, { coins: 16, food: 24 }]);
  await ago('potager', 'manger', 30);
  const gloomy = await view();
  assert.equal(who(gloomy, 'potager').moodEffect, '−10 % de production');
  assert.deepEqual([potager(gloomy).moodBonus, potager(gloomy).pending, potager(gloomy).perHour], [-10, { coins: 14, food: 21 }, { amount: 2.7, coins: 1.8 }]);
  const collected = await api('POST', '/play/world/collect', {}, player);
  assert.deepEqual([collected.data.gained, collected.data.stock.food], [14, 21]);
  // Tout combler : Rose et Paulette mangent (20 vivres), puis plus rien à faire
  await ago('foyer', 'manger', 20);
  const all = await fillAll();
  assert.equal(all.status, 200);
  assert.deepEqual(all.data.filled, [{ villager: 'potager', need: 'manger' }, { villager: 'foyer', need: 'manger' }]);
  assert.equal(all.data.world.stock.food, 81);
  assert.equal((await fillAll()).status, 409);
  // Travailler : seulement avec l'Atelier (Ferdinand) ; triste, il ôte 2 coups à chaque Récolte
  assert.equal((await fill('foyer', 'outils')).status, 403);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'est')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'atelier', 1)`, [player.userId]);
  const forge = await view();
  assert.deepEqual(who(forge, 'foyer').needs.map(n => n.id), ['manger', 'outils', 'deco']);
  assert.equal(who(forge, 'atelier').mood, 'content');
  await ago('atelier', 'outils', 50);
  const worn = await view();
  assert.equal(who(worn, 'atelier').moodEffect, '−2 coups par Récolte');
  assert.equal(worn.harvest.maxMoves, forge.harvest.maxMoves - 2);
  const run = await api('POST', '/play/world/harvest/start', {}, player);
  assert.equal(run.data.maxMoves, worn.harvest.maxMoves);
  const tooled = await fill('atelier', 'outils');
  assert.deepEqual([tooled.data.world.stock.stone, tooled.data.world.stock.wood], [95, 95]);
  // Entrées invalides ; habitant absent ; compte requis
  assert.equal((await fill('personne', 'manger')).status, 404);
  assert.equal((await fill('constructor', 'manger')).status, 404);
  assert.equal((await fill('foyer', 'deco')).status, 400);
  assert.equal((await fill('foyer', 'MANGER!')).status, 400);
  assert.equal((await fill('carriere', 'manger')).status, 403);
  assert.equal((await api('POST', '/play/world/villagers/needs', {}, await guest())).status, 402);
});

test('visiteurs : un voyageur débarque au Ponton avec une demande, la comble une fois, repart ; le suivant arrive après', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const satisfy = id => api('POST', '/play/world/visitor', { id }, player);
  // Pas de Ponton : personne
  assert.equal((await view()).visitor, null);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'crique')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 2)`, [player.userId]);
  const first = (await view()).visitor;
  assert.ok(first && first.id && first.seed && first.name);
  assert.ok(['foyer', 'ponton'].includes(first.site), first.site);
  assert.ok(first.leavesIn > 23 * 3600000 && first.leavesIn <= 72 * 3600000);
  assert.equal(first.satisfied, false);
  // Une seule visite à la fois : la vue suivante montre le même
  assert.equal((await view()).visitor.id, first.id);
  // Livrer 30 vivres (palier II du Ponton) : sans stock, refusé ; puis versé une fois
  await sql(`UPDATE world_visitors SET request = '{"kind":"livrer","resource":"food","amount":30,"reward":60}' WHERE id = $1`, [first.id]);
  const poor = await satisfy(first.id);
  assert.equal(poor.status, 400);
  assert.match(poor.data.message, /30 vivres/);
  await sql('UPDATE world_stock SET food = 50 WHERE user_id = $1', [player.userId]);
  const done = await satisfy(first.id);
  assert.equal(done.status, 200);
  assert.deepEqual([done.data.reward, done.data.coins, done.data.world.stock.food], [60, 60, 20]);
  assert.equal(done.data.world.visitor.satisfied, true);
  assert.equal((await satisfy(first.id)).status, 409);
  assert.equal(await coinsOf(player), 60);
  // Reparti : personne pendant quelques heures, puis un autre arrive
  await sql(`UPDATE world_visitors SET leaves_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [first.id]);
  assert.equal((await view()).visitor, null);
  assert.equal((await satisfy(first.id)).status, 404);
  await sql(`UPDATE world_visitors SET leaves_at = NOW() - INTERVAL '5 hours' WHERE id = $1`, [first.id]);
  const second = (await view()).visitor;
  assert.ok(second && second.id !== first.id);
  // Demande de Récoltes : comptées depuis son arrivée
  await sql(`UPDATE world_visitors SET request = '{"kind":"recolter","count":2,"reward":60}' WHERE id = $1`, [second.id]);
  assert.deepEqual((await view()).visitor.request, { kind: 'recolter', count: 2, reward: 60, have: 0 });
  const early = await satisfy(second.id);
  assert.equal(early.status, 403);
  assert.match(early.data.message, /Encore 2 Récoltes/);
  const run = `INSERT INTO world_runs (user_id, seed, config, finished_at) VALUES ($1, 1, '{}', NOW())`;
  await sql(run, [player.userId]);
  await sql(run, [player.userId]);
  assert.equal((await view()).visitor.request.have, 2);
  assert.equal((await satisfy(second.id)).status, 200);
  // Entrées invalides ; le visiteur d'un autre ; compte requis
  assert.equal((await satisfy('x')).status, 400);
  assert.equal((await satisfy(-1)).status, 400);
  const other = await newPlayer();
  assert.equal((await api('POST', '/play/world/visitor', { id: second.id }, other)).status, 404);
  assert.equal((await api('POST', '/play/world/visitor', { id: 1 }, await guest())).status, 402);
});

test('maisons : un visiteur comblé reste dans une maison libre et devient habitant (amitié, besoins)', async () => {
  const player = await newPlayer();
  const view = async () => (await api('GET', '/play/world', null, player)).data;
  const settle = id => api('POST', '/play/world/visitor/settle', { id }, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'crique')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 2)`, [player.userId]);
  const traveller = (await view()).visitor;
  await sql('UPDATE world_stock SET food = 100 WHERE user_id = $1', [player.userId]);
  await sql(`UPDATE world_visitors SET request = '{"kind":"livrer","resource":"food","amount":10,"reward":60}' WHERE id = $1`, [traveller.id]);
  // Pas encore comblé : il ne reste pas ; comblé mais sans maison libre : non plus
  assert.equal((await settle(traveller.id)).status, 403);
  assert.equal((await api('POST', '/play/world/visitor', { id: traveller.id }, player)).status, 200);
  const homeless = await settle(traveller.id);
  assert.equal(homeless.status, 409);
  assert.match(homeless.data.message, /Maison/);
  // Une maison près du Foyer : il s'installe, la visite s'achève, il devient habitant
  await sql(`INSERT INTO world_annexes (user_id, x, y, annex) VALUES ($1, $2, $3, 'maison')`, [player.userId, X(28), Y(31)]);
  assert.deepEqual((await view()).houses, { total: 1, used: 0 });
  const stayed = await settle(traveller.id);
  assert.equal(stayed.status, 200);
  assert.equal(stayed.data.settled, traveller.name);
  assert.equal(stayed.data.world.visitor, null);
  assert.deepEqual(stayed.data.world.houses, { total: 1, used: 1 });
  const id = `v${traveller.id}`;
  const settler = stayed.data.world.villagers.find(v => v.id === id);
  assert.deepEqual([settler.name, settler.role, settler.site, settler.seed, settler.home], [traveller.name, traveller.role, traveller.site, traveller.seed, { x: X(28), y: Y(31) }]);
  assert.deepEqual(settler.needs.map(n => n.id), ['manger', 'deco']);
  assert.equal((await settle(traveller.id)).status, 404);
  // Comme les autres habitants : on lui parle, on comble ses besoins
  const hello = await api('POST', '/play/world/villager/talk', { villager: id }, player);
  assert.deepEqual([hello.status, hello.data.gained], [200, 8]);
  await sql(`UPDATE world_needs SET filled_at = NOW() - INTERVAL '13 hours' WHERE user_id = $1 AND villager = $2`, [player.userId, id]);
  assert.equal((await api('POST', '/play/world/villager/need', { villager: id, need: 'manger' }, player)).status, 200);
  assert.equal((await api('POST', '/play/world/villager/talk', { villager: 'v999999' }, player)).status, 404);
  // Le visiteur suivant arrive quelques heures après ; sans seconde maison, il ne pourra pas rester
  assert.equal((await view()).visitor, null);
  await sql(`UPDATE world_visitors SET settled_at = NOW() - INTERVAL '5 hours' WHERE id = $1`, [traveller.id]);
  const next = (await view()).visitor;
  assert.ok(next && next.id !== traveller.id);
  await sql(`UPDATE world_visitors SET request = '{"kind":"livrer","resource":"food","amount":10,"reward":60}' WHERE id = $1`, [next.id]);
  assert.equal((await api('POST', '/play/world/visitor', { id: next.id }, player)).status, 200);
  assert.equal((await settle(next.id)).status, 409);
  assert.equal((await api('POST', '/play/world/visitor/settle', { id: 'x' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/visitor/settle', { id: 1 }, await guest())).status, 402);
});

test('mini-jeux : au palier III, trois parties en réserve, gestes rejoués par le serveur, écus versés une fois', async () => {
  const player = await newPlayer();
  const start = game => api('POST', '/play/world/game/start', { game }, player);
  const finish = (run, input) => api('POST', '/play/world/game/finish', { run, input }, player);
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(view.games.map(g => [g.id, g.site, g.open, g.plays, g.max]), [['peche', 'ponton', false, 3, 3], ['filon', 'carriere', false, 3, 3], ['cueillette', 'bosquet', false, 3, 3]]);
  assert.equal((await start('peche')).status, 403);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 3), ($1, 'carriere', 5)`, [player.userId]);
  // Pêche : le premier poisson sous l'hameçon (la partie est datée d'une minute : les gestes ne viennent pas du futur)
  const begun = await start('peche');
  assert.equal(begun.status, 200);
  assert.equal(begun.data.run.level, 3);
  assert.equal(begun.data.world.games.find(g => g.id === 'peche').plays, 2);
  const { id, seed } = begun.data.run;
  const fish = minigames.fishingOf(seed).find(f => f.kind !== 'botte');
  const at = Math.round(fish.t0 + (0.6 / fish.speed) * 1000);
  await sql(`UPDATE world_game_runs SET created_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
  const done = await finish(id, [[at, fish.lane]]);
  assert.equal(done.status, 200);
  assert.deepEqual(done.data.detail, [fish.kind]);
  assert.equal(done.data.earned, minigames.FISH[fish.kind].value);
  assert.equal(await coinsOf(player), done.data.earned);
  assert.equal((await finish(id, [[at, fish.lane]])).status, 404);
  // Gestes datés après la fin réelle de la partie : refusés (la partie est rendue quand même)
  const quick = await start('peche');
  const late = await finish(quick.data.run.id, [[40000, 0]]);
  assert.equal(late.status, 400);
  assert.match(late.data.message, /trop rapide/);
  assert.equal((await finish(quick.data.run.id, [])).status, 404);
  // Troisième partie, puis la réserve est vide
  const third = await start('peche');
  assert.equal((await finish(third.data.run.id, [['x']])).status, 400);
  assert.equal((await start('peche')).status, 409);
  // Filon au palier V : ×1,4 ; ouvrir la colonne du milieu jusqu'à trouver une pierre ou épuiser les coups
  const vein = await start('filon');
  assert.equal(vein.data.run.level, 5);
  const wall = minigames.veinOf(vein.data.run.seed);
  const taps = [];
  for (const i of [2, 8, 14, 20, 26, 32, 38]) for (let k = 0; k < wall.hard[i] && taps.length < minigames.VEIN.strokes; k++) taps.push(i);
  const dug = await finish(vein.data.run.id, taps);
  assert.equal(dug.status, 200);
  assert.equal(dug.data.earned, minigames.earnedOf(dug.data.raw, 5));
  assert.equal((await api('GET', '/play/world', null, player)).data.games.find(g => g.id === 'filon').mult, 1.4);
  // Jeu inconnu, entrées invalides ; compte requis
  assert.equal((await start('rien')).status, 404);
  assert.equal((await start('Pêche!')).status, 400);
  assert.equal((await finish(0, [])).status, 400);
  assert.equal((await api('POST', '/play/world/game/finish', { run: 1, input: 'x' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/game/start', { game: 'peche' }, await guest())).status, 402);
});

test('enseignes : dès le palier V, au nom choisi, un style par bâtiment, acheté une seule fois', async () => {
  const player = await newPlayer({ coins: 400 });
  const sign = body => api('POST', '/play/world/sign', body, player);
  const start = (await api('GET', '/play/world', null, player)).data;
  // Nom proposé : le premier mot de l'identifiant ; styles : le bois offert, les autres à acheter ; pas d'enseigne avant V
  assert.equal(start.signs.name, 'Test');
  assert.equal(start.signs.level, 5);
  assert.deepEqual(start.signs.styles.filter(s => s.owned).map(s => s.id), ['bois']);
  assert.ok(start.sites.every(s => s.sign === null));
  assert.equal((await sign({ site: 'potager', style: 'bois' })).status, 403);
  // Nom choisi, nettoyé ; refusé s'il ne convient pas
  const named = await api('POST', '/play/world/sign/name', { name: '  Zoé   des Îles ' }, player);
  assert.equal(named.status, 200);
  assert.equal(named.data.signs.name, 'Zoé des Îles');
  assert.equal((await api('POST', '/play/world/sign/name', { name: '<script>' }, player)).status, 400);
  assert.equal((await api('POST', '/play/world/sign/name', { name: 'x'.repeat(15) }, player)).status, 400);
  // Potager au palier V : planche de bois d'office
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 5), ($1, 'carriere', 6)`, [player.userId]);
  const five = (await api('GET', '/play/world', null, player)).data;
  assert.equal(five.sites.find(s => s.id === 'potager').sign, 'bois');
  assert.equal(five.sites.find(s => s.id === 'ponton').sign, null);
  // Ardoise : 150 écus, une seule fois même en double clic, puis portée
  const [a, b] = await Promise.all([1, 2].map(() => sign({ site: 'potager', style: 'ardoise' })));
  assert.deepEqual([a.status, b.status], [200, 200]);
  assert.equal(await coinsOf(player), 250);
  assert.deepEqual([a.data.coins, b.data.coins].filter(c => c !== undefined), [250]);
  assert.equal(a.data.world.sites.find(s => s.id === 'potager').sign, 'ardoise');
  assert.equal(a.data.world.signs.styles.find(s => s.id === 'ardoise').owned, true);
  // Déjà achetée : portée gratuitement sur un autre bâtiment ; trop chère : refusée, rien n'est pris
  const carriere = await sign({ site: 'carriere', style: 'ardoise' });
  assert.equal(carriere.data.coins, undefined);
  assert.equal(carriere.data.world.sites.find(s => s.id === 'carriere').sign, 'ardoise');
  assert.equal((await sign({ site: 'carriere', style: 'lanterne' })).status, 400);
  assert.equal(await coinsOf(player), 250);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_sign_styles WHERE user_id = $1', [player.userId]))[0].n, 1);
  // Retour au bois, offert
  assert.equal((await sign({ site: 'potager', style: 'bois' })).data.world.sites.find(s => s.id === 'potager').sign, 'bois');
  // Entrées invalides ; compte requis
  assert.equal((await sign({ site: 'potager', style: 'neon' })).status, 404);
  assert.equal((await sign({ site: 'nulle', style: 'bois' })).status, 404);
  assert.equal((await sign({ site: 'potager', style: 'Bois!' })).status, 400);
  assert.equal((await api('POST', '/play/world/sign', { site: 'potager', style: 'bois' }, await guest())).status, 402);
});

test('annexes : posées autour du bâtiment au palier voulu, payées une fois, déplacées gratuitement, elles produisent', async () => {
  const player = await newPlayer({ coins: 0 });
  const potagerOf = world => world.sites.find(s => s.id === 'potager');
  const place = (annex, cell) => api('POST', '/play/world/annex', { annex, ...cell }, player);
  await api('GET', '/play/world', null, player);
  assert.equal((await place('Champ!', { x: 10, y: 10 })).status, 400);
  assert.equal((await place('inconnue', { x: 10, y: 10 })).status, 404);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'jardins'), ($1, 'est')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'potager', 1), ($1, 'atelier', 2)`, [player.userId]);
  const first = (await api('GET', '/play/world', null, player)).data;
  // Palier I : pas encore de cases ; le catalogue annonce le Champ au palier II, trois exemplaires (II, III, V)
  assert.deepEqual(potagerOf(first).spots, []);
  const champ = potagerOf(first).annexes.find(a => a.id === 'champ');
  assert.deepEqual([champ.max, champ.built, champ.levels, champ.next.level, champ.next.coins], [3, 0, [2, 3, 5], 2, 100]);
  assert.equal(champ.effect, '+3 vivres et +2 écus par heure');
  assert.equal(potagerOf(first).annexes.find(a => a.id === 'grenier').effect, 'Garde 12 h de production au lieu de 8');
  await sql(`UPDATE world_buildings SET level = 2 WHERE user_id = $1 AND site = 'potager'`, [player.userId]);
  const spots = potagerOf((await api('GET', '/play/world', null, player)).data).spots;
  assert.ok(spots.length >= 10);
  const [a, b, c] = spots;
  // Loin du bâtiment : refusé ; sans ressources puis sans écus : refusé, rien n'est pris
  assert.equal((await place('champ', { x: 31, y: 35 })).status, 400);
  assert.equal((await place('champ', a)).status, 400);
  await sql('UPDATE world_stock SET stone = 500, wood = 500, water = 500, food = 500 WHERE user_id = $1', [player.userId]);
  const poor = await place('champ', a);
  assert.equal(poor.status, 400);
  assert.match(poor.data.message, /100 écus/);
  assert.equal((await api('GET', '/play/world', null, player)).data.stock.wood, 500);
  await sql('UPDATE progress SET coins = 1000 WHERE user_id = $1', [player.userId]);
  const done = await place('champ', a);
  assert.equal(done.status, 200);
  assert.equal(done.data.built, 'Champ');
  assert.equal(done.data.coins, 900);
  assert.deepEqual(done.data.world.annexes, [{ x: a.x, y: a.y, annex: 'champ', site: 'potager' }]);
  assert.equal(done.data.world.stock.wood, 480);
  assert.equal(potagerOf(done.data.world).annexes.find(x => x.id === 'champ').built, 1);
  assert.ok(!potagerOf(done.data.world).spots.some(s => s.x === a.x && s.y === a.y));
  // Deuxième exemplaire : palier III ; au palier III, deux poses en même temps : une seule passe (la 3e veut le palier V)
  const early = await place('champ', b);
  assert.equal(early.status, 403);
  assert.match(early.data.message, /palier III/);
  await sql(`UPDATE world_buildings SET level = 3 WHERE user_id = $1 AND site = 'potager'`, [player.userId]);
  const [r1, r2] = await Promise.all([place('champ', b), place('champ', c)]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 403]);
  assert.equal(await coinsOf(player), 900 - 250);
  // Case occupée : ni annexe ni décoration ne s'y pose
  const taken = r1.status === 200 ? b : c;
  const free = r1.status === 200 ? c : b;
  assert.equal((await place('grenier', taken)).status, 403);
  await sql(`INSERT INTO world_crafts (user_id, craft) VALUES ($1, 'cloture')`, [player.userId]);
  assert.equal((await api('POST', '/play/world/craft/place', { craft: 'cloture', ...a }, player)).status, 400);
  // Déplacement gratuit vers une case autorisée ; pas hors de portée, pas sur une case prise
  const move = (from, to) => api('POST', '/play/world/annex/move', { x: from.x, y: from.y, toX: to.x, toY: to.y }, player);
  assert.equal((await move(a, { x: 31, y: 35 })).status, 400);
  assert.equal((await move(a, taken)).status, 409);
  assert.equal((await move({ x: 0, y: 0 }, free)).status, 404);
  const moved = await move(a, free);
  assert.equal(moved.status, 200);
  assert.ok(moved.data.annexes.some(x => x.x === free.x && x.y === free.y && x.annex === 'champ'));
  assert.equal(await coinsOf(player), 650);
  // Production : Potager III depuis 4 h ; deux champs posés il y a 2 h → 36 + 12 vivres, 24 + 8 écus
  await sql(`UPDATE world_buildings SET built_at = NOW() - INTERVAL '4 hours' WHERE user_id = $1 AND site = 'potager'`, [player.userId]);
  await sql(`UPDATE world_annexes SET built_at = NOW() - INTERVAL '2 hours' WHERE user_id = $1`, [player.userId]);
  await sql(`UPDATE world_stock SET collected_at = NOW() - INTERVAL '5 hours' WHERE user_id = $1`, [player.userId]);
  const later = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(potagerOf(later).pending, { coins: 32, food: 48 });
  assert.deepEqual(potagerOf(later).perHour, { amount: 15, coins: 10 });
  // Atelier II : le Tas de charbon ajoute un coup à la Récolte (Atelier II : +5)
  const atelier = later.sites.find(s => s.id === 'atelier');
  assert.equal(later.harvest.maxMoves, 15 + 5);
  const coal = await place('charbon', atelier.spots[0]);
  assert.equal(coal.status, 200);
  assert.equal(coal.data.world.harvest.maxMoves, 15 + 5 + 1);
  assert.equal((await place('charbon', atelier.spots[1])).status, 409);
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

test('butins : le coffre du jour s’ouvre une fois par jour, sa série monte et repart à 1 après un jour manqué', async () => {
  const player = await newPlayer();
  const open = source => api('POST', '/play/world/chest', { source }, player);
  const start = (await api('GET', '/play/world', null, player)).data.chests.daily;
  assert.deepEqual(start, { available: true, streak: 1, rarity: 'commun', tomorrow: 'commun', week: ['commun', 'commun', 'rare', 'rare', 'rare', 'rare', 'epique'] });
  // Deux ouvertures simultanées : un seul coffre
  const [a, b] = await Promise.all([1, 2].map(() => open('jour')));
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  const { day } = loot.parisOf(Date.now());
  assert.equal(ok.data.chest.source, `jour:${day}`);
  assert.equal(ok.data.chest.rarity, 'commun');
  const prize = ok.data.chest.prize;
  assert.ok(['coins', 'stock'].includes(prize.kind));
  assert.equal(ok.data.coins, prize.kind === 'coins' ? prize.amount : 0);
  assert.equal(await coinsOf(player), ok.data.coins);
  if (prize.kind === 'stock') for (const [r, n] of Object.entries(prize.stock)) assert.equal(ok.data.world.stock[r], n);
  assert.equal(ok.data.world.chests.daily.available, false);
  assert.equal(ok.data.world.chests.daily.streak, 1);
  // Série : hier au 6e jour, aujourd'hui le 7e (épique) ; sans hier, retour à 1
  const other = await newPlayer();
  await api('GET', '/play/world', null, other);
  await sql(`INSERT INTO world_chests (user_id, source, rarity, prize, streak) VALUES ($1, $2, 'rare', '{"kind":"coins","amount":50}', 6)`, [other.userId, `jour:${loot.dayBefore(day)}`]);
  const seventh = (await api('GET', '/play/world', null, other)).data.chests.daily;
  assert.equal(seventh.streak, 7);
  assert.equal(seventh.rarity, 'epique');
  assert.equal(seventh.tomorrow, 'commun');
  const epic = await api('POST', '/play/world/chest', { source: 'jour' }, other);
  assert.equal(epic.data.chest.rarity, 'epique');
  await sql(`INSERT INTO world_chests (user_id, source, rarity, prize, streak) VALUES ($1, $2, 'rare', '{"kind":"coins","amount":50}', 6)`, [player.userId, `jour:${loot.dayBefore(loot.dayBefore(day))}`]);
  assert.equal((await api('GET', '/play/world', null, player)).data.chests.daily.streak, 1);
});

test('butins : chapitres ouverts, quêtes réclamées et bouteille donnent leur coffre une seule fois', async () => {
  const player = await newPlayer();
  const open = source => api('POST', '/play/world/chest', { source }, player);
  const view = (await api('GET', '/play/world', null, player)).data;
  // Chapitres I et II ouverts d'emblée : le II offre sa pièce rare
  assert.deepEqual(view.chests.pending, [{ source: 'chapitre:II', rarity: 'legendaire', label: 'Chapitre II du Livre' }]);
  const chapter = await open('chapitre:II');
  assert.equal(chapter.status, 200);
  assert.deepEqual(chapter.data.chest.prize, { kind: 'rare', item: 'etincelles', site: 'atelier', name: 'Gerbe d’étincelles' });
  assert.equal(chapter.data.world.sites.find(s => s.id === 'atelier').shop.find(i => i.id === 'etincelles').owned, true);
  assert.deepEqual(chapter.data.world.chests.pending, []);
  assert.equal((await open('chapitre:II')).status, 409);
  assert.equal((await open('chapitre:III')).status, 403);
  assert.equal((await open('chapitre:I')).status, 404);
  // Une pièce gagnée ne se rend pas contre des écus
  assert.equal((await api('POST', '/play/world/item/undo', { item: 'etincelles' }, player)).status, 409);
  // Quête de fin d'acte réclamée : son coffre attend ; une quête sans coffre ou pas réclamée, non
  assert.equal((await open('quete:source')).status, 403);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'deco'), ($1, 'recolte'), ($1, 'source')`, [player.userId]);
  const pending = (await api('GET', '/play/world', null, player)).data.chests.pending;
  assert.deepEqual(pending, [{ source: 'quete:source', rarity: 'rare', label: 'Quête : Achète La Source' }]);
  const quest = await open('quete:source');
  assert.equal(quest.status, 200);
  assert.equal(quest.data.chest.rarity, 'rare');
  assert.equal((await open('quete:source')).status, 409);
  assert.equal((await open('quete:deco')).status, 404);
  // Bouteille à la mer : une par tranche de 6 heures
  assert.equal(quest.data.world.chests.bottle.available, true);
  const bottle = await open('bouteille');
  assert.equal(bottle.status, 200);
  assert.ok(['commun', 'rare', 'epique'].includes(bottle.data.chest.rarity));
  assert.equal(bottle.data.world.chests.bottle.available, false);
  assert.equal((await open('bouteille')).status, 409);
  // Sources invalides ; compte requis
  assert.equal((await open('DROP TABLE')).status, 400);
  assert.equal((await open('chapitre:IX')).status, 404);
  assert.equal((await api('POST', '/play/world/chest', { source: 'jour' }, await guest())).status, 402);
});

test('butins : « Tout ouvrir » ouvre d’un coup le coffre du jour, les chapitres, les quêtes et la bouteille, une seule fois', async () => {
  const player = await newPlayer();
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_quests (user_id, quest) VALUES ($1, 'deco'), ($1, 'source')`, [player.userId]);
  const all = () => api('POST', '/play/world/chests/all', {}, player);
  // Deux appels simultanés : l'un ouvre tout, l'autre ne trouve plus rien
  const [a, b] = await Promise.all([all(), all()]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  const { day, slot } = loot.parisOf(Date.now());
  assert.deepEqual(ok.data.chests.map(c => c.source), [`jour:${day}`, 'chapitre:II', 'quete:source', `bouteille:${day}-${slot}`]);
  assert.deepEqual(ok.data.chests.map(c => c.rarity).slice(0, 3), ['commun', 'legendaire', 'rare']);
  assert.deepEqual(ok.data.chests[1].prize, { kind: 'rare', item: 'etincelles', site: 'atelier', name: 'Gerbe d’étincelles' });
  // Le solde et la vue suivent : plus rien n'attend, la série du jour compte
  const coins = ok.data.chests.reduce((sum, c) => sum + (c.prize.kind === 'coins' ? c.prize.amount : 0), 0);
  assert.equal(ok.data.coins, coins);
  assert.equal(await coinsOf(player), coins);
  assert.deepEqual(ok.data.world.chests.pending, []);
  assert.equal(ok.data.world.chests.daily.available, false);
  assert.equal(ok.data.world.chests.daily.streak, 1);
  assert.equal(ok.data.world.chests.bottle.available, false);
  assert.equal((await sql('SELECT COUNT(*)::int AS n FROM world_chests WHERE user_id = $1', [player.userId]))[0].n, 4);
  assert.equal((await all()).status, 409);
  assert.equal((await api('POST', '/play/world/chest', { source: 'jour' }, player)).status, 409);
  // Compte requis
  assert.equal((await api('POST', '/play/world/chests/all', {}, await guest())).status, 402);
});

test('butins : une teinte gagnée ne s’annule pas comme un achat', async () => {
  const player = await newPlayer({ coins: 500 });
  await api('GET', '/play/world', null, player);
  await sql(`INSERT INTO world_zones (user_id, zone) VALUES ($1, 'est')`, [player.userId]);
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'atelier', 1)`, [player.userId]);
  await sql(`INSERT INTO world_items (user_id, item, source) VALUES ($1, 'craie-atelier', 'butin')`, [player.userId]);
  assert.equal((await api('POST', '/play/world/item/undo', { item: 'craie-atelier' }, player)).status, 409);
  assert.equal(await coinsOf(player), 500);
  // Un achat, lui, s'annule toujours
  assert.equal((await api('POST', '/play/world/item', { item: 'sepia-atelier' }, player)).status, 200);
  assert.equal((await api('POST', '/play/world/item/undo', { item: 'sepia-atelier' }, player)).status, 200);
  assert.equal(await coinsOf(player), 500);
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
  // Une création posée : deux réclamations simultanées, une seule récompense
  await sql(`INSERT INTO world_crafts (user_id, craft, x, y) VALUES ($1, 'cloture', 31, 35)`, [player.userId]);
  const [a, b] = await Promise.all([1, 2].map(() => api('POST', '/play/world/quest', { id: 'deco' }, player)));
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b;
  assert.equal(ok.data.gained, 20);
  assert.equal(ok.data.coins, 20);
  assert.equal(await coinsOf(player), 20);
  assert.equal(ok.data.world.brume.quest.id, 'recolte');
  assert.equal(ok.data.world.brume.done, 1);
  assert.equal((await api('POST', '/play/world/quest', { id: 'deco' }, player)).status, 409);
  // Brume seule, pour le Livre : la même quête active, sans le reste de l'île
  const brume = await api('GET', '/play/world/brume', null, player);
  assert.equal(brume.status, 200);
  assert.equal(brume.data.quest.id, 'recolte');
  assert.equal(brume.data.quest.kind, 'runs');
  assert.equal(brume.data.done, 1);
  assert.equal(brume.data.tiles, undefined);
  assert.equal((await api('GET', '/play/world/brume', null, { cookies: {} })).status, 401);
});

