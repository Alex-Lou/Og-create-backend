const { Pool } = require('pg');
require('dotenv').config();

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
        console.log('Requête SQL :', text);
        console.log('Paramètres :', params);
        
        try {
            const result = await pool.query(text, params);
            console.log('Résultat de la requête :', result.rows);
            return result;
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la requête :', error);
            throw error;
        }
    },
};