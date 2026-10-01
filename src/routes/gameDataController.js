const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger');
const db = require('../config/db');

// ----------------------------------------
// SERVICES (logique métier)
// ----------------------------------------

// Service de cache avec expiration par clé
const cacheService = {
  data: {}, // Format: { key: { timestamp, data } }
  duration: 5 * 60 * 1000, // 5 minutes par défaut

  get(key) {
    const cached = this.data[key];
    const now = Date.now();
    
    if (cached && now - cached.timestamp < this.duration) {
      log('debug', `Utilisation des données en cache pour ${key}`);
      return cached.data;
    }
    
    return null;
  },
  
  set(key, data) {
    this.data[key] = {
      timestamp: Date.now(),
      data
    };
    return data;
  },
  
  invalidate(key) {
    if (key) {
      delete this.data[key];
    } else {
      this.data = {}; // Vider tout le cache
    }
  }
};

// Service pour les requêtes DB
const dbService = {
  // Récupérer les questions du timer
  async getTimerQuestions() {
    try {
      // Vérifier si présent en cache
      const cachedData = cacheService.get('timerQuestions');
      if (cachedData) return cachedData;
      
      log('debug', 'Récupération des questions du timer depuis la base de données');
      
      // Compter les questions pour le log
      const countResult = await db.query('SELECT COUNT(*) FROM timer_questions');
      log('debug', `Nombre de questions dans la table: ${countResult.rows[0].count}`);
      
      const result = await db.query(
        'SELECT id, level, timer, category, question_text, points, initial_elements FROM timer_questions ORDER BY level, category'
      );
      
      log('debug', `Résultat de la requête: ${result.rowCount} lignes trouvées`);
      
      if (result.rows.length === 0) {
        log('warn', 'Aucune question de timer trouvée dans la base de données');
        return { levels: {} };
      }
      
      // Structure organisée des questions
      const organized = {
        levels: {}
      };
      
      // Traiter chaque question
      for (const row of result.rows) {
        const level = row.level;
        const category = row.category;
        
        // Initialiser le niveau s'il n'existe pas
        if (!organized.levels[level]) {
          organized.levels[level] = {
            timer: row.timer || (level === "Facile" ? 300 : (level === "Moyen" ? 240 : 180)),
            categories: {}
          };
        }
        
        // Mettre à jour le timer pour ce niveau
        organized.levels[level].timer = row.timer;
        
        // Initialiser la catégorie si elle n'existe pas
        if (!organized.levels[level].categories[category]) {
          organized.levels[level].categories[category] = {
            questions: []
          };
        }
        
        // Parser initialElements
        let initialElements;
        try {
          initialElements = typeof row.initial_elements === 'string'
            ? JSON.parse(row.initial_elements)
            : row.initial_elements;
        } catch (e) {
          log('error', `Erreur de parsing initial_elements pour question ${row.id}:`, e);
          initialElements = {
            validationMode: "any",
            required: [],
            additional: []
          };
        }
        
        // Créer l'objet question
        const question = {
          id: row.id,
          text: row.question_text,
          points: row.points,
          // Éléments de départ et mode de validation seulement : les réponses restent au serveur (services/trial.js)
          initialElements: {
            validationMode: initialElements.validationMode || 'any',
            requiredCount: initialElements.requiredCount,
            required: initialElements.required || [],
            additional: initialElements.additional || []
          }
        };
        
        // Ajouter la question à la catégorie
        organized.levels[level].categories[category].questions.push(question);
      }
      
      log('info', `Questions du timer chargées: ${result.rows.length}`);
      
      // Mettre en cache et retourner
      return cacheService.set('timerQuestions', organized);
    } catch (error) {
      log('error', 'Erreur lors de la récupération des questions du timer', error);
      log('error', 'Détails de l\'erreur:', error.stack);
      throw error;
    }
  }
};

// ----------------------------------------
// GESTIONNAIRE DE RÉPONSES STANDARDISÉ
// ----------------------------------------

const responseHandler = {
  // Envoyer une réponse standard
  send(res, data, status = 200) {
    return res.status(status).json(data);
  },
  
  // Gérer les erreurs de manière cohérente
  error(res, error, message = 'Une erreur est survenue') {
    const status = error.status || 500;
    const errorDetails = process.env.NODE_ENV === 'development' ? error.message : null;
    
    log('error', message, error);
    
    return res.status(status).json({
      success: false,
      message,
      errorDetails
    });
  },
  
  // Réponse 404 standardisée
  notFound(res, message = 'Ressource non trouvée') {
    return res.status(404).json({
      success: false,
      message
    });
  }
};

// ----------------------------------------
// CONTRÔLEURS (gestion des routes)
// ----------------------------------------

// Contrôleur pour les questions du timer
async function getTimerQuestionsController(req, res) {
  try {
    const questions = await dbService.getTimerQuestions();
    
    // Vérifier si des questions ont été trouvées
    if (!questions || !questions.levels || Object.keys(questions.levels).length === 0) {
      log('warn', 'Aucune question du timer trouvée ou format incorrect');
      return responseHandler.send(res, { levels: {} });
    }
    
    return responseHandler.send(res, questions);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement des questions du timer');
  }
}


// ----------------------------------------
// DÉFINITION DES ROUTES
// Lecture publique (mode invité)
// ----------------------------------------

// Seules les questions de l'Épreuve sortent d'ici : les recettes ne quittent plus le serveur (routes/play.js)
// Le front normalise le nom en « timer_questions » : les deux écritures mènent aux questions
router.get(['/timer-questions', '/timer_questions'], getTimerQuestionsController);

module.exports = router;