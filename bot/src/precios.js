import { tiendas } from './store.js'
import { tasaPara, bs } from './tasa.js'

export const nombreTienda = id => tiendas()[id]?.nombre

// Precio -> lo que paga el cliente según la tienda:
//  - lista real (usdBs informado): el USD ya es el precio de contado y usdBs el equivalente si paga en bolívares
//  - sin usdBs (servicios, datos de ejemplo): USD = lista con el descuento de la tienda, Bs = lista a la tasa
//  - en bolívares: equivalente x tasa de la moneda de la tienda (euro en Maracay, dólar BCV en Caracas)
export async function precio(lista, tienda, usdBs) {
  const t = tiendas()[tienda]
  const tasa = await tasaPara(t.moneda_bs)
  return {
    pagando_en_dolares_usd: usdBs ? lista : Math.round(lista * (1 - t.descuento_usd)),
    ...(usdBs && { pagando_en_bolivares_equivale_usd: usdBs }),
    pagando_en_bolivares_bs: bs(usdBs ?? lista, tasa.rate),
    tasa_usada: `${t.etiqueta_tasa}: Bs ${tasa.rate.toLocaleString('es-VE', { maximumFractionDigits: 2 })}${tasa.fecha ? ' (' + tasa.fecha + ')' : ''}`,
  }
}

// Existencias por sede -> estado para la tienda del cliente. Las cantidades negativas (traslados sin cargar) cuentan como 0.
export function disponibilidad(stock, tienda) {
  const t = tiendas()[tienda]
  const sedes = Object.keys(t.sedes)
  if (!sedes.some(s => stock?.[s] !== undefined)) return { estado: 'por_confirmar', detalle: 'Sin datos de existencia para esta ciudad; confirmar con la tienda' }
  const hay = sedes.filter(s => (stock?.[s] ?? 0) > 0)
  const negativo = sedes.some(s => (stock?.[s] ?? 0) < 0)
  if (!hay.length) return { estado: negativo ? 'por_confirmar' : 'agotado', detalle: negativo ? 'Puede haber mercancía en traslado; confirmar con la tienda' : 'Sin existencia en esta ciudad' }
  const donde = sedes.length > 1 ? t.nombre : t.sedes[hay[0]]                     // en Maracay da igual si está en CM o en Master Cauchos
  return { estado: 'disponible', detalle: `Disponible en ${donde}` }
}

// Horario de atención de la sede (de data/tiendas.json: «lunes a sábado de 8:00 a 17:30»). Master Cauchos es tienda_2 en Maracay.
export function horarioDe(tienda, marca = '') {
  const t = tiendas()[tienda]; if (!t) return null
  const claves = Object.keys(t.horarios || {}), sede = /master/i.test(marca) && claves.includes('tienda_2') ? 'tienda_2' : claves[0]
  const m = String(t.horarios?.[sede] || '').match(/(\d{1,2}):(\d{2})\s*a\s*(\d{1,2}):(\d{2})/)
  return m ? { texto: t.horarios[sede], desde: +m[1] * 60 + +m[2], hasta: +m[3] * 60 + +m[4] } : null
}
// Fecha y hora actuales de Venezuela como «YYYY-MM-DD HH:MM»
export const ahoraCaracas = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Caracas' }).slice(0, 16)
