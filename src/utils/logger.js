// logger.js
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  // Vous pouvez configurer le niveau de log via une variable d'environnement
  const logLevel = process.env.LOG_LEVEL || 'warn';
  
  /**
   * Fonction de logging.
   * @param {string} level - Niveau de log (debug, info, warn, error)
   * @param {string} message - Message à logger
   * @param {any} [data] - Données additionnelles (optionnel)
   */
  function log(level, message, data) {
    if (LOG_LEVELS[level] >= LOG_LEVELS[logLevel]) {
      if (data !== undefined) {
        console[level](
          `[${level.toUpperCase()}] ${message}`,
          typeof data === 'object' ? JSON.stringify(data, null, 2) : data
        );
      } else {
        console[level](`[${level.toUpperCase()}] ${message}`);
      }
    }
  }
  
  module.exports = {
    log,
    LOG_LEVELS,
    logLevel
  };
  