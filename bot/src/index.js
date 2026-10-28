import express from 'express'
import path from 'node:path'
import { responder } from './agent.js'
import * as cw from './chatwoot.js'
import { inventario, citas, servicios } from './store.js'
import { tasaPara } from './tasa.js'
import { montarLista } from './lista.js'
import { montarMeta } from './meta.js'

const app = express()
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }))     // el cuerpo exacto sirve para validar la firma de Meta

const procesando = new Set()
const intentado = new Map() // conversación -> id del último mensaje ya intentado (evita bucles si falla)
const HUMANO = 'requiere-humano'

// Chatwoot no permite webhooks a hosts privados; en local consultamos las conversaciones nuevas.
// En producción (dominio público) se puede cambiar a webhook de agent bot.
// El bot solo atiende las bandejas autorizadas (BOT_INBOX_IDS="1,3"). Una bandeja nueva queda en silencio
// hasta que se agregue aquí, para no responder a clientes reales con datos de prueba.
const PERMITIDAS = new Set((process.env.BOT_INBOX_IDS || '').split(',').map(x => x.trim()).filter(Boolean).map(Number))

// Bandejas en prueba: Nexo solo responde ahí si la conversación tiene la etiqueta "prueba" (BOT_PRUEBA_INBOX_IDS="3"), así no toca a clientes reales.
const SOLO_PRUEBA = new Set((process.env.BOT_PRUEBA_INBOX_IDS || '').split(',').map(x => x.trim()).filter(Boolean).map(Number))
// Contactos de prueba (ids de Chatwoot, BOT_PRUEBA_CONTACT_IDS="6"): en las bandejas en prueba Nexo siempre les responde, aunque la conversación sea nueva y no tenga etiqueta.
const CONTACTOS_PRUEBA = new Set((process.env.BOT_PRUEBA_CONTACT_IDS || '').split(',').map(x => x.trim()).filter(Boolean).map(Number))
const fallos = new Map()
async function revisar() {
  for (const c of await cw.abiertas()) {
    if (!PERMITIDAS.has(c.inbox_id)) continue
    if (SOLO_PRUEBA.has(c.inbox_id) && !c.labels?.includes('prueba') && !CONTACTOS_PRUEBA.has(c.meta?.sender?.id)) continue
    if (procesando.has(c.id) || c.labels?.includes(HUMANO)) continue
    const ult = c.last_non_activity_message
    if (ult && ult.message_type === 1 && !ult.private) { seguimiento(c, ult).catch(e => console.error('Seguimiento', c.id, e.message)); continue }
    if (!ult || ult.message_type !== 0 || ult.private) continue // solo si el último mensaje es del cliente
    if (intentado.get(c.id) === ult.id) continue
    intentado.set(c.id, ult.id)
    procesando.add(c.id)
    Promise.race([atender(c), new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo agotado atendiendo')), 120000))])
      .then(() => fallos.delete(ult.id))
      .catch(async err => {
        console.error('Error atendiendo', c.id, err.message)
        const n = (fallos.get(ult.id) || 0) + 1
        fallos.set(ult.id, n)
        if (n < 3) return setTimeout(() => intentado.delete(c.id), 5000)   // reintenta el mismo mensaje
        await cw.sendMessage(c.id, 'Disculpa, tuve un inconveniente técnico para responderte. Un asesor te atenderá en breve. 🙏').catch(() => {})
        await cw.addLabels(c.id, [HUMANO]).catch(() => {})
      })
      .finally(() => procesando.delete(c.id))
  }
}

// La tienda se deduce del nombre de la bandeja ("WhatsApp Caracas", "WhatsApp Maracay"...). Si no dice cuál, el bot pregunta.
let bandejas = { ts: 0, lista: [] }
// "WhatsApp CM Maracay" -> Maracay / CM Venezuela; "WhatsApp Master Cauchos" -> Maracay / Master Cauchos; "WhatsApp CM Caracas" -> Caracas / CM Venezuela
async function contextoDeBandeja(id) {
  if (Date.now() - bandejas.ts > 5 * 60 * 1000) bandejas = { ts: Date.now(), lista: await cw.inboxes().catch(() => bandejas.lista) }
  const nombre = bandejas.lista.find(b => b.id === id)?.name || ''
  if (/master/i.test(nombre)) return { tienda: 'maracay', marca: 'Master Cauchos', canal: nombre }
  if (/caracas/i.test(nombre)) return { tienda: 'caracas', marca: 'CM Venezuela', canal: nombre }
  if (/maracay/i.test(nombre)) return { tienda: 'maracay', marca: 'CM Venezuela', canal: nombre }
  return { tienda: null, marca: null, canal: nombre }
}

// Seguimiento: si el cliente dejó la conversación a medias (el último mensaje es del bot), a las 2 h le escribimos una vez,
// siempre dentro de la ventana de 24 h de WhatsApp (sin plantillas ni costo) y en horario razonable, y avisamos al asesor.
const SEGUIMIENTO_MIN_H = Number(process.env.SEGUIMIENTO_MINUTOS || 120) / 60, SEGUIMIENTO_MAX_H = 20, ENVIADO = 'seguimiento-enviado', ASESOR = 'seguimiento'
const enSeguimiento = new Set(), descartado = new Map()
const horaCaracas = () => Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Caracas' })) % 24
async function seguimiento(c, ult) {
  if (enSeguimiento.has(c.id) || descartado.get(c.id) === ult.id || c.labels?.some(l => [ENVIADO, HUMANO, 'cita-agendada'].includes(l))) return
  const horas = (Date.now() / 1000 - ult.created_at) / 3600
  if (horas < SEGUIMIENTO_MIN_H || horas > SEGUIMIENTO_MAX_H || horaCaracas() < 8 || horaCaracas() >= 20) return
  enSeguimiento.add(c.id)
  try {
    const payload = await cw.history(c.id)
    const clienteEscribio = payload.filter(m => m.message_type === 0 && m.content).length >= 2     // hubo interés real, no solo un saludo
    const humano = payload.some(m => m.message_type === 1 && !m.private && m.sender?.type === 'user' && !m.content_attributes?.bot)
    if (!clienteEscribio || humano) { descartado.set(c.id, ult.id); return }                        // sin interés real o ya lo atiende un humano: se revisa de nuevo si hay mensaje nuevo
    await cw.addLabels(c.id, [ENVIADO]).catch(() => {})                                            // marcamos primero: nunca se envía dos veces
    const ctx = await contextoDeBandeja(c.inbox_id)
    const ficha = (await cw.contacto(c.meta?.sender?.id).catch(() => ({}))).custom_attributes || {}
    const nombre = (c.meta?.sender?.name || '').split(' ')[0]
    const interes = [ficha.cantidad_cauchos && `${ficha.cantidad_cauchos}`, ficha.marca_caucho, ficha.medida_caucho].filter(Boolean).join(' ')
    await cw.sendMessage(c.id, `Hola${nombre ? ' ' + nombre : ''}, soy Nexo de ${ctx.marca || 'la tienda'}. 🚗 Vi que nos quedamos a medias${interes ? ` con tu cotización (${interes})` : ''}. ¿Seguimos? Si quieres te ayudo a completarla o te reservo el caucho. Si ya no te interesa, no hay problema.`)
    await cw.addLabels(c.id, [ASESOR]).catch(() => {})
    const datos = [ficha.vehiculo && `Vehículo: ${ficha.vehiculo}`, ficha.medida_caucho && `Medida: ${ficha.medida_caucho}`, ficha.marca_caucho && `Marca: ${ficha.marca_caucho}`, ficha.cantidad_cauchos && `Cantidad: ${ficha.cantidad_cauchos}`].filter(Boolean).join(' · ')
    await cw.sendMessage(c.id, `🔔 Seguimiento: el cliente dejó la conversación sin terminar hace ${horas < 1 ? Math.round(horas * 60) + ' min' : Math.round(horas) + ' h'}. Nexo ya le escribió. Conviene que un asesor lo llame o le escriba.${datos ? '\n' + datos : ''}`, true).catch(() => {})
  } finally { enSeguimiento.delete(c.id) }
}

async function atender(c) {
  const ctx = { conversationId: c.id, contactId: c.meta?.sender?.id, telefono: c.meta?.channel === 'Channel::Whatsapp' ? c.meta?.sender?.phone_number : undefined, ...(await contextoDeBandeja(c.inbox_id)) }
  ctx.ficha = (await cw.contacto(ctx.contactId).catch(() => ({}))).custom_attributes || {}
  const payload = await cw.history(c.id)
  if (payload.some(m => m.message_type === 1 && !m.private && m.sender?.type === 'user' && !m.content_attributes?.bot)) return // ya lo atiende un humano
  const texto = await responder(payload, ctx)
  if (!texto) throw new Error('respuesta vacía del modelo')   // se reintenta; nunca dejamos al cliente sin respuesta
  await cw.sendMessage(c.id, texto)
}

setInterval(() => revisar().catch(e => console.error('Poll:', e.message)), 2000)

app.get('/api/estado', async (_req, res) => {
  const t = { usd: await tasaPara('USD'), eur: await tasaPara('EUR') }
  res.json({ tasa: t, inventario: inventario(), servicios: servicios(), citas: citas() })
})

montarLista(app)
montarMeta(app)
app.use('/brand', express.static(path.resolve('../brand')))
app.use('/demo', express.static(path.resolve('../demo')))
app.get('/', (_req, res) => res.redirect('/demo/'))

app.listen(process.env.PORT, () => console.log(`Bot escuchando en http://localhost:${process.env.PORT}`))
