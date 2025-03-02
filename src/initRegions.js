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
      return;
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
    
    console.log('Initialisation des régions terminée avec succès.');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des régions:', error);
    return { success: false, error };
  }
}

module.exports = { initRegions };