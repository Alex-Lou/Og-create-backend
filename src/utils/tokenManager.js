const jwt = require('jsonwebtoken');

// Générer un nouveau token d'accès
function generateAccessToken(userData) {
  return jwt.sign(userData, process.env.JWT_SECRET, {
    expiresIn: '24h' // Durée de validité du token
  });
}

// Vérifier un token et retourner les données décodées ou null si invalide
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateAccessToken,
  verifyToken
};