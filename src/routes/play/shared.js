// Outils communs des routes de jeu : limites par joueur, résolution du joueur, aides payantes.
const players = require('../../services/players');
const book = require('../../services/recipeBook');
const ledger = require('../../services/ledger');
const bookPages = require('../../services/bookPages');
const bookTries = require('../../services/bookTries');
const bookLetters = require('../../services/bookLetters');
const achievementService = require('../../services/achievementService');
const { verifyAccess, readCookie } = require('../../services/authSession');
const { limiter } = require('../../middleware/rateLimit');
const { log } = require('../../utils/logger');

const HELP_PRICE = 50; // encre du Livre et joker payant de l'Épreuve
const NAME = /^[^\u0000-\u001f]{1,60}$/;
const PAGE = /^[A-Za-z0-9_-]{1,32}$/;

// Limites : par joueur (compte ou cookie invité), et par adresse pour la création de carnets invités
const SLOW_DOWN = 'Doucement ! Réessaie dans un instant.';
const playerKey = req => {
    const user = verifyAccess(req);
    if (user) return `u:${user.id}`;
    return `g:${readCookie(req, 'oc_guest') || req.ip}`;
};
const playLimiter = limiter({ minutes: 1, max: 120, key: playerKey, message: SLOW_DOWN });
const addressLimiter = limiter({ minutes: 1, max: 600, key: req => req.ip, message: SLOW_DOWN });
const guestLimiter = limiter({ minutes: 60, max: 20, key: req => req.ip, message: SLOW_DOWN });

const fail = (res, error, what) => {
    log('error', what, { errorMessage: error.message });
    res.status(500).json({ message: 'Le serveur de jeu ne répond pas, réessaie.' });
};

// Joueur obligatoire : sans compte ni carnet invité, 401 NO_PLAYER (le front crée alors un carnet)
const withPlayer = handler => async (req, res) => {
    try {
        const owner = await players.resolve(req);
        if (!owner) return res.status(401).json({ message: 'Aucune partie', code: 'NO_PLAYER' });
        await handler(req, res, owner, await book.load());
    } catch (error) {
        fail(res, error, `Jeu ${req.path}`);
    }
};

// Compte obligatoire (le Monde : ses ressources et ses écus sont gardés par le serveur)
const ACCOUNT_ONLY = { message: 'Ton île t’attend : crée un compte pour la bâtir.', code: 'ACCOUNT' };
const withAccount = handler => withPlayer((req, res, owner, b) => (
    owner.kind === 'user' ? handler(req, res, owner, b) : res.status(402).json(ACCOUNT_ONLY)
));

// Débit d'une aide : compte seulement (les écus d'un invité n'existent pas côté serveur)
async function pay(owner, reason) {
    if (owner.kind !== 'user') return { status: 402, message: 'Les aides payantes demandent un compte.' };
    const coins = await ledger.debit(owner.id, HELP_PRICE, reason);
    if (coins === null) return { status: 400, message: `Il te faut ${HELP_PRICE} écus.` };
    return { coins };
}

// Nouvelle découverte du Livre (mélange ou pendu) : sa page n'a plus de pendu ni d'essais ratés, les succès
// sont revus (compte). Renvoie les mélanges encore inexplorés de chaque élément possédé.
async function discovered(owner, b, owned, name) {
    const page = bookPages.pageId(name);
    await bookLetters.clear(owner.key, page);
    if (owner.kind === 'user') {
        await bookTries.clear(owner.id, page);
        await achievementService.syncAchievements(owner.id);
    }
    return book.unexplored(b, [...owned, name]);
}

module.exports = { NAME, PAGE, playLimiter, addressLimiter, guestLimiter, fail, withPlayer, withAccount, pay, discovered };
