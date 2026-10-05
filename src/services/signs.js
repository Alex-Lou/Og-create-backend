// Enseignes (lot 4d) : dès le palier V, chaque bâtiment porte une enseigne au nom que le joueur a choisi (un seul nom
// pour toute l'île). Six styles : la planche de bois est offerte, les autres s'achètent une fois en écus et se
// portent ensuite sur n'importe quel bâtiment au palier V ou plus (src/world/signSprites.js du front, mêmes
// identifiants).

const SIGN_LEVEL = 5;
const STYLES = [
    { id: 'bois', name: 'Planche de bois', price: 0, text: 'Clouée sur deux piquets, peinte à la main.' },
    { id: 'ardoise', name: 'Ardoise', price: 150, text: 'Écrite à la craie, sur un chevalet.' },
    { id: 'fer', name: 'Fer forgé', price: 300, text: 'Suspendue à une potence, elle se balance au vent.' },
    { id: 'laiton', name: 'Plaque de laiton', price: 300, text: 'Lettres gravées, rivets polis : elle brille au soleil.' },
    { id: 'fleurie', name: 'Enseigne fleurie', price: 450, text: 'Une couronne de fleurs, et des papillons qui s’y posent.' },
    { id: 'lanterne', name: 'Enseigne lanterne', price: 600, text: 'Deux lanternes l’éclairent dès la tombée de la nuit.' }
];
const STYLE_BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));

// Nom d'enseigne : 2 à 14 caractères, lettres (accents compris) et chiffres, avec un espace, une apostrophe ou un tiret
// seulement entre deux d'entre eux
const NAME_MAX = 14;
const NAME_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}]|[ '’-](?=[\p{L}\p{N}])){1,13}$/u;
const DEFAULT_NAME = 'Alchimiste';

// Nom saisi par le joueur, nettoyé (espaces en trop), ou null s'il ne convient pas
function cleanName(raw) {
    const name = String(raw ?? '').slice(0, 64).normalize('NFC').trim().replace(/\s+/g, ' ');
    return NAME_RE.test(name) ? name : null;
}

// Nom proposé tant que le joueur n'en a pas choisi : le premier mot de son identifiant (« alex.dupont_4821 » → « Alex »)
function defaultName(username) {
    const word = String(username ?? '').replace(/_\d+$/, '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')[0];
    const name = (word.charAt(0).toUpperCase() + word.slice(1)).slice(0, NAME_MAX);
    return NAME_RE.test(name) ? name : DEFAULT_NAME;
}

module.exports = { SIGN_LEVEL, STYLES, STYLE_BY_ID, NAME_MAX, cleanName, defaultName };
