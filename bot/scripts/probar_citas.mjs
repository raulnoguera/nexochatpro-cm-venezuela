// Prueba de citas sin tocar Chatwoot: node --env-file=.env scripts/probar_citas.mjs
// Reproduce la conversación 27: el cliente pide la cita de «hoy a las 5 pm» cuando esa hora ya pasó.
import { responder } from '../src/agent.js'
import { ahoraCaracas } from '../src/precios.js'

const hoy = ahoraCaracas().slice(0, 10), [h, m] = ahoraCaracas().slice(11).split(':').map(Number)
const pasada = `${String(Math.max(h - 1, 8)).padStart(2, '0')}:00`
const casos = [
  ['Hora que ya pasó', `si voy hoy a las ${pasada}`],
  ['Domingo', 'puedo ir el domingo a las 10 am?'],
  ['Hora fuera de horario', 'mañana a las 9 pm'],
  ['Hora válida', 'mañana lunes a las 10 am'],
]
for (const [nombre, ultimo] of casos) {
  const hist = [
    ['hola estoy interesado en cauchos rin 18', 0], ['Gracias por comunicarte con MASTER CAUCHOS 🏁', 1], ['265/60R18', 0],
    ['🛞 265/60/18\n\n-Habilead HT = 96\n\nÂ Oferta válida por 12 horas.', 1], ['quiero Habilead HT 2 unidades', 0], ['¿Me indica su nombre y vehículo?', 1],
    ['mi nombre es Alirio y es para Cherokee KK', 0], ['¿Desea agendar una cita para el montaje?', 1], [ultimo, 0],
  ].map(([content, message_type]) => ({ message_type, private: false, content }))
  const ctx = { conversationId: 0, tienda: 'maracay', marca: 'MASTER CAUCHOS', telefono: '+584141902877', ficha: {} }
  const r = await responder(hist, ctx).catch(e => 'ERROR ' + e.message)
  console.log(`\n=== ${nombre}: «${ultimo}» (ahora ${ahoraCaracas()})\n${r}\n(cita registrada: ${ctx.citaOk ? 'sí' : 'no'})`)
}
