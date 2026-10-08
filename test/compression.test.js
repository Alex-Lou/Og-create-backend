// Les réponses JSON assez grosses partent compressées (gzip) quand le navigateur l'accepte ; les petites, non
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const express = require('express');
const { compressJson, MIN_BYTES } = require('../src/middleware/compress');

test('gzip pour les grosses réponses acceptées, rien pour les petites ni sans Accept-Encoding', async () => {
  const app = express();
  app.use(compressJson);
  app.get('/gros', (req, res) => res.json({ data: 'x'.repeat(MIN_BYTES * 4) }));
  app.get('/petit', (req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const port = server.address().port;
  const get = (path, gzip) => new Promise((resolve, reject) => {
    http.get({ port, path, headers: gzip ? { 'Accept-Encoding': 'gzip, deflate' } : {} }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  try {
    const big = await get('/gros', true);
    assert.equal(big.headers['content-encoding'], 'gzip');
    assert.match(big.headers['content-type'], /application\/json/);
    assert.ok(big.body.length < MIN_BYTES);
    assert.equal(JSON.parse(zlib.gunzipSync(big.body)).data.length, MIN_BYTES * 4);
    const plain = await get('/gros', false);
    assert.equal(plain.headers['content-encoding'], undefined);
    const small = await get('/petit', true);
    assert.equal(small.headers['content-encoding'], undefined);
    assert.deepEqual(JSON.parse(small.body), { ok: true });
  } finally {
    server.close();
  }
});
