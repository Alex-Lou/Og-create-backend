// db/setup.js — applique le schéma puis le contenu du jeu (seed) sur la base.
// Idempotent : tables en IF NOT EXISTS, contenu en upsert. Ne touche ni aux comptes ni à la progression.
// Usage : DATABASE_URL=... npm run db:setup   (lancé aussi par Render à chaque déploiement)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const FILES = ['schema.sql', 'seed.sql'];

function connectionConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
  };
}

async function main() {
  const client = new Client(connectionConfig());
  await client.connect();
  try {
    for (const file of FILES) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      // Requête simple (sans paramètres) : plusieurs instructions dans un seul appel
      await client.query(sql);
      console.log(`db:setup — ${file} appliqué`);
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('db:setup — échec :', error.message);
  process.exit(1);
});
