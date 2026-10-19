// Accès PostgreSQL : requêtes simples (query) et transactions (transaction).
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
require('dotenv').config();
const { log } = require('../utils/logger');

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
    log('error', 'Client PostgreSQL', error.stack);
});

// Lectures mémorisées le temps d'un calcul (cached(fn), la vue de l'île) : une même lecture (SELECT, ni FOR UPDATE ni
// FOR SHARE, mêmes paramètres) n'est envoyée qu'une fois ; toute écriture vide la mémoire. La base est distante (Neon) :
// chaque requête coûte un aller-retour. Les transactions (conn.query) n'y passent jamais
const reads = new AsyncLocalStorage();
const READ = /^\s*SELECT\b/i;
const LOCK = /\bFOR\s+(UPDATE|SHARE)\b/i;
function cached(fn) {
    return reads.run(new Map(), fn);
}

async function query(text, params) {
    const memo = reads.getStore();
    if (memo) {
        if (!READ.test(text) || LOCK.test(text)) memo.clear();
        else {
            const key = `${text}\u0000${JSON.stringify(params || [])}`;
            if (!memo.has(key)) memo.set(key, run(text, params).catch(error => { memo.delete(key); throw error; }));
            const result = await memo.get(key);
            // (une copie : celui qui lit peut trier ou modifier ses lignes)
            return { ...result, rows: structuredClone(result.rows) };
        }
    }
    return run(text, params);
}

// Chaque requête, en debug seulement (LOG_LEVEL=debug), sans ses paramètres (e-mails, empreintes de mots de passe…).
// Une requête en échec remonte telle quelle : celui qui l'attrape la journalise, une seule fois
async function run(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        log('debug', `SQL ${Date.now() - start} ms, ${result.rowCount} lignes`, text.trim());
        return result;
    } catch (error) {
        log('debug', `SQL en échec après ${Date.now() - start} ms`, text.trim());
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

module.exports = { query, cached, transaction, rollback, pool };
