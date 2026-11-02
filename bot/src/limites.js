import { usoPorDia, costo } from './uso.js'

// Topes para que el gasto no se dispare: por cliente (mensajes de entrada por hora y por día) y del modelo (USD por semana).
// Pasado un tope Nexo deja de llamar al modelo y la conversación pasa a un asesor. Se cambian en .env sin tocar el código.
const num = (v, def) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : def)
export const LIMITE_HORA = num(process.env.LIMITE_MENSAJES_HORA, 15)
export const LIMITE_DIA = num(process.env.LIMITE_MENSAJES_DIA, 20)
export const TOPE_SEMANAL = num(process.env.TOPE_SEMANAL_USD, 20)

const diaCaracas = ahora => new Date(ahora).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

// La semana va de lunes a domingo (hora de Caracas).
export function inicioSemana(ahora = Date.now()) {
  const d = new Date(diaCaracas(ahora) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

// Gasto estimado del modelo en la semana en curso, con el mismo cálculo del panel de uso.
export function gastoSemana(datos = usoPorDia(), ahora = Date.now()) {
  const desde = inicioSemana(ahora)
  let total = 0
  for (const [dia, modelos] of Object.entries(datos)) if (dia >= desde) for (const [modelo, v] of Object.entries(modelos)) total += costo(modelo, v)
  return total
}

export const estadoPresupuesto = (datos, ahora) => {
  const gasto = gastoSemana(datos, ahora)
  return { desde: inicioSemana(ahora), gasto, tope: TOPE_SEMANAL, pct: gasto / TOPE_SEMANAL * 100 }
}

// Por qué Nexo no debe seguir respondiendo ('semana' | 'hora' | 'dia'), o null. Los mensajes de entrada se cuentan en el historial de la
// conversación (el mensaje que acaba de llegar ya está incluido, así que el límite se pasa con el mensaje número LIMITE + 1).
export function motivoDeFreno(payload, { datos, ahora = Date.now() } = {}) {
  if (gastoSemana(datos, ahora) >= TOPE_SEMANAL) return 'semana'
  const entrada = payload.filter(m => m.message_type === 0 && !m.private).map(m => m.created_at)
  const desdeDia = Date.parse(diaCaracas(ahora) + 'T00:00:00-04:00') / 1000
  if (entrada.filter(t => t >= ahora / 1000 - 3600).length > LIMITE_HORA) return 'hora'
  if (entrada.filter(t => t >= desdeDia).length > LIMITE_DIA) return 'dia'
  return null
}
