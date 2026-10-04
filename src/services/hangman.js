// Le pendu d'une page du Livre, sans base de données : lettres de jeu, erreurs permises, état montré au joueur.
// Le joueur pose une lettre dans la case de son choix : juste → elle s'inscrit ; présente ailleurs → rien n'est perdu ;
// absente du mot → une goutte d'encre. Il ne reçoit qu'un masque (lettres posées, null ailleurs) ; l'emoji dès la
// première lettre posée (l'illustration se découvre par morceaux) ; le nom complet ne sort qu'à la fin (élément inscrit).

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

// Case visible : caractère hors jeu, lettre posée, ou première lettre donnée par la page
const shownAt = (name, revealed, first) => [...name].map((char, i) => !fold(char) || revealed.includes(i) || (first && i === 0));

// Verdict d'une lettre posée en `position` : 'hit' (juste), 'elsewhere' (dans le mot, pas ici), 'miss' (absente)
function judge(name, position, letter) {
    if (fold([...name][position]) === letter) return 'hit';
    return has(name, letter) ? 'elsewhere' : 'miss';
}

const solvedBy = (name, revealed, first) => shownAt(name, revealed, first).every(Boolean);

// État d'une partie. row = { letters, revealed, misses, failed_at } ou rien ; first : la page donne la première lettre.
function state(name, row, max, first, emoji, now = new Date()) {
    const letters = row?.letters || '';
    const revealed = row?.revealed || [];
    const chars = [...name];
    const shown = shownAt(name, revealed, first);
    const mask = chars.map((char, i) => (shown[i] ? char : null));
    const playable = chars.map((char, i) => Boolean(fold(char)) && !(first && i === 0));
    const total = playable.filter(Boolean).length;
    const share = total ? playable.filter((yes, i) => yes && shown[i]).length / total : 1;
    const until = failedUntil(row, now);
    return {
        mask,
        tried: [...letters],
        // Lettres essayées absentes du mot (les autres sont dans le mot, posées ou non)
        absent: [...letters].filter(letter => !has(name, letter)),
        // Un échec passé (plus de 24 h) ne compte plus : la partie reprend avec toutes ses vies
        misses: row?.failed_at && !until ? 0 : row?.misses || 0,
        max,
        failedUntil: until ? until.toISOString() : null,
        share,
        ...(revealed.length ? { emoji } : {})
    };
}

module.exports = { RETRY_HOURS, maxMisses, fold, has, judge, solvedBy, failedUntil, state };
