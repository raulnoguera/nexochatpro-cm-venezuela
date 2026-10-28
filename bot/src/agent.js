import { definiciones, ejecutar } from './tools.js'
import { registrarUso, registrarConversacion, costo } from './uso.js'
import { tiendas } from './store.js'

const { LLM_API_KEY, LLM_MODEL } = process.env
const BASE = process.env.LLM_NATIVE_URL || 'https://generativelanguage.googleapis.com/v1beta'
const PENSAR = process.env.LLM_PENSAR || ''     // nivel de razonamiento de Gemini 3 (minimal | low | medium | high); vacío = el de Google
const herramientas = [{ functionDeclarations: definiciones.map(d => ({ name: d.name, description: d.description, parameters: d.input_schema })) }]

// API nativa de Gemini: a diferencia de la compatible con OpenAI, informa los tokens en caché y los de razonamiento.
// Las reglas y herramientas (≈2.700 tokens, iguales en todas las conversaciones) se suben una vez a una caché explícita
// (TTL 1 h, se renueva sola) y cada llamada las usa con ~90 % de descuento. Si la caché falla, se envían completas como siempre.
const cachés = new Map()   // modelo|marca -> { nombre, expira } | Promise
async function cacheDe(model, marca, fijo) {
  if (process.env.LLM_CACHE === '0') return null
  const clave = `${model}|${marca}`, hay = cachés.get(clave)
  if (hay && !(hay instanceof Promise) && hay.expira > Date.now() + 120000) return hay.nombre
  if (hay instanceof Promise) return hay
  const p = (async () => {
    try {
      const r = await fetch(`${BASE}/cachedContents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': LLM_API_KEY },
        body: JSON.stringify({ model: `models/${model}`, systemInstruction: { parts: [{ text: fijo }] }, tools: herramientas, ttl: '3600s' }),
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
      const j = await r.json()
      cachés.set(clave, { nombre: j.name, expira: Date.now() + 3600000 })
      return j.name
    } catch (e) {
      console.error('Caché de Gemini no disponible, se envía completo:', e.message)
      cachés.set(clave, { nombre: null, expira: Date.now() + 120000 + 300000 })    // no insistir durante 5 min
      return null
    }
  })()
  cachés.set(clave, p)
  return p
}

async function llm(marca, ctxTexto, contents, acum) {
  const fijo = sistemaFijo(marca)
  const modelos = [LLM_MODEL, LLM_MODEL, process.env.LLM_FALLBACK_MODEL].filter(Boolean)
  let ultimo
  for (const [i, model] of modelos.entries()) {
    if (i) await new Promise(r => setTimeout(r, 1000))
    const generationConfig = { maxOutputTokens: 3000, ...(PENSAR && /gemini-3/.test(model) && { thinkingConfig: { thinkingLevel: PENSAR } }) }
    const cache = await cacheDe(model, marca, fijo)
    // con caché, lo variable va al inicio del primer mensaje del cliente; sin ella, junto al resto de las instrucciones
    const cuerpo = cache
      ? { cachedContent: cache, contents: [{ ...contents[0], parts: [{ text: ctxTexto }, ...contents[0].parts] }, ...contents.slice(1)], generationConfig }
      : { systemInstruction: { parts: [{ text: fijo + '\n\n' + ctxTexto }] }, contents, tools: herramientas, generationConfig }
    const r = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': LLM_API_KEY },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(45000),
    }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
    if (r.ok) {
      const j = await r.json()
      const u = j.usageMetadata || {}
      registrarUso(model, { prompt_tokens: u.promptTokenCount, completion_tokens: u.candidatesTokenCount, pensando: u.thoughtsTokenCount, cache: u.cachedContentTokenCount })
      const gasto = { entrada: u.promptTokenCount || 0, cache: u.cachedContentTokenCount || 0, salida: u.candidatesTokenCount || 0, pensando: u.thoughtsTokenCount || 0 }
      acum.llamadas++; acum.usd += costo(model, gasto)
      for (const k of Object.keys(gasto)) acum[k] += gasto[k]
      const cand = j.candidates?.[0]
      const parts = cand?.content?.parts || []
      const llamadas = parts.some(p => p.functionCall)
      if (cand?.finishReason === 'MAX_TOKENS' && !llamadas) { ultimo = 'LLM: respuesta cortada por límite de tokens'; continue }   // nunca enviamos mensajes a medias
      if (!parts.length) { ultimo = `LLM: respuesta vacía (${cand?.finishReason || j.promptFeedback?.blockReason || 'sin detalle'})`; continue }
      return parts
    }
    const cuerpoError = await r.text()
    if (cache && /cached|cache/i.test(cuerpoError)) cachés.delete(`${model}|${marca}`)    // caché vencida o inválida: se recrea en el próximo intento
    registrarUso(model, null, r.status === 429 ? '429' : 'error')
    ultimo = `LLM ${r.status}: ${cuerpoError}`
    if (![0, 429, 500, 503].includes(r.status) && !(cache && /cached|cache/i.test(cuerpoError))) break // errores permanentes no se reintentan
  }
  throw new Error(ultimo)
}

const ahora = () => new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Caracas' })
const hoy = () => new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Caracas' })

const fichaTexto = f => {
  const d = [f?.vehiculo && `vehículo ${f.vehiculo}`, f?.medida_caucho && `medida ${f.medida_caucho}`, f?.marca_caucho && `marca elegida ${f.marca_caucho}`, f?.cantidad_cauchos && `${f.cantidad_cauchos} unidades`, f?.proxima_cita && `próxima cita ${f.proxima_cita}`].filter(Boolean)
  return d.length ? `Datos ya guardados de este cliente (de conversaciones anteriores): ${d.join(', ')}. Úsalos para retomar sin volver a preguntarlos: salúdalo y confirma brevemente si sigue interesado en eso. No los repitas como lista; si algo cambió, actualízalo con guardar_cliente.\n` : ''
}

// Lo fijo (reglas) se guarda en la caché de Gemini y se cobra con descuento; lo que cambia en cada conversación (hora, tienda, ficha) va aparte.
const sistemaFijo = marca => `Eres Nexo, el asistente virtual de ${marca} (plataforma NexoChatPro), una cauchera en Venezuela (cauchos, baterías, aceites, bicicletas y servicios: montaje, balanceo, alineación, reparación, rotación).
Presentación: en tu primer mensaje de la conversación di brevemente que eres Nexo, el asistente virtual de la tienda; después no te vuelvas a presentar. Si en el historial ya aparece un mensaje tuyo donde te presentas (por ejemplo la bienvenida a quien comentó una publicación), no repitas la presentación. No uses pronombres de género para referirte a ti mismo.
Estilo: español venezolano cordial y profesional, mensajes cortos (es WhatsApp), sin listas largas. Máximo 1-2 emojis. Sin markdown (nada de ** ni #); saltos de línea simples.
Reglas:
- Precios: usa solo los montos de las herramientas, sin recalcular ni redondear (multiplicar por la cantidad sí). En la lista de opciones usa SIEMPRE este formato corto, una línea por opción: "Habilead HT: $96 en divisa · $101 en Bs tasa euro". El primer monto es pagando_en_dolares_usd; el segundo es pagando_en_bolivares_equivale_usd, con la etiqueta de etiqueta_tasa ("tasa euro" en Maracay, "tasa BCV" en Caracas); en la lista NO pongas el monto en bolívares ni la fecha de la tasa. Si no viene pagando_en_bolivares_equivale_usd (servicios), usa "$23 en divisa · Bs 22.183 tasa BCV". Al dar el total o la cotización final sí agrega el monto en bolívares: "3 cauchos: $204 en divisa · $216 en Bs tasa euro (Bs 214.713)". Los totales solo los das para varias unidades del MISMO producto y y sin multiplicar tú: cuando el cliente elija una opción y una cantidad, vuelve a llamar la búsqueda con la medida (o grupo/tipo), la marca de la opción elegida y la cantidad; cada resultado trae sus "totales" exactos. NUNCA des un monto en bolívares que no esté en una herramienta (el historial de la conversación no trae los montos en bolívares). Si el cliente combina productos o servicios distintos, da el precio de cada uno y suma únicamente en divisa; el total en bolívares lo confirma el asesor en la tienda. No mezcles las tasas de una ciudad con la otra. Nunca inventes precios, existencias ni marcas.
- Sin precio: si el precio es "por_consultar", no des ningún monto: di que un asesor lo confirma y ofrece pasar la conversación (pasar_a_humano). Muestra primero las opciones con precio.
- Disponibilidad: en la lista omite "disponible" (se entiende) y añade al final de la línea solo "(quedan pocas)" o "(por confirmar)"; si el cliente pregunta, responde "disponible", "quedan pocas unidades" o "por confirmar", sin cifras. Si solo hay en la otra tienda de Maracay, ofrécelo con traslado. Si es "por confirmar", di que lo confirmas con la tienda y no lo prometas.
- Datos del negocio: solo conoces el horario y la dirección que figuren en el contexto y lo que devuelven las herramientas. NUNCA inventes direcciones, teléfonos, redes sociales, formas de pago, promociones, descuentos, regalos ni servicios gratis (no digas que el montaje, el balanceo o las válvulas son gratis o están incluidos). Si preguntan por la dirección u otro dato que no tengas, dile que un asesor se lo confirma (pasar_a_humano).
- Cashea: solo en la tienda de Caracas. En Maracay no lo ofrezcas; si preguntan, di que allí no lo manejan.
- Medida: NUNCA deduzcas ni sugieras una medida a partir del vehículo (varía por versión; un error es vender un caucho que no sirve). Si no la sabe, dile que está en el lateral del caucho (ej. 245/60R18) o en la etiqueta del marco de la puerta del conductor; si no puede revisarla, ofrece un asesor (pasar_a_humano) o que la verifique en la tienda. Tampoco menciones posibles medidas de un vehículo, ni como ejemplo (nada de "suele ser 235/60R18 o 245/60R18"). Si solo sabe el rin, NO busques ni muestres precios: pídele la medida completa.
- Cauchos: pide la medida o el vehículo si no la saben. Busca con buscar_cauchos y ofrece TODAS las opciones que devuelva (hasta 6) de menor a mayor precio, una línea por opción con marca, precio en dólares y bolívares y disponibilidad. Si hay más de 6, muestra las 5 más económicas con existencia y pregunta si quiere afinar por marca o presupuesto.
- Baterías: pide el grupo o el vehículo. Busca con buscar_baterias por el grupo que diga el cliente (24, 34, 4D…) o, para Aveo u Optra, con el grupo "PARA AVEO" / "PARA OPTRA". Si dice su vehículo (marca, modelo, año), usa vehiculo_marca, vehiculo_modelo y anio: el grupo sale SOLO de la tabla de compatibilidad que devuelve la herramienta, nunca de tu memoria. Si no hay datos de ese vehículo o no lo sabe, dile que el grupo viene en la etiqueta de la batería actual o pásalo a un asesor; no adivines. Aun con coincidencia, pídele confirmar grupo y polaridad con su batería actual. Muestra todas las opciones como los cauchos, con garantía en meses, y pregunta cuántas quiere. Si pregunta por el recargo de la batería vieja ("chatarra"), pasa a un asesor; no inventes recargos.
- Bicicletas: pide el rin (12, 16, 20, 24, 26 o 29) o el modelo y busca con buscar_bicicletas; muestra modelo, para quién es, colores, precio y disponibilidad como los cauchos. Los colores y existencias exactas las confirma el asesor.
- Aceites: pide tipo o viscosidad (20W-50 mineral, 15W-40 semisintético…) y presentación (litro, 4 litros…). Busca con buscar_aceites y da las opciones con marca, presentación, precios y disponibilidad. Si no saben cuál usa su vehículo, dile que está en la tapa del aceite o en el manual y ofrece un asesor; no lo adivines por el modelo.
- Cantidad: tras mostrar las opciones, pregunta cuántas unidades quiere (y si prefiere alguna marca). Si el estado es "pocas_unidades" o "por confirmar", no prometas que alcanza: lo confirmas con la tienda. Con la cantidad, busca de nuevo con cantidad y da el total que traiga "totales", en dólares y bolívares.
- Captura de datos: tras la primera cotización o cuando muestre interés, pide con naturalidad nombre y vehículo (marca, modelo, año) (el teléfono solo si el contexto dice que no lo tienes; si ya lo tienes, NO lo pidas) "para enviarte la cotización y reservarte el caucho". Un solo mensaje, sin interrogatorio; si no quiere, no insistas. Guárdalos con guardar_cliente apenas los dé, con marca_caucho, medida y cantidad; vuelve a llamarla si cambia de opción y no los pidas de nuevo si ya los tienes.
- Citas: confirma servicio, fecha y hora, y recién ahí usa agendar_cita, solo dentro del horario y sin horas ya pasadas hoy (si pasó, pide otra). Una sola cita por conversación: si agendar_cita dice que ya existe, confírmala tal cual; solo si el cliente pide cambiarla, llama con reemplazar=true. No hay límite de cupo: nunca digas que un horario está ocupado.
- Cierre: tras confirmar la cita (fecha, hora, tienda y qué llevar si aplica), si el cliente se despide ("nos vemos", "gracias", "eso sería todo"), responde con una despedida breve y cordial (ej. "¡Perfecto, Raúl! Te esperamos hoy a las 3:00 PM en Master Cauchos. ¡Que tengas un excelente día! 🚗") sin herramientas ni más preguntas. Siempre contesta algo; nunca dejes un mensaje sin respuesta.
- Si piden descuento, quieren pagar, hay un reclamo o algo fuera de tu alcance, usa pasar_a_humano y avisa que un asesor lo atenderá.
- Al final de una venta o cita, pregunta si necesita algo más.`

// Dirección y horario salen de data/tiendas.json: la sede se deduce de la bandeja (Master Cauchos, CM Maracay o CM Caracas)
const sedeDe = ctx => {
  const t = ctx?.tienda && tiendas()[ctx.tienda]
  const sede = !t ? null : /master/i.test(ctx.marca || '') ? 'tienda_2' : ctx.tienda === 'caracas' ? 'caracas' : 'tienda_1'
  return { direccion: t?.direcciones?.[sede] || null, horario: t?.horarios?.[sede] || null }
}

const contexto = ctx => `Contexto de esta conversación:
Hoy es ${hoy()}, son las ${ahora()} (hora de Caracas).
Tienda: ${ctx?.tienda ? `la conversación es de la tienda de ${ctx.tienda === 'caracas' ? 'Caracas' : 'Maracay'}; úsala en las herramientas.` : 'todavía no sabes si el cliente compra en Maracay o en Caracas: pregúntalo ANTES de dar precios o disponibilidad y úsalo en las herramientas.'}
Dirección de la tienda: ${sedeDe(ctx).direccion || 'no la tienes: si la piden, ofrece que un asesor se la confirme (pasar_a_humano)'}.
Horario de la tienda: ${sedeDe(ctx).horario || 'depende de la ciudad (Maracay: lunes a sábado de 8:00 a 17:30; Caracas: lunes a sábado de 8:00 a 17:00); si no sabes la ciudad del cliente, pregúntala'}.
Teléfono: ${ctx?.telefono ? 'ya lo tienes porque escribe desde WhatsApp (' + ctx.telefono + '), se guarda solo' : 'no lo tienes, pídelo junto con el nombre'}.
${fichaTexto(ctx?.ficha)}`

const MAX_HISTORIAL = 16
// historial de Chatwoot -> mensajes del modelo
function aMensajes(payload) {
  const msgs = []
  for (const m of payload.filter(x => !x.private && (x.message_type === 0 || x.message_type === 1) && x.content)) {
    const role = m.message_type === 0 ? 'user' : 'model'
    if (msgs.at(-1)?.role === role) msgs.at(-1).parts[0].text += '\n' + m.content
    else msgs.push({ role, parts: [{ text: m.content }] })
  }
  const recientes = msgs.slice(-MAX_HISTORIAL)     // solo lo reciente: lo importante del cliente ya está en su ficha
  // Los mensajes tuyos anteriores al primero del cliente (p. ej. la bienvenida a quien comentó) no se descartan: se anteponen
  // al primer mensaje del cliente para que sepas qué le dijiste y no te presentes dos veces.
  const previos = []
  while (recientes.length && recientes[0].role !== 'user') previos.push(recientes.shift().parts[0].text)
  if (previos.length && recientes.length) recientes[0].parts[0].text = `[Antes de que el cliente escribiera, ya le enviaste: «${previos.join(' ').slice(0, 400)}»]\n` + recientes[0].parts[0].text
  return recientes
}

export async function responder(payload, ctx) {
  const acum = { llamadas: 0, entrada: 0, cache: 0, salida: 0, pensando: 0, usd: 0 }
  try { return await conversar(payload, ctx, acum) } finally { registrarConversacion(ctx?.conversationId, acum, ctx?.canal) }
}

async function conversar(payload, ctx, acum) {
  const contents = aMensajes(payload)
  for (let i = 0; i < 6; i++) {
    const parts = await llm(ctx?.marca || process.env.BUSINESS_NAME, contexto(ctx), contents, acum)
    const llamadas = parts.filter(p => p.functionCall)
    const texto = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim()
    if (!llamadas.length && !texto) {      // a veces el modelo responde vacío (sobre todo tras pasar_a_humano): nunca dejamos al cliente sin respuesta
      if (ctx?.handoff) return 'Listo, un asesor te atenderá por este mismo chat en breve. 🙏'
      continue
    }
    contents.push({ role: 'model', parts })      // se devuelve tal cual (Gemini 3 exige conservar sus firmas de razonamiento)
    if (!llamadas.length) return texto
    const respuestas = []
    for (const { functionCall: call } of llamadas) {
      const out = await ejecutar(call.name, call.args || {}, ctx).catch(e => ({ error: e.message }))
      respuestas.push({ functionResponse: { name: call.name, response: out } })
    }
    contents.push({ role: 'user', parts: respuestas })
  }
  return 'Dame un momento, te paso con un asesor.'
}
