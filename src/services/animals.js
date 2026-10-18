// Le Bestiaire des animaux rencontrés (choix de l'auteur, 18 oct.) : la première fois qu'on touche un animal sur l'île
// (ou qu'on repousse un égaré, la nuit), il entre au Bestiaire, pour tous les appareils du compte. Une ligne de
// world_items par animal (préfixe ANIMAL, sans donnée nouvelle) ; sa date d'entrée est celle de la ligne. Le jeu sait où
// et quand chacun vit (world/creatures.js du dépôt front) ; le serveur ne garde que la liste des animaux connus, pour
// refuser les autres.
const db = require('../config/db');

const ANIMAL = 'animal:';
// Les animaux du Bestiaire, dans l'ordre du livre (le jeu : world/creatures.js, CREATURES)
const ANIMALS = [
    'lapin', 'ecureuil', 'mesange', 'renard', 'herisson', 'cerf', 'hibou',
    'papillon', 'papillon-lune', 'luciole', 'abeille',
    'grenouille', 'tortue', 'heron', 'koi', 'loutre',
    'crabe', 'mouette', 'sardines', 'dauphin', 'baleine', 'geant', 'kraken',
    'macareux', 'poney', 'bouquetin', 'renard-polaire', 'chameau', 'fennec', 'toucan', 'cameleon', 'corbeau', 'salamandre',
    'fantome', 'zombie', 'noye', 'racine', 'esprit',
    'lapin-de-brume', 'bouquetin-de-brume', 'poney-de-brume', 'grenouille-de-brume', 'fennec-de-brume', 'cameleon-de-brume', 'salamandre-de-brume'
];
const known = new Set(ANIMALS);

// Les animaux rencontrés : [{ id, at (ms) }], dans l'ordre du livre
async function animalsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT item, bought_at FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${ANIMAL}%`]);
    const at = new Map(rows.map(r => [r.item.slice(ANIMAL.length), new Date(r.bought_at).getTime()]));
    return ANIMALS.filter(id => at.has(id)).map(id => ({ id, at: at.get(id) }));
}

// Un animal rencontré : retenu une seule fois (deux touchers à la fois : une seule ligne) → { animal, at, new }
async function meetAnimal(userId, id) {
    if (!known.has(id)) return { status: 404 };
    const added = await db.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'bestiaire') ON CONFLICT DO NOTHING RETURNING bought_at`, [userId, `${ANIMAL}${id}`]);
    if (added.rows.length) return { animal: id, at: new Date(added.rows[0].bought_at).getTime(), new: true };
    const { rows } = await db.query('SELECT bought_at FROM world_items WHERE user_id = $1 AND item = $2', [userId, `${ANIMAL}${id}`]);
    return { animal: id, at: new Date(rows[0].bought_at).getTime(), new: false };
}

module.exports = { ANIMALS, animalsOf, meetAnimal };
