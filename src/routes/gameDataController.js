// routes/gameDataController.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { log } = require('../utils/logger');
const db = require('../config/db');

// Cache pour éviter de requêter la base de données à chaque fois
const dataCache = {
  timestamp: 0,
  data: {},
  cacheDuration: 5 * 60 * 1000
};

// Fonction pour récupérer une donnée par son nom depuis la base de données
async function fetchGameDataByName(name) {
  try {
    log('debug', `Récupération des données pour ${name} depuis la base de données`);
    
    // Normaliser le nom pour la recherche
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const result = await db.query(
      'SELECT name, elements, rules, metadata FROM game_data WHERE name = $1 AND active = true',
      [normalizedName]
    );
    
    if (result.rows.length === 0) {
      log('warn', `Aucune donnée trouvée pour ${name}`);
      return null;
    }
    
    const row = result.rows[0];
    
    // Combiner les données des colonnes JSONB
    return {
      ...(row.elements || {}),
      ...(row.rules || {}),
      ...(row.metadata || {})
    };
  } catch (error) {
    log('error', `Erreur lors de la récupération de ${name} depuis la base de données`, error);
    return null;
  }
}

// Fonction pour récupérer les achievements depuis la base de données
async function fetchAchievementsFromDB() {
  try {
    log('debug', 'Récupération des achievements depuis la base de données pour progress');
    
    const result = await db.query(
      'SELECT id, name, description, unlocked, condition, image FROM achievements_list ORDER BY id'
    );
    
    if (result.rows.length === 0) {
      log('warn', 'Aucun achievement trouvé dans la base de données');
      return [];
    }
    
    return result.rows;
  } catch (error) {
    log('error', 'Erreur lors de la récupération des achievements depuis la base de données', error);
    return [];
  }
}

// Fonction pour récupérer et formater les questions du timer depuis la base de données
async function fetchTimerQuestionsFromDB() {
  try {
    log('debug', 'Récupération des questions du timer depuis la base de données');
    
    const result = await db.query(
      'SELECT id, level, timer, category, question_text, valid_answers, points, initial_elements FROM timer_questions ORDER BY id'
    );
    
    if (result.rows.length === 0) {
      log('warn', 'Aucune question de timer trouvée dans la base de données');
      return { levels: {} };
    }
    
    // Organiser les questions par niveau et catégorie
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
          timer: level === "Facile" ? 300 : (level === "Moyen" ? 240 : 180),
          categories: {}
        };
      }
      
      // Initialiser la catégorie si elle n'existe pas
      if (!organized.levels[level].categories[category]) {
        organized.levels[level].categories[category] = {
          questions: []
        };
      }
      
      // Formatter la question
      let initialElements = row.initial_elements;
      if (typeof initialElements === 'string') {
        try {
          initialElements = JSON.parse(initialElements);
        } catch (e) {
          initialElements = {};
        }
      }
      
      // Créer l'objet question
      const question = {
        id: row.id,
        level: row.level,
        category: row.category,
        text: row.question_text,
        validAnswers: row.valid_answers,
        points: row.points,
        initialElements: initialElements
      };
      
      // Ajouter la question à la catégorie
      organized.levels[level].categories[category].questions.push(question);
    }
    
    return organized;
  } catch (error) {
    log('error', 'Erreur lors de la récupération des questions du timer', error);
    return { levels: {} };
  }
}

// Purger les données sensibles des éléments
function sanitizeElementsData(data) {
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
}

