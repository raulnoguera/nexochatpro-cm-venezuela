// Prueba sin Meta ni Chatwoot reales: los avisos de mensajes de Instagram (firmados con la clave de Instagram) se reenvían a la ruta de Instagram
// de Chatwoot, los de Messenger a la de Messenger, y una firma inválida se rechaza. Uso: node scripts/probar_instagram_mensajes.mjs
import http from 'node:http'
import crypto from 'node:crypto'
import express from 'express'
import assert from 'node:assert/strict'

const recibidos = []
const cw = http.createServer((req, res) => {
  let cuerpo = ''
  req.on('data', d => (cuerpo += d)).on('end', () => { recibidos.push({ url: req.url, firma: req.headers['x-hub-signature-256'], cuerpo }); res.end('ok') })
}).listen(0)
await new Promise(r => cw.once('listening', r))
const puerto = cw.address().port

Object.assign(process.env, {
  META_APP_SECRET: 'clave-facebook', META_IG_APP_SECRET: 'clave-instagram', META_VERIFY_TOKEN: 'vt', META_DRY_RUN: '1',
  CHATWOOT_BOT_URL: `http://127.0.0.1:${puerto}/bot`, CHATWOOT_IG_URL: `http://127.0.0.1:${puerto}/webhooks/instagram`,
})
const { montarMeta } = await import('../src/meta.js')
const app = express(); app.use(express.json({ verify: (r, _s, b) => { r.rawBody = b } })); montarMeta(app)
const srv = app.listen(0)
const base = 'http://127.0.0.1:' + srv.address().port

const enviar = async (body, secreto) => {
  const raw = JSON.stringify(body)
  const r = await fetch(base + '/meta/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', secreto).update(raw).digest('hex') }, body: raw })
  await new Promise(r => setTimeout(r, 150))
  return r.status
}
const msgIg = { object: 'instagram', entry: [{ id: 'IG1', time: 1, messaging: [{ sender: { id: 'U1' }, recipient: { id: 'IG1' }, message: { mid: 'm1', text: 'hola' } }] }] }
const msgFb = { object: 'page', entry: [{ id: 'P1', time: 1, messaging: [{ sender: { id: 'U2' }, recipient: { id: 'P1' }, message: { mid: 'm2', text: 'hola' } }] }] }

assert.equal(await enviar(msgIg, 'clave-instagram'), 200, 'mensaje de Instagram con la clave de Instagram')
assert.equal(recibidos.at(-1).url, '/webhooks/instagram', 'va a la ruta de Instagram de Chatwoot')
assert.equal(recibidos.at(-1).cuerpo, JSON.stringify(msgIg), 'el cuerpo llega idéntico (Chatwoot revalida la firma)')
assert.equal(recibidos.at(-1).firma, 'sha256=' + crypto.createHmac('sha256', 'clave-instagram').update(JSON.stringify(msgIg)).digest('hex'), 'y con la misma firma')

assert.equal(await enviar(msgFb, 'clave-facebook'), 200, 'mensaje de Messenger con la clave de Facebook')
assert.equal(recibidos.at(-1).url, '/bot', 'va a la ruta de Messenger')

const antes = recibidos.length
assert.equal(await enviar(msgIg, 'clave-equivocada'), 401, 'firma inválida: rechazado')
assert.equal(await enviar({ object: 'instagram', entry: [{ id: 'IG1', changes: [{ field: 'comments', value: { id: 'c1', text: 'precio', from: { id: 'I9' }, media: { id: 'M1' } } }] }] }, 'clave-instagram'), 200, 'comentario de Instagram firmado con la clave de Instagram')
assert.equal(recibidos.length, antes, 'los rechazados y los comentarios no se reenvían a Chatwoot')

srv.close(); cw.close()
console.log('Todo bien: Instagram y Messenger van a su ruta, la firma se valida con la clave correcta')
