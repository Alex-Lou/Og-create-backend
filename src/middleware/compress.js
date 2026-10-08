// Réponses JSON compressées (gzip) quand le navigateur l'accepte et qu'elles valent la peine : la vue de l'île part
// après chaque action (70 Ko et plus, quelques Ko une fois compressée). zlib de Node, sans dépendance de plus.
const zlib = require('zlib');

// En dessous, la compression ne vaut pas son coût
const MIN_BYTES = 1024;

function compressJson(req, res, next) {
    if (!/\bgzip\b/.test(req.get('Accept-Encoding') || '')) return next();
    const json = res.json.bind(res);
    res.json = body => {
        const text = JSON.stringify(body);
        if (text === undefined || Buffer.byteLength(text) < MIN_BYTES || res.headersSent) return json(body);
        const packed = zlib.gzipSync(text, { level: 6 });
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Content-Encoding', 'gzip');
        res.vary('Accept-Encoding');
        return res.send(packed);
    };
    next();
}

module.exports = { compressJson, MIN_BYTES };
