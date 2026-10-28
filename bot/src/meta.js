import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Comentarios de publicaciones de Facebook e Instagram: respuesta pública corta + mensaje privado con el primer paso de la cotización.
// Meta avisa por webhook; el bot responde con la API Graph. No usa el modelo (sin costo de tokens).
const { META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ID, META_PAGE_TOKEN, META_IG_ID } = process.env
const G = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`
const SECO = process.env.META_DRY_RUN === '1'        // solo registra lo que haría, sin llamar a Meta
const MARCA = process.env.META_MARCA || 'CM Venezuela'
// Seguro por defecto: mientras META_MODO no sea "produccion", el bot SOLO responde a comentarios que lleven la clave de prueba (#prueba),
// así los comentarios reales de clientes se ignoran y se puede probar con calma.
const PRODUCCION = process.env.META_MODO === 'produccion'
const CLAVE_PRUEBA = (process.env.META_CLAVE_PRUEBA || '#prueba').toLowerCase()
const CHATWOOT_BOT = process.env.CHATWOOT_BOT_URL || 'http://rails:3000/bot'      // el canal de Messenger de Chatwoot recibe sus avisos aquí
const archivo = path.resolve('data', 'comentarios.json')

const TEXTOS = {
  respuesta_publica: [
    '¡Hola{nombre}! Te acabamos de escribir por mensaje privado con la información 📩',
    '¡Gracias por comentar{nombre}! Revisa tus mensajes: ya te escribimos con los detalles 📩',
    '¡Hola{nombre}! Te enviamos la info por mensaje privado 🚗',
  ],
  mensaje_privado: `Hola{nombre}, soy Nexo, el asistente virtual de ${MARCA}. 🚗 Vi tu comentario en nuestra publicación. ¿Qué medida de caucho buscas (viene en el lateral, ej. 195/65R15) o para qué vehículo? Te doy precio y disponibilidad al momento.`,
  ignorar_palabras: [],
}
// Los textos se pueden cambiar sin tocar el código: data/comentarios.json con las mismas claves
const textos = () => { try { return { ...TEXTOS, ...JSON.parse(fs.readFileSync(archivo, 'utf8')) } } catch { return TEXTOS } }
const llenar = (t, nombre) => t.replaceAll('{nombre}', nombre ? ' ' + nombre : '')
const elegir = lista => lista[Math.floor(Math.random() * lista.length)]

const vistos = new Map()      // comentario -> hora: Meta puede reenviar el mismo aviso
const personas = new Map()    // persona -> hora del último privado: máximo uno cada 24 h
let ventana = { desde: Date.now(), n: 0 }
const MAX_POR_MINUTO = 20

async function graph(ruta, cuerpo) {
  if (SECO) { console.log('[meta simulacro]', ruta, JSON.stringify(cuerpo)); return { simulacro: true } }
  const r = await fetch(G + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_PAGE_TOKEN}` }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`Meta ${ruta} -> ${r.status} ${await r.text()}`)
  return r.json()
}

// ¿Vale la pena responder? Se ignoran emojis solos, etiquetas a amigos, enlaces (spam) y las palabras que CM indique.
export function merece(texto) {
  const t = String(texto || '').trim()
  if (/^\s*@/.test(t) || !/\p{L}{2,}/u.test(t.replace(/@\S+/g, ''))) return false     // empieza etiquetando a alguien: es para un amigo, no para la tienda
  if (/https?:\/\/|www\.|\.com\b/i.test(t)) return false
  return !textos().ignorar_palabras.some(p => t.toLowerCase().includes(String(p).toLowerCase()))
}

// Convierte el aviso de Meta en una lista simple de comentarios nuevos (solo los principales, no las respuestas entre personas)
export function comentarios(body) {
  const lista = []
  for (const entry of body?.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {}
    if (body.object === 'page' && ch.field === 'feed' && v.item === 'comment' && v.verb === 'add') {
      if (v.from?.id === META_PAGE_ID || (v.parent_id && v.parent_id !== v.post_id)) continue
      lista.push({ red: 'facebook', id: v.comment_id, texto: v.message, persona: v.from?.id, nombre: (v.from?.name || '').split(' ')[0] })
    } else if (body.object === 'instagram' && ch.field === 'comments') {
      if (v.from?.id === META_IG_ID || v.parent_id) continue
      lista.push({ red: 'instagram', id: v.id, texto: v.text, persona: v.from?.id, nombre: '' })
    }
  }
  return lista
}

