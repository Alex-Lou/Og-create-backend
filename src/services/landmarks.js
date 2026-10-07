// Lieux remarquables des terres nouvelles (lot 9c) : treize lieux uniques, un ou deux par climat, chacun sur une case
// fixe de son quartier. Une fois le quartier acheté, un toucher découvre le lieu : un coffre (rare, légendaire pour les
// plus lointains), une page du Carnet d'explorateur et un effet durable, propre à son climat. Fonctions pures.
const map = require('./worldMap');

const SITE_LABEL = { carriere: 'la Carrière', bosquet: 'le Bosquet', puits: 'le Puits', potager: 'le Potager', ponton: 'le Ponton' };
// Bâtiments qui produisent (une réserve plus grande vaut pour chacun)
const PRODUCERS = Object.keys(SITE_LABEL);

// effect : charges (parties en réserve), moves (coups par Récolte), regenCut (ms gagnées sur le retour d'une partie),
// cap (heures de production gardées, pour chaque bâtiment qui produit), prod ({ bâtiment: part en plus })
const LANDMARKS = [
    {
        id: 'grotte', name: 'La Grotte de glace', zone: 'neiges', x: 78, y: 15, chest: 'legendaire', effect: { charges: 1 },
        text: 'Une bouche bleue s’ouvre au pied du glacier ; dedans, la glace chante quand le vent passe.'
    },
    {
        id: 'lac', name: 'Le Lac gelé', zone: 'neiges', x: 66, y: 12, chest: 'rare', effect: { cap: 2 },
        text: 'Sous la glace claire dorment des poissons d’argent, immobiles comme des souvenirs.'
    },
    {
        id: 'col', name: 'Le Col du Vent', zone: 'contreforts', x: 54, y: 21, chest: 'rare', effect: { regenCut: 3 * 60 * 1000 },
        text: 'Des fanions claquent entre deux pics : ici, le vent pousse toujours dans le dos du voyageur.'
    },
    {
        id: 'menhirs', name: 'Le Cercle de menhirs', zone: 'menhirs', x: 20, y: 33, chest: 'rare', effect: { moves: 2 },
        text: 'Sept pierres dressées, plus vieilles que l’île ; leurs gravures luisent à la nuit tombée.'
    },
    {
        id: 'arche', name: 'L’Arche des falaises', zone: 'falaises', x: 5, y: 21, chest: 'rare', effect: { prod: { carriere: 0.1 } },
        text: 'La mer a percé la falaise d’une arche immense, où nichent les goélands.'
    },
    {
        id: 'saule', name: 'Le Saule millénaire', zone: 'roselieres', x: 33, y: 68, chest: 'rare', effect: { prod: { potager: 0.1 } },
        text: 'Ses branches trempent dans l’eau dormante ; les grenouilles le disent aussi vieux que la brume.'
    },
    {
        id: 'pilotis', name: 'La Cabane sur pilotis', zone: 'bayou', x: 15, y: 78, chest: 'rare', effect: { prod: { ponton: 0.1 } },
        text: 'Une cabane de pêcheur oubliée, perchée sur l’eau ; les lucioles y tiennent conseil chaque soir.'
    },
    {
        id: 'oasis', name: 'La Source de l’oasis', zone: 'oasis', x: 30, y: 120, chest: 'rare', effect: { prod: { puits: 0.1 } },
        text: 'Au milieu du sable, une eau fraîche jaillit d’un rocher, à l’ombre de trois palmiers.'
    },
    {
        id: 'pyramide', name: 'La Pyramide ensablée', zone: 'dunes', x: 39, y: 132, chest: 'legendaire', effect: { moves: 2 },
        text: 'Seul son sommet dépasse des dunes ; le soleil couchant y dessine des signes oubliés.'
    },
    {
        id: 'arbre', name: 'L’Arbre-géant', zone: 'canopee', x: 66, y: 123, chest: 'rare', effect: { prod: { bosquet: 0.1 } },
        text: 'Son tronc vaut dix maisons ; dans ses racines, la jungle entière semble respirer.'
    },
    {
        id: 'cascade', name: 'La Grande cascade', zone: 'cascade', x: 93, y: 120, chest: 'legendaire', effect: { cap: 2 },
        text: 'L’eau tombe de la falaise en un rideau blanc ; dans ses embruns flotte toujours un arc-en-ciel.'
    },
    {
        id: 'geyser', name: 'Le Geyser', zone: 'coulees', x: 120, y: 129, chest: 'legendaire', effect: { regenCut: 3 * 60 * 1000 },
        text: 'Toutes les quelques minutes, la terre souffle une colonne de vapeur brûlante vers le ciel.'
    },
    {
        id: 'cratere', name: 'Le Lac de lave', zone: 'cratere', x: 126, y: 120, chest: 'legendaire', effect: { charges: 1 },
        text: 'Au cœur du cratère, la lave bouillonne lentement ; ses lueurs se voient depuis toute l’île.'
    }
];
const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map(l => [l.id, l]));
// Cases des lieux (clés y * SIZE + x) : rien ne s'y pose
const CELLS = new Set(LANDMARKS.map(l => l.y * map.SIZE + l.x));
const isLandmark = (x, y) => CELLS.has(y * map.SIZE + x);

// Ce que fait un lieu découvert (Carnet, bulle)
function effectText({ effect }) {
    if (effect.charges) return `+${effect.charges} partie de Récolte en réserve`;
    if (effect.moves) return `+${effect.moves} coups par Récolte`;
    if (effect.regenCut) return `Une partie revient ${Math.round(effect.regenCut / 60000)} min plus vite`;
    if (effect.cap) return `Chaque bâtiment garde ${effect.cap} h de production de plus`;
    const [site, part] = Object.entries(effect.prod)[0];
    return `+${Math.round(part * 100)} % de production pour ${SITE_LABEL[site]}`;
}

// Bonus des lieux découverts (found : Set des identifiants) : { prod: { bâtiment: part }, cap: { bâtiment: heures },
// charges, moves, regenCut }
function bonusesOf(found) {
    const out = { prod: {}, cap: {}, charges: 0, moves: 0, regenCut: 0 };
    for (const id of found) {
        const effect = LANDMARK_BY_ID[id]?.effect;
        if (!effect) continue;
        out.charges += effect.charges || 0;
        out.moves += effect.moves || 0;
        out.regenCut += effect.regenCut || 0;
        if (effect.cap) PRODUCERS.forEach(site => { out.cap[site] = (out.cap[site] || 0) + effect.cap; });
        for (const [site, part] of Object.entries(effect.prod || {})) out.prod[site] = (out.prod[site] || 0) + part;
    }
    return out;
}

module.exports = { LANDMARKS, LANDMARK_BY_ID, PRODUCERS, isLandmark, effectText, bonusesOf };
