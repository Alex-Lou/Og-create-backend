// Démarre le vrai serveur sur une base de test et fournit de quoi l'interroger.
// Variables attendues : DATABASE_URL (ou DB_*), JWT_SECRET, JWT_REFRESH_SECRET ; la base doit avoir reçu `npm run db:setup`.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');

const PORT = process.env.TEST_PORT || 3999;
const BASE = `http://127.0.0.1:${PORT}/api`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', LOG_LEVEL: 'error' },
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

async function api(method, route, body, token) {
  const response = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
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
  const { data } = await api('POST', '/auth/register', { email, password: 'motdepasse-solide' });
  await api('POST', '/progress/save', { discoveredElements: ['Eau', 'Feu', 'Terre', 'Air'], discoveredCategories: [] }, data.token);
  if (coins) await sql('UPDATE progress SET coins = $1 WHERE user_id = $2', [coins, data.userId]);
  return { email, token: data.token, refreshToken: data.refreshToken, userId: data.userId };
}

async function coinsOf(player) {
  return (await api('GET', '/coins/balance', null, player.token)).data.coins;
}

module.exports = { startServer, api, sql, newPlayer, coinsOf };
