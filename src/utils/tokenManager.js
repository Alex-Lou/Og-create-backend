const jwt = require('jsonwebtoken');

// Générer un nouveau token d'accès
function generateAccessToken(userData) {
  return jwt.sign(userData, process.env.JWT_SECRET, {
    expiresIn: '1h' // Durée réduite à 1 heure au lieu de 24h
  });
}

// Générer un token de rafraîchissement
function generateRefreshToken(userData) {
  return jwt.sign(
    { userId: userData.userId }, // Données minimales pour le refresh token
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' } // Durée plus longue pour le refresh token
  );
}

// Vérifier un token et retourner les données décodées ou null si invalide
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Vérifier un token de rafraîchissement
function verifyRefreshToken(token) {
  try {
    return jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};