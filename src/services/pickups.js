// Ce que la mer a rendu, sur la plage de Brumelune (bible, § 9, étape 4 : « ramasser ») : du bois flotté, des galets, puis des
// coquillages. Au tutoriel, à des cases fixes du sable, près du camp ; ensuite (choix de l'auteur, 15 oct. : la plage
// ne doit pas être prévisible), chaque trouvaille revient ailleurs, et d'une autre source, à chaque marée. Un toucher
// en verse un peu dans les réserves (le sac : bois, nourriture, pierre), puis la trouvaille repousse. Les ramassages se
// gardent comme ceux des gisements de climat (world_deposits, identifiants « greve-… »), sans donnée nouvelle.
// Fonctions pures.
const map = require('./worldMap');
const { mulberry32 } = require('./crafts');

// Ce que donne chaque sorte, versé dans les réserves
const KINDS = {
    bois: { name: 'Bois flotté', gives: { wood: 2 } },
    // (deux coquillages : la soupe d’Agathe, dix vivres, le jour d’Agathe ; choix de l'auteur, 11 oct.)
    coquillage: { name: 'Coquillages', gives: { food: 5 } },
    galet: { name: 'Galets', gives: { stone: 2 } },
    // (les débris de la grande Hirondelle, sur l'ancienne butte devant le Feu : de quoi bâtir ; choix de l'auteur, 15 oct.)
    planche: { name: 'Planches de l\'Hirondelle', gives: { wood: 3 } },
    ferraille: { name: 'Ferraille de l\'Hirondelle', gives: { stone: 2 } }
};
// Les cases de la plage : le sable au bord de l'eau, au pied du camp (le cœur de l'île, à soi dès le départ), toutes
// sur le sable découvert dès l'arrivée. Le premier soir (choix de l'auteur, 11 oct.) : deux bois flottés et un galet,
// exactement le prix du feu de camp ; les coquillages, au jour d’Agathe (after : la quête faite avant qu'ils
// paraissent). Le coin d’Agathe, au bout de la plage (x 99 et plus), se voit dès la première nuit (le carré de la
// plage, choix de l'auteur, 12 oct.) : rien du premier soir n'y est, ses coquillages paraissent avec elle
const SPOTS = [
    ['greve-bois-1', 'bois', 95, 98], ['greve-galet-1', 'galet', 98, 98], ['greve-bois-2', 'bois', 97, 98],
    ['greve-coquillage-1', 'coquillage', 102, 98, 'veille'], ['greve-coquillage-2', 'coquillage', 103, 98, 'veille'],
    // (les débris de l'épave, après le Feu : le compte du premier soir ne change pas)
    ['greve-planche-1', 'planche', 101, 97, 'feu'], ['greve-ferraille-1', 'ferraille', 104, 97, 'feu'], ['greve-planche-2', 'planche', 105, 96, 'feu']
].map(([id, kind, x, y, after]) => ({ id, kind, x, y, ...(after ? { after } : {}) }));
// La trouvaille paraît-elle déjà ? done : les quêtes faites (quests.doneOf)
const shownFor = (spot, done) => !spot.after || done.has(spot.after);
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));
const PREFIX = 'greve-';
// Une trouvaille ramassée repousse en 3 h (la mer en rend d'autres)
const REGROW_MS = 3 * 3600 * 1000;


// Après le tutoriel, chaque trouvaille a sa source (la sorte qu'elle rapporte, au poids ; où elle s'échoue) : la laisse
// de mer, tout le sable au bord de l'eau des quartiers à soi ; les débris de l'Hirondelle, le sable autour de l'épave ;
// les creux de l'anse, où les coquillages se prennent (l'identifiant d'une trouvaille reste celui du tutoriel)
const TUTORIAL_LAST = 'chemin';
const WRECK_REACH = 3;
const SOURCES = {
    laisse: { weights: { bois: 5, coquillage: 3, galet: 2 }, near: 'mer' },
    epave: { weights: { bois: 3, galet: 2 }, near: 'epave' },
    anse: { weights: { coquillage: 4, galet: 1, bois: 1 }, near: 'mer' }
};
const SOURCE_OF = { 'greve-bois-1': 'laisse', 'greve-bois-2': 'laisse', 'greve-galet-1': 'epave', 'greve-coquillage-1': 'anse', 'greve-coquillage-2': 'anse' };
// La marée où la trouvaille revient : l'instant de son dernier ramassage (0 : jamais ramassée)
const waveOf = at => (at ? new Date(at).getTime() : 0);
// Empreinte d'un texte (FNV-1a, 32 bits)
function hashOf(text) {
    let h = 0x811c9dc5;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    return h >>> 0;
}
// Graine de son tirage : le joueur, la trouvaille, sa marée
const seedOf = (userId, id, wave) => hashOf(`${userId}:${id}:${wave}`);
// Tirage au poids : la clé tirée
function pick(weights, r) {
    const entries = Object.entries(weights);
    let at = r * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [key, w] of entries) {
        if (at < w) return key;
        at -= w;
    }
    return entries[entries.length - 1][0];
}
// Le sable mouillé : une case de sable qui touche la mer (ou l'eau)
const wet = (x, y) => map.groundAt(x, y) === 's' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.heightAt(x + dx, y + dy) < 0 || map.groundAt(x + dx, y + dy) === 'w');
// Le sable mouillé de toute l'île, en ordre de lecture (calculé une fois)
const WET = [];
for (let y = 0; y < map.SIZE; y++) for (let x = 0; x < map.SIZE; x++) if (wet(x, y)) WET.push({ x, y });

// Ce que la mer a rendu (la vue) : [{ id, kind, x, y, at }] (at : le dernier ramassage, ou null), pour les trouvailles
// déjà parues (shownFor). Au tutoriel, à leurs cases et de leurs sortes ; ensuite, chacune tirée de (joueur, trouvaille,
// marée) : sa sorte parmi celles de sa source, sa case parmi celles de sa source, dans un quartier à soi, libre
// (free(x, y) : ni bâtiment, ni chemin, ni camp, ni lieu, ni gisement) et pas déjà prise par une autre ; sans case
// libre, elle attend. done : les quêtes faites ; gathered : Map id → dernier ramassage ; owned : quartiers à soi (Set) ;
// wreck : la case de l'épave ({ x, y })
function shoreOf({ userId, done, gathered, owned, free, wreck }) {
    const shown = SPOTS.filter(spot => shownFor(spot, done));
    if (!done.has(TUTORIAL_LAST)) {
        return shown.filter(spot => free(spot.x, spot.y)).map(spot => ({ id: spot.id, kind: spot.kind, x: spot.x, y: spot.y, at: gathered.get(spot.id) || null }));
    }
    const busy = new Set();
    const out = [];
    // (celles qui sont là depuis le plus longtemps choisissent d'abord : la dernière revenue cède sa case, jamais une
    // autre ne bouge pour elle)
    const since = spot => waveOf(gathered.get(spot.id));
    for (const spot of [...shown].sort((a, b) => since(a) - since(b))) {
        const at = gathered.get(spot.id) || null;
        const rand = mulberry32(seedOf(userId, spot.id, waveOf(at)));
        const source = SOURCES[SOURCE_OF[spot.id]];
        const kind = pick(source.weights, rand());
        // (chaque case a sa note pour cette marée ; la trouvaille prend la mieux notée qui est libre : elle ne bouge pas
        // quand une autre est ramassée ou qu'on bâtit ailleurs, seulement si on prend sa case)
        const seed = seedOf(userId, spot.id, waveOf(at));
        let cell = null;
        let best = Infinity;
        for (const c of source.near === 'epave' ? aroundWreck(wreck) : WET) {
            const score = hashOf(`${seed}:${c.x},${c.y}`);
            if (score >= best || busy.has(`${c.x},${c.y}`) || !owned.has(map.zoneAt(c.x, c.y)) || !free(c.x, c.y)) continue;
            cell = c;
            best = score;
        }
        if (!cell) continue;
        busy.add(`${cell.x},${cell.y}`);
        out.push({ id: spot.id, kind, x: cell.x, y: cell.y, at });
    }
    return SPOTS.map(spot => out.find(p => p.id === spot.id)).filter(Boolean);
}
// Le sable autour de l'épave (2 × 2 cases, coin haut-gauche wreck), en ordre de lecture
function aroundWreck(wreck) {
    const out = [];
    for (let y = wreck.y - WRECK_REACH; y <= wreck.y + 1 + WRECK_REACH; y++) {
        for (let x = wreck.x - WRECK_REACH; x <= wreck.x + 1 + WRECK_REACH; x++) {
            const inWreck = x >= wreck.x && x <= wreck.x + 1 && y >= wreck.y && y <= wreck.y + 1;
            if (!inWreck && map.groundAt(x, y) === 's') out.push({ x, y });
        }
    }
    return out;
}
// La sorte que la trouvaille rapporte à cette marée (le ramassage, sans relire la plage) : celle du tutoriel, ou celle
// de sa source
function kindOf({ userId, done, spot, at }) {
    if (!done.has(TUTORIAL_LAST)) return spot.kind;
    const rand = mulberry32(seedOf(userId, spot.id, waveOf(at)));
    return pick(SOURCES[SOURCE_OF[spot.id]].weights, rand());
}

module.exports = { KINDS, SPOTS, SPOT_BY_ID, PREFIX, REGROW_MS, SOURCES, TUTORIAL_LAST, shownFor, shoreOf, kindOf };
