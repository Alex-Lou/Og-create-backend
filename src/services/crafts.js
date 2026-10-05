// Créations d'île (lot 8) : ce qu'on fabrique pour l'île, à la place des éléments du Livre posés n'importe où.
// - Catalogue : chaque création coûte des ressources (prises au stock) et demande des éléments déjà découverts dans le
//   Livre (savoir-faire, non consommés). Elle s'ouvre quand son palier est ouvert et qu'on a déjà fabriqué celles qui
//   la précèdent (after).
// - Paliers : « start » ouvert d'emblée (pour apprendre) ; I : chapitre I du Livre entièrement trouvé, ou EPREUVES
//   questions de l'Épreuve réussies ; II, III : chapitre II, III entièrement trouvé. « climat » (lot 9d) : ouvert
//   d'emblée, ses créations coûtent aussi des trouvailles de climat (finds) et ne se posent que dans leur climat ;
//   chacune posée dans un quartier y fait rendre une trouvaille de plus à chaque ramassage (world.js).
// - Fabrication : un puzzle d'assemblage. Le gabarit (cases de la silhouette) se découpe, d'après une graine, en
//   pièces de 2 à 4 cases ; dès le palier II, les pièces arrivent tournées. Le joueur pose chaque pièce (rotation,
//   case) ; le serveur vérifie que les pièces couvrent exactement le gabarit. Le front reçoit les pièces ; il ne
//   recopie que le quart de tour (turn, src/world/crafts.js).
// - Pose : sol permis (ground), au bord d'un chemin (path), près d'un bâtiment (nearSite) ou d'une autre création
//   (nearCraft), à reach cases au plus (en tous sens), dans un quartier d'un climat (climate).
// Fonctions pures, sans base de données.
const map = require('./worldMap');
const finds = require('./finds');

const EPREUVES = 10;
const TIERS = ['start', 'I', 'II', 'III', 'climat'];
// Plus grande pièce, et pièces tournées, selon le palier
const PIECE_MAX = { start: 3, I: 3, II: 4, III: 4, climat: 4 };
const TURNED = { start: false, I: false, II: true, III: true, climat: true };
// Sols des règles de pose, en clair
const GROUND_TEXT = { gm: 'sur l’herbe', s: 'sur le sable', n: 'sur la neige', lg: 'sur la lande', x: 'dans le marais', jg: 'dans la jungle', ar: 'sur la cendre ou la roche' };

// « de » + nom d'un climat, contracté (des Landes, du Marais, de la Jungle)
const ofPlace = name => name.replace(/^Les /, 'des ').replace(/^Le /, 'du ').replace(/^La /, 'de la ');

