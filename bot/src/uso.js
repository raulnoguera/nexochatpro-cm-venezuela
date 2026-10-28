import fs from 'node:fs'
import path from 'node:path'

// Contador de uso del modelo por día (hora de Caracas) y modelo. Se guarda en data/uso.json.
const archivo = path.resolve('data', 'uso.json')
let datos = {}
try { datos = JSON.parse(fs.readFileSync(archivo, 'utf8')) } catch {}

const dia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

export function registrarUso(modelo, usage, estado = 'ok') {
  const d = (datos[dia()] ??= {})
  const m = (d[modelo] ??= { llamadas: 0, entrada: 0, salida: 0, errores: 0, limite: 0, cache: 0, pensando: 0 })
  if (estado === 'ok') { m.llamadas++; m.entrada += usage?.prompt_tokens || 0; m.salida += usage?.completion_tokens || 0; m.cache = (m.cache || 0) + (usage?.cache || 0); m.pensando = (m.pensando || 0) + (usage?.pensando || 0) }
  else if (estado === '429') m.limite++
  else m.errores++
  try { fs.writeFileSync(archivo + '.tmp', JSON.stringify(datos)); fs.renameSync(archivo + '.tmp', archivo) } catch (e) { console.error('Uso:', e.message) }
}

export const usoPorDia = () => datos

// Precio por millón de tokens (lista pública de Google); lo que está en caché se cobra al 10 % de la entrada. Es una estimación.
export const costo = (modelo, v) => {
  const [pe, ps] = /lite/i.test(modelo) ? [0.25, 1.5] : [0.5, 3], c = v.cache || 0
  return ((v.entrada - c) * pe + c * pe * 0.1 + ((v.salida || 0) + (v.pensando || 0)) * ps) / 1e6
}

// Gasto por conversación de Chatwoot (se acumula entre los mensajes del cliente). Se conservan las últimas 500.
const archivoConv = path.resolve('data', 'uso_conversaciones.json')
let convs = {}
try { convs = JSON.parse(fs.readFileSync(archivoConv, 'utf8')) } catch {}

export function registrarConversacion(id, a, canal) {
  if (!id || !a.llamadas) return
  const c = (convs[id] ??= { inicio: Date.now(), mensajes: 0, llamadas: 0, entrada: 0, cache: 0, salida: 0, pensando: 0, usd: 0 })
  c.actualizado = Date.now(); c.mensajes++; if (canal) c.canal = canal
  for (const k of ['llamadas', 'entrada', 'cache', 'salida', 'pensando', 'usd']) c[k] += a[k]
  const ids = Object.keys(convs)
  if (ids.length > 500) for (const k of ids.sort((x, y) => convs[x].actualizado - convs[y].actualizado).slice(0, ids.length - 500)) delete convs[k]
  try { fs.writeFileSync(archivoConv + '.tmp', JSON.stringify(convs)); fs.renameSync(archivoConv + '.tmp', archivoConv) } catch (e) { console.error('Uso conv:', e.message) }
}

export const usoPorConversacion = () => Object.entries(convs).map(([id, c]) => ({ id: Number(id), ...c })).sort((x, y) => y.actualizado - x.actualizado)
