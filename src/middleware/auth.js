const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    console.log('Début du middleware d\'authentification');
    console.log('En-têtes de la requête :', req.headers);

    try {
        // Vérifier si le header Authorization existe et a le bon format
        const authHeader = req.headers.authorization;
        console.log('Header Authorization :', authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Format du token incorrect');
            return res.status(401).json({ 
                message: 'Format du token incorrect. Utilisez "Bearer [token]"' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        console.log('Token extrait :', token);
        
        // Vérifier si le token est présent
        if (!token) {
            console.log('Aucun token fourni');
            return res.status(401).json({ message: 'Aucun token fourni' });
        }
        
        // Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            maxAge: '1h' // Réduit à 1 heure en correspondance avec generateAccessToken
        });
        
        console.log('Token décodé :', decoded);
        
        // Ajouter les informations de l'utilisateur à la requête
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            username: decoded.username
        };
        
        next();
    } catch (error) {
        console.error('Erreur complète d\'authentification :', error);

        if (error.name === 'TokenExpiredError') {
            console.log('Erreur : Token expiré');
            return res.status(401).json({
                message: 'Le token a expiré. Veuillez vous reconnecter.',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            console.log('Erreur : Token invalide');
            return res.status(401).json({
                message: 'Token invalide. Authentification échouée.',
                code: 'INVALID_TOKEN'
            });
        }
        
        console.error('Erreur interne lors de l\'authentification', error);
        return res.status(500).json({
            message: 'Erreur interne lors de l\'authentification'
        });
    }
};

module.exports = authMiddleware;