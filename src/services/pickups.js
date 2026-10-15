// Ce que la mer a rendu, sur la plage de Brumelune (bible, § 9, étape 4 : « ramasser ») : du bois flotté, des galets, puis des
// coquillages, à des cases fixes du sable, près du camp. Un toucher en verse un peu dans les réserves (le sac : bois,
// nourriture, pierre), puis la trouvaille repousse. Les ramassages se gardent comme ceux des gisements de climat
// (world_deposits, identifiants « greve-… »), sans donnée nouvelle. Fonctions pures.

// Ce que donne chaque sorte, versé dans les réserves
const KINDS = {
    bois: { name: 'Bois flotté', gives: { wood: 2 } },
    // (deux coquillages : la soupe d’Agathe, dix vivres, le jour d’Agathe ; choix de l'auteur, 11 oct.)
    coquillage: { name: 'Coquillages', gives: { food: 5 } },
    galet: { name: 'Galets', gives: { stone: 2 } }
};
// Les cases de la plage : le sable au bord de l'eau, au pied du camp (le cœur de l'île, à soi dès le départ), toutes
// sur le sable découvert dès l'arrivée. Le premier soir (choix de l'auteur, 11 oct.) : deux bois flottés et un galet,
// exactement le prix du feu de camp ; les coquillages, au jour d’Agathe (after : la quête faite avant qu'ils
// paraissent). Le coin d’Agathe, au bout de la plage (x 99 et plus), se voit dès la première nuit (le carré de la
// plage, choix de l'auteur, 12 oct.) : rien du premier soir n'y est, ses coquillages paraissent avec elle
const SPOTS = [
    ['greve-bois-1', 'bois', 95, 98], ['greve-galet-1', 'galet', 98, 98], ['greve-bois-2', 'bois', 97, 98],
    ['greve-coquillage-1', 'coquillage', 102, 98, 'veille'], ['greve-coquillage-2', 'coquillage', 103, 98, 'veille']
].map(([id, kind, x, y, after]) => ({ id, kind, x, y, ...(after ? { after } : {}) }));
// La trouvaille paraît-elle déjà ? done : les quêtes faites (quests.doneOf)
const shownFor = (spot, done) => !spot.after || done.has(spot.after);
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));
const PREFIX = 'greve-';
// Une trouvaille ramassée repousse en 3 h (la mer en rend d'autres)
const REGROW_MS = 3 * 3600 * 1000;

module.exports = { KINDS, SPOTS, SPOT_BY_ID, PREFIX, REGROW_MS, shownFor };
