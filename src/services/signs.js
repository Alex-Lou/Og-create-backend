// Enseignes (lot 4d) : dès le palier V, chaque bâtiment porte une enseigne au nom que le joueur a choisi (un seul nom
// pour toute l'île). Six styles : la planche de bois est offerte, les autres s'achètent une fois en écus et se
// portent ensuite sur n'importe quel bâtiment au palier V ou plus (src/world/nameSigns.js du front, mêmes
// identifiants).

const naming = require('./naming');
const { STYLE_TEXTS } = require('../texts/signs');

const SIGN_LEVEL = 5;
const STYLES = [
    { id: 'bois', name: 'Planche de bois', price: 0, text: STYLE_TEXTS.bois },
    { id: 'ardoise', name: 'Ardoise', price: 150, text: STYLE_TEXTS.ardoise },
    { id: 'fer', name: 'Fer forgé', price: 300, text: STYLE_TEXTS.fer },
    { id: 'laiton', name: 'Plaque de laiton', price: 300, text: STYLE_TEXTS.laiton },
    { id: 'fleurie', name: 'Enseigne fleurie', price: 450, text: STYLE_TEXTS.fleurie },
    { id: 'lanterne', name: 'Enseigne lanterne', price: 600, text: STYLE_TEXTS.lanterne }
];
const STYLE_BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));

// Nom d'enseigne : 2 à 14 caractères (règles communes des noms : naming.js)
const NAME_MAX = 14;
const DEFAULT_NAME = 'Alchimiste';

// Nom saisi par le joueur, nettoyé (espaces en trop), ou null s'il ne convient pas
const cleanName = raw => naming.cleanName(raw, NAME_MAX);

// Nom proposé tant que le joueur n'en a pas choisi : le premier mot de son identifiant (« alex.dupont_4821 » → « Alex »)
function defaultName(username) {
    const word = String(username ?? '').replace(/_\d+$/, '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')[0];
    const name = (word.charAt(0).toUpperCase() + word.slice(1)).slice(0, NAME_MAX);
    return cleanName(name) || DEFAULT_NAME;
}

module.exports = { SIGN_LEVEL, STYLES, STYLE_BY_ID, NAME_MAX, cleanName, defaultName };
