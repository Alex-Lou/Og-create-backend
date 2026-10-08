// Les choix de l'avatar composé sur la carte d'embarquement (bible, § 6.17) : ce que le serveur accepte, et rien
// d'autre. La liste suit le kit de dessin du front (design/personnages/avatar_choix.js, publié dans
// design/bibliotheque/svg/personnages/avatar/avatar.json) ; un choix inconnu est refusé, jamais deviné.
//
// Ce qui est libre : les formes, les nuanciers (peau, yeux, cheveux, tissus, métaux, lèvres) et les accessoires marqués
// gratuits. Ce qui se gagne (les autres accessoires et les teintures rares, à la boutique ou dans les coffres) ne passe
// que s'il est possédé : une ligne de world_items « tenue:<accessoire> » ou « teinture:<teinte> ». Fonctions pures,
// sans base de données (le possédé est passé par l'appelant).

const NUANCIERS = {
    peau: ['nacre', 'porcelaine', 'rosee', 'peche', 'doree', 'miel', 'sable', 'ocre', 'cannelle', 'bronze', 'cuivre', 'cacao', 'acajou', 'ebene', 'ombre', 'nuit'],
    cheveux: ['jais', 'noir', 'chocolat', 'brun', 'auburn', 'roux', 'cuivre', 'chatain', 'venitien', 'blond', 'platine', 'gris', 'blanc', 'nuit', 'bonbon', 'poudre', 'cerise', 'corail', 'lilas', 'violet', 'ciel', 'turquoise', 'menthe', 'sapin'],
    yeux: ['brun', 'chocolat', 'noisette', 'ambre', 'or', 'olive', 'vert', 'emeraude', 'eau', 'azur', 'bleu', 'grisbleu', 'gris', 'violet', 'rose', 'noir'],
    tissus: ['blanc', 'creme', 'sable', 'caramel', 'cuir', 'charbon', 'noir', 'rosepale', 'rose', 'framboise', 'corail', 'rouge', 'bordeaux', 'abricot', 'soleil', 'menthe', 'olive', 'foret', 'ciel', 'lagon', 'jean', 'marine', 'lavande', 'prune'],
    metaux: ['or', 'argent', 'orrose', 'cuivre', 'sombre'],
    levres: ['naturelles', 'rose', 'corail', 'framboise', 'nude', 'prune', 'rouge']
};
// Les teintures rares : elles s'ajoutent aux tissus et aux cheveux, une fois gagnées
const TEINTURES = ['nacre', 'opale', 'or', 'argent', 'rubis', 'saphir', 'emeraude', 'amethyste', 'onyx', 'aurore'];
const FORMES = {
    taille: ['petite', 'moyenne', 'grande'],
    silhouette: ['fine', 'moyenne', 'large', 'ronde'],
    visage: ['rond', 'ovale', 'carre'],
    formeYeux: ['ronds', 'amande', 'grands', 'rieurs', 'paisibles'],
    cils: ['sans', 'legers', 'recourbes'],
    sourcils: ['fins', 'epais', 'doux'],
    bouche: ['douce', 'sourire', 'malice', 'serieuse'],
    rousseur: ['non', 'legere', 'oui'],
    joues: ['roses', 'discretes'],
    grain: ['non', 'joue', 'levre'],
    coupe: ['courte', 'meche', 'bataille', 'carre', 'milongue', 'longue', 'ondulee', 'queue', 'queueCote', 'couettes', 'chignon', 'deuxChignons', 'couronne', 'tresses', 'bouclee', 'locks', 'rasee'],
    meches: ['sans', 'pointes', 'meches'],
    haut: ['tshirt', 'mariniere', 'pull', 'sweat', 'chemise', 'veste'],
    bas: ['pantalon', 'short', 'jupe', 'salopette', 'robe', 'robeEntiere']
};
// Chaque choix et ce dans quoi il se prend : une forme, ou un nuancier
const CHOIX = {
    taille: 'formes', silhouette: 'formes', peau: 'peau', visage: 'formes', yeux: 'yeux', formeYeux: 'formes', cils: 'formes',
    sourcils: 'formes', bouche: 'formes', levres: 'levres', rousseur: 'formes', joues: 'formes', grain: 'formes',
    coupe: 'formes', cheveux: 'cheveux', meches: 'formes', couleurMeches: 'cheveux', haut: 'formes', couleurHaut: 'tissus',
    bas: 'formes', couleurBas: 'tissus', chaussures: 'tissus'
};
const DEFAUT = {
    taille: 'moyenne', silhouette: 'moyenne', peau: 'peche', visage: 'rond', yeux: 'brun', formeYeux: 'ronds', cils: 'sans', sourcils: 'fins',
    bouche: 'douce', levres: 'naturelles', rousseur: 'non', joues: 'roses', grain: 'non', coupe: 'courte', cheveux: 'brun', meches: 'sans',
    couleurMeches: 'blond', haut: 'tshirt', couleurHaut: 'corail', bas: 'pantalon', couleurBas: 'jean', chaussures: 'cuir'
};
// Les accessoires : [emplacement, zones de couleur (t : tissu, m : métal), couleurs par défaut, gratuit]
const ACCESSOIRES = {
    bonnet: ['tete', 'tt', ['marine', 'creme'], true],
    paille: ['tete', 't', ['rouge'], true],
    casquette: ['tete', 't', ['ciel'], true],
    bandana: ['tete', 't', ['rouge'], true],
    couronneFleurs: ['tete', 't', ['rose'], true],
    beret: ['tete', 't', ['bordeaux'], false],
    oreillesChat: ['tete', 't', ['noir'], false],
    oreillesLapin: ['tete', 't', ['blanc'], false],
    diademe: ['tete', 'm', ['or'], false],
    cacheOreilles: ['tete', 'tt', ['rouge', 'rouge'], true],
    noeud: ['cheveux', 't', ['rose'], true],
    barrettes: ['cheveux', 't', ['soleil'], true],
    fleur: ['cheveux', 't', ['corail'], false],
    etoile: ['cheveux', 'm', ['or'], false],
    lunettesRondes: ['visage', 'm', ['sombre'], true],
    lunettesCarrees: ['visage', 't', ['noir'], true],
    lunettesPapillon: ['visage', 't', ['framboise'], false],
    lunettesSoleil: ['visage', 't', ['noir'], false],
    lunettesCoeur: ['visage', 't', ['rose'], false],
    coeurs: ['joues', 't', ['rose'], true],
    etoiles: ['joues', 't', ['soleil'], false],
    pansement: ['joues', 't', ['creme'], true],
    puces: ['oreilles', 'm', ['or'], true],
    anneaux: ['oreilles', 'm', ['or'], true],
    pendantsEtoile: ['oreilles', 'm', ['argent'], false],
    foulard: ['cou', 't', ['soleil'], true],
    echarpe: ['cou', 'tt', ['rouge', 'creme'], false],
    perles: ['cou', 'm', ['argent'], false],
    coquillage: ['cou', 'm', ['or'], true],
    papillon: ['cou', 't', ['rouge'], false],
    sacDos: ['dos', 't', ['abricot'], true],
    besace: ['dos', 't', ['caramel'], true],
    cape: ['dos', 't', ['bordeaux'], false],
    ailes: ['dos', 't', ['lavande'], false],
    peluche: ['main', 't', ['caramel'], false],
    panier: ['main', 't', ['rose'], false],
    ombrelle: ['main', 't', ['rosepale'], false],
    manteau: ['dessus', 'tt', ['marine', 'creme'], true],
    cire: ['dessus', 't', ['soleil'], true],
    chale: ['dessus', 'tt', ['prune', 'creme'], true],
    pelerine: ['dessus', 'tt', ['marine', 'creme'], true],
    etole: ['dessus', 't', ['creme'], true],
    bottesPluie: ['pieds', 't', ['rouge'], true],
    bottesFourrees: ['pieds', 'tt', ['caramel', 'creme'], true],
    moufles: ['mains', 'tt', ['rouge', 'creme'], true]
};

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const refuse = message => ({ status: 400, message });

