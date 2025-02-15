const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier .env
const envPath = path.resolve(process.cwd(), '.env');

// Fonction pour générer une clé secrète sécurisée
function generateSecureJWTSecret() {
    return crypto.randomBytes(64).toString('hex');
}

// Fonction pour vérifier et mettre à jour la clé secrète JWT
function ensureJWTSecret() {
    // Lire le contenu actuel du .env
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Vérifier si une clé JWT existe déjà
    const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
    
    if (!jwtSecretMatch || jwtSecretMatch[1].length < 64) {
        // Générer une nouvelle clé sécurisée
        const newSecret = generateSecureJWTSecret();
        
        // Remplacer ou ajouter la clé JWT
        if (jwtSecretMatch) {
            envContent = envContent.replace(
                /JWT_SECRET=.+/,
                `JWT_SECRET=${newSecret}`
            );
        } else {
            envContent += `\nJWT_SECRET=${newSecret}\n`;
        }
        
        // Écrire la mise à jour dans le fichier .env
        fs.writeFileSync(envPath, envContent);
        
        console.log('Nouvelle clé JWT sécurisée générée et sauvegardée');
    }
}

// Exporter les fonctions utiles
module.exports = {
    generateSecureJWTSecret,
    ensureJWTSecret
};