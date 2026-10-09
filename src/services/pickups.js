// Ce que la mer a rendu, sur la plage de Brumelune (bible, § 9, étape 4 : « ramasser ») : du bois flotté, des coquillages et des
// galets, à des cases fixes du sable, près du camp. Un toucher en verse un peu dans les réserves (le sac : bois,
// nourriture, pierre), puis la trouvaille repousse. Les ramassages se gardent comme ceux des gisements de climat
// (world_deposits, identifiants « greve-… »), sans donnée nouvelle. Fonctions pures.

// Ce que donne chaque sorte, versé dans les réserves
const KINDS = {
    bois: { name: 'Bois flotté', gives: { wood: 2 } },
    coquillage: { name: 'Coquillages', gives: { food: 2 } },
    galet: { name: 'Galets', gives: { stone: 2 } }
};
// Les cases de la plage : le sable au bord de l'eau, au pied du camp (le cœur de l'île, à soi dès le départ)
const SPOTS = [
    ['greve-bois-1', 'bois', 93, 98], ['greve-coquillage-1', 'coquillage', 95, 98], ['greve-galet-1', 'galet', 98, 98],
    ['greve-bois-2', 'bois', 100, 98], ['greve-coquillage-2', 'coquillage', 102, 98], ['greve-galet-2', 'galet', 104, 98]
].map(([id, kind, x, y]) => ({ id, kind, x, y }));
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));
const PREFIX = 'greve-';
// Une trouvaille ramassée repousse en 3 h (la mer en rend d'autres)
const REGROW_MS = 3 * 3600 * 1000;

module.exports = { KINDS, SPOTS, SPOT_BY_ID, PREFIX, REGROW_MS };
