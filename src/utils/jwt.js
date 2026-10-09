const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Longueur minimale du secret, quelle que soit sa source (environnement ou .env) : 32 caractères.
// Le generateValue de Render (256 bits en base64) en fait ~44 ; un secret généré ici en fait 128.
const MIN_LENGTH = 32;
// La ligne JWT_SECRET du .env, en début de ligne (pas OLD_JWT_SECRET=…)
const SECRET_LINE = /^JWT_SECRET=(.*)$/m;

const isValid = secret => typeof secret === 'string' && secret.length >= MIN_LENGTH;
// Valeur d'une ligne du .env, lue comme dotenv : espaces et guillemets autour retirés
const unquote = value => value.trim().replace(/^(['"`])(.*)\1$/, '$2');

// Fonction pour générer une clé secrète sécurisée
function generateSecureJWTSecret() {
    return crypto.randomBytes(64).toString('hex');
}

// Garantit un secret JWT valable dans process.env avant le démarrage du serveur.
// - Fourni par l'environnement (Render, OVH, CI…) : rien à faire.
// - Sinon, un .env est requis (local) : son secret est repris s'il est valable, sinon un nouveau y est écrit.
//   Dans les deux cas, process.env.JWT_SECRET est renseigné tout de suite : le processus en cours s'en sert.
//   (Un secret valable du .env n'est absent de process.env que si l'environnement en impose un trop court, que dotenv
//   ne remplace pas : celui du .env l'emporte alors.)
function ensureJWTSecret(envPath = path.resolve(process.cwd(), '.env')) {
    if (isValid(process.env.JWT_SECRET)) return;

    // Sans .env (hébergeur), impossible de générer et persister un secret : échouer clairement
    if (!fs.existsSync(envPath)) {
        throw new Error(`JWT_SECRET manquant ou trop court (${MIN_LENGTH} caractères minimum)`);
    }

    let envContent = fs.readFileSync(envPath, 'utf8');
    const current = envContent.match(SECRET_LINE);
    const saved = current ? unquote(current[1]) : null;
    if (isValid(saved)) {
        process.env.JWT_SECRET = saved;
        return;
    }

    const newSecret = generateSecureJWTSecret();
    envContent = current
        ? envContent.replace(SECRET_LINE, `JWT_SECRET=${newSecret}`)
        : `${envContent}${envContent && !envContent.endsWith('\n') ? '\n' : ''}JWT_SECRET=${newSecret}\n`;
    fs.writeFileSync(envPath, envContent);
    process.env.JWT_SECRET = newSecret;

    console.log('Nouvelle clé JWT sécurisée générée et sauvegardée');
}

module.exports = { ensureJWTSecret, MIN_LENGTH };
