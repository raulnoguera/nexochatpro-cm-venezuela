import express from 'express'
import crypto from 'node:crypto'
process.env.META_APP_SECRET = 'secreto-de-prueba'; process.env.META_VERIFY_TOKEN = 'vt'; process.env.META_PAGE_ID = 'PAGE1'; process.env.META_IG_ID = 'IG1'; process.env.META_DRY_RUN = '1'; if (process.env.MODO) process.env.META_MODO = process.env.MODO
const { montarMeta } = await import('../src/meta.js')
const app = express(); app.use(express.json({ verify: (r, _s, b) => { r.rawBody = b } })); montarMeta(app)
const srv = app.listen(0); const base = 'http://localhost:' + srv.address().port
const post = async (body, firmar = true) => { const raw = JSON.stringify(body); const sig = 'sha256=' + crypto.createHmac('sha256', 'secreto-de-prueba').update(raw).digest('hex'); const r = await fetch(base + '/meta/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(firmar && { 'x-hub-signature-256': sig }) }, body: raw }); return r.status }
const fb = (id, msg, from = { id: 'U1', name: 'Juan Pérez' }, extra = {}) => ({ object: 'page', entry: [{ changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: id, post_id: 'P1', parent_id: 'P1', message: msg, from, ...extra } }] }] })
const ig = (id, text, from = { id: 'I9', username: 'maria' }, extra = {}) => ({ object: 'instagram', entry: [{ changes: [{ field: 'comments', value: { id, text, from, media: { id: 'M1' }, ...extra } }] }] })
console.log('verificar ok:', (await fetch(base + '/meta/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123')).status, '| token malo:', (await fetch(base + '/meta/webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1')).status)
console.log('sin firma:', await post(fb('c0', 'precio'), false))
console.log('--- FB con clave de prueba'); await post(fb('p1', 'Precio del 195/65R15? #prueba', { id: 'U1', name: 'Juan Pérez' })); await new Promise(r => setTimeout(r, 100)); await post(fb('p2', 'Otro #PRUEBA', { id: 'U1', name: 'Juan Pérez' })); await new Promise(r => setTimeout(r, 100))
console.log('--- FB precio'); console.log(await post(fb('c1', 'Precio del 195/65R15?')))
await new Promise(r => setTimeout(r, 100))
console.log('--- IG info'); console.log(await post(ig('c2', 'Info por favor')))
await new Promise(r => setTimeout(r, 100))
console.log('--- repetido (no debe hacer nada)'); await post(fb('c1', 'Precio del 195/65R15?')); await new Promise(r => setTimeout(r, 100))
console.log('--- emoji / etiqueta / link / propia / respuesta entre personas (no deben hacer nada)')
await post(fb('c3', '😍😍', { id: 'U2', name: 'Ana' })); await post(fb('c4', '@pedro mira esto', { id: 'U3', name: 'Luis' })); await post(fb('c5', 'gana dinero www.spam.com', { id: 'U4', name: 'Spam' }))
await post(fb('c6', 'gracias', { id: 'PAGE1', name: 'CM' })); await post(fb('c7', 'si yo también', { id: 'U5', name: 'Rosa' }, { parent_id: 'OTRO' })); await post(ig('c8', 'gracias', { id: 'IG1', username: 'cm' }))
await new Promise(r => setTimeout(r, 200)); srv.close()
