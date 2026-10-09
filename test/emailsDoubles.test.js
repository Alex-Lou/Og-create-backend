// Comptes créés avant le lot R3 qui ne diffèrent que par les majuscules de l'adresse : la base peut en contenir (son
// unicité tient compte des majuscules). Chacun doit garder l'accès à son compte.
// (Fichier à part : la connexion est limitée à 10 essais par adresse IP et par serveur ; celui-ci en fait 5.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, sql, randomPassword } = require('./helpers');

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server?.kill());

const register = (email, password) => api('POST', '/auth/register', { email, password }, { cookies: {} });
const who = async (email, password) => {
  const res = await api('POST', '/auth/login', { email, password }, { cookies: {} });
  return res.status === 200 ? res.data.userId : res.status;
};

test('deux comptes qui ne diffèrent que par les majuscules : l’adresse exacte d’abord, sinon chacun est essayé', async () => {
  const lower = `double-${process.pid}-${Date.now()}@exemple.fr`;
  const upper = lower.replace('double', 'DOUBLE');
  const mixed = lower.replace('double', 'Double');
  const a = { password: randomPassword() };
  const b = { password: randomPassword() };
  a.id = (await register(lower, a.password)).data.userId;
  b.id = (await register(`autre-${process.pid}-${Date.now()}@exemple.fr`, b.password)).data.userId;
  // Comme un compte d'avant la règle : la même adresse, à la casse près
  await sql('UPDATE users SET email = $1 WHERE id = $2', [upper, b.id]);

  assert.equal(await who(lower, a.password), a.id);
  assert.equal(await who(upper, b.password), b.id);
  // L'adresse exacte existe : seul son compte est essayé
  assert.equal(await who(lower, b.password), 401);
  // Une autre écriture : chacun des deux comptes est essayé
  assert.equal(await who(mixed, a.password), a.id);
  assert.equal(await who(mixed, b.password), b.id);
});