// Gabarit en lignes ('x' : case de la silhouette) ; spent : trouvailles de climat dépensées ({ trouvaille: nombre })
const craft = (id, name, tier, cost, elements, after, place, shape, spent = {}) => ({ id, name, tier, cost, elements, after, place, shape, finds: spent });
const CRAFTS = [
    craft('cloture', 'Clôture', 'start', { wood: 8 }, [], [], {}, ['x.x', 'xxx', 'x.x']),
    craft('massif', 'Massif de fleurs', 'start', { water: 6, food: 4 }, ['Terre'], [], { ground: 'gm' }, ['.x.', 'xxx', 'xxx']),
    craft('muret', 'Muret de pierre', 'I', { stone: 12 }, ['Terre'], ['cloture'], {}, ['xxxx', 'xxxx']),
    craft('lanterne', 'Lanterne', 'I', { wood: 6, stone: 6 }, ['Feu', 'Lumière'], [], { path: true }, ['xxx', 'xxx', '.x.', '.x.']),
    craft('banc', 'Banc', 'I', { wood: 14 }, [], ['cloture'], { nearCraft: { id: 'lanterne', reach: 2 } }, ['xxxx', 'xxxx', 'x..x']),
    craft('epouvantail', 'Épouvantail', 'I', { wood: 8, food: 8 }, ['Vent'], ['massif'], { nearSite: { id: 'potager', reach: 3 } }, ['.x.', 'xxx', '.x.', 'xxx']),
    craft('nichoir', 'Nichoir', 'I', { wood: 10 }, ['Air'], ['cloture'], { nearSite: { id: 'bosquet', reach: 3 } }, ['.x.', 'xxx', 'xxx', '.x.']),
    craft('girouette', 'Girouette', 'I', { wood: 10, stone: 6 }, ['Vent'], ['muret'], {}, ['xxx', '.x.', '.x.', 'xxx']),
    craft('fontaine', 'Fontaine', 'II', { stone: 30, water: 20 }, ['Pierre', 'Eau'], ['muret'], { nearSite: { id: 'puits', reach: 3 } }, ['.xx.', 'xxxx', 'xxxx', '.xx.']),
    craft('brasero', 'Brasero', 'II', { stone: 16, wood: 10 }, ['Fer', 'Charbon'], ['lanterne'], { path: true }, ['xxxx', 'xxxx', '.xx.', '.xx.']),
    craft('pergola', 'Pergola', 'II', { wood: 30, water: 10 }, ['Corde'], ['banc', 'massif'], {}, ['xxxxx', 'x.x.x', 'x.x.x']),
    craft('statue', 'Statue', 'II', { stone: 40 }, ['Marbre'], ['muret'], {}, ['.x.', 'xxx', '.x.', 'xxx', 'xxx']),
    craft('arche', 'Arche fleurie', 'II', { wood: 24, water: 16 }, ['Corde'], ['massif', 'cloture'], { path: true }, ['xxxx', 'x..x', 'x..x', 'x..x']),
    craft('etal', 'Étal du marché', 'II', { wood: 24, food: 16 }, ['Tissu'], ['banc'], { nearSite: { id: 'foyer', reach: 4 } }, ['xxxxx', 'xxxxx', 'x...x']),
    craft('kiosque', 'Kiosque', 'III', { wood: 60, stone: 40 }, ['Bronze'], ['pergola', 'lanterne'], {}, ['..x..', '.xxx.', 'xxxxx', '.x.x.', '.x.x.']),
    craft('cadran', 'Cadran solaire', 'III', { stone: 50 }, ['Soleil'], ['statue'], {}, ['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..']),
    craft('bassin', 'Bassin', 'III', { stone: 40, water: 40 }, ['Source'], ['fontaine'], { nearCraft: { id: 'fontaine', reach: 3 } }, ['xxxxx', 'x...x', 'xxxxx']),
    craft('longuevue', 'Longue-vue', 'III', { stone: 20, wood: 20 }, ['Étoile', 'Lentille'], ['girouette'], { ground: 's' }, ['...xx', '..xx.', '.xx..', 'xxx..', 'x.x..']),
    // Créations de climat (lot 9d) : deux par climat, la seconde après la première
    craft('igloo', 'Igloo', 'climat', { wood: 10 }, ['Neige'], [], { climate: 'cimes', ground: 'n' }, ['.xxx.', 'xxxxx', 'xx.xx'], { glace: 8 }),
    craft('sculpture', 'Sculpture de glace', 'climat', { stone: 10 }, ['Glace'], ['igloo'], { climate: 'cimes', ground: 'n' }, ['..x..', '.xxx.', '..x..', '.xxx.', 'xxxxx'], { glace: 12 }),
    craft('parc', 'Enclos à moutons', 'climat', { wood: 24 }, ['Mouton'], [], { climate: 'landes', ground: 'lg' }, ['xxxx', 'x..x', 'x..x', 'xxxx'], { laine: 8 }),
    craft('cairn', 'Cairn aux rubans', 'climat', { stone: 20 }, ['Vent'], ['parc'], { climate: 'landes', ground: 'lg' }, ['..x..', '.xxx.', '.xxx.', 'xxxxx'], { laine: 12 }),
    craft('passerelle', 'Passerelle de roseaux', 'climat', { wood: 16 }, ['Marais'], [], { climate: 'marais', ground: 'x' }, ['xxxxx', 'xxxxx', '.x.x.'], { roseau: 8 }),
    craft('heron', 'Héron de bois', 'climat', { wood: 14 }, ['Oiseau'], ['passerelle'], { climate: 'marais', ground: 'x' }, ['xx...', '.x...', '.xxxx', '..xx.', '..xx.'], { roseau: 12 }),
    craft('tente', 'Tente nomade', 'climat', { wood: 12, food: 10 }, ['Tissu'], [], { climate: 'dunes', ground: 's' }, ['..x..', '.xxx.', 'xxxxx', 'xx.xx'], { sel: 8 }),
    craft('cadransel', 'Cadran de sel', 'climat', { stone: 20 }, ['Sel'], ['tente'], { climate: 'dunes', ground: 's' }, ['.xxx.', 'xxxxx', 'xx.xx', 'xxxxx', '.xxx.'], { sel: 12 }),
    craft('hamac', 'Hamac', 'climat', { wood: 14 }, ['Corde'], [], { climate: 'jungle', ground: 'jg' }, ['x...x', 'xx.xx', 'xxxxx'], { fruits: 8 }),
    craft('totem', 'Totem', 'climat', { wood: 30 }, ['Jungle'], ['hamac'], { climate: 'jungle', ground: 'jg' }, ['xxx', '.x.', 'xxx', '.x.', 'xxx'], { fruits: 12 }),
    craft('obelisque', 'Obélisque d’obsidienne', 'climat', { stone: 24 }, ['Obsidienne'], [], { climate: 'volcan', ground: 'ar' }, ['..x..', '.xxx.', '.xxx.', '.xxx.', 'xxxxx'], { obsidienne: 10 }),
    craft('bassinchaud', 'Bassin chaud', 'climat', { stone: 20, water: 20 }, ['Vapeur'], ['obelisque'], { climate: 'volcan', ground: 'ar' }, ['.xxx.', 'xxxxx', 'xxxxx', '.xxx.'], { obsidienne: 12 })
];
const CRAFT_BY_ID = Object.fromEntries(CRAFTS.map(c => [c.id, c]));

