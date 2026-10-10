// Démarre le vrai serveur sur une base de test et fournit de quoi l'interroger.
// Variables attendues : DATABASE_URL (ou DB_*), JWT_SECRET ; la base doit avoir reçu `npm run db:setup`.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { Client } = require('pg');
const crypto = require('node:crypto');
const { SHORE_TUTORIAL_MARK } = require('../src/services/quests');

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
      // Fenêtre de tolérance des rafraîchissements concurrents à 0 : la réutilisation d'un jeton se teste sans attendre.
      // Tous les joueurs d'un fichier de tests viennent de la même adresse : sa limite de requêtes de jeu est relevée
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'error', AUTH_RACE_SECONDS: '0', REGISTER_RATE_LIMIT: '200', PLAY_ADDRESS_RATE_LIMIT: '5000' },
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

// Connexion directe à la base de test (à fermer : client.end())
async function connect() {
  const client = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME
  });
  await client.connect();
  return client;
}

// Accès direct à la base, pour préparer un état (jamais pour vérifier à la place de l'API)
async function sql(query, params) {
  const client = await connect();
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
  // Par défaut, un « vétéran » de test a réellement dépassé la première nuit. Le marqueur explicite évite de lui
  // injecter une quête métier et laisse les tests d'anciens comptes incomplets utiliser veteran: false puis antidater.
  if (veteran) await sql(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'tutoriel')`, [player.userId, SHORE_TUTORIAL_MARK]);
  await api('POST', '/progress/save', { discoveredElements: ['Eau', 'Feu', 'Terre', 'Air'], discoveredCategories: [] }, player);
  if (coins) await sql('UPDATE progress SET coins = $1 WHERE user_id = $2', [coins, player.userId]);
  return player;
}

// Course entre deux requêtes, rejouée à coup sûr : `hold` ouvre une transaction et y fait ses écritures (verrous
// tenus) ; `request` part alors ; dès qu'elle attend un verrou de cette transaction, celle-ci est validée. Renvoie la
// réponse de `request`.
async function whileHeld(hold, request) {
  const tx = await connect();
  try {
    await tx.query('BEGIN');
    await hold(tx);
    const pid = (await tx.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    let done = false;
    const pending = request().finally(() => { done = true; });
    for (let i = 0; ; i++) {
      // Dans une transaction, pg_stat_activity est figé à sa première lecture : sans ce rafraîchissement, une connexion
      // ouverte par le serveur après coup (pool froid) n'y apparaît jamais et l'attente n'est pas vue
      await tx.query('SELECT pg_stat_clear_snapshot()');
      if ((await tx.query('SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid])).rows.length) break;
      if (done || i === 200) {
        // Lâcher les verrous avant d'attendre la requête : sinon elle les attendrait, et nous elle (blocage du test)
        await tx.query('ROLLBACK').catch(() => {});
        await pending.catch(() => {});
        throw new Error(done ? 'la requête a fini sans attendre la transaction' : 'la requête n’a jamais attendu la transaction');
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    await tx.query('COMMIT');
    return await pending;
  } finally {
    await tx.end();
  }
}

// Le cœur de l'île à soi (le quartier du Cœur l'est toujours) : les terres alentour s'ouvrent alors aux expéditions
async function ownCore(player) {
  await sql(`INSERT INTO world_zones (user_id, zone) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [player.userId, ['lisiere', 'colline', 'jardins', 'est', 'hauteurs']]);
}

async function coinsOf(player) {
  return (await api('GET', '/coins/balance', null, player)).data.coins;
}

module.exports = { startServer, api, sql, whileHeld, newPlayer, ownCore, coinsOf, randomPassword };
