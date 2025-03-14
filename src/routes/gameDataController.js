// routes/gameDataController.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { log } = require('../utils/logger');

// Répertoire contenant tous les fichiers JSON
const DATA_DIR = path.join(__dirname, '../public/data');

// Cache pour éviter de relire les fichiers à chaque requête
const dataCache = {
  timestamp: 0,
  data: {},
  // Durée de validité du cache en millisecondes (5 minutes)
  cacheDuration: 5 * 60 * 1000
};

// Lire et traiter un fichier JSON
function readJsonFile(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log('error', `Erreur lors de la lecture du fichier ${filename}`, error);
    return null;
  }
}

// Purger les données sensibles des éléments
function sanitizeElementsData(data) {
  // Fonction récursive pour parcourir l'objet et supprimer les formules
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Si c'est un tableau, nettoyer chaque élément
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    
    // Si c'est un objet
    const result = { ...obj };
    
    // Supprimer les propriétés sensibles
    delete result.formula;
    delete result.secretFormula;
    delete result.calculationMethod;
    delete result.secretInfo;
    
    // Parcourir récursivement toutes les propriétés
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
    
    // Lister tous les fichiers JSON dans le répertoire
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
    
    // Objet pour stocker toutes les données
    const allData = {};
    
    // Lire chaque fichier
    for (const file of files) {
      const baseName = path.basename(file, '.json');
      const data = readJsonFile(file);
      
      if (data) {
        // Nettoyer les données sensibles si nécessaire
        if (baseName.includes('elements') || baseName.includes('formations') || 
            baseName.includes('animaux') || baseName.includes('phenomenes')) {
          allData[baseName] = sanitizeElementsData(data);
        } else {
          allData[baseName] = data;
        }
      }
    }
    
    // Mettre à jour le cache
    dataCache.data = allData;
    dataCache.timestamp = now;
    
    log('debug', 'Données du jeu chargées avec succès', { 
      filesCount: files.length,
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
router.get('/elements', authMiddleware, (req, res) => {
  try {
    log('debug', 'Demande de chargement des éléments');
    
    // Répondre avec la liste des éléments par défaut si le fichier n'existe pas
    const defaultElements = {
      elements: [
        { name: "Eau", category: "Element Fondamental" },
        { name: "Feu", category: "Element Fondamental" },
        { name: "Terre", category: "Element Fondamental" },
        { name: "Air", category: "Element Fondamental" }
      ]
    };
    
    // Essayer de charger le fichier elements_data.json à la place
    const elementsDataPath = path.join(DATA_DIR, 'elements_data.json');
    
    if (fs.existsSync(elementsDataPath)) {
      log('debug', 'Utilisation du fichier elements_data.json');
      const data = readJsonFile('elements_data.json');
      
      if (data) {
        return res.status(200).json(sanitizeElementsData(data));
      }
    }
    
    // Si ça ne marche pas, essayer avec elements.json
    const elementsPath = path.join(DATA_DIR, 'elements.json');
    
    if (fs.existsSync(elementsPath)) {
      log('debug', 'Utilisation du fichier elements.json');
      const data = readJsonFile('elements.json');
      
      if (data) {
        return res.status(200).json(sanitizeElementsData(data));
      }
    }
    
    // Si aucun fichier n'existe ou ne peut être lu, retourner la liste par défaut
    log('info', 'Utilisation des éléments par défaut, fichiers non trouvés');
    res.status(200).json(defaultElements);
  } catch (error) {
    log('error', 'Erreur lors du chargement des éléments', error);
    res.status(500).json({
      message: 'Erreur lors du chargement des éléments',
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Route pour charger un fichier JSON spécifique (version sécurisée)
router.get('/:filename', authMiddleware, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Vérifier que le nom de fichier est sécurisé
    if (!filename.match(/^[a-zA-Z0-9_-]+$/)) {
      log('warn', 'Tentative d\'accès avec un nom de fichier invalide', { filename });
      return res.status(400).json({ message: 'Nom de fichier invalide' });
    }
    
    // Chemin complet avec extension
    const jsonFilename = `${filename}.json`;
    const filePath = path.join(DATA_DIR, jsonFilename);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      log('warn', 'Fichier demandé non trouvé', { filename });
      return res.status(404).json({ message: 'Fichier non trouvé' });
    }
    
    log('debug', 'Chargement de fichier spécifique', { filename });
    
    // Lire le fichier
    const data = readJsonFile(jsonFilename);
    
    if (!data) {
      return res.status(500).json({ message: 'Erreur lors de la lecture du fichier' });
    }
    
    // Nettoyer les données sensibles si nécessaire
    if (filename.includes('elements') || filename.includes('formations') || 
        filename.includes('animaux') || filename.includes('phenomenes')) {
      return res.status(200).json(sanitizeElementsData(data));
    }
    
    // Envoyer les données
    res.status(200).json(data);
  } catch (error) {
    log('error', `Erreur lors du chargement du fichier ${req.params.filename}`, error);
    res.status(500).json({
      message: 'Erreur lors du chargement du fichier',
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
      
      // Charger les formules de combinaison (formules cachées côté serveur)
      const formulasPath = path.join(DATA_DIR, 'formulas.json');
      let formulas = {};
      
      try {
        const formulasContent = fs.readFileSync(formulasPath, 'utf8');
        formulas = JSON.parse(formulasContent);
      } catch (error) {
        log('error', 'Erreur lors du chargement des formules', error);
        return res.status(500).json({ message: 'Erreur lors du chargement des formules' });
      }
      
      // Trier les éléments pour correspondre aux formules (ordre alphabétique)
      const sortedElements = [...elements].sort();
      
      // Chercher une formule correspondante
      let result = null;
      
      // Vérifier les combinaisons spécifiques
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
      
      // Si aucune combinaison spécifique n'est trouvée, vérifier les règles génériques
      if (!result && formulas.generic) {
        for (const rule of formulas.generic) {
          // Vérifier si la règle s'applique à ces éléments
          const matches = checkGenericRule(rule, elements);
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
      
      // Si aucun résultat trouvé
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
      const elementsData = readJsonFile('elements_data.json');
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
  
// Fonction pour vérifier si une règle générique s'applique
function checkGenericRule(rule, elements) {
  // Exemple de règle générique :
  // { type: "category", category1: "Feu", category2: "Eau", result: "Vapeur" }
  
  // Charger les catégories des éléments
  const categoriesData = {};
  const elementsData = readJsonFile('elements_data.json');
  
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
    
    // Ajoutez d'autres types de règles au besoin
  }
  
  return null;
}

module.exports = router;