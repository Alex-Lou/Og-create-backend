// Erreurs du jeu, envoyées par le navigateur (routes/clientErrors.js) : ce qui en est gardé pour le journal de l'API,
// nettoyé et borné. Rien qui désigne le joueur : ni compte, ni adresse e-mail, ni paramètre d'adresse web (un lien
// reçu par e-mail en porte un jeton), ni contenu de partie.
const KINDS = new Set(['error', 'rejection', 'vue']);
const LIMITS = { message: 300, source: 200, stack: 1500, info: 80, mode: 20, version: 40 };

const EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[^\s@<>()"']+/g;
const QUERY = /\?[^\s)#]*/g;

// Du texte d'une ligne (la pile garde ses retours à la ligne), sans adresse ni paramètres, coupé à max
function text(value, max, multiline = false) {
    if (typeof value !== 'string') return '';
    const flat = multiline ? value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ') : value.replace(/[\u0000-\u001f\u007f]+/g, ' ');
    return flat.replace(EMAIL, '[adresse]').replace(QUERY, '').trim().slice(0, max);
}

// { kind, message, source?, stack?, info?, mode?, version? }, ou null si l'envoi ne décrit pas une erreur
function clean(body) {
    const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const kind = KINDS.has(b.kind) ? b.kind : null;
    const message = text(b.message, LIMITS.message);
    if (!kind || !message) return null;
    const out = { kind, message };
    for (const key of ['source', 'stack', 'info', 'mode', 'version']) {
        const value = text(b[key], LIMITS[key], key === 'stack');
        if (value) out[key] = value;
    }
    return out;
}

module.exports = { clean, LIMITS };
