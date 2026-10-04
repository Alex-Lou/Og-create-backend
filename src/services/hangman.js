// Le pendu d'une page du Livre, sans base de données : lettres de jeu, erreurs permises, état montré au joueur.
// Le joueur ne reçoit qu'un masque (lettres trouvées à leur place, null ailleurs) ; le nom n'apparaît qu'une fois
// toutes les lettres trouvées, l'emoji dès la première bonne lettre (l'illustration se découvre par morceaux).

const RETRY_HOURS = 24;

// Erreurs permises : 3 jusqu'au chapitre IV, 2 ensuite
const maxMisses = chapterId => (['I', 'II', 'III', 'IV'].includes(chapterId) ? 3 : 2);

// Lettre de jeu d'un caractère : A-Z sans accent, ou null (espace, tiret, apostrophe, œ… montrés d'emblée)
function fold(char) {
    const plain = char.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    return /^[A-Z]$/.test(plain) ? plain : null;
}

const has = (name, letter) => [...name].some(char => fold(char) === letter);

// Fin de l'échec (rejouable gratuitement à partir de là), ou null
function failedUntil(row, now = new Date()) {
    if (!row?.failed_at) return null;
    const until = new Date(new Date(row.failed_at).getTime() + RETRY_HOURS * 3600 * 1000);
    return until > now ? until : null;
}

// Mot entièrement découvert (la première lettre comptée si la page la donne)
const solvedBy = (name, letters, first) => [...name].every((char, i) => !fold(char) || letters.includes(fold(char)) || (first && i === 0));

// État d'une partie. row = { letters, misses, failed_at } ou rien ; first : la page donne déjà la première lettre.
function state(name, row, max, first, emoji, now = new Date()) {
    const letters = row?.letters || '';
    const chars = [...name];
    const playable = chars.map(fold);
    const mask = chars.map((char, i) => (!playable[i] || letters.includes(playable[i]) || (first && i === 0) ? char : null));
    const total = playable.filter(Boolean).length;
    const shown = playable.filter((letter, i) => letter && mask[i]).length;
    const share = total ? shown / total : 1;
    const until = failedUntil(row, now);
    const solved = mask.every(Boolean);
    return {
        mask,
        tried: [...letters],
        // Un échec passé (plus de 24 h) ne compte plus : la partie reprend avec toutes ses vies
        misses: row?.failed_at && !until ? 0 : row?.misses || 0,
        max,
        failedUntil: until ? until.toISOString() : null,
        share,
        ...([...letters].some(letter => has(name, letter)) ? { emoji } : {}),
        ...(solved ? { name, emoji } : {})
    };
}

module.exports = { RETRY_HOURS, maxMisses, fold, has, solvedBy, failedUntil, state };
