// Journal à niveaux (debug < info < warn < error), réglé par LOG_LEVEL (warn par défaut)
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.warn;

function log(level, message, data) {
    if (LEVELS[level] < threshold) return;
    if (data === undefined) console[level](`[${level.toUpperCase()}] ${message}`);
    else console[level](`[${level.toUpperCase()}] ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
}

module.exports = { log };
