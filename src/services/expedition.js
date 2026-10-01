// L'Expédition tenue par le serveur : il pose les éléments d'une région, mène le combat des gardiens
// et ne valide une région que si son défi a vraiment été relevé dans la partie qu'il a suivie.
const path = require('path');
const db = require('../config/db');
const players = require('./players');
const { BASE_ELEMENTS } = require('./recipeBook');

const REGIONS = require(path.join(__dirname, '../public/data/regionChallenges.json')).regions;
// Mélange raté pendant un combat : le joueur perd ces points de vie (comme à l'écran)
const FAIL_DAMAGE = 10;

const asList = value => (Array.isArray(value) ? value : []);
const regionOf = id => REGIONS.find(r => r.id === Number(id)) || null;
const isBoss = r => !!(r && r.is_boss && r.maxHealth);

// Ce qui sort d'ici avant d'entrer dans une région : la carte, les dialogues, les récompenses.
// Les éléments, les règles de combat et les dégâts ne sont envoyés qu'au joueur qui y entre (start).
const HIDDEN = ['requiredElements', 'availableElements', 'damagePerElement', 'bossCombatRules', 'elementsWithGifs'];
function catalogue() {
    return REGIONS.map(r => Object.fromEntries(Object.entries(r).filter(([key]) => !HIDDEN.includes(key))));
}

// Entrée dans une région déjà visitée (énergie payée par /explorer/visit) : éléments en main et combat
async function start(owner, regionId) {
    const r = regionOf(regionId);
    if (!r) return { status: 404, message: 'Région inconnue' };
    if (owner.kind !== 'user') return { status: 401, message: 'L’Expédition demande un compte.' };
    const { rows } = await db.query('SELECT visited FROM user_regions WHERE user_id = $1 AND region_id = $2', [owner.id, r.id]);
    if (!rows[0]?.visited) return { status: 403, message: 'Visite d’abord cette région.' };

    const inventory = asList(r.availableElements).length ? [...new Set(r.availableElements)] : [...BASE_ELEMENTS];
    await players.startRun(owner, 'explorer', r.id, inventory);
    const health = isBoss(r) ? r.maxHealth : null;
    await db.query(`UPDATE play_runs SET boss_hp = $2, player_hp = $2 WHERE owner = $1 AND mode = 'explorer'`, [owner.key, health]);
    return {
        inventory,
        required: asList(r.requiredElements),
        elementsWithGifs: asList(r.elementsWithGifs),
        boss: health ? { bossHp: health, playerHp: health, maxHealth: health } : null
    };
}

// Dégâts d'un élément créé contre le gardien, et riposte (mêmes règles que l'écran de combat)
function blow(r, element) {
    const special = r.damagePerElement?.[element];
    if (special) return { damage: special, counter: 0 };
    const rules = r.bossCombatRules;
    if (!rules) return { damage: 3, counter: 0 };
    const damage = rules.baseElementDamage?.[element] ?? rules.defaultElementDamage ?? 3;
    const attack = rules.bossCounterAttack;
    if (!attack) return { damage, counter: 0 };
    const types = attack.elementTypes || {};
    const kind = asList(types.weakElements).includes(element) ? 'weakElement'
        : asList(types.strongElements).includes(element) ? 'strongElement' : 'neutralElement';
    return { damage, counter: Math.round(attack.baseDamage * (attack.damageMultipliers?.[kind] ?? 1)) };
}

async function fightState(owner) {
    const { rows } = await db.query(
        `SELECT context, boss_hp, player_hp FROM play_runs WHERE owner = $1 AND mode = 'explorer'`, [owner.key]);
    return rows[0] || null;
}

// Combat terminé (gardien tombé ou joueur vaincu) : plus de mélange tant qu'on ne repart pas
async function fightOver(owner) {
    const state = await fightState(owner);
    return !!state && state.boss_hp !== null && (state.boss_hp <= 0 || state.player_hp <= 0);
}

// Après un mélange en Expédition (résultat ou null) : le coup porté au gardien s'il y a combat
async function strike(owner, result) {
    const state = await fightState(owner);
    const r = state && regionOf(state.context);
    if (!isBoss(r) || state.boss_hp === null) return null;
    const { damage, counter } = result ? blow(r, result) : { damage: 0, counter: FAIL_DAMAGE };
    const { rows } = await db.query(
        `UPDATE play_runs SET boss_hp = GREATEST(0, boss_hp - $2), player_hp = GREATEST(0, player_hp - $3)
         WHERE owner = $1 AND mode = 'explorer' AND boss_hp > 0 AND player_hp > 0
         RETURNING boss_hp, player_hp`,
        [owner.key, damage, counter]);
    if (!rows.length) return null;
    const [{ boss_hp: bossHp, player_hp: playerHp }] = rows;
    return { damage, counter, bossHp, playerHp, defeated: bossHp <= 0, lost: playerHp <= 0 };
}

// Défi relevé dans la partie suivie par le serveur : éléments demandés créés, ou gardien vaincu
async function solved(userId, regionId) {
    const r = regionOf(regionId);
    const { rows } = await db.query(
        `SELECT context, inventory, boss_hp, player_hp FROM play_runs WHERE owner = $1 AND mode = 'explorer'`, [`u:${userId}`]);
    const run = rows[0];
    if (!r || !run || Number(run.context) !== r.id) return false;
    if (isBoss(r)) return run.boss_hp !== null && run.boss_hp <= 0 && run.player_hp > 0;
    const have = new Set(asList(run.inventory));
    return asList(r.requiredElements).every(name => have.has(name));
}

// Élément présent dans la partie en cours de cette région
async function holds(userId, regionId, name) {
    const { rows } = await db.query(
        `SELECT 1 FROM play_runs WHERE owner = $1 AND mode = 'explorer' AND context = $2 AND inventory ? $3`,
        [`u:${userId}`, String(Number(regionId)), name]);
    return rows.length > 0;
}

module.exports = { catalogue, start, strike, fightOver, solved, holds, regionOf, isBoss };
