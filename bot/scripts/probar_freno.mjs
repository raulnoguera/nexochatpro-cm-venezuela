// Prueba de punta a punta sin Chatwoot real: levanta un Chatwoot falso, arranca el bot y comprueba que, con 16 mensajes en una hora,
// Nexo avisa una sola vez, etiqueta, deja una nota privada y asigna al equipo. Uso: node scripts/probar_freno.mjs
import http from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const ahora = Math.floor(Date.now() / 1000)
const mensajes = Array.from({ length: 16 }, (_, i) => ({ id: 100 + i, message_type: 0, private: false, content: 'hola ' + i, created_at: ahora - 60 + i }))
const conv = { id: 5, inbox_id: 1, labels: [], meta: { sender: { id: 7, name: 'Cliente' }, channel: 'Channel::Whatsapp' }, last_non_activity_message: mensajes.at(-1) }
let etiquetas = []
const registro = []

const cw = http.createServer((req, res) => {
  let cuerpo = ''
  req.on('data', d => (cuerpo += d)).on('end', () => {
    const p = req.url.replace('/api/v1/accounts/1', '').split('?')[0]
    const json = d => res.setHeader('Content-Type', 'application/json').end(JSON.stringify(d))
    if (req.method !== 'GET') registro.push({ p, body: cuerpo ? JSON.parse(cuerpo) : null })
    if (p === '/inboxes') return json({ payload: [{ id: 1, name: 'WhatsApp Prueba Master Cauchos' }] })
    if (p === '/teams') return json([{ id: 2, name: 'master cauchos' }])
    if (p === '/conversations') return json({ data: { payload: [{ ...conv, labels: etiquetas }] } })
    if (p === '/conversations/5/messages') return json({ payload: mensajes })
    if (p === '/conversations/5/labels') { if (req.method === 'POST') etiquetas = JSON.parse(cuerpo).labels; return json({ payload: etiquetas }) }
    if (p === '/contacts/7') return json({ payload: { custom_attributes: {} } })
    json({ ok: true })
  })
}).listen(0)
await new Promise(r => cw.once('listening', r))

const bot = spawn('node', ['src/index.js'], {
  env: { ...process.env, PORT: '4099', CHATWOOT_URL: `http://127.0.0.1:${cw.address().port}`, CHATWOOT_TOKEN: 'x', CHATWOOT_ACCOUNT_ID: '1', BOT_INBOX_IDS: '1', LLM_API_KEY: 'sin-uso' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let salida = ''
bot.stdout.on('data', d => (salida += d)); bot.stderr.on('data', d => (salida += d))
await new Promise(r => setTimeout(r, 7000))     // varios ciclos de revisión (cada 2 s): el aviso debe salir una sola vez
bot.kill(); cw.close()

const mensajesEnviados = registro.filter(r => r.p === '/conversations/5/messages')
assert.equal(mensajesEnviados.filter(r => !r.body.private).length, 1, 'un solo aviso al cliente')
assert.match(mensajesEnviados.find(r => !r.body.private).body.content, /Recibimos muchos mensajes seguidos/)
assert.equal(mensajesEnviados.filter(r => r.body.private).length, 1, 'una nota privada para el asesor')
assert.deepEqual(etiquetas.sort(), ['limite-hora', 'requiere-humano'])
assert.deepEqual(registro.find(r => /assignments$/.test(r.p)).body, { team_id: 2 })
assert.ok(!/generativelanguage|Error atendiendo/.test(salida), 'no llamó al modelo ni falló: ' + salida.slice(0, 300))
console.log('Todo bien: 1 aviso, 1 nota privada, etiquetas', etiquetas.join(' + '), 'y equipo 2')