// Route pour charger toutes les données du jeu en un seul appel
router.get('/load', authMiddleware, async (req, res) => {
  try {
    log('info', 'Demande de chargement des données du jeu');
    
    // Vérifier si le cache est encore valide
    const now = Date.now();
    if (now - dataCache.timestamp < dataCache.cacheDuration && Object.keys(dataCache.data).length > 0) {
      log('debug', 'Utilisation des données en cache');
      return res.status(200).json(dataCache.data);
    }
    
    // Récupérer toutes les données depuis la base de données
    const result = await db.query(
      'SELECT name, elements, rules, metadata FROM game_data WHERE active = true'
    );
    
    if (result.rows.length === 0) {
      log('warn', 'Aucune donnée trouvée dans la base');
      return res.status(404).json({
        message: 'Aucune donnée de jeu trouvée'
      });
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
        allData[baseName] = sanitizeElementsData(data);
      } else {
        allData[baseName] = data;
      }
    }
    
    // Récupérer les achievements et les ajouter aux données
    const achievements = await fetchAchievementsFromDB();
    if (achievements.length > 0) {
      allData['achievements'] = achievements;
    }
    
    // Mettre à jour le cache
    dataCache.data = allData;
    dataCache.timestamp = now;
    
    log('debug', 'Données du jeu chargées avec succès depuis la base de données', { 
      dataCount: Object.keys(allData).length,
      cacheTimestamp: now
    });
    
    // Envoyer toutes les données
    res.status(200).json(allData);
  } catch (error) {
    log('error', 'Erreur lors du chargement des données du jeu', error);
    res.status(500).json({
      message: 'Erreur lors du chargement des données du jeu',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route spécifique pour les éléments
router.get('/elements', authMiddleware, async (req, res) => {
  try {
    log('debug', 'Demande de chargement des éléments');
    
    // Répondre avec la liste des éléments par défaut si aucune donnée n'est trouvée
    const defaultElements = {
      elements: [
        { name: "Eau", category: "Element Fondamental" },
        { name: "Feu", category: "Element Fondamental" },
        { name: "Terre", category: "Element Fondamental" },
        { name: "Air", category: "Element Fondamental" }
      ]
    };
    
    // Essayer de charger les données 'elements_data' de la base de données
    let data = await fetchGameDataByName('elements_data');
    
    if (data) {
      log('debug', 'Utilisation des données elements_data depuis la base de données');
      return res.status(200).json(sanitizeElementsData(data));
    }
    
    // Si ça ne marche pas, essayer avec 'elements'
    data = await fetchGameDataByName('elements');
    
    if (data) {
      log('debug', 'Utilisation des données elements depuis la base de données');
      return res.status(200).json(sanitizeElementsData(data));
    }
    
    // Si aucune donnée n'est trouvée, retourner la liste par défaut
    log('info', 'Utilisation des éléments par défaut, données non trouvées');
    res.status(200).json(defaultElements);
  } catch (error) {
    log('error', 'Erreur lors du chargement des éléments', error);
    res.status(500).json({
      message: 'Erreur lors du chargement des éléments',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route pour charger les achievements depuis la base de données
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    log('debug', 'Demande de chargement des achievements');
    
    const achievements = await fetchAchievementsFromDB();
    
    if (achievements.length === 0) {
      log('warn', 'Aucun achievement trouvé dans la base de données');
      return res.status(404).json({
        message: 'Aucun achievement trouvé'
      });
    }
    
    // Envoyer les achievements
    res.status(200).json(achievements);
  } catch (error) {
    log('error', 'Erreur lors du chargement des achievements', error);
    res.status(500).json({
      message: 'Erreur lors du chargement des achievements',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route pour charger un fichier JSON spécifique
router.get('/:filename', authMiddleware, async (req, res) => {
  try {
    let { filename } = req.params;
    
    // Décoder le nom de fichier pour gérer les caractères spéciaux
    filename = decodeURIComponent(filename);
    
    // Vérifier que le nom de fichier est sécurisé
    if (!filename.match(/^[a-zA-ZÀ-ÿ0-9_-]+$/)) {
      log('warn', 'Tentative d\'accès avec un nom de fichier invalide', { filename });
      return res.status(400).json({ message: 'Nom de fichier invalide' });
    }
    
    log('debug', 'Chargement de données spécifiques', { filename });
    
    // Cas spécial pour timer-questions - charger depuis la BD
    if (filename === 'timer-questions') {
      const timerQuestionsData = await fetchTimerQuestionsFromDB();
      return res.status(200).json(timerQuestionsData);
    }
    
    // Cas spécial pour les achievements
    if (filename === 'achievements') {
      const achievements = await fetchAchievementsFromDB();
      return res.status(200).json(achievements);
    }
    
    // Récupérer les données depuis la base de données
    const data = await fetchGameDataByName(filename);
    
    if (data) {
      // Nettoyer les données sensibles si nécessaire
      if (filename.includes('elements') || filename.includes('formations') || 
          filename.includes('animaux') || filename.includes('phenomenes')) {
        return res.status(200).json(sanitizeElementsData(data));
      }
      
      // Envoyer les données
      return res.status(200).json(data);
    }
    
    // Si les données ne sont pas trouvées
    log('warn', 'Données demandées non trouvées', { filename });
    return res.status(404).json({ message: 'Données non trouvées' });
  } catch (error) {
    log('error', `Erreur lors du chargement des données ${req.params.filename}`, error);
    res.status(500).json({
      message: 'Erreur lors du chargement des données',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route pour vérifier les combinaisons d'éléments
router.post('/combine', authMiddleware, async (req, res) => {
  try {
    const { elements } = req.body;
    
    if (!elements || !Array.isArray(elements) || elements.length < 2) {
      return res.status(400).json({ 
        message: 'Au moins deux éléments sont nécessaires pour une combinaison'
      });
    }
    
    log('info', 'Tentative de combinaison', { elements: elements.join(' + ') });
    
    // Charger les formules de combinaison depuis la base de données
    let formulas = await fetchGameDataByName('formulas');
    
    if (!formulas) {
      log('error', 'Erreur lors du chargement des formules');
      return res.status(500).json({ message: 'Erreur lors du chargement des formules' });
    }
    
    // Trier les éléments pour correspondre aux formules (ordre alphabétique)
    const sortedElements = [...elements].sort();
    
    // Chercher une formule correspondante
    let result = null;
    
    // Vérifier les combinaisons spécifiques
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
    
    // Si aucune combinaison spécifique n'est trouvée, vérifier les règles génériques
    if (!result && formulas.generic) {
      for (const rule of formulas.generic) {
        // Vérifier si la règle s'applique à ces éléments
        const matches = await checkGenericRule(rule, elements);
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
    
    // Si aucun résultat trouvé, vérifier les règles de craft dans les données geologie, etc.
    if (!result) {
      const craftResult = await checkCraftRules(elements);
      if (craftResult) {
        result = {
          success: true,
          resultElement: craftResult,
          newElement: true,
          message: `Vous avez créé ${craftResult} !`
        };
      }
    }
    
    // Si toujours aucun résultat
    if (!result) {
      log('debug', 'Combinaison échouée', { elements: elements.join(' + ') });
      return res.status(200).json({
        success: false,
        message: 'Ces éléments ne se combinent pas...'
      });
    }
    
    log('info', 'Combinaison réussie', { 
      elements: elements.join(' + '), 
      result: result.resultElement,
      isNew: result.newElement
    });
    
    // Charger les détails de l'élément résultant
    const elementsData = await fetchGameDataByName('elements_data');
    if (elementsData && elementsData.elements) {
      const resultElementDetails = elementsData.elements.find(e => e.name === result.resultElement);
      if (resultElementDetails) {
        // Ajouter les détails mais sans les formules
        result.elementDetails = sanitizeElementsData(resultElementDetails);
      }
    }
    
    res.status(200).json(result);
  } catch (error) {
    log('error', 'Erreur lors de la vérification de la combinaison', error);
    res.status(500).json({
      message: 'Erreur lors de la vérification de la combinaison',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Fonction pour vérifier les règles de craft dans les données DB
async function checkCraftRules(elements) {
  // Liste des catégories qui peuvent contenir des règles de craft
  const craftCategories = [
    'geologie',
    'biologie',
    'materiaux_elementaires',
    'formations_naturelles',
    'phenomenes_naturels'
  ];
  
  const originalKey = elements.join('+');
  const sortedElements = [...elements].sort();
  const sortedKey = sortedElements.join('+');
  
  for (const category of craftCategories) {
    // Chercher depuis la base de données
    const data = await fetchGameDataByName(category);
    
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
}

// Fonction pour vérifier si une règle générique s'applique
async function checkGenericRule(rule, elements) {
  // Exemple de règle générique :
  // { type: "category", category1: "Feu", category2: "Eau", result: "Vapeur" }
  
  // Charger les catégories des éléments depuis la base de données
  const elementsData = await fetchGameDataByName('elements_data');
  
  if (!elementsData || !elementsData.elements) {
    return null;
  }
  
  // Créer un tableau des catégories auxquelles appartiennent les éléments
  const elementCategories = [];
  for (const element of elements) {
    const elementInfo = elementsData.elements.find(e => e.name === element);
    if (elementInfo && elementInfo.category) {
      elementCategories.push(elementInfo.category);
    }
  }
  
  // Vérifier selon le type de règle
  switch (rule.type) {
    case 'category': {
      // Si deux éléments de catégories spécifiées sont combinés
      if (elementCategories.includes(rule.category1) && 
          elementCategories.includes(rule.category2)) {
        return {
          result: rule.result,
          isNew: rule.isNew !== false,
          message: rule.message || `Vous avez créé ${rule.result} !`
        };
      }
      break;
    }
    
    case 'property': {
      // Vérifier les propriétés des éléments
      const matchesProperty = elements.some(element => {
        const elementInfo = elementsData.elements.find(e => e.name === element);
        return elementInfo && elementInfo.properties && 
                elementInfo.properties.includes(rule.property);
      });
      
      if (matchesProperty) {
        return {
          result: rule.result,
          isNew: rule.isNew !== false,
          message: rule.message || `Vous avez créé ${rule.result} !`
        };
      }
      break;
    }
  }
  
  return null;
}

module.exports = router;