export async function atender(c) {
  if (!c.id || vistos.has(c.id)) return
  vistos.set(c.id, Date.now())
  if (vistos.size > 5000) for (const k of [...vistos.keys()].slice(0, 2500)) vistos.delete(k)
  if (!PRODUCCION && !String(c.texto || '').toLowerCase().includes(CLAVE_PRUEBA)) return console.log('Comentario ignorado (modo prueba):', c.red, c.id)
  if (!merece(c.texto)) return console.log('Comentario ignorado:', c.red, c.id)
  if (Date.now() - ventana.desde > 60000) ventana = { desde: Date.now(), n: 0 }
  if (++ventana.n > MAX_POR_MINUTO) return console.error('Comentarios: demasiados por minuto, se omite', c.id)
  if (PRODUCCION && c.persona && Date.now() - (personas.get(c.persona) || 0) < 24 * 3600 * 1000) return console.log('Comentario ya atendido hoy para esta persona:', c.id)
  const t = textos()
  try {
    // primero el privado: si no se puede entregar (la persona no acepta mensajes), no se promete en público
    const priv = await graph(c.red === 'facebook' ? `/${META_PAGE_ID}/messages` : `/${META_IG_ID}/messages`, { recipient: { comment_id: c.id }, message: { text: llenar(t.mensaje_privado, c.nombre) } })
    console.log('Comentario', c.red, c.id, 'privado enviado:', JSON.stringify(priv))
    if (c.persona) personas.set(c.persona, Date.now())
    const pub = await graph(c.red === 'facebook' ? `/${c.id}/comments` : `/${c.id}/replies`, { message: llenar(elegir(t.respuesta_publica), c.nombre) })
    console.log('Comentario', c.red, c.id, 'respuesta pública:', JSON.stringify(pub))
  } catch (e) { console.error('Comentario no atendido', c.red, c.id, e.message) }
}

// Meta solo permite una dirección de avisos por app: este bot recibe todo y entrega a Chatwoot los mensajes de Messenger tal cual
// (mismo cuerpo y mismas firmas, que Chatwoot vuelve a validar con la clave de la app).
async function reenviarAChatwoot(req) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }
  for (const h of ['x-hub-signature', 'x-hub-signature-256']) if (req.headers[h]) headers[h] = req.headers[h]
  try {
    const r = await fetch(CHATWOOT_BOT, { method: 'POST', headers, body: req.rawBody, signal: AbortSignal.timeout(15000) })
    console.log('Meta webhook: mensajes reenviados a Chatwoot, respuesta', r.status)
  } catch (e) { console.error('Meta webhook: no se pudo reenviar a Chatwoot:', e.message) }
}

export function montarMeta(app) {
  app.get('/meta/webhook', (req, res) => {
    if (META_VERIFY_TOKEN && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === META_VERIFY_TOKEN) return res.type('text').send(req.query['hub.challenge'])
    res.sendStatus(403)
  })
  app.post('/meta/webhook', (req, res) => {
    if (!META_APP_SECRET) return res.sendStatus(404)
    console.log('Meta webhook: llegó un aviso')
    const firma = Buffer.from(String(req.headers['x-hub-signature-256'] || ''))
    const esperada = Buffer.from('sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBody || '').digest('hex'))
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(firma, esperada)) { console.error('Meta webhook: firma inválida, aviso rechazado'); return res.sendStatus(401) }
    res.sendStatus(200)                                           // Meta exige respuesta rápida; se procesa después
    const lista = comentarios(req.body)
    if ((req.body?.entry || []).some(e => e.messaging || e.standby)) reenviarAChatwoot(req)
    console.log(`Meta webhook: ${req.body?.object}, ${(req.body?.entry || []).flatMap(e => e.changes || []).map(c => `${c.field}/${c.value?.item || ''}/${c.value?.verb || ''}`).join(',') || 'sin cambios'}, comentarios útiles: ${lista.length}`)
    for (const c of lista) atender(c).catch(e => console.error('Meta:', e.message))
  })
}
