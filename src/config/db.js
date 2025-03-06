// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Configuration du niveau de log
const LOG_LEVEL = process.env.DB_LOG_LEVEL || 'INFO'; // Valeurs possibles: 'ERROR', 'INFO', 'DEBUG'

// Affichage des infos de connexion uniquement au démarrage
console.log('Configuration de la base de données :');
console.log('Utilisateur :', process.env.DB_USER);
console.log('Hôte :', process.env.DB_HOST);
console.log('Port :', process.env.DB_PORT);
console.log('Base de données :', process.env.DB_NAME);

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// Log des erreurs de connexion
pool.on('error', (err, client) => {
    console.error('Erreur inattendue sur le client PostgreSQL', err);
});

module.exports = {
    query: async (text, params) => {
        // En mode DEBUG, on log les détails de la requête
        if (LOG_LEVEL === 'DEBUG') {
            console.log('Requête SQL :', text);
            if (params) console.log('Paramètres :', params);
        } else if (LOG_LEVEL === 'INFO') {
            // En mode INFO, on log juste la première partie de la requête pour identifier son type
            const queryType = text.trim().split(' ')[0];
            console.log(`Exécution ${queryType}${params ? ` avec ${params.length} paramètres` : ''}`);
        }
        
        try {
            const start = Date.now();
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            
            // En mode INFO ou DEBUG, on log des informations sur le résultat
            if (LOG_LEVEL === 'INFO' || LOG_LEVEL === 'DEBUG') {
                console.log(`Requête exécutée en ${duration}ms, ${result.rowCount} lignes affectées`);
            }
            
            // En mode DEBUG seulement, on log les résultats
            if (LOG_LEVEL === 'DEBUG') {
                if (result.rows && result.rows.length <= 5) {
                    // Limiter l'affichage pour éviter de surcharger la console
                    console.log('Résultat de la requête :', result.rows);
                } else if (result.rows) {
                    console.log(`Résultat: ${result.rows.length} lignes retournées (détails omis)`);
                }
            }
            
            return result;
        } catch (error) {
            // On log toujours les erreurs, quel que soit le niveau de log
            console.error('Erreur lors de l\'exécution de la requête :', error.message);
            
            // Plus de détails en mode DEBUG
            if (LOG_LEVEL === 'DEBUG') {
                console.error('Requête en échec :', text);
                console.error('Paramètres :', params);
                console.error('Détails de l\'erreur :', error);
            }
            
            throw error;
        }
    },
    // Ajout du pool pour permettre l'utilisation des transactions
    pool: pool
};