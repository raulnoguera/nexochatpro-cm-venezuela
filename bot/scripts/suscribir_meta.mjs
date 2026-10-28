// Registra los campos de la página en la app de Meta (comentarios + mensajes) y prueba el reenvío a Chatwoot.
// Usa META_* del entorno del bot. Ver docs/META.md. Uso: docker exec nexochatpro-bot node suscribir_meta.mjs
import crypto from 'node:crypto'
const { META_PAGE_ID: P, META_PAGE_TOKEN: T, META_APP_SECRET: S, META_VERIFY_TOKEN: V } = process.env
const A = '1652089316559570', F = 'feed,messages,messaging_postbacks,message_deliveries,message_reads,message_echoes'
const post = async (r, d, tok) => { const x = await fetch('https://graph.facebook.com/v23.0' + r, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(d) }); return x.json() }
console.log('app:', JSON.stringify(await post('/' + A + '/subscriptions', { object: 'page', callback_url: 'https://crm.nexochatpro.cloud/meta/webhook', verify_token: V, fields: F }, A + '|' + S)))
console.log('pagina:', JSON.stringify(await post('/' + P + '/subscribed_apps', { subscribed_fields: F }, T)))
const sus = await (await fetch('https://graph.facebook.com/v23.0/' + P + '/subscribed_apps', { headers: { Authorization: 'Bearer ' + T } })).json()
console.log('campos de la pagina:', JSON.stringify(sus.data?.map(a => a.subscribed_fields) ?? sus))
// prueba de reenvío: aviso firmado de mensaje para una página que Chatwoot no conoce
const cuerpo = JSON.stringify({ object: 'page', entry: [{ id: '0', time: Date.now(), messaging: [{ sender: { id: '1' }, recipient: { id: '0' }, timestamp: Date.now(), message: { mid: 'prueba', text: 'prueba de reenvio' } }] }] })
const r = await fetch('http://localhost:4001/meta/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', S).update(cuerpo).digest('hex'), 'X-Hub-Signature': 'sha1=' + crypto.createHmac('sha1', S).update(cuerpo).digest('hex') }, body: cuerpo })
console.log('bot respondió', r.status)
