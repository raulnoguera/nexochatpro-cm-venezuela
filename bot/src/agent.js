import { definiciones, ejecutar } from './tools.js'
import { registrarUso, registrarConversacion, costo } from './uso.js'
import { tiendas, citas } from './store.js'

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
Presentación: sigues el PROTOCOLO DE RESPUESTA de la tienda (más abajo), que ya incluye la bienvenida; no añadas otra presentación. Solo si el cliente pregunta con quién habla o si eres una persona, di con naturalidad que eres Nexo, el asistente virtual de la tienda (nunca digas que eres humano). No uses pronombres de género para referirte a ti mismo.
Estilo: español venezolano cordial y profesional, mensajes cortos (es WhatsApp), sin listas largas. Máximo 1-2 emojis. Sin markdown (nada de ** ni #); saltos de línea simples.
Reglas:
- Precios: usa solo los montos de las herramientas, sin recalcular ni redondear (multiplicar por la cantidad sí). En la lista de opciones usa SIEMPRE este formato corto, una línea por opción: "Habilead HT: $96 en divisa · $101 en Bs tasa euro". El primer monto es pagando_en_dolares_usd; el segundo es pagando_en_bolivares_equivale_usd, con la etiqueta de etiqueta_tasa ("tasa euro" en Maracay, "tasa BCV" en Caracas); en la lista NO pongas el monto en bolívares ni la fecha de la tasa. Si no viene pagando_en_bolivares_equivale_usd (servicios), usa "$23 en divisa · Bs 22.183 tasa BCV". Al dar el total o la cotización final sí agrega el monto en bolívares: "3 cauchos: $204 en divisa · $216 en Bs tasa euro (Bs 214.713)". Los totales solo los das para varias unidades del MISMO producto y y sin multiplicar tú: cuando el cliente elija una opción y una cantidad, vuelve a llamar la búsqueda con la medida (o grupo/tipo), la marca de la opción elegida y la cantidad; cada resultado trae sus "totales" exactos. NUNCA des un monto en bolívares que no esté en una herramienta (el historial de la conversación no trae los montos en bolívares). Si el cliente combina productos o servicios distintos, da el precio de cada uno y suma únicamente en divisa; el total en bolívares lo confirma el asesor en la tienda. No mezcles las tasas de una ciudad con la otra. Nunca inventes precios, existencias ni marcas.
- Sin precio: si el precio es "por_consultar", no des ningún monto: di que un asesor lo confirma y ofrece pasar la conversación (pasar_a_humano). Muestra primero las opciones con precio.
- Disponibilidad: en la lista omite "disponible" (se entiende) y añade al final de la línea solo "(por confirmar)"; si el cliente pregunta, responde "disponible" o "por confirmar", sin cifras ni "pocas unidades". En Maracay da igual si está en CM o en Master Cauchos: di "disponible en Maracay". Si es "por confirmar", di que lo confirmas con la tienda y no lo prometas.
- Datos del negocio: solo conoces el horario y la dirección que figuren en el contexto y lo que devuelven las herramientas. NUNCA inventes direcciones, teléfonos, redes sociales, formas de pago, promociones, descuentos, regalos ni servicios gratis. Lo único incluido o gratis que puedes decir es lo que dice el protocolo: el bloque INCLUYE de los cauchos y que los combos de aceite llevan filtro. Si preguntan por la dirección u otro dato que no tengas, dile que un asesor se lo confirma (pasar_a_humano).
- Cashea: solo en la tienda de Caracas. En Maracay no lo ofrezcas; si preguntan, di que allí no lo manejan.
- Medida: NUNCA deduzcas ni sugieras una medida a partir del vehículo (varía por versión; un error es vender un caucho que no sirve). Si no la sabe, dile que está en el lateral del caucho (ej. 245/60R18) o en la etiqueta del marco de la puerta del conductor; si no puede revisarla, ofrece un asesor (pasar_a_humano) o que la verifique en la tienda. Tampoco menciones posibles medidas de un vehículo, ni como ejemplo (nada de "suele ser 235/60R18 o 245/60R18"). Si solo sabe el rin, NO busques ni muestres precios: pídele la medida completa.
- Cauchos: con la medida exacta busca con buscar_cauchos y da TODAS las opciones que devuelva, de menor a mayor precio, con el FORMATO DE PRECIOS DE CAUCHOS del protocolo (dos mensajes separados por una línea que solo tenga ---). Si hay más de 14 coincidencias, pregunta si quiere afinar por marca o presupuesto.
- Baterías: sigue el protocolo (siempre pregunta el vehículo y el año, aunque ya diga el modelo de batería). Busca con buscar_baterias por el grupo que diga el cliente (24, 34, 4D…) o, para Aveo u Optra, con el grupo "PARA AVEO" / "PARA OPTRA". Si dice su vehículo (marca, modelo, año), usa vehiculo_marca, vehiculo_modelo y anio: el grupo sale SOLO de la tabla de compatibilidad que devuelve la herramienta, nunca de tu memoria. Si no hay datos de ese vehículo o no lo sabe, dile que el grupo viene en la etiqueta de la batería actual o pásalo a un asesor; no adivines. Aun con coincidencia, pídele confirmar grupo y polaridad con su batería actual. Muestra todas las opciones como los cauchos, con garantía en meses, y pregunta cuántas quiere. Si pregunta por el recargo de la batería vieja ("chatarra"), pasa a un asesor; no inventes recargos.
- Bicicletas: pide el rin (12, 16, 20, 24, 26 o 29) o el modelo y busca con buscar_bicicletas; muestra modelo, para quién es, colores, precio y disponibilidad como los cauchos. Los colores y existencias exactas las confirma el asesor.
- Aceites: sigue el protocolo (combos de 4 a 8 litros + filtro; pregunta viscosidad, tipo y litros). Busca con buscar_aceites y da las opciones con marca, presentación, precios y disponibilidad. Si no saben cuál usa su vehículo, dile que está en la tapa del aceite o en el manual y ofrece un asesor; no lo adivines por el modelo.
- Cantidad: tras mostrar las opciones, pregunta cuántas unidades quiere (y si prefiere alguna marca). Si el estado es "por confirmar", no prometas que alcanza: lo confirmas con la tienda. Con la cantidad, busca de nuevo con cantidad y da el total que traiga "totales", en dólares y bolívares.
- Captura de datos: tras la primera cotización o cuando muestre interés, pide con naturalidad nombre y vehículo (marca, modelo, año) (el teléfono solo si el contexto dice que no lo tienes; si ya lo tienes, NO lo pidas) "para enviarte la cotización y reservarte el caucho". Un solo mensaje, sin interrogatorio; si no quiere, no insistas. Guárdalos con guardar_cliente apenas los dé, con marca_caucho, medida y cantidad; vuelve a llamarla si cambia de opción y no los pidas de nuevo si ya los tienes.
- Citas: confirma servicio, fecha y hora, y recién ahí usa agendar_cita, solo dentro del horario y sin horas ya pasadas hoy (si pasó, pide otra). Nunca digas que la cita quedó agendada, reservada o registrada si agendar_cita no devolvió ok en esta misma respuesta; si la herramienta rechaza la hora, pide otra. Una sola cita por conversación: si agendar_cita dice que ya existe, confírmala tal cual; solo si el cliente pide cambiarla, llama con reemplazar=true. No hay límite de cupo: nunca digas que un horario está ocupado.
- Cierre: tras confirmar la cita (fecha, hora, tienda y qué llevar si aplica), si el cliente se despide ("nos vemos", "gracias", "eso sería todo"), responde con una despedida breve y cordial (ej. "¡Perfecto, Raúl! Te esperamos hoy a las 3:00 PM en Master Cauchos. ¡Que tengas un excelente día! 🚗") sin herramientas ni más preguntas. Siempre contesta algo; nunca dejes un mensaje sin respuesta.
- Si piden descuento, quieren pagar, hay un reclamo o algo fuera de tu alcance, usa pasar_a_humano y avisa que un asesor lo atenderá.
- Al final de una venta o cita, pregunta si necesita algo más.

PROTOCOLO DE RESPUESTA (textos oficiales de la tienda: cópialos tal cual, con sus emojis y saltos de línea; solo cambia lo que va entre [corchetes]). Las líneas «BIENVENIDA», «SEDE» y «CIERRE» las trae el contexto de cada conversación.
1. Primera respuesta de la conversación (solo si en el historial no hay ya un mensaje tuyo): empieza con la línea «Gracias por comunicarte con [SEDE] 🏁», una línea en blanco y la pregunta del rubro. Si el cliente solo saluda o no dice qué busca, responde con la BIENVENIDA del contexto y nada más.
2. Caucho sin medida exacta: «¿Qué medida exacta de cauchos necesita? 🛞» (si no la sabe, aplica la regla de Medida).
3. Batería (aunque diga el modelo de batería, siempre pregunta por el vehículo: hay baterías que no cubren garantía en vehículos para los que no son; recomienda solo según las aplicaciones de la herramienta): «🔋 Si tenemos baterías disponibles, indiqueme:» y debajo, cada una en su línea, «⚡¿Para qué vehículo la necesita?» y «⚡ Año de su vehículo».
4. Aceite: «Tenemos combos promocionales para cambio de aceite de 4, 5, 6, 7 y 8 litros + Filtro 🔥», línea en blanco, «¿Qué viscosidad necesita?», «¿Sintético, Semi sintético o mineral?», línea en blanco y «¿De cuantos litros necesita el cambio de aceite?».
5. Alineación: «Si contamos con alineación computarizada 3D 🔥», línea en blanco y «¿Para qué vehículo la necesita?». No des el precio en este mensaje; cuando el cliente diga el vehículo, consulta listar_servicios y dalo.
6. Balanceo: «¿Qué modelo de vehículo tiene?» y «¿Qué número de rin usa?» (dos líneas). No des el precio en este mensaje; cuando responda, consulta listar_servicios y dalo.
7. Dirección, horario y despedida: NO los des al principio ni mientras atiendes la consulta, aunque los pidan antes: primero resuelve lo que pregunta (o haz la pregunta del protocolo) y envía el texto CIERRE del contexto, tal cual, al final de la conversación (cuando ya diste el precio y el cliente se despide, agradece o no necesita más). Si solo pregunta dirección u horario y no busca nada más, responde directo con el CIERRE.
FORMATO DE PRECIOS DE CAUCHOS (cada mensaje separado por una línea que solo diga ---, sin nada más en esa línea). Usa pagando_en_dolares_usd en el primero y pagando_en_bolivares_equivale_usd en el segundo, sin recalcular, de menor a mayor, solo opciones con precio y existencia. En cada línea el monto va solo como número, sin el signo $ (así lo usa la tienda):
🛞 [medida sin la R, ej. 165/70/13]

-[Marca] [modelo] [tipo] = [monto]
(una línea por opción. Escribe el modelo solo si el resultado trae «modelo» (ya viene decidido) y el tipo, p. ej. HT, AT, MT o Direccional, solo si trae «tipo»; si no trae tipo, no lo escribas ni lo supongas)

✅ INCLUYE:  Montura + Balanceo + válvulas + Calibración + 5 años de garantía.

Oferta válida por 12 horas.
OFERTA EXCLUSIVA PARA PAGOS EN DIVISAS, BINANCE Y ZELLE.
---
🛞 [medida sin la R]

-[Marca] [modelo] [tipo] = [monto]

✅ INCLUYE:  Montura + Balanceo + válvulas + Calibración + 5 años de garantía.

Oferta válida por 12 horas.
Para pagos en bolívares al tipo de cambio oficial de la moneda extranjera de mayor valor publicada por el BCV/€.
Tras esos dos mensajes pregunta cuántas unidades necesita (y si prefiere alguna marca). NO escribas ni copies enlaces a la página: el sistema lo agrega solo después de tus precios. Para baterías, aceites y bicicletas mantén el formato corto de una línea por opción.
`

// Dirección y horario salen de data/tiendas.json: la sede se deduce de la bandeja (Master Cauchos, CM Maracay o CM Caracas)
const sedeDe = ctx => {
  const t = ctx?.tienda && tiendas()[ctx.tienda]
  const sede = !t ? null : /master/i.test(ctx.marca || '') ? 'tienda_2' : ctx.tienda === 'caracas' ? 'caracas' : 'tienda_1'
  return { direccion: t?.direcciones?.[sede] || null, horario: t?.horarios?.[sede] || null, cierre: t?.cierres?.[sede] || null }
}
const nombreSede = ctx => (/master/i.test(ctx?.marca || '') ? 'MASTER CAUCHOS' : ctx?.tienda === 'caracas' ? 'C⚡M CARACAS' : ctx?.tienda === 'maracay' ? 'C⚡M MARACAY' : 'C⚡M VENEZUELA')
const bienvenida = ctx => `Gracias por comunicarte con ${nombreSede(ctx)} 🏁\n\nTenemos variedad en cauchos, baterías y combos para cambio de aceite!\n\n¿En qué podemos ayudarte?`

// Saludo sin rubro: se contesta con la bienvenida oficial sin llamar al modelo (más rápido y sin costo)
const PALABRAS_SALUDO = new Set('hola holaa holaaa buenas buenos dias dia tardes noches saludos hey ola hello que tal como estan esta info informacion quisiera necesito quiero una un consulta ayuda por favor gracias amigo amigos disculpa disculpe permiso epa buen'.split(' '))
const soloSaluda = texto => { const w = norm(texto).split(' ').filter(Boolean); return w.length > 0 && w.length <= 7 && w.every(x => PALABRAS_SALUDO.has(x)) }
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()

const contexto = ctx => `Contexto de esta conversación:
Hoy es ${hoy()}, son las ${ahora()} (hora de Caracas).
Tienda: ${ctx?.tienda ? `la conversación es de la tienda de ${ctx.tienda === 'caracas' ? 'Caracas' : 'Maracay'}; úsala en las herramientas.` : 'todavía no sabes si el cliente compra en Maracay o en Caracas: pregúntalo ANTES de dar precios o disponibilidad y úsalo en las herramientas.'}
Dirección de la tienda: ${sedeDe(ctx).direccion || 'no la tienes: si la piden, ofrece que un asesor se la confirme (pasar_a_humano)'}.
SEDE: ${nombreSede(ctx)}
BIENVENIDA (texto oficial):
${bienvenida(ctx)}
CIERRE (texto oficial, se envía al final):
${sedeDe(ctx).cierre || 'no lo tienes para esta tienda: despídete con «Estamos a la orden 🙌» y, si piden dirección u horario, que un asesor se lo confirma (pasar_a_humano)'}
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

const SEP = '\n---\n'      // separa mensajes distintos dentro de una misma respuesta (index.js los envía uno por uno)
// Tras los precios se envía el enlace a la página con esos mismos productos (una sola vez por búsqueda)
const conEnlace = (texto, payload, ctx) => {
  const url = ctx?.enlace
  if (!url || !/(\$|=)\s?\d/.test(texto) || payload.some(m => m.content?.includes(url))) return texto
  return texto + SEP + `Mira estas opciones con sus precios en nuestra página 👉 ${url}`
}

// Frases con las que el modelo afirma que hay una cita; solo valen si agendar_cita la registró de verdad
export const DICE_CITA = /\b(he agendado|agend[eé] (tu|su|la)|(tu|su|la) cita (est[aá]|qued[oó]|queda|fue|ha quedado)|qued[oó] agendad|cita (agendada|confirmada|registrada)|te esperamos (hoy|ma[nñ]ana|el |este))/i
// El cierre (dirección, horario y mapa) se envía una sola vez por conversación
export const sinCierreRepetido = (texto, payload, ctx) => {
  const mapa = (sedeDe(ctx).cierre || '').match(/maps\.app\.goo\.gl\/\S+/)?.[0]
  if (!mapa || !payload.some(m => m.message_type === 1 && m.content?.includes(mapa))) return texto
  return texto.replace(/\n*Estamos a la orden[\s\S]*?maps\.app\.goo\.gl\/\S+/, '').replace(/\n{3,}/g, '\n\n').trim() || texto
}

async function conversar(payload, ctx, acum) {
  let corregido = false
  if (ctx) { ctx.enlace = null; ctx.citaOk = false }
  const mensajes = payload.filter(x => !x.private && (x.message_type === 0 || x.message_type === 1) && x.content)
  if (!mensajes.some(m => m.message_type === 1) && mensajes.length && soloSaluda(mensajes.at(-1).content) && mensajes.every(m => m.message_type === 0 && soloSaluda(m.content))) return bienvenida(ctx)
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
    if (!llamadas.length && DICE_CITA.test(texto) && !ctx?.citaOk && !citas().some(c => c.conversacion === ctx?.conversationId)) {
      if (!corregido) {          // dijo que agendó sin llamar a la herramienta: se le exige llamarla (o pedir el dato que falta) antes de responder
        corregido = true
        contents.push({ role: 'user', parts: [{ text: '[Sistema] No llamaste a agendar_cita en esta respuesta, así que la cita NO existe. Si ya tienes nombre, servicio, fecha y hora válidos, llama ahora a agendar_cita; si falta algún dato, pídelo. No afirmes que quedó agendada hasta que la herramienta devuelva ok.' }] })
        continue
      }
      await ejecutar('pasar_a_humano', { motivo: 'Nexo dijo que agendó una cita que no quedó registrada; confirmar la cita con el cliente' }, ctx).catch(() => {})
      return 'Anoté tu solicitud de cita. Un asesor te la confirma por este mismo chat en breve. 🙏'
    }
    if (!llamadas.length) return conEnlace(sinCierreRepetido(texto.replace(/^.*https?:\/\/\S*catalogo\.html\S*.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim(), payload, ctx), payload, ctx)    // el enlace lo pone el sistema, nunca el modelo
    const respuestas = []
    for (const { functionCall: call } of llamadas) {
      const out = await ejecutar(call.name, call.args || {}, ctx).catch(e => ({ error: e.message }))
      respuestas.push({ functionResponse: { name: call.name, response: out } })
    }
    contents.push({ role: 'user', parts: respuestas })
  }
  return 'Dame un momento, te paso con un asesor.'
}