// Ce qui est possédé : un Set de lignes world_items (« tenue:<id> », « teinture:<id> »)
const dyeOk = (key, owned) => TEINTURES.includes(key) && owned.has(`teinture:${key}`);
// Une couleur d'un nuancier (les tissus et les cheveux acceptent aussi une teinture gagnée)
function colorOk(nuancier, key, owned) {
    if (typeof key !== 'string') return false;
    if (NUANCIERS[nuancier].includes(key)) return true;
    return (nuancier === 'tissus' || nuancier === 'cheveux') && dyeOk(key, owned);
}

// Les choix envoyés par le joueur, vérifiés et complétés (les choix absents prennent ceux par défaut) :
// { choices } ou { status, message }. owned : Set des objets gagnés (world_items)
function cleanChoices(raw, owned = new Set()) {
    if (!plain(raw)) return refuse('Avatar invalide.');
    const out = {};
    for (const key of Object.keys(raw)) {
        if (key !== 'accessoires' && !own(CHOIX, key)) return refuse('Avatar invalide.');
    }
    for (const [key, from] of Object.entries(CHOIX)) {
        const value = own(raw, key) ? raw[key] : DEFAUT[key];
        const ok = from === 'formes' ? typeof value === 'string' && FORMES[key].includes(value) : colorOk(from, value, owned);
        if (!ok) return refuse('Ce choix n’existe pas, ou n’est pas encore à toi.');
        out[key] = value;
    }
    const worn = own(raw, 'accessoires') ? raw.accessoires : {};
    if (!plain(worn)) return refuse('Avatar invalide.');
    out.accessoires = {};
    for (const [place, item] of Object.entries(worn)) {
        if (item === null) continue;
        if (!plain(item) || typeof item.id !== 'string' || !own(ACCESSOIRES, item.id)) return refuse('Cet objet n’existe pas.');
        const [where, zones, defaults, free] = ACCESSOIRES[item.id];
        if (where !== place) return refuse('Cet objet ne se porte pas là.');
        if (!free && !owned.has(`tenue:${item.id}`)) return refuse('Cet objet n’est pas encore à toi.');
        const colors = item.couleurs === undefined ? [] : item.couleurs;
        if (!Array.isArray(colors) || colors.length > zones.length) return refuse('Avatar invalide.');
        const picked = [...zones].map((zone, i) => (colors[i] === undefined ? defaults[i] : colors[i]));
        if (!picked.every((key, i) => colorOk(zones[i] === 'm' ? 'metaux' : 'tissus', key, owned))) {
            return refuse('Cette couleur n’existe pas, ou n’est pas encore à toi.');
        }
        out.accessoires[place] = { id: item.id, couleurs: picked };
    }
    return { choices: out };
}

module.exports = { cleanChoices, NUANCIERS, TEINTURES, FORMES, CHOIX, DEFAUT, ACCESSOIRES };
