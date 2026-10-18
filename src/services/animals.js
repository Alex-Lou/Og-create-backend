// Le Bestiaire des animaux rencontrés (choix de l'auteur, 18 oct.) : la première fois qu'on touche un animal sur l'île
// (ou qu'on repousse un égaré, la nuit), il entre au Bestiaire, pour tous les appareils du compte. Une ligne de
// world_items par animal (préfixe ANIMAL, sans donnée nouvelle) ; sa date d'entrée est celle de la ligne. Le jeu sait où
// et quand chacun vit (world/creatures.js du dépôt front) ; le serveur garde la liste des animaux connus, par catégorie,
// pour refuser les autres et récompenser une catégorie complète : COINS_PER_ANIMAL écus par animal, une seule fois.
const db = require('../config/db');
const ledger = require('./ledger');

const ANIMAL = 'animal:';
const COINS_PER_ANIMAL = 25;
// Les animaux du Bestiaire par catégorie, dans l'ordre du livre (le jeu : world/creatures.js, CREATURES)
const CATEGORIES = {
    bois: ['lapin', 'ecureuil', 'mesange', 'renard', 'herisson', 'cerf', 'hibou'],
    fleurs: ['papillon', 'papillon-lune', 'luciole', 'abeille'],
    eau: ['grenouille', 'tortue', 'heron', 'koi', 'loutre'],
    mer: ['crabe', 'mouette', 'sardines', 'dauphin', 'baleine', 'geant', 'kraken'],
    lointain: ['macareux', 'poney', 'bouquetin', 'renard-polaire', 'chameau', 'fennec', 'toucan', 'cameleon', 'corbeau', 'salamandre'],
    ferme: [
        'poule', 'coq', 'poussin', 'vache', 'mouton', 'cochon', 'chevre', 'chat', 'chien',
        'bosco', 'bouillon', 'tic-tac', 'bulle', 'mousse', 'basalte', 'lunette'
    ],
    brume: [
        'fantome', 'zombie', 'noye', 'racine', 'esprit',
        'lapin-de-brume', 'bouquetin-de-brume', 'poney-de-brume', 'grenouille-de-brume', 'fennec-de-brume', 'cameleon-de-brume', 'salamandre-de-brume'
    ],
    legendes: ['cerf-blanc', 'phenix']
};
const ANIMALS = Object.values(CATEGORIES).flat();
const known = new Set(ANIMALS);

// Les animaux rencontrés : [{ id, at (ms) }], dans l'ordre du livre
async function animalsOf(userId, conn = db) {
    const { rows } = await conn.query('SELECT item, bought_at FROM world_items WHERE user_id = $1 AND item LIKE $2', [userId, `${ANIMAL}%`]);
    const at = new Map(rows.map(r => [r.item.slice(ANIMAL.length), new Date(r.bought_at).getTime()]));
    return ANIMALS.filter(id => at.has(id)).map(id => ({ id, at: at.get(id) }));
}

// Un animal rencontré : retenu une seule fois (deux touchers à la fois : une seule ligne). Une rencontre nouvelle verse
// la récompense de chaque catégorie complète pas encore versée (aussi celle complétée avant qu'elle existe) →
// { animal, at, new, rewards: [{ category, coins }], coins (le solde, s'il a changé) }
async function meetAnimal(userId, id) {
    if (!known.has(id)) return { status: 404 };
    return db.transaction(async conn => {
        const added = await conn.query(`INSERT INTO world_items (user_id, item, source) VALUES ($1, $2, 'bestiaire') ON CONFLICT DO NOTHING RETURNING bought_at`, [userId, `${ANIMAL}${id}`]);
        if (!added.rows.length) {
            const { rows } = await conn.query('SELECT bought_at FROM world_items WHERE user_id = $1 AND item = $2', [userId, `${ANIMAL}${id}`]);
            return { animal: id, at: new Date(rows[0].bought_at).getTime(), new: false, rewards: [] };
        }
        const met = new Set((await animalsOf(userId, conn)).map(a => a.id));
        const rewards = [];
        let coins;
        for (const [category, list] of Object.entries(CATEGORIES)) {
            if (!list.every(a => met.has(a))) continue;
            const done = await ledger.credit(userId, list.length * COINS_PER_ANIMAL, 'bestiaire', category, conn);
            if (!done.credited) continue;
            rewards.push({ category, coins: list.length * COINS_PER_ANIMAL });
            coins = done.coins;
        }
        return { animal: id, at: new Date(added.rows[0].bought_at).getTime(), new: true, rewards, ...(coins === undefined ? {} : { coins }) };
    });
}

module.exports = { ANIMALS, CATEGORIES, COINS_PER_ANIMAL, animalsOf, meetAnimal };
