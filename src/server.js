// Démarrage : variables d'environnement, secret JWT, puis écoute du port.
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Avant tout require qui journalise : le niveau est lu au chargement de utils/logger.js
process.env.LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

const { log } = require('./utils/logger');
require('./utils/jwt').ensureJWTSecret();
const app = require('./app');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    log('info', `Serveur prêt sur le port ${PORT} (${process.env.NODE_ENV || 'development'}, journal : ${process.env.LOG_LEVEL})`);
});

// Les comptes dont les sept jours de grâce sont passés s'effacent : au démarrage, puis toutes les heures
const { sweepDeleted } = require('./services/accountSettings');
const sweep = () => sweepDeleted().catch(error => log('error', 'Effacement des comptes supprimés', error.stack));
sweep();
setInterval(sweep, 3600 * 1000).unref();

// Une erreur que rien n'a attrapée : journalisée avec sa pile, puis le serveur s'arrête (l'hébergeur le relance)
process.on('unhandledRejection', reason => {
    log('error', 'Promesse rejetée sans traitement', reason instanceof Error ? reason.stack : reason);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', error => {
    log('error', 'Exception non attrapée', error.stack);
    server.close(() => process.exit(1));
});
