import fs from 'node:fs'
import path from 'node:path'

// Tasa en Bs por unidad de moneda. USD y EUR se leen del BCV (API pública); se puede fijar una tasa a mano
// en data/tasas.json, por ejemplo {"EUR": {"valor": 1000, "fecha": "2026-10-27"}}, y solo vale el día de su fecha.
const FUENTE = { USD: 'dolares/oficial', EUR: 'euros/oficial' }
const RESPALDO = { USD: Number(process.env.FALLBACK_RATE_USD) || 0, EUR: Number(process.env.FALLBACK_RATE_EUR) || 0 }
const cache = {}
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

function manual(moneda) {
  try {
    const m = JSON.parse(fs.readFileSync(path.resolve('data/tasas.json'), 'utf8'))[moneda]
    if (m && m.valor > 0 && m.fecha === hoy()) return { rate: m.valor, fecha: m.fecha, fuente: 'fijada a mano' }
  } catch { /* sin archivo */ }
  return null
}

export async function tasaPara(moneda) {
  const m = manual(moneda); if (m) return m
  const c = cache[moneda]
  if (c && Date.now() - c.ts < 30 * 60 * 1000) return c
  try {
    const r = await fetch(`https://ve.dolarapi.com/v1/${FUENTE[moneda]}`, { signal: AbortSignal.timeout(6000) })
    const j = await r.json()
    if (j.promedio) return (cache[moneda] = { rate: j.promedio, fecha: j.fechaActualizacion?.slice(0, 10), fuente: 'BCV', ts: Date.now() })
  } catch { /* usa respaldo */ }
  if (c) return { ...c, ts: Date.now() - 25 * 60 * 1000 }   // última buena, reintenta pronto
  return (cache[moneda] = { rate: RESPALDO[moneda], fecha: null, fuente: 'respaldo', ts: Date.now() - 25 * 60 * 1000 })
}

// Bolívares siempre redondeados hacia arriba al bolívar entero (como el ROUNDUP de la lista de precios)
export const bs = (usd, rate) => Math.ceil(usd * rate - 1e-6)
