// Les enseignes des bâtiments : la description de chaque style (STYLE_TEXTS, par identifiant : services/signs.js), et
// ce que répond l'île quand on en choisit un (services/world.js).

const STYLE_TEXTS = {
    bois: 'Clouée sur deux piquets, peinte à la main.',
    ardoise: 'Écrite à la craie, sur un chevalet.',
    fer: 'Suspendue à une potence, elle se balance au vent.',
    laiton: 'Lettres gravées, rivets polis : elle brille au soleil.',
    fleurie: 'Une couronne de fleurs, et des papillons qui s’y posent.',
    lanterne: 'Deux lanternes l’éclairent dès la tombée de la nuit.'
};

const STYLE_UNKNOWN = 'Style d’enseigne inconnu.';
const SIGN_LEVEL = 'L’enseigne vient au palier V du bâtiment.';
const STYLE_PRICE = price => `Ce style coûte ${price} écus.`;

module.exports = { STYLE_TEXTS, STYLE_UNKNOWN, SIGN_LEVEL, STYLE_PRICE };
