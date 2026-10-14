// Le Grimoire (le Livre) : la phrase de la page de garde de chaque chapitre (VERSES, par numéro : services/bookPages.js),
// et ce que répondent l'Encre et le pendu des pages (routes/play/book.js, services/bookLetters.js).

const VERSES = {
    I: 'Au commencement, quatre souffles et une étincelle de curiosité.',
    II: 'Ce qui se pétrit, se fond, se forge : le monde a des mains.',
    III: 'Lève les yeux vers les astres, puis baisse-les vers les montagnes.',
    IV: 'Une graine, un souffle, un battement : tout ce qui pousse et respire.',
    V: 'Autour du feu, l’humain invente, rêve et bâtit sa maison.',
    VI: 'Des silex aux étoiles : les siècles tournent leurs pages.',
    VII: 'Ici s’écrit ce que nul n’a vu, et que tout le monde connaît.'
};

const OUT_OF_REACH = 'Cette page n’est pas à portée.';
const CELL_FILLED = 'Cette case est déjà remplie.';
const GAME_LOST = 'Partie perdue : reviens demain, ou rejoue contre des écus.';
const RETRY_ACCOUNT = 'Rejouer contre des écus demande un compte.';
const NOT_LOST = 'Cette partie n’est pas perdue.';

module.exports = { VERSES, OUT_OF_REACH, CELL_FILLED, GAME_LOST, RETRY_ACCOUNT, NOT_LOST };
