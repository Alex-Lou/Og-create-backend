// Les niveaux des jeux à grille (design/conception/minijeux_grille.md, § 2 et § 8) : la Récolte, le Filon, la
// Cueillette. 30 niveaux par jeu, en 3 saisons de 10 ; un objectif par niveau, affiché avant de jouer ; 1 à 3 étoiles
// selon la marge (coups ou secondes) qui reste quand l'objectif est rempli. Une étoile ouvre le niveau suivant ;
// 20 étoiles d'une saison ouvrent la suivante. Chaque étoile rapporte un petit bonus d'écus la première fois
// seulement (dans le plafond de la partie). Fonctions pures, copie conforme de src/game/levels.js : les deux suites de
// tests vérifient les mêmes niveaux.

const PER_SEASON = 10;
const SEASONS = 3;
const LEVELS = PER_SEASON * SEASONS;
const SEASON_STARS = 20;
// Le bonus de la 1re, 2e et 3e étoile d'un niveau (versé une fois)
const STAR_BONUS = [5, 5, 10];
// La marge (part des coups ou du temps qui reste) pour 2 et 3 étoiles
const MARGINS = [0.25, 0.5];
const GAMES = ['recolte', 'filon', 'cueillette'];

// L'objectif d'un niveau (1 à 30) : { need, text } ; il monte doucement d'un bout à l'autre
const ramp = (n, from, to) => from + Math.round(((n - 1) * (to - from)) / (LEVELS - 1));
const GOALS = {
    recolte: n => ({ need: ramp(n, 30, 90), text: need => `Récolte ${need} ressources` }),
    filon: n => ({ need: ramp(n, 2, 7), text: need => `Trouve ${need} pierres précieuses` }),
    cueillette: n => ({ need: ramp(n, 6, 24), text: need => `Remplis ton panier : ${need} cueillettes` })
};
function goalOf(game, n) {
    const { need, text } = GOALS[game](n);
    return { need, text: text(need) };
}
const seasonOf = n => Math.ceil(n / PER_SEASON);
const isLevel = n => Number.isInteger(n) && n >= 1 && n <= LEVELS;

// Les étoiles d'une partie : 0 si l'objectif n'est pas rempli. at : l'instant (coup ou ms) où il l'a été, ou null ;
// limit : les coups ou le temps de la partie
function starsOf(at, limit) {
    if (at === null || at === undefined) return 0;
    const margin = (limit - at) / limit;
    return 1 + MARGINS.filter(m => margin >= m).length;
}
// Où l'objectif a été rempli : la valeur de steps (cumuls croissants, un par coup ou par prise) qui l'atteint, son
// instant dans at (le même rang), ou null
function reachedAt(need, totals, at) {
    const k = totals.findIndex(v => v >= need);
    return k < 0 ? null : at[k];
}

// Ce qu'a donné une partie de ce niveau : { need, at (où l'objectif a été rempli, ou null), stars }. r : le rejeu
// (Récolte : totals, le total après chaque coup ; Filon et Cueillette : at, le coup ou l'instant de chaque prise) ;
// limit : les coups ou le temps de la partie
function outcomeOf(game, n, r, limit) {
    const { need } = goalOf(game, n);
    const totals = game === 'recolte' ? r.totals : r.at.map((_, i) => i + 1);
    const at = reachedAt(need, totals, game === 'recolte' ? totals.map((_, i) => i + 1) : r.at);
    return { need, at, stars: starsOf(at, limit) };
}

// Ce qui est ouvert, d'après les étoiles de chaque niveau (tableau de 30, 0 à 3) : { seasons (ouvertes), max (le plus
// haut niveau jouable), stars (total) }
function openOf(stars = []) {
    const at = n => stars[n - 1] || 0;
    const seasonStars = s => Array.from({ length: PER_SEASON }, (_, i) => at((s - 1) * PER_SEASON + i + 1)).reduce((a, b) => a + b, 0);
    let seasons = 1;
    while (seasons < SEASONS && seasonStars(seasons) >= SEASON_STARS) seasons++;
    let max = 1;
    while (max < seasons * PER_SEASON && at(max) > 0) max++;
    return { seasons, max, stars: stars.reduce((a, b) => a + (b || 0), 0) };
}
// Le niveau se joue-t-il ?
const playable = (stars, n) => isLevel(n) && n <= openOf(stars).max;

// Le bonus d'écus des étoiles gagnées pour la première fois sur un niveau (before : celles qu'il avait)
const bonusOf = (before, now) => STAR_BONUS.slice(before, Math.max(before, now)).reduce((a, b) => a + b, 0);

module.exports = { PER_SEASON, SEASONS, LEVELS, SEASON_STARS, STAR_BONUS, MARGINS, GAMES, goalOf, seasonOf, isLevel, starsOf, reachedAt, outcomeOf, openOf, playable, bonusOf };
