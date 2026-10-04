// Accès PostgreSQL : requêtes simples (query) et transactions (transaction).
const { Pool } = require('pg');
require('dotenv').config();

// Journal des requêtes : ERROR par défaut (seules les erreurs), INFO ou DEBUG à la demande
const LOG_LEVEL = process.env.DB_LOG_LEVEL || 'ERROR';

// DATABASE_URL (Neon, Render...) prioritaire ; sinon variables DB_* séparées (local).
// Le SSL est piloté par l'URL (ex. ?sslmode=require).
const pool = new Pool(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
    });

pool.on('error', error => {
    console.error('Erreur inattendue sur le client PostgreSQL', error);
});

async function query(text, params) {
    if (LOG_LEVEL === 'DEBUG') console.log('Requête SQL :', text, params || '');
    else if (LOG_LEVEL === 'INFO') console.log(`Exécution ${text.trim().split(' ')[0]}${params ? ` avec ${params.length} paramètres` : ''}`);
    try {
        const start = Date.now();
        const result = await pool.query(text, params);
        if (LOG_LEVEL !== 'ERROR') console.log(`Requête exécutée en ${Date.now() - start}ms, ${result.rowCount} lignes affectées`);
        return result;
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la requête :', error.message);
        if (LOG_LEVEL === 'DEBUG') console.error('Requête en échec :', text, params);
        throw error;
    }
}

// Refus au milieu d'une transaction : la transaction est annulée et la valeur renvoyée telle quelle
class Rollback {
    constructor(value) {
        this.value = value;
    }
}
const rollback = value => new Rollback(value);

// Exécute fn(conn) dans une transaction : COMMIT à la fin, ROLLBACK sur erreur ou sur `return rollback(valeur)`
async function transaction(fn) {
    const conn = await pool.connect();
    try {
        await conn.query('BEGIN');
        const result = await fn(conn);
        if (result instanceof Rollback) {
            await conn.query('ROLLBACK');
            return result.value;
        }
        await conn.query('COMMIT');
        return result;
    } catch (error) {
        await conn.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { query, transaction, rollback, pool };
