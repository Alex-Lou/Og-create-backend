// Démarre le vrai serveur sur une base de test et fournit de quoi l'interroger.
// Variables attendues : DATABASE_URL (ou DB_*), JWT_SECRET, JWT_REFRESH_SECRET ; la base doit avoir reçu `npm run db:setup`.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const crypto = require('node:crypto');

// Mots de passe de test tirés au hasard à chaque exécution : aucun secret écrit en dur dans le dépôt
const randomPassword = () => crypto.randomBytes(18).toString('base64url');

// Un port par fichier de tests (node --test lance les fichiers en parallèle, chacun dans son processus)
const PORT = process.env.TEST_PORT || 3900 + (process.pid % 90);
const BASE = `http://127.0.0.1:${PORT}/api`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      // Fenêtre de tolérance des rafraîchissements concurrents à 0 : la réutilisation d'un jeton se teste sans attendre
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', LOG_LEVEL: 'error', AUTH_RACE_SECONDS: '0', REGISTER_RATE_LIMIT: '200' },
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
async function newPlayer({ coins = 0 } = {}) {
  const email = `test-${process.pid}-${Date.now()}-${counter++}@exemple.fr`;
  const player = { email, password: randomPassword(), cookies: {} };
  const { data } = await api('POST', '/auth/register', { email, password: player.password }, player);
  player.userId = data.userId;
  await api('POST', '/progress/save', { discoveredElements: ['Eau', 'Feu', 'Terre', 'Air'], discoveredCategories: [] }, player);
  if (coins) await sql('UPDATE progress SET coins = $1 WHERE user_id = $2', [coins, player.userId]);
  return player;
}

async function coinsOf(player) {
  return (await api('GET', '/coins/balance', null, player)).data.coins;
}

module.exports = { startServer, api, sql, newPlayer, coinsOf, randomPassword };
