// L'avatar composé sur la carte d'embarquement (bible, § 6.17) : le serveur ne garde que des choix qui existent ; ce
// qui se gagne (accessoires de boutique ou de coffre, teintures rares) ne passe que s'il est possédé
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, newPlayer } = require('./helpers');
const { cleanChoices, DEFAUT, CHOIX, FORMES, NUANCIERS, ACCESSOIRES } = require('../src/services/avatarChoices');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

test('choix : complétés par défaut ; inconnus, mal formés ou pas encore gagnés, refusés', () => {
  const empty = cleanChoices({});
  assert.deepEqual(empty.choices, { ...DEFAUT, accessoires: {} });
  // Chaque choix du catalogue passe, chacun à son tour (la barbe et la moustache, chez l'homme)
  for (const [key, from] of Object.entries(CHOIX)) {
    for (const value of from === 'formes' ? FORMES[key] : NUANCIERS[from]) {
      const extra = (key === 'barbe' || key === 'moustache') ? { genre: 'homme' } : {};
      assert.equal(cleanChoices({ ...extra, [key]: value }).choices[key], value, `${key} = ${value}`);
    }
  }
  // La barbe et la moustache ne vont qu'à l'homme : chez la femme, elles s'effacent
  const femme = cleanChoices({ genre: 'femme', barbe: 'pleine', moustache: 'epaisse' }).choices;
  assert.deepEqual([femme.barbe, femme.moustache], ['sans', 'sans']);
  const homme = cleanChoices({ genre: 'homme', barbe: 'pleine', moustache: 'epaisse' }).choices;
  assert.deepEqual([homme.barbe, homme.moustache], ['pleine', 'epaisse']);
  const refused = [
    null, 'avatar-01', [], { taille: 'immense' }, { peau: 'vert' }, { pouvoir: 'voler' }, { taille: ['petite'] },
    { couleurHaut: 'or' }, // une teinture rare, pas gagnée
    { accessoires: [] }, { accessoires: { tete: 'bonnet' } }, { accessoires: { tete: { id: 'couronne' } } },
    { accessoires: { cou: { id: 'bonnet' } } }, // pas à sa place
    { accessoires: { tete: { id: 'diademe' } } }, // un objet de coffre, pas gagné
    { accessoires: { tete: { id: 'bonnet', couleurs: ['rouge', 'creme', 'noir'] } } },
    { accessoires: { tete: { id: 'bonnet', couleurs: ['or'] } } },
    { accessoires: { visage: { id: 'lunettesRondes', couleurs: ['rouge'] } } }, // un tissu sur une monture
    JSON.parse('{"__proto__": {"taille": "petite"}}')
  ];
  for (const raw of refused) assert.equal(cleanChoices(raw).status, 400, JSON.stringify(raw));
  // Un accessoire gratuit : ses couleurs par défaut complètent celles qui manquent ; null ôte l'emplacement
  const worn = cleanChoices({ accessoires: { tete: { id: 'bonnet', couleurs: ['rouge'] }, cou: null } }).choices.accessoires;
  assert.deepEqual(worn, { tete: { id: 'bonnet', couleurs: ['rouge', 'creme'] } });
  // Ce qui est gagné passe
  const owned = new Set(['tenue:diademe', 'teinture:or']);
  const rich = cleanChoices({ cheveux: 'or', accessoires: { tete: { id: 'diademe' } } }, owned).choices;
  assert.deepEqual([rich.cheveux, rich.accessoires.tete], ['or', { id: 'diademe', couleurs: ['or'] }]);
  // Les teintures ne vont qu'aux tissus et aux cheveux
  assert.equal(cleanChoices({ yeux: 'or' }, owned).choices.yeux, 'or'); // l'or des yeux est un nuancier libre
  assert.equal(cleanChoices({ peau: 'opale' }, new Set(['teinture:opale'])).status, 400);
  // Tous les accessoires gratuits passent, à leur place
  for (const [id, [place, , , free]] of Object.entries(ACCESSOIRES)) {
    assert.equal(cleanChoices({ accessoires: { [place]: { id } } }).status, free ? undefined : 400, id);
  }
});

test('avatar composé : gardé par le serveur, rendu par l’île et le compte ; un exemple le remplace', async () => {
  const player = await newPlayer();
  const choices = { coupe: 'couettes', cheveux: 'roux', rousseur: 'oui', accessoires: { cou: { id: 'foulard', couleurs: ['lagon'] } } };
  assert.equal((await api('POST', '/play/world/avatar', { choices }, { cookies: {} })).status, 401);
  assert.equal((await api('POST', '/play/world/avatar', { choices: { accessoires: { dos: { id: 'ailes' } } } }, player)).status, 400);
  const done = await api('POST', '/play/world/avatar', { choices }, player);
  assert.equal(done.status, 200);
  assert.deepEqual(done.data.avatar, { ...DEFAUT, coupe: 'couettes', cheveux: 'roux', rousseur: 'oui', accessoires: { cou: { id: 'foulard', couleurs: ['lagon'] } } });
  assert.deepEqual((await api('GET', '/play/world', null, player)).data.avatar, done.data.avatar);
  assert.deepEqual((await api('GET', '/account', null, player)).data.look, done.data.avatar);
  const [row] = await sql('SELECT look FROM world_avatars WHERE user_id = $1', [player.userId]);
  assert.equal(row.look, 'perso');
  // Un objet gagné (ligne de world_items) se porte
  await sql(`INSERT INTO world_items (user_id, item) VALUES ($1, 'tenue:ailes')`, [player.userId]);
  const winged = await api('POST', '/play/world/avatar', { choices: { accessoires: { dos: { id: 'ailes' } } } }, player);
  assert.deepEqual(winged.data.avatar.accessoires.dos, { id: 'ailes', couleurs: ['lavande'] });
  // Un exemple de la bibliothèque remplace l'avatar composé
  assert.equal((await api('POST', '/play/world/avatar', { look: 'avatar-04' }, player)).data.avatar, 'avatar-04');
  assert.equal((await api('GET', '/play/world', null, player)).data.avatar, 'avatar-04');
});
