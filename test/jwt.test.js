// Secret JWT au démarrage (utils/jwt.js) : celui de l'environnement, sinon celui du .env, sinon un nouveau, écrit dans
// le .env ET mis dans process.env pour le processus en cours (avant, il ne servait qu'au redémarrage suivant)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureJWTSecret, MIN_LENGTH } = require('../src/utils/jwt');

// Chaque test part d'un dossier neuf et d'un process.env sans secret ; l'état d'origine est rendu à la fin
const original = process.env.JWT_SECRET;
let dir;
test.beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwt-test-'));
  delete process.env.JWT_SECRET;
});
test.afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  if (original === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = original;
});
const envFile = content => {
  const file = path.join(dir, '.env');
  if (content !== undefined) fs.writeFileSync(file, content);
  return file;
};
const savedSecret = file => fs.readFileSync(file, 'utf8').match(/^JWT_SECRET=(.*)$/m)?.[1];

test('le secret de l\'environnement suffit : le .env n\'est ni lu ni créé', () => {
  process.env.JWT_SECRET = 'e'.repeat(MIN_LENGTH);
  const file = envFile();
  ensureJWTSecret(file);
  assert.equal(process.env.JWT_SECRET, 'e'.repeat(MIN_LENGTH));
  assert.equal(fs.existsSync(file), false);
});

test('sans secret ni .env : le démarrage échoue clairement', () => {
  assert.throws(() => ensureJWTSecret(envFile()), /JWT_SECRET manquant ou trop court \(32 caractères minimum\)/);
});

test('.env sans secret : un secret est ajouté au fichier et utilisé tout de suite, le reste du fichier intact', () => {
  const file = envFile('PORT=3000\nDB_NAME=origins');
  ensureJWTSecret(file);
  const written = savedSecret(file);
  assert.match(written, /^[0-9a-f]{128}$/);
  assert.equal(process.env.JWT_SECRET, written);
  assert.equal(fs.readFileSync(file, 'utf8'), `PORT=3000\nDB_NAME=origins\nJWT_SECRET=${written}\n`);
});

test('.env avec un secret trop court : il est remplacé, en place, et utilisé tout de suite', () => {
  const file = envFile('A=1\nJWT_SECRET=court\nB=2\n');
  ensureJWTSecret(file);
  const written = savedSecret(file);
  assert.match(written, /^[0-9a-f]{128}$/);
  assert.equal(process.env.JWT_SECRET, written);
  assert.equal(fs.readFileSync(file, 'utf8'), `A=1\nJWT_SECRET=${written}\nB=2\n`);
});

test('.env avec un secret valable (32 caractères, entre guillemets) : il est repris tel quel, sans réécriture', () => {
  const secret = 's'.repeat(MIN_LENGTH);
  const content = `JWT_SECRET="${secret}"\n`;
  const file = envFile(content);
  process.env.JWT_SECRET = 'trop-court';
  ensureJWTSecret(file);
  assert.equal(process.env.JWT_SECRET, secret);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
});

test('une autre variable qui finit par JWT_SECRET n\'est pas prise pour le secret', () => {
  const file = envFile(`OLD_JWT_SECRET=${'o'.repeat(64)}\n`);
  ensureJWTSecret(file);
  const written = savedSecret(file);
  assert.match(written, /^[0-9a-f]{128}$/);
  assert.equal(process.env.JWT_SECRET, written);
  assert.ok(fs.readFileSync(file, 'utf8').startsWith(`OLD_JWT_SECRET=${'o'.repeat(64)}\n`));
});

test('un secret généré reste stable : un second appel ne le change pas', () => {
  const file = envFile('');
  ensureJWTSecret(file);
  const first = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  ensureJWTSecret(file);
  assert.equal(process.env.JWT_SECRET, first);
  assert.equal(fs.readFileSync(file, 'utf8'), `JWT_SECRET=${first}\n`);
});
