// Jetons opaques (session, invité, mot de passe oublié) : 32 octets aléatoires en hexadécimal,
// dont seule l'empreinte SHA-256 est gardée en base
const crypto = require('crypto');

const newToken = () => crypto.randomBytes(32).toString('hex');
const isToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const digest = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { newToken, isToken, digest };
