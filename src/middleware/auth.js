const jwt = require('jsonwebtoken');

// Configuration des niveaux de log
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Niveau de log par défaut, peut être remplacé par une variable d'environnement
const logLevel = process.env.LOG_LEVEL || 'warn';

/**
 * Fonction de logging avec niveau
 * @param {string} level - Niveau de log (debug, info, warn, error)
 * @param {string} message - Message à logger
 * @param {any} data - Données additionnelles (optionnel)
 */
function log(level, message, data) {
    // Ne logger que si le niveau est supérieur ou égal au niveau configuré
    if (LOG_LEVELS[level] >= LOG_LEVELS[logLevel]) {
        if (data !== undefined) {
            console[level](`[${level.toUpperCase()}] ${message}`, 
                typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
        } else {
            console[level](`[${level.toUpperCase()}] ${message}`);
        }
    }
}

/**
 * Middleware d'authentification
 */
const authMiddleware = (req, res, next) => {
    log('debug', 'Authentification en cours');
    
    try {
        // Vérifier si le header Authorization existe et a le bon format
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Vérifier si c'est une requête après déconnexion
            const isAfterLogout = req.originalUrl.includes('/api/game-data') || 
                                 req.originalUrl.includes('/api/progress');
            
            if (isAfterLogout) {
                log('debug', 'Requête sans authentification après déconnexion');
            } else {
                log('warn', 'Format du token incorrect');
            }
            
            return res.status(401).json({ 
                message: 'Format du token incorrect. Utilisez "Bearer [token]"' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Vérifier si le token est présent
        if (!token) {
            log('warn', 'Aucun token fourni');
            return res.status(401).json({ message: 'Aucun token fourni' });
        }
        
        // Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            maxAge: '1h' // Réduit à 1 heure en correspondance avec generateAccessToken
        });
        
        log('debug', 'Token validé', { userId: decoded.userId });
        
        // Ajouter les informations de l'utilisateur à la requête
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            username: decoded.username
        };
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            log('warn', 'Token expiré');
            return res.status(401).json({
                message: 'Le token a expiré. Veuillez vous reconnecter.',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            log('warn', 'Token invalide', { error: error.message });
            return res.status(401).json({
                message: 'Token invalide. Authentification échouée.',
                code: 'INVALID_TOKEN'
            });
        }
        
        log('error', 'Erreur interne d\'authentification', { error: error.message });
        return res.status(500).json({
            message: 'Erreur interne lors de l\'authentification'
        });
    }
};

module.exports = authMiddleware;