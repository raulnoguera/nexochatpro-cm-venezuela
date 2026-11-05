import fs from 'node:fs'
import path from 'node:path'

// Tasa en Bs por unidad de moneda. USD y EUR se leen del BCV (API pública); se puede fijar una tasa a mano
// en data/tasas.json (lo hace el panel: «Tasa del día»), por ejemplo {"EUR": {"valor": 1000, "fecha": "2026-10-27"}}, y solo vale el día de su fecha.
const FUENTE = { USD: 'dolares/oficial', EUR: 'euros/oficial' }
const RESPALDO = { USD: Number(process.env.FALLBACK_RATE_USD) || 0, EUR: Number(process.env.FALLBACK_RATE_EUR) || 0 }
const cache = {}
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

const ARCHIVO = () => path.resolve('data/tasas.json')
const leerManuales = () => { try { return JSON.parse(fs.readFileSync(ARCHIVO(), 'utf8')) } catch { return {} } }
function manual(moneda) {
  const m = leerManuales()[moneda]
  return m && m.valor > 0 && m.fecha === hoy() ? { rate: m.valor, fecha: m.fecha, fuente: 'fijada a mano' } : null
}
// Tasas fijadas a mano que valen hoy, tal como las lee la web desde catalogo.json: { euro: { valor, fecha }, dolar: { valor, fecha } }
export const manualesVigentes = () => {
  const m = leerManuales(), vale = x => (x && x.valor > 0 && x.fecha === hoy() ? { valor: x.valor, fecha: x.fecha } : null)
  return { euro: vale(m.EUR), dolar: vale(m.USD) }
}

// El euro vale entre 0,8 y 2 veces el dólar; fuera de ese rango el dato de la API no sirve
export const esCoherente = (euro, dolar) => (dolar > 0 ? euro >= dolar * 0.8 && euro <= dolar * 2 : euro >= 10)
// A veces la API manda el euro sin el separador de miles (1.006 en lugar de 1.006,03): si multiplicado por 1.000 sí es coherente, se corrige; si no, se descarta
export const ajustarEuro = (euro, dolar) => (esCoherente(euro, dolar) ? euro : esCoherente(euro * 1000, dolar) ? euro * 1000 : null)

// Lo que dice la API del BCV (nunca la tasa fijada a mano ni el respaldo)
async function tasaApi(moneda) {
  const c = cache[moneda]
  if (c && Date.now() - c.ts < 30 * 60 * 1000) return c
  try {
    const r = await fetch(`https://ve.dolarapi.com/v1/${FUENTE[moneda]}`, { signal: AbortSignal.timeout(6000) })
    const j = await r.json()
    const rate = moneda === 'EUR' && j.promedio ? ajustarEuro(j.promedio, (await tasaPara('USD')).rate) : j.promedio
    if (rate > 0) return (cache[moneda] = { rate, fecha: j.fechaActualizacion?.slice(0, 10), fuente: rate === j.promedio ? 'BCV' : 'BCV (escala corregida)', ts: Date.now() })
  } catch { /* sin respuesta de la API */ }
  return null
}

export async function tasaPara(moneda) {
  const m = manual(moneda); if (m) return m
  const a = await tasaApi(moneda); if (a) return a
  const c = cache[moneda]
  if (c) return { ...c, ts: Date.now() - 25 * 60 * 1000 }   // última buena, reintenta pronto
  return (cache[moneda] = { rate: RESPALDO[moneda], fecha: null, fuente: 'respaldo', ts: Date.now() - 25 * 60 * 1000 })
}

// Para el panel: la tasa en uso, lo que dice la API y la fijada a mano (si vale hoy)
export async function estadoTasas() {
  const salida = {}
  for (const [k, moneda] of [['euro', 'EUR'], ['dolar', 'USD']]) {
    const uso = await tasaPara(moneda), api = await tasaApi(moneda), m = leerManuales()[moneda]
    salida[k] = { en_uso: { rate: uso.rate, fuente: uso.fuente, fecha: uso.fecha }, api: api ? { rate: api.rate, fecha: api.fecha } : null, manual: m && m.valor > 0 && m.fecha === hoy() ? { valor: m.valor, fecha: m.fecha } : null, respaldo: RESPALDO[moneda] || null }
  }
  return salida
}

// Fija (número) o quita (null) la tasa de hoy a mano. Valida que el euro y el dólar sean coherentes entre sí. Devuelve el estado nuevo.
export async function fijarTasas(cambios) {
  const m = leerManuales(), nuevo = { ...m }
  for (const [k, moneda] of [['euro', 'EUR'], ['dolar', 'USD']]) {
    if (!(k in cambios)) continue
    if (cambios[k] === null) { delete nuevo[moneda]; continue }
    const v = Number(String(cambios[k]).replace(',', '.'))
    if (!(v > 0) || v > 1e7) throw new Error(`Escribe la tasa del ${k === 'euro' ? 'euro' : 'dólar'} como un número mayor que 0 (ejemplo 1006,03).`)
    nuevo[moneda] = { valor: Math.round(v * 1e4) / 1e4, fecha: hoy() }
  }
  fs.writeFileSync(ARCHIVO() + '.tmp', JSON.stringify(nuevo)); fs.renameSync(ARCHIVO() + '.tmp', ARCHIVO())
  const e = await estadoTasas()
  if (!esCoherente(e.euro.en_uso.rate, e.dolar.en_uso.rate)) {
    fs.writeFileSync(ARCHIVO() + '.tmp', JSON.stringify(m)); fs.renameSync(ARCHIVO() + '.tmp', ARCHIVO())            // se deshace
    throw new Error(`Esas tasas no son coherentes: el euro debe valer entre 0,8 y 2 veces el dólar (euro ${e.euro.en_uso.rate}, dólar ${e.dolar.en_uso.rate}).`)
  }
  return e
}

// Bolívares siempre redondeados hacia arriba al bolívar entero (como el ROUNDUP de la lista de precios)
export const bs = (usd, rate) => Math.ceil(usd * rate - 1e-6)
