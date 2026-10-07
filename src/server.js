// Démarrage : variables d'environnement, secret JWT, puis écoute du port.
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Avant tout require qui journalise : le niveau est lu au chargement de utils/logger.js
process.env.LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

require('./utils/jwt').ensureJWTSecret();
const app = require('./app');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`
    🚀 Serveur démarré
    • Port: ${PORT}
    • Environnement: ${process.env.NODE_ENV}
    • Niveau de log: ${process.env.LOG_LEVEL}
    • Heure: ${new Date().toLocaleString()}
    `);
    // Les tests attendent cette ligne pour savoir que le serveur écoute (test/helpers.js)
    console.log('Tout roule! :)');
});

// Les comptes dont les sept jours de grâce sont passés s'effacent : au démarrage, puis toutes les heures
const { sweepDeleted } = require('./services/accountSettings');
const sweep = () => sweepDeleted().catch(error => console.error('Effacement des comptes supprimés :', error.message));
sweep();
setInterval(sweep, 3600 * 1000).unref();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});