// Cases d'un gabarit, dans l'ordre de lecture : [[x, y]]
const cellsOf = shape => shape.flatMap((row, y) => [...row].map((c, x) => (c === 'x' ? [x, y] : null)).filter(Boolean));

// Générateur pseudo-aléatoire déterministe (mulberry32) : nombres dans [0, 1)
function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// Pièce ramenée à son coin haut-gauche, cases triées (ligne puis colonne)
function normal(cells) {
    const mx = Math.min(...cells.map(c => c[0]));
    const my = Math.min(...cells.map(c => c[1]));
    return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
// Quart de tour (sens horaire), k fois
function turn(cells, k = 0) {
    let out = cells;
    for (let i = 0; i < ((k % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
    return normal(out);
}

// Découpe d'un gabarit en pièces, d'après la graine : chaque pièce grandit depuis la première case libre (ordre de
// lecture) vers des cases voisines tirées au hasard, jusqu'à sa taille (2 à max) ; une case restée seule rejoint une
// pièce voisine. Puis chaque pièce est présentée tournée (paliers II et III) : [[[x, y]]] (pièces normalisées)
function piecesOf(shape, seed, tier) {
    const rand = mulberry32(seed);
    const cells = cellsOf(shape);
    const key = (x, y) => `${x},${y}`;
    const free = new Set(cells.map(([x, y]) => key(x, y)));
    const owner = new Map();
    const pieces = [];
    for (const [x, y] of cells) {
        if (!free.has(key(x, y))) continue;
        const size = 2 + Math.floor(rand() * (PIECE_MAX[tier] - 1));
        const piece = [[x, y]];
        free.delete(key(x, y));
        while (piece.length < size) {
            const options = [];
            for (const [px, py] of piece) {
                for (const [dx, dy] of DIRS) {
                    const nx = px + dx;
                    const ny = py + dy;
                    if (free.has(key(nx, ny)) && !options.some(o => o[0] === nx && o[1] === ny)) options.push([nx, ny]);
                }
            }
            if (!options.length) break;
            const next = options[Math.floor(rand() * options.length)];
            piece.push(next);
            free.delete(key(next[0], next[1]));
        }
        pieces.push(piece);
        piece.forEach(([px, py]) => owner.set(key(px, py), pieces.length - 1));
    }
    // Une case seule rejoint la première pièce voisine (le gabarit est d'un seul tenant)
    for (let i = 0; i < pieces.length; i++) {
        if (pieces[i].length !== 1) continue;
        const [x, y] = pieces[i][0];
        const near = DIRS.map(([dx, dy]) => owner.get(key(x + dx, y + dy))).find(j => j !== undefined && j !== i && pieces[j].length);
        if (near === undefined) continue;
        pieces[near].push([x, y]);
        owner.set(key(x, y), near);
        pieces[i] = [];
    }
    return pieces.filter(p => p.length).map(p => turn(p, TURNED[tier] ? Math.floor(rand() * 4) : 0));
}

// Vérifie un assemblage : layout = [{ piece, rot, x, y }] (chaque pièce une fois, tournée rot quarts de tour, coin
// haut-gauche en (x, y) du gabarit). { ok: true } ou { ok: false, error }
function check(shape, pieces, layout) {
    if (!Array.isArray(layout) || layout.length !== pieces.length) return { ok: false, error: 'il manque des pièces' };
    const goal = new Set(cellsOf(shape).map(([x, y]) => `${x},${y}`));
    const used = new Set();
    const filled = new Set();
    for (const step of layout) {
        const { piece, rot, x, y } = step || {};
        if (![piece, rot, x, y].every(Number.isInteger) || piece < 0 || piece >= pieces.length || used.has(piece) || rot < 0 || rot > 3) {
            return { ok: false, error: 'pièce invalide' };
        }
        used.add(piece);
        for (const [cx, cy] of turn(pieces[piece], rot)) {
            const k = `${cx + x},${cy + y}`;
            if (!goal.has(k)) return { ok: false, error: 'une pièce dépasse du gabarit' };
            if (filled.has(k)) return { ok: false, error: 'deux pièces se chevauchent' };
            filled.add(k);
        }
    }
    return filled.size === goal.size ? { ok: true } : { ok: false, error: 'le gabarit n’est pas rempli' };
}

// Paliers ouverts : finished = Set des chapitres du Livre entièrement trouvés ; epreuves = questions réussies (le palier
// des climats est toujours ouvert : ses trouvailles le gardent)
function tiersOpen(finished, epreuves) {
    const open = new Set(['start']);
    if (finished.has('I') || epreuves >= EPREUVES) open.add('I');
    for (const t of ['II', 'III']) if (finished.has(t)) open.add(t);
    open.add('climat');
    return open;
}

// Ce qui empêche de fabriquer une création (texte), ou null. made : { création: nombre fabriqué } ; owned : Set des
// éléments du Livre ; stock : ressources ; open : paliers ouverts ; have : trouvailles de climat
function blockOf(c, { made, owned, stock, open, have = {} }) {
    if (!open.has(c.tier)) return c.tier === 'I' ? `Palier I : finis le chapitre I du Grimoire, ou réussis ${EPREUVES} questions de l’Épreuve.` : `Palier ${c.tier} : finis le chapitre ${c.tier} du Grimoire.`;
    const before = c.after.filter(id => !made[id]);
    if (before.length) return `Fabrique d’abord : ${before.map(id => CRAFT_BY_ID[id].name).join(', ')}.`;
    const unknown = c.elements.filter(e => !owned.has(e));
    if (unknown.length) return `Il faut savoir faire : ${unknown.join(', ')} (Grimoire).`;
    if (Object.entries(c.cost).some(([r, n]) => (stock[r] || 0) < n)) return 'Il te manque des ressources : joue une Récolte.';
    const short = Object.entries(c.finds).find(([f, n]) => (have[f] || 0) < n);
    if (short) {
        const find = finds.FIND_BY_ID[short[0]];
        return `Il te faut ${short[1]} ${find.name.toLowerCase()} : ramasses-en sur les gisements ${ofPlace(map.CLIMATES[find.climate])}.`;
    }
    return null;
}

// Règle de pose en clair (fiche) ; siteName : nom d'un bâtiment
function placeText(c, siteName = id => id) {
    const p = c.place;
    const parts = [];
    if (p.climate) parts.push(`dans ${map.CLIMATES[p.climate]}`);
    if (p.ground) parts.push(GROUND_TEXT[p.ground]);
    if (p.path) parts.push('au bord d’un chemin');
    if (p.nearSite) parts.push(`à ${p.nearSite.reach} cases au plus de « ${siteName(p.nearSite.id)} »`);
    if (p.nearCraft) parts.push(`à ${p.nearCraft.reach} cases au plus de « ${CRAFT_BY_ID[p.nearCraft.id].name} »`);
    return parts.length ? `Se pose ${parts.join(', ')}.` : 'Se pose sur n’importe quelle case libre.';
}

// Distance (en cases, diagonales comprises) entre une case et un rectangle { x, y, w, h }
const gapTo = (x, y, r) => Math.max(r.x - x, 0, x - (r.x + r.w - 1), r.y - y, 0, y - (r.y + r.h - 1));

// Ce qui empêche de poser cette création sur (x, y) (texte), ou null. ctx : { ground(x, y), free(x, y) (case libre :
// constructible, hors chantier, quartier à soi, ni annexe ni création), site(id) (emprise si bâti, sinon null),
// placed : [{ x, y, craft }] (les autres créations posées), climate(x, y) (climat du quartier) }
function spotBlock(c, x, y, ctx) {
    const p = c.place;
    if (!ctx.free(x, y)) return 'Case occupée ou hors de tes quartiers.';
    if (p.climate && ctx.climate(x, y) !== p.climate) return `Se pose dans ${map.CLIMATES[p.climate]}.`;
    if (!(p.ground || 'gsm').includes(ctx.ground(x, y))) return `Se pose ${GROUND_TEXT[p.ground || 'gm']}.`;
    if (p.path && !DIRS.some(([dx, dy]) => 'pk'.includes(ctx.ground(x + dx, y + dy)))) return 'Se pose au bord d’un chemin.';
    if (p.nearSite) {
        const at = ctx.site(p.nearSite.id);
        if (!at || gapTo(x, y, at) > p.nearSite.reach) return 'Trop loin du bâtiment demandé.';
    }
    if (p.nearCraft && !ctx.placed.some(o => o.craft === p.nearCraft.id && Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= p.nearCraft.reach)) {
        return `Se pose près de « ${CRAFT_BY_ID[p.nearCraft.id].name} ».`;
    }
    return null;
}

module.exports = {
    EPREUVES, TIERS, PIECE_MAX, TURNED, CRAFTS, CRAFT_BY_ID, cellsOf, mulberry32, normal, turn, piecesOf, check, tiersOpen, blockOf, placeText, gapTo, spotBlock
};
