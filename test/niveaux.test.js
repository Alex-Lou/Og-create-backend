// Les niveaux et les étoiles des jeux à grille (design/conception/minijeux_grille.md, § 2 et § 8) : un objectif par
// niveau, 1 à 3 étoiles selon la marge, un bonus d'écus la première fois seulement (dans le plafond de la partie), une
// étoile ouvre le niveau suivant, 20 étoiles la saison suivante. Mêmes vecteurs que tests/levels.test.js du jeu
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer, coinsOf } = require('./helpers');
const levels = require('../src/services/levels');
const minigames = require('../src/services/minigames');
const harvest = require('../src/services/harvest');

test('les objectifs montent doucement ; les étoiles suivent la marge ; le bonus ne paie que les nouvelles', () => {
  assert.deepEqual([1, 15, 30].map(n => levels.goalOf('recolte', n).need), [30, 59, 90]);
  assert.deepEqual([1, 15, 30].map(n => levels.goalOf('filon', n).need), [2, 4, 7]);
  assert.deepEqual([1, 15, 30].map(n => levels.goalOf('cueillette', n).need), [6, 15, 24]);
  assert.equal(levels.goalOf('filon', 1).text, 'Trouve 2 pierres précieuses');
  // Objectif manqué : 0 ; rempli de justesse : 1 ; un quart de marge : 2 ; la moitié : 3
  assert.deepEqual([null, 15, 12, 11, 8, 7].map(at => levels.starsOf(at, 15)), [0, 1, 1, 2, 2, 3]);
  assert.deepEqual([levels.bonusOf(0, 3), levels.bonusOf(1, 3), levels.bonusOf(2, 1), levels.bonusOf(0, 1)], [20, 15, 0, 5]);
  // Le rejeu dit où l'objectif est rempli : le coup (Récolte, Filon) ou l'instant (Cueillette)
  assert.deepEqual(levels.outcomeOf('recolte', 1, { totals: [6, 18, 31, 40] }, 15), { need: 30, at: 3, stars: 3 });
  assert.deepEqual(levels.outcomeOf('filon', 1, { at: [9, 20] }, 26), { need: 2, at: 20, stars: 1 });
  assert.deepEqual(levels.outcomeOf('cueillette', 1, { at: [1000, 2000] }, 40000), { need: 6, at: null, stars: 0 });
  // Une étoile ouvre le suivant ; la saison 2 attend 20 étoiles de la saison 1
  assert.deepEqual(levels.openOf([]), { seasons: 1, max: 1, stars: 0 });
  assert.deepEqual(levels.openOf([1, 2]), { seasons: 1, max: 3, stars: 3 });
  const tens = Array(10).fill(1);
  assert.deepEqual(levels.openOf(tens), { seasons: 1, max: 10, stars: 10 });
  assert.deepEqual(levels.openOf([...Array(10).fill(2)]), { seasons: 2, max: 11, stars: 20 });
  assert.equal(levels.playable([1], 2), true);
  assert.equal(levels.playable([1], 3), false);
  assert.equal(levels.playable([], 0), false);
});

test('les rejeux disent quand chaque prise arrive (mêmes vecteurs que le jeu)', () => {
  const vein = minigames.veinOf(1234);
  const taps = [];
  for (const i of [2, 8, 14, 20, 26, 32, 38]) for (let k = 0; k < vein.hard[i] && taps.length < minigames.VEIN.strokes; k++) taps.push(i);
  const dug = minigames.replay('filon', 1234, taps);
  assert.equal(dug.at.length, dug.detail.length);
  assert.ok(dug.at.every((s, i) => s >= 1 && s <= taps.length && (i === 0 || s > dug.at[i - 1])));
  const events = minigames.pickingOf(77).filter(e => e.kind !== 'guepes').slice(0, 3);
  const picked = minigames.replay('cueillette', 77, events.map(e => [e.at, e.cell]));
  assert.deepEqual(picked.at, events.map(e => e.at));
  const game = harvest.create(5, harvest.BASE_KINDS);
  assert.ok(game.board);
  assert.deepEqual(harvest.replay(5, harvest.BASE_KINDS, [], 15).totals, []);
  // Les deux premières parties sont courtes : moins de coups, moins de temps
  assert.deepEqual([minigames.limitOf('filon', true), minigames.limitOf('cueillette', true), minigames.limitOf('peche', true), minigames.limitOf('filon')], [12, 20000, 25000, 26]);
  assert.equal(minigames.replay('filon', 1234, Array(13).fill(0), true).ok, false);
  assert.ok(minigames.fishingOf(9, 25000).every(f => f.t0 < 23500));
  assert.ok(minigames.pickingOf(9, 20000).every(e => e.until <= 20000));
  assert.ok(minigames.fishingOf(9).length > minigames.fishingOf(9, 25000).length);
});

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

// Une chaîne de trois tuiles (la première trouvée)
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
// Des coups jusqu'à remplir l'objectif (ou count coups)
function playUntil(run, need, count) {
  const game = harvest.create(run.seed, run.kinds);
  const moves = [];
  let total = 0;
  while (moves.length < count && total < need) {
    const path = firstChain(game.board);
    moves.push(path);
    total += harvest.gainOf(harvest.play(game, path), path.length, run.boosts).amount;
  }
  return moves;
}

