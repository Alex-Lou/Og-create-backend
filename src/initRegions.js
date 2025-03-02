// initRegions.js
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

/**
 * Fonction pour initialiser ou mettre à jour les régions depuis le fichier JSON
 */
async function initRegions() {
  try {
    console.log('Initialisation des régions...');
    const jsonPath = path.join(__dirname, 'public/data/regionChallenges.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`Le fichier ${jsonPath} n'existe pas!`);
      return { success: false, error: 'JSON file not found' };
    }
    
    const regionsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Initialiser les régions normales
    for (const region of regionsData.regions) {
      // Vérifier si la région existe déjà
      const existingRegion = await db.query(
        'SELECT id FROM explorer_regions WHERE id = $1',
        [region.id]
      );
      
      // Préparer les éléments requis et disponibles
      const requiredElements = region.requiredElements || [];
      const availableElements = region.availableElements || [];
      
      if (existingRegion.rows.length === 0) {
        // Si la région n'existe pas, l'insérer
        await db.query(`
          INSERT INTO explorer_regions (
            id, name, description, image_path, is_default, required_level, 
            parent_region_id, required_elements, unlocked_elements, 
            position_x, position_y, is_boss
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          )
        `, [
          region.id,
          region.name,
          region.description || '',
          region.background || null,
          region.is_default || false,
          region.id, // Utiliser l'ID comme niveau requis par défaut
          region.parent_region_id || null,
          requiredElements,
          availableElements,
          region.position_x || 50,
          region.position_y || 50,
          false // Les régions normales ne sont pas des boss
        ]);
        
        console.log(`Région ${region.name} (ID: ${region.id}) créée.`);
      } else {
        console.log(`Région ${region.id} existe déjà, mise à jour...`);
        // Si la région existe, la mettre à jour avec les dernières informations
        await db.query(`
          UPDATE explorer_regions SET
            name = $2,
            description = $3,
            image_path = $4,
            is_default = $5,
            required_level = $6,
            parent_region_id = $7,
            required_elements = $8,
            unlocked_elements = $9,
            position_x = $10,
            position_y = $11,
            is_boss = $12
          WHERE id = $1
        `, [
          region.id,
          region.name,
          region.description || '',
          region.background || null,
          region.is_default || false,
          region.id, // Utiliser l'ID comme niveau requis par défaut
          region.parent_region_id || null,
          requiredElements,
          availableElements,
          region.position_x || 50,
          region.position_y || 50,
          false // Les régions normales ne sont pas des boss
        ]);
      }
    }
    
    // Initialiser les boss
    if (regionsData.bosses && regionsData.bosses.length > 0) {
      for (const boss of regionsData.bosses) {
        // Pour chaque boss, nous devons créer ou mettre à jour une entrée dans explorer_regions
        const bossRegionId = boss.regionId || 5; // L'ID 5 semble être réservé au boss
        
        // Vérifier si la région du boss existe déjà
        const existingBossRegion = await db.query(
          'SELECT id FROM explorer_regions WHERE id = $1',
          [bossRegionId]
        );
        
        // Préparer les éléments requis et disponibles pour le boss
        const requiredElements = boss.requiredElements || [];
        const availableElements = boss.availableElements || [];
        
        if (existingBossRegion.rows.length === 0) {
          // Si la région du boss n'existe pas, l'insérer
          await db.query(`
            INSERT INTO explorer_regions (
              id, name, description, image_path, is_default, required_level, 
              parent_region_id, required_elements, unlocked_elements, 
              position_x, position_y, is_boss
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
          `, [
            bossRegionId,
            boss.name,
            boss.description || 'Région de boss',
            boss.bossImage || null,
            false, // Un boss n'est jamais une région par défaut
            boss.requiredLevel || bossRegionId, // Utiliser l'ID comme niveau requis par défaut
            boss.trigger_after_region || null,
            requiredElements,
            availableElements,
            boss.position_x || 70,
            boss.position_y || 45,
            true // C'est un boss
          ]);
          
          console.log(`Boss ${boss.name} (ID: ${bossRegionId}) créé.`);
        } else {
          console.log(`Boss ${bossRegionId} existe déjà, mise à jour...`);
          // Si la région du boss existe, la mettre à jour
          await db.query(`
            UPDATE explorer_regions SET
              name = $2,
              description = $3,
              image_path = $4,
              is_default = $5,
              required_level = $6,
              parent_region_id = $7,
              required_elements = $8,
              unlocked_elements = $9,
              position_x = $10,
              position_y = $11,
              is_boss = $12
            WHERE id = $1
          `, [
            bossRegionId,
            boss.name,
            boss.description || 'Région de boss',
            boss.bossImage || null,
            false, // Un boss n'est jamais une région par défaut
            boss.requiredLevel || bossRegionId, // Utiliser l'ID comme niveau requis par défaut
            boss.trigger_after_region || null,
            requiredElements,
            availableElements,
            boss.position_x || 70,
            boss.position_y || 45,
            true // C'est un boss
          ]);
        }
      }
    }
    
    // Optionnel: Synchroniser les éléments découverts pour les utilisateurs
    await syncUserDiscoveredElements();
    
    console.log('Initialisation des régions terminée avec succès.');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des régions:', error);
    return { success: false, error };
  }
}

/**
 * Synchroniser les éléments découverts pour les utilisateurs
 * Cette fonction va vérifié tous les utilisateurs qui ont des régions complétées
 * et s'assurer qu'ils ont les éléments découverts correspondants
 */
async function syncUserDiscoveredElements() {
  try {
    console.log('Synchronisation des éléments découverts par utilisateur...');
    
    // Récupérer tous les utilisateurs qui ont des régions
    const userResult = await db.query(
      'SELECT DISTINCT user_id FROM user_regions'
    );
    
    if (userResult.rows.length === 0) {
      console.log('Aucun utilisateur avec des régions trouvé.');
      return;
    }
    
    // Pour chaque utilisateur
    for (const userRow of userResult.rows) {
      const userId = userRow.user_id;
      console.log(`Synchronisation des éléments pour l'utilisateur ${userId}...`);
      
      // Récupérer toutes les régions complétées par cet utilisateur
      const completedRegionsResult = await db.query(
        'SELECT region_id FROM user_regions WHERE user_id = $1 AND completed = TRUE',
        [userId]
      );
      
      // Pour chaque région complétée
      for (const regionRow of completedRegionsResult.rows) {
        const regionId = regionRow.region_id;
        
        // Récupérer les éléments requis pour cette région
        const regionResult = await db.query(
          'SELECT required_elements FROM explorer_regions WHERE id = $1',
          [regionId]
        );
        
        if (regionResult.rows.length === 0 || !regionResult.rows[0].required_elements) {
          continue;
        }
        
        const requiredElements = regionResult.rows[0].required_elements;
        
        // Récupérer les éléments déjà découverts par l'utilisateur pour cette région
        const userRegionResult = await db.query(
          'SELECT discovered_elements FROM user_regions WHERE user_id = $1 AND region_id = $2',
          [userId, regionId]
        );
        
        // Si la région est complétée, tous les éléments requis devraient être découverts
        if (userRegionResult.rows.length > 0) {
          let discoveredElements = userRegionResult.rows[0].discovered_elements || [];
          
          // Si la région est complétée mais que discovered_elements est vide ou ne contient pas tous les éléments requis
          const needsUpdate = requiredElements.some(element => !discoveredElements.includes(element));
          
          if (needsUpdate) {
            // Ajouter tous les éléments requis aux éléments découverts
            for (const element of requiredElements) {
              if (!discoveredElements.includes(element)) {
                discoveredElements.push(element);
              }
            }
            
            // Mettre à jour les éléments découverts
            await db.query(
              'UPDATE user_regions SET discovered_elements = $1 WHERE user_id = $2 AND region_id = $3',
              [discoveredElements, userId, regionId]
            );
            
            console.log(`Éléments découverts mis à jour pour l'utilisateur ${userId}, région ${regionId}.`);
          }
        }
      }
    }
    
    console.log('Synchronisation des éléments découverts terminée.');
  } catch (error) {
    console.error('Erreur lors de la synchronisation des éléments découverts:', error);
  }
}

module.exports = { initRegions, syncUserDiscoveredElements };