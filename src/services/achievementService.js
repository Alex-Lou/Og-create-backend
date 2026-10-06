// Succès : liste en base (achievements_list), débloqués par joueur dans progress.achievements.
// Un succès n'est débloqué que si sa condition est remplie par le carnet enregistré côté serveur.
const db = require('../config/db');
const { isConditionMet } = require('../utils/achievementCondition');

const CACHE_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;

// Liste complète (lue en base au plus une fois toutes les 5 minutes)
async function getAllAchievements() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const { rows } = await db.query('SELECT id, name, description, unlocked, condition, image FROM achievements_list ORDER BY id');
  if (!rows.length) return [];
  cached = rows;
  cachedAt = Date.now();
  return rows;
}

// Chaque succès, avec son état pour ce joueur : { "<nom>": { ...succès, unlocked, unlockedAt } }
async function getUserAchievements(userId) {
  const { rows } = await db.query('SELECT achievements FROM progress WHERE user_id = $1', [userId]);
  const mine = rows[0]?.achievements || {};
  const merged = {};
  for (const achievement of await getAllAchievements()) {
    merged[achievement.name] = {
      ...achievement,
      unlocked: mine[achievement.name]?.unlocked || false,
      unlockedAt: mine[achievement.name]?.unlockedAt || null
    };
  }
  return merged;
}

// Recalcule les succès d'un joueur depuis ses découvertes enregistrées (mode Infini).
// `claimed` ({ "<nom>": { unlockedAt } }, envoyé par le client) ne sert qu'à garder la date affichée.
// La ligne est verrouillée le temps du calcul : deux recalculs en même temps (deux onglets) ne s'écrasent pas.
async function syncAchievements(userId, claimed = {}) {
  if (!userId) throw new Error('ID utilisateur requis');
  const all = await getAllAchievements();
  return db.transaction(async conn => {
    const { rows } = await conn.query('SELECT achievements, infinite_elements FROM progress WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!rows.length) return { achievements: {}, newlyUnlocked: [] };

    const updated = { ...(rows[0].achievements || {}) };
    const discovered = rows[0].infinite_elements || [];
    const newlyUnlocked = [];
    for (const achievement of all) {
      if (updated[achievement.name]?.unlocked || !isConditionMet(achievement.condition, discovered)) continue;
      const claimedAt = Date.parse(claimed?.[achievement.name]?.unlockedAt);
      const unlockedAt = Number.isNaN(claimedAt) || claimedAt > Date.now() ? new Date().toISOString() : new Date(claimedAt).toISOString();
      updated[achievement.name] = { unlocked: true, unlockedAt };
      newlyUnlocked.push({ ...achievement, unlockedAt });
    }
    if (newlyUnlocked.length) {
      await conn.query('UPDATE progress SET achievements = $1, last_saved = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(updated), userId]);
    }
    return { achievements: updated, newlyUnlocked };
  });
}

async function updateUserAchievements(userId, claimed) {
  return { message: 'Succès vérifiés', ...(await syncAchievements(userId, claimed)), timestamp: new Date().toISOString() };
}

module.exports = { getAllAchievements, getUserAchievements, syncAchievements, updateUserAchievements };
