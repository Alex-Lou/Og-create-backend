// Démarre le vrai serveur sur une base de test et fournit de quoi l'interroger.
// Variables attendues : DATABASE_URL (ou DB_*), JWT_SECRET ; la base doit avoir reçu `npm run db:setup`.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { Client } = require('pg');
const crypto = require('node:crypto');

// Mots de passe de test tirés au hasard à chaque exécution : aucun secret écrit en dur dans le dépôt
const randomPassword = () => crypto.randomBytes(18).toString('base64url');

// Un port par fichier de tests (node --test lance les fichiers en parallèle, chacun dans son processus) : un port libre
// demandé au système au démarrage du serveur (TEST_PORT l'impose). Un port tiré du numéro de processus pouvait être
// celui d'un autre fichier, ou d'un serveur d'une exécution précédente pas encore éteint
let BASE = null;
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const port = process.env.TEST_PORT || await freePort();
  BASE = `http://127.0.0.1:${port}/api`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      // Fenêtre de tolérance des rafraîchissements concurrents à 0 : la réutilisation d'un jeton se teste sans attendre
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'error', AUTH_RACE_SECONDS: '0', REGISTER_RATE_LIMIT: '200' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Le serveur ne démarre pas\n${output}`)), 20000);
    child.stderr.on('data', chunk => (output += chunk));
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('Tout roule')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('exit', code => reject(new Error(`Serveur arrêté (code ${code})\n${output.slice(-2000)}`)));
  });
}

// Un joueur = une boîte à cookies (la session vit dans des cookies httpOnly, jamais dans le corps)
async function api(method, route, body, player, { csrf = true, headers = {} } = {}) {
  const cookie = player?.cookies ? Object.entries(player.cookies).map(([k, v]) => `${k}=${v}`).join('; ') : '';
  const response = await fetch(BASE + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-Requested-With': 'origins' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookies = response.headers.getSetCookie?.() || [];
  if (player) {
    player.cookies = player.cookies || {};
    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const expired = !value || attributes.some(a => /max-age=0\b/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (expired) delete player.cookies[name.trim()];
      else player.cookies[name.trim()] = value;
    }
  }
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, setCookies };
}

// Accès direct à la base, pour préparer un état (jamais pour vérifier à la place de l'API)
async function sql(query, params) {
  const client = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME
  });
  await client.connect();
  try {
    return (await client.query(query, params)).rows;
  } finally {
    await client.end();
  }
}

let counter = 0;
// Compte de test. veteran : créé avant la bible (players.VETERAN_BEFORE : les anciennes règles lui restent dues) ;
// sinon créé après. La date est fixée ici, pour que les tests ne dépendent pas de l'horloge.
async function newPlayer({ coins = 0, veteran = true } = {}) {
  const email = `test-${process.pid}-${Date.now()}-${counter++}@exemple.fr`;
  const player = { email, password: randomPassword(), cookies: {} };
  const { data } = await api('POST', '/auth/register', { email, password: player.password }, player);
  player.userId = data.userId;
  await sql('UPDATE users SET created_at = $2 WHERE id = $1', [player.userId, veteran ? '2026-01-01T00:00:00Z' : '2030-01-01T00:00:00Z']);
  await api('POST', '/progress/save', { discoveredElements: ['Eau', 'Feu', 'Terre', 'Air'], discoveredCategories: [] }, player);
  if (coins) await sql('UPDATE progress SET coins = $1 WHERE user_id = $2', [coins, player.userId]);
  return player;
}

async function coinsOf(player) {
  return (await api('GET', '/coins/balance', null, player)).data.coins;
}

module.exports = { startServer, api, sql, newPlayer, coinsOf, randomPassword };
