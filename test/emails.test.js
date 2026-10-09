// Adresses e-mail à l'inscription et à la connexion (lot R3) : une adresse ne vaut qu'une fois, majuscules comprises,
// comme au changement d'adresse, au mot de passe oublié et à la signature ; une entrée invalide répond 400, jamais 500.
// (La connexion est limitée à 10 essais par adresse IP et par serveur : ce fichier en fait 7.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, whileHeld, randomPassword } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

let counter = 0;
const uniqueMail = prefix => `${prefix}-${process.pid}-${Date.now()}-${counter++}@exemple.fr`;
const register = (email, password) => api('POST', '/auth/register', { email, password }, { cookies: {} });
const loginAs = (email, password) => api('POST', '/auth/login', { email, password }, { cookies: {} });

test('une adresse ne s’inscrit qu’une fois, majuscules comprises ; la connexion ignore les majuscules', async () => {
  const email = uniqueMail('Casse');
  const password = randomPassword();
  const first = await register(email, password);
  assert.equal(first.status, 201);
  const again = await register(email.toLowerCase(), randomPassword());
  assert.deepEqual([again.status, again.data.message], [400, 'Email ou username déjà utilisé']);
  for (const typed of [email, email.toLowerCase(), email.toUpperCase()]) {
    const res = await loginAs(typed, password);
    assert.deepEqual([res.status, res.data.userId], [200, first.data.userId], typed);
  }
  assert.equal((await loginAs(email.toUpperCase(), 'mauvais-mot-de-passe')).status, 401);
});

test('adresse invalide à l’inscription ou à la connexion : 400, jamais 500', async () => {
  const password = randomPassword();
  const tooLong = `${'a'.repeat(251)}@x.fr`;
  assert.equal(tooLong.length, 256);
  for (const email of [tooLong, ['a@b.fr'], { a: 1 }, 42, 'pas-une-adresse', `naufrage-${Date.now()}@provisoire.invalid`]) {
    const res = await register(email, password);
    assert.equal(res.status, 400, JSON.stringify(email).slice(0, 40));
  }
  // 255 caractères : la limite de la colonne, acceptée
  const longest = `${`${process.pid}-${Date.now()}`.padEnd(250, 'a')}@x.fr`;
  assert.equal(longest.length, 255);
  assert.equal((await register(longest, password)).status, 201);
  for (const email of [['a@b.fr'], { a: 1 }, 42]) assert.equal((await loginAs(email, password)).status, 400, JSON.stringify(email));
});

test('deux inscriptions simultanées avec la même adresse : la seconde reçoit 400, pas une erreur serveur', async () => {
  const email = uniqueMail('course');
  // Une inscription en cours (non validée) tient l'adresse ; la seconde passe la vérification, puis bute sur l'unicité
  const res = await whileHeld(
    tx => tx.query('INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3)', [email, 'x', `course_${process.pid}_${Date.now()}`]),
    () => register(email, randomPassword())
  );
  assert.deepEqual([res.status, res.data.message], [400, 'Email ou username déjà utilisé']);
});
