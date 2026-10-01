const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { log } = require('../utils/logger');
const db = require('../config/db');
const achievementService = require('../services/achievementService');

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
  // Récupération de données par nom depuis la table game_data
  async getGameDataByName(name) {
    try {
      // Vérifier si présent en cache
      const cachedData = cacheService.get(`gameData:${name}`);
      if (cachedData) return cachedData;
      
      log('debug', `Récupération des données pour ${name} depuis la base de données`);
      
      // Normaliser le nom pour la recherche
      const normalizedName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      
      const result = await db.query(
        `SELECT name, elements, rules, metadata 
        FROM game_data 
        WHERE LOWER(REPLACE(name, ' ', '_')) = $1 
        AND active = true`,
        [normalizedName]
      );
      
      if (result.rows.length === 0) {
        log('warn', `Aucune donnée trouvée pour ${name} (normalisé: ${normalizedName})`);
        return null;
      }
      
      const row = result.rows[0];
      
      // Combiner les données des colonnes JSONB
      const data = {
        ...(row.elements || {}),
        ...(row.rules || {}),
        ...(row.metadata || {})
      };
      
      // Mettre en cache et retourner
      return cacheService.set(`gameData:${name}`, data);
    } catch (error) {
      log('error', `Erreur lors de la récupération de ${name} depuis la base de données`, error);
      throw error;
    }
  },

  // Récupérer toutes les données du jeu
  async getAllGameData() {
    try {
      // Vérifier si présent en cache
      const cachedData = cacheService.get('allGameData');
      if (cachedData) return cachedData;
      
      log('info', 'Récupération de toutes les données du jeu');
      
      const result = await db.query(
        'SELECT name, elements, rules, metadata FROM game_data WHERE active = true'
      );
      
      if (result.rows.length === 0) {
        log('warn', 'Aucune donnée trouvée dans la base');
        return {};
      }
      
      // Objet pour stocker toutes les données
      const allData = {};
      
      // Traiter chaque ligne de la base de données
      for (const row of result.rows) {
        const baseName = row.name;
        
        // Combiner les données
        const data = {
          ...(row.elements || {}),
          ...(row.rules || {}),
          ...(row.metadata || {})
        };
        
        // Nettoyer les données sensibles si nécessaire
        if (baseName.includes('elements') || baseName.includes('formations') || 
            baseName.includes('animaux') || baseName.includes('phenomenes')) {
          allData[baseName] = this.sanitizeElementsData(data);
        } else {
          allData[baseName] = data;
        }
      }
      
      // Récupérer et ajouter les achievements
      const achievements = await achievementService.getAllAchievements();
      if (achievements.length > 0) {
        allData['achievements'] = achievements;
      }
      
      // Mettre en cache et retourner
      return cacheService.set('allGameData', allData);
    } catch (error) {
      log('error', 'Erreur lors de la récupération de toutes les données du jeu', error);
      throw error;
    }
  },
  
  // Récupérer les achievements
  async getAchievements() {
    try {
      // Utiliser le service centralisé des achievements
      return await achievementService.getAllAchievements();
    } catch (error) {
      log('error', 'Erreur lors de la récupération des achievements', error);
      throw error;
    }
  },

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
  },
  
  // Vérifier une combinaison d'éléments
  async checkCombination(elements) {
    try {
      if (!elements || !Array.isArray(elements) || elements.length < 2) {
        throw new Error('Au moins deux éléments sont nécessaires pour une combinaison');
      }
      
      log('info', 'Tentative de combinaison', { elements: elements.join(' + ') });
      
      // Charger les formules de combinaison
      let formulas = await this.getGameDataByName('formulas');
      
      if (!formulas) {
        throw new Error('Formules de combinaison non disponibles');
      }
      
      // Trier les éléments (pour les comparaisons)
      const sortedElements = [...elements].sort();
      
      // Chercher une formule correspondante
      let result = null;
      
      // 1. Vérifier les combinaisons spécifiques
      if (formulas.specific) {
        for (const formula of formulas.specific) {
          // Convertir les ingrédients requis en ensemble pour vérification facile
          const requiredIngredients = new Set(formula.ingredients);
          
          // Vérifier si les éléments correspondent exactement
          if (formula.ingredients.length === elements.length && 
              elements.every(elem => requiredIngredients.has(elem))) {
            result = {
              success: true,
              resultElement: formula.result,
              newElement: !formula.known,
              message: formula.message || `Vous avez créé ${formula.result} !`
            };
            break;
          }
        }
      }
      
      // 2. Si aucune combinaison spécifique, vérifier les règles génériques
      if (!result && formulas.generic) {
        for (const rule of formulas.generic) {
          // Vérifier si la règle s'applique à ces éléments
          const matches = await this.checkGenericRule(rule, elements);
          if (matches) {
            result = {
              success: true,
              resultElement: matches.result,
              newElement: matches.isNew,
              message: matches.message
            };
            break;
          }
        }
      }
      
      // 3. Si toujours aucun résultat, vérifier les règles de craft
      if (!result) {
        const craftResult = await this.checkCraftRules(elements);
        if (craftResult) {
          result = {
            success: true,
            resultElement: craftResult,
            newElement: true,
            message: `Vous avez créé ${craftResult} !`
          };
        }
      }
      
      // Si aucun résultat trouvé
      if (!result) {
        log('debug', 'Combinaison échouée', { elements: elements.join(' + ') });
        return {
          success: false,
          message: 'Ces éléments ne se combinent pas...'
        };
      }
      
      log('info', 'Combinaison réussie', { 
        elements: elements.join(' + '), 
        result: result.resultElement,
        isNew: result.newElement
      });
      
      // Récupérer les détails de l'élément résultant
      const elementsData = await this.getGameDataByName('elements_data');
      if (elementsData && elementsData.elements) {
        const resultElementDetails = elementsData.elements.find(e => e.name === result.resultElement);
        if (resultElementDetails) {
          // Ajouter les détails mais sans les formules
          result.elementDetails = this.sanitizeElementsData(resultElementDetails);
        }
      }
      
      return result;
    } catch (error) {
      log('error', 'Erreur lors de la vérification de la combinaison', error);
      throw error;
    }
  },
  
  // Vérifier les règles génériques (à implémenter selon votre logique)
  async checkGenericRule(rule, elements) {
    // À implémenter selon votre logique actuelle
    return null;
  },
  
  // Vérifier les règles de craft dans les données DB
  async checkCraftRules(elements) {
    // Liste des catégories qui peuvent contenir des règles de craft
    const craftCategories = [
      'geologie',
      'biologie',
      'materiaux_elementaires',
      'formations_naturelles',
      'phenomenes_naturels'
    ];
    
    const originalKey = elements.join('+');
    const sortedKey = [...elements].sort().join('+');
    
    for (const category of craftCategories) {
      // Chercher depuis la base de données
      const data = await this.getGameDataByName(category);
      
      if (data && data.rules) {
        // Vérifier les règles, d'abord avec la clé originale
        if (data.rules[originalKey]) {
          return data.rules[originalKey];
        }
        
        // Puis avec la clé triée
        if (data.rules[sortedKey]) {
          return data.rules[sortedKey];
        }
      }
    }
    
    return null;
  },
  
  // Purger les données sensibles des éléments
  sanitizeElementsData(data) {
    function sanitizeObject(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }
      
      const result = { ...obj };
      
      delete result.formula;
      delete result.secretFormula;
      delete result.calculationMethod;
      delete result.secretInfo;
      
      for (const key in result) {
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = sanitizeObject(result[key]);
        }
      }
      
      return result;
    }
    
    return sanitizeObject(data);
  },
  
  // Diagnostic de la table timer_questions
  async diagnosisTimerQuestions() {
    try {
      log('info', 'Exécution du diagnostic pour timer_questions');
      
      // Vérifier si la table existe
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'timer_questions'
        );
      `);
      
      const tableExists = tableCheck.rows[0].exists;
      
      if (!tableExists) {
        return {
          success: false,
          message: 'La table timer_questions n\'existe pas',
          tablesAvailable: await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            .then(result => result.rows.map(row => row.table_name))
        };
      }
      
      // Vérifier le nombre de lignes
      const countResult = await db.query('SELECT COUNT(*) FROM timer_questions');
      const count = parseInt(countResult.rows[0].count);
      
      // Récupérer la structure d'une ligne
      let sampleRow = null;
      let columns = [];
      
      if (count > 0) {
        const sampleResult = await db.query('SELECT * FROM timer_questions LIMIT 1');
        sampleRow = sampleResult.rows[0];
        
        // Récupérer les colonnes
        const columnsResult = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'timer_questions'
        `);
        
        columns = columnsResult.rows;
      }
      
      // Résultat complet
      return {
        success: true,
        tableExists,
        rowCount: count,
        columns,
        sampleRow: sampleRow ? {
          id: sampleRow.id,
          level: sampleRow.level,
          category: sampleRow.category,
          question_text: sampleRow.question_text,
          valid_answers_type: typeof sampleRow.valid_answers,
          valid_answers: sampleRow.valid_answers,
          points: sampleRow.points,
          initial_elements_type: typeof sampleRow.initial_elements,
          elements_emojis_type: typeof sampleRow.elements_emojis
        } : null,
        rawSampleRow: sampleRow
      };
    } catch (error) {
      log('error', 'Erreur lors du diagnostic de timer_questions', error);
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

// Contrôleur pour toutes les données du jeu
async function getAllGameDataController(req, res) {
  try {
    const allData = await dbService.getAllGameData();
    
    if (Object.keys(allData).length === 0) {
      return responseHandler.notFound(res, 'Aucune donnée de jeu trouvée');
    }
    
    return responseHandler.send(res, allData);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement des données du jeu');
  }
}

// Contrôleur pour les éléments
async function getElementsController(req, res) {
  try {
    // Répondre avec la liste des éléments par défaut si aucune donnée n'est trouvée
    const defaultElements = {
      elements: [
        { name: "Eau", category: "Element Fondamental" },
        { name: "Feu", category: "Element Fondamental" },
        { name: "Terre", category: "Element Fondamental" },
        { name: "Air", category: "Element Fondamental" }
      ]
    };
    
    // Essayer de charger 'elements_data'
    let data = await dbService.getGameDataByName('elements_data');
    
    if (data) {
      return responseHandler.send(res, dbService.sanitizeElementsData(data));
    }
    
    // Si ça ne marche pas, essayer avec 'elements'
    data = await dbService.getGameDataByName('elements');
    
    if (data) {
      return responseHandler.send(res, dbService.sanitizeElementsData(data));
    }
    
    // Si aucune donnée n'est trouvée, retourner la liste par défaut
    log('info', 'Utilisation des éléments par défaut, données non trouvées');
    return responseHandler.send(res, defaultElements);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement des éléments');
  }
}

// Contrôleur pour les achievements
async function getAchievementsController(req, res) {
  try {
    const achievements = await achievementService.getAllAchievements();
    
    if (achievements.length === 0) {
      return responseHandler.notFound(res, 'Aucun achievement trouvé');
    }
    
    return responseHandler.send(res, achievements);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du chargement des achievements');
  }
}

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

// Contrôleur pour le diagnostic des questions du timer
async function diagnosisTimerQuestionsController(req, res) {
  try {
    const diagnosis = await dbService.diagnosisTimerQuestions();
    return responseHandler.send(res, diagnosis);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors du diagnostic des questions du timer');
  }
}

// Contrôleur pour récupérer une donnée spécifique
async function getSpecificDataController(req, res) {
  try {
    let { filename } = req.params;
    
    // Normalisation extensive
    const normalizedFilename = filename
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
    
    // Mapping personnalisé pour game_data
    const nameMapping = {
      'creations_humaines': 'humains_craft_rules',
      'phenomenes_naturels': 'phenomenes_naturels'
    };
    
    // Si c'est timer_questions, utiliser directement getTimerQuestionsController
    if (normalizedFilename === 'timer_questions') {
      return getTimerQuestionsController(req, res);
    }
    
    // Utiliser le mapping si existant, sinon utiliser le nom normalisé
    const databaseName = nameMapping[normalizedFilename] || normalizedFilename;
    
    log('debug', 'Recherche de données', { 
      originalFilename: filename, 
      normalizedFilename, 
      databaseName 
    });
    
    // Récupérer les données depuis game_data
    const data = await dbService.getGameDataByName(databaseName);
    
    if (data) {
      return responseHandler.send(res, data);
    }
    
    // Si les données ne sont pas trouvées
    return responseHandler.notFound(res, 'Données non trouvées');
  } catch (error) {
    return responseHandler.error(res, error, `Erreur lors du chargement des données ${req.params.filename}`);
  }
}

// Contrôleur pour vérifier les combinaisons
async function checkCombinationController(req, res) {
  try {
    const { elements } = req.body;
    
    if (!elements || !Array.isArray(elements) || elements.length < 2) {
      return res.status(400).json({ 
        message: 'Au moins deux éléments sont nécessaires pour une combinaison'
      });
    }
    
    const result = await dbService.checkCombination(elements);
    return responseHandler.send(res, result);
  } catch (error) {
    return responseHandler.error(res, error, 'Erreur lors de la vérification de la combinaison');
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