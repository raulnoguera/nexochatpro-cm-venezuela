// Mide el consumo de tokens y el costo estimado con 8 conversaciones simuladas (cauchos, batería, aceite, servicios, saludo...).
// Uso (dentro del contenedor del bot): docker cp scripts/medir_consumo.mjs nexochatpro-bot:/app/ && docker exec -e LLM_MODEL=gemini-3-flash-preview nexochatpro-bot node medir_consumo.mjs
// Usa conversationId 0, así que no queda en el registro de gasto por conversación.
import { responder } from './src/agent.js'
import { usoPorDia } from './src/uso.js'
const M = process.env.LLM_MODEL
const dia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
const snap = () => { const v = usoPorDia()[dia()]?.[M] || {}; return { l: v.llamadas || 0, e: v.entrada || 0, s: v.salida || 0, err: (v.errores || 0) + (v.limite || 0), p: v.pensando || 0, c: v.cache || 0 } }
const E = [
  ['cauchos (7 mensajes)', 'maracay', ['Hola buenas', 'necesito 4 cauchos 195/65R15', 'cuales son los mas baratos?', 'me llevo los de $40, soy Carlos y tengo un Aveo 2010', 'cuanto saldrian los 4?', 'tienen otra marca mas economica?', 'gracias, lo pienso']],
  ['batería (4)', 'maracay', ['buenas, necesito una bateria', 'grupo 24', 'cuanto da de garantia?', 'ok gracias']],
  ['aceite (4)', 'caracas', ['aceite 15w-40 semisintetico', '4 litros', 'cual es el mas barato?', 'gracias']],
  ['servicios (3)', 'caracas', ['cuanto cuesta alinear?', 'y balancear?', 'gracias']],
  ['solo saludo (2)', 'maracay', ['hola', 'gracias']],
  ['no sabe medida (3)', 'maracay', ['tengo una Hilux, que caucho le va?', 'no puedo ver ahora', 'ok']],
  ['descuento (3)', 'maracay', ['quiero 4 cauchos 265/70R16', 'me haces descuento?', 'ok espero']],
  ['cauchos Caracas (4)', 'caracas', ['necesito cauchos 205/55R16', 'dame los mas baratos', 'cuanto por los 4?', 'gracias']],
]
const res = []
for (const [nombre, tienda, msgs] of E) {
  const antes = snap(); const hist = []
  for (const m of msgs) {
    hist.push({ message_type: 0, private: false, content: m })
    const r = await responder(hist, { conversationId: 0, tienda, marca: 'CM Venezuela', telefono: '+584141234567', ficha: {} }).catch(e => 'ERROR ' + e.message)
    hist.push({ message_type: 1, private: false, content: r })
  }
  const d = snap()
  const x = { nombre, llamadas: d.l - antes.l, entrada: d.e - antes.e, cache: d.c - antes.c, salida: d.s - antes.s, pensando: d.p - antes.p, errores: d.err - antes.err, ultima: hist.at(-1).content.replace(/\s+/g, ' ').slice(0, 170) }
  x.usd = +(((x.entrada - x.cache) * 0.5 + x.cache * 0.05 + (x.salida + x.pensando) * 3) / 1e6).toFixed(4)
  res.push(x)
}
for (const x of res) console.log(JSON.stringify(x))
console.log('TOTAL usd', res.reduce((a, x) => a + x.usd, 0).toFixed(4), 'llamadas', res.reduce((a, x) => a + x.llamadas, 0), 'entrada', res.reduce((a, x) => a + x.entrada, 0), 'cache', res.reduce((a, x) => a + x.cache, 0), 'pensando', res.reduce((a, x) => a + x.pensando, 0), 'salida', res.reduce((a, x) => a + x.salida, 0))