test('Récolte : le niveau 1 d’abord ; ses étoiles et leur bonus, une fois ; le suivant s’ouvre ; « Recommencer » efface', async () => {
  const player = await newPlayer();
  // (deux Récoltes déjà jouées : celle-ci a ses 15 coups)
  await sql(`INSERT INTO world_runs (user_id, seed, config, finished_at) VALUES ($1, 1, '{}', NOW()), ($1, 2, '{}', NOW())`, [player.userId]);
  const start = level => api('POST', '/play/world/harvest/start', level ? { level } : {}, player);
  const finish = (run, moves) => api('POST', '/play/world/harvest/finish', { run: run.id, moves }, player);
  const view = (await api('GET', '/play/world', null, player)).data;
  assert.deepEqual(view.stages.recolte, Array(30).fill(0));
  assert.equal((await start(2)).status, 403);
  assert.equal((await start(31)).status, 400);
  const run = (await start()).data;
  assert.deepEqual([run.level, run.goal.need], [1, 30]);
  const moves = playUntil(run, 30, run.maxMoves);
  const done = await finish(run, moves);
  assert.equal(done.status, 200);
  const { stars } = levels.outcomeOf('recolte', 1, harvest.replay(run.seed, run.kinds, moves, run.maxMoves, run.boosts), run.maxMoves);
  assert.ok(stars >= 1);
  assert.deepEqual([done.data.level.stars, done.data.level.best, done.data.level.bonus], [stars, stars, levels.bonusOf(0, stars)]);
  assert.equal(done.data.world.stages.recolte[0], stars);
  assert.equal(await coinsOf(player), done.data.earned + done.data.level.bonus + (done.data.chest?.prize?.kind === 'coins' ? done.data.chest.prize.amount : 0));
  // Rejouer le même niveau sans faire mieux ne paie rien de plus ; le niveau 2 est ouvert, et le niveau par défaut
  const again = (await start(1)).data;
  const twice = await finish(again, []);
  assert.deepEqual([twice.data.level.stars, twice.data.level.best, twice.data.level.bonus], [0, stars, 0]);
  assert.equal((await start()).data.level, 2);
  // « Recommencer l'île » efface les étoiles
  assert.equal((await api('POST', '/play/world/restart', { confirm: 'RECOMMENCER' }, player)).status, 200);
  assert.equal((await api('GET', '/play/world', null, player)).data.stages.recolte[0], 0);
});

test('Filon : le niveau et le palier ensemble ; le bonus dans le plafond de la partie', async () => {
  const player = await newPlayer();
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'carriere', 3)`, [player.userId]);
  const begun = await api('POST', '/play/world/game/start', { game: 'filon' }, player);
  assert.equal(begun.status, 200);
  assert.deepEqual([begun.data.run.level, begun.data.run.stage, begun.data.run.goal.need], [3, 1, 2]);
  assert.equal((await api('POST', '/play/world/game/start', { game: 'filon', level: 5 }, player)).status, 403);
  // Les coups vers les pierres : les blocs à frapper, les plus proches d'abord, jusqu'à deux pierres
  const { seed, id } = begun.data.run;
  const wall = minigames.veinOf(seed);
  const broken = Array(wall.hard.length).fill(false);
  const taps = [];
  let found = 0;
  // (la première partie est courte : ses coups)
  const limit = begun.data.run.limit;
  assert.deepEqual([begun.data.run.short, limit], [true, minigames.SHORT.filon]);
  while (found < 2 && taps.length < limit) {
    const gems = wall.gems.map((g, i) => (g && !broken[i] ? i : -1)).filter(i => i >= 0);
    const near = i => Math.min(...gems.map(j => Math.abs((i % 6) - (j % 6)) + Math.abs(Math.floor(i / 6) - Math.floor(j / 6))));
    const next = wall.hard.map((_, i) => i).filter(i => !broken[i] && minigames.reachable(broken, i)).sort((a, b) => near(a) - near(b))[0];
    for (let k = 0; k < wall.hard[next] && taps.length < limit; k++) taps.push(next);
    broken[next] = true;
    if (wall.gems[next]) found++;
  }
  const done = await api('POST', '/play/world/game/finish', { run: id, input: taps }, player);
  assert.equal(done.status, 200);
  const played = minigames.replay('filon', seed, taps, true);
  const want = levels.outcomeOf('filon', 1, played, limit).stars;
  assert.equal(done.data.level.stars, want);
  const room = minigames.CAP - done.data.earned;
  assert.equal(done.data.level.bonus, Math.min(levels.bonusOf(0, want), room));
  assert.ok(done.data.earned + done.data.level.bonus <= minigames.CAP);
  assert.equal(await coinsOf(player), done.data.earned + done.data.level.bonus);
  // Les deux premières parties sont courtes, la troisième normale ; trop de coups pour une partie courte : refusée
  const second = await api('POST', '/play/world/game/start', { game: 'filon' }, player);
  assert.deepEqual([second.data.run.short, second.data.run.limit], [true, 12]);
  const tooMany = Array.from({ length: 13 }, () => 0);
  assert.equal((await api('POST', '/play/world/game/finish', { run: second.data.run.id, input: tooMany }, player)).status, 400);
  await sql('UPDATE world_games SET plays = 3 WHERE user_id = $1', [player.userId]);
  const third = await api('POST', '/play/world/game/start', { game: 'filon' }, player);
  assert.deepEqual([third.data.run.short, third.data.run.limit], [false, minigames.VEIN.strokes]);
  // La Pêche n'a pas de niveaux
  await sql(`INSERT INTO world_buildings (user_id, site, level) VALUES ($1, 'ponton', 3)`, [player.userId]);
  const fishing = await api('POST', '/play/world/game/start', { game: 'peche' }, player);
  assert.deepEqual([fishing.data.run.level, fishing.data.run.stage], [3, undefined]);
});
