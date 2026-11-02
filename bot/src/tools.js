import fs from 'node:fs'
import path from 'node:path'
import { inventario, baterias, aceites, bicicletas, compatibilidad, servicios, addCita, updateCita, citas, tiendas } from './store.js'
import { precio, disponibilidad, nombreTienda, horarioDe, ahoraCaracas } from './precios.js'
import * as cw from './chatwoot.js'
import { traspasar } from './equipos.js'
import { gruposDe } from './lista.js'

const MAX_RESULTADOS = 6
const MAX_CAUCHOS = 14        // el protocolo de la tienda lista TODAS las opciones de una medida
const WEB = (process.env.WEB_URL || 'https://cmvenezuela.com').replace(/\/$/, '')
// Enlace a la web con esos mismos productos: se agrega después del mensaje con precios (ver agent.js)
const enlaceWeb = (cat, params, tienda) => `${WEB}/catalogo.html?${new URLSearchParams({ ciudad: tienda, cat, ...params })}`
const unico = (rs, campo) => { const v = [...new Set(rs.map(r => r[campo]).filter(Boolean))]; return v.length === 1 ? v[0] : null }
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const TIENDA = { type: 'string', enum: ['maracay', 'caracas'], description: 'Ciudad donde el cliente comprará. Si no la sabes, pregúntala antes.' }

export const definiciones = [
  {
    name: 'buscar_cauchos',
    description: 'Busca cauchos en inventario por medida (ej. 195/65R15 o "195 65 15"), rin o marca. Devuelve precio en dólares (con descuento) y en bolívares según la tienda, y la disponibilidad en esa ciudad.',
    input_schema: {
      type: 'object',
      properties: {
        tienda: TIENDA,
        cantidad: { type: 'integer', description: 'Unidades que quiere el cliente. Pásala cuando ya eligió una opción: cada resultado trae entonces los totales exactos.' },
        medida: { type: 'string', description: 'Medida como 195/65R15. Opcional si se da rin.' },
        rin: { type: 'integer', description: 'Rin en pulgadas, ej. 15' },
        marca: { type: 'string' },
        codigo: { type: 'string', description: 'Código exacto del producto (CM o Master Cauchos), si el cliente o el asesor lo da.' },
      },
    },
  },
  {
    name: 'buscar_baterias',
    description: 'Busca baterías por grupo (ej. "GRUPO 24", "GRUPO 34", "4D", "42"), por vehículo (hay grupos "PARA AVEO" y "PARA OPTRA"), amperaje o marca. Devuelve precio en dólares y en bolívares según la tienda, garantía en meses y disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        tienda: TIENDA,
        cantidad: { type: 'integer', description: 'Unidades que quiere el cliente. Pásala cuando ya eligió una opción: cada resultado trae entonces los totales exactos.' },
        grupo: { type: 'string', description: 'Grupo o tipo de batería, ej. 24, 34, 4D, 22NF, "PARA AVEO"' },
        amperaje: { type: 'integer', description: 'Amperaje, ej. 1000' },
        marca: { type: 'string', description: 'Marca de la batería (ej. Duncan, PGT), no del vehículo' },
        vehiculo_marca: { type: 'string', description: 'Marca del vehículo (ej. Toyota). Úsalo con vehiculo_modelo y anio para buscar según la tabla de compatibilidad.' },
        vehiculo_modelo: { type: 'string', description: 'Modelo del vehículo (ej. Corolla)' },
        anio: { type: 'integer', description: 'Año del vehículo, ej. 2012' },
      },
    },
  },
  {
    name: 'buscar_aceites',
    description: 'Busca aceites de motor y lubricantes por tipo o viscosidad (ej. "20W-50 MINERAL", "15W-40 SEMISINTETICO", "ATF", "2 Tiempos"), presentación (Litro, 4 Litros, 5 Litros…) o marca. Devuelve precio en dólares y en bolívares según la tienda y disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        tienda: TIENDA,
        cantidad: { type: 'integer', description: 'Unidades que quiere el cliente. Pásala cuando ya eligió una opción: cada resultado trae entonces los totales exactos.' },
        tipo: { type: 'string', description: 'Viscosidad y/o tipo, ej. 20W-50, SEMISINTETICO, ATF, 2 Tiempos' },
        presentacion: { type: 'string', description: 'Ej. Litro, "4 Litros"' },
        marca: { type: 'string' },
      },
    },
  },
  {
    name: 'buscar_bicicletas',
    description: 'Busca bicicletas por rin (12, 16, 20, 24, 26, 29) o por modelo. Devuelve modelo, para quién es, colores, precio en dólares y en bolívares según la tienda y disponibilidad.',
    input_schema: { type: 'object', properties: { tienda: TIENDA, rin: { type: 'integer', description: 'Rin de la bicicleta, ej. 20' }, modelo: { type: 'string', description: 'Número de modelo, ej. 130' } } },
  },
  {
    name: 'listar_servicios',
    description: 'Lista servicios del taller (montaje, balanceo, alineación, etc.) con precio en dólares y en bolívares según la tienda.',
    input_schema: { type: 'object', properties: { tienda: TIENDA } },
  },
  {
    name: 'guardar_cliente',
    description: 'Guarda en el CRM los datos del cliente cuando los diga: nombre, teléfono, vehículo, placa, ciudad.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        telefono: { type: 'string' },
        vehiculo: { type: 'string', description: 'Marca, modelo y año' },
        placa: { type: 'string' },
        medida_caucho: { type: 'string' },
        marca_caucho: { type: 'string', description: 'Marca (y modelo si aplica) del caucho que el cliente eligió, ej. Habilead HT' },
        cantidad_cauchos: { type: 'integer', description: 'Unidades que quiere comprar' },
        tienda: TIENDA,
      },
    },
  },
  {
    name: 'agendar_cita',
    description: 'Agenda una cita de servicio o de compra/retiro. Pide nombre, servicio y fecha/hora antes de llamarla.',
    input_schema: {
      type: 'object',
      properties: {
        tienda: TIENDA,
        nombre: { type: 'string' },
        telefono: { type: 'string' },
        servicio: { type: 'string', description: 'Servicio o "compra de cauchos"' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:MM en 24h' },
        notas: { type: 'string' },
        reemplazar: { type: 'boolean', description: 'true solo si el cliente pide cambiar la cita que ya tiene en esta conversación' },
      },
      required: ['nombre', 'servicio', 'fecha', 'hora'],
    },
  },
  {
    name: 'pasar_a_humano',
    description: 'Transfiere la conversación a un asesor humano. Úsala si el cliente lo pide, hay un reclamo, quiere negociar, pagar o el tema no está en tus herramientas.',
    input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] },
  },
]

// Formato de la lista de cauchos: en una medida, la misma marca y tipo con el mismo precio sale una sola vez, sin modelo;
// con precios distintos cada una lleva su modelo. Las marcas de data/formato_cauchos.json siempre llevan el modelo.
const siempreModelo = () => { try { return JSON.parse(fs.readFileSync(path.resolve('data', 'formato_cauchos.json'), 'utf8')).marcas_con_modelo.map(norm) } catch { return [] } }
const grupoKey = x => [x.medida, x.marca, x.tipo ?? '', x.lonas ?? ''].map(norm).join('|')        // las lonas distintas no se unen en una sola línea
const agrupaModelos = r => {
  const fijas = siempreModelo(), por = new Map(), usados = new Set()
  for (const x of r) por.set(grupoKey(x), [...(por.get(grupoKey(x)) || []), x])
  return r.filter(x => {
    if (fijas.includes(norm(x.marca))) return true
    const g = por.get(grupoKey(x)), k = grupoKey(x) + '|' + x.usd + '|' + x.usd_bs
    x.modelo_oculto = new Set(g.map(y => y.usd + '|' + y.usd_bs)).size === 1          // un solo precio en el grupo: sin modelo
    return !usados.has(k) && usados.add(k)                                           // una línea por precio distinto
  })
}
const modeloVisible = (x, input) => Boolean(input.codigo) || !x.modelo_oculto
// Productos sin precio en la lista: no se inventa ningún monto; Nexo debe decir que un asesor lo confirma
const sinPrecio = x => (x.usd > 0 ? 0 : 1)
const precioONada = async (x, tienda) => (x.usd > 0 ? precio(x.usd, tienda, x.usd_bs) : { precio: 'por_consultar', instruccion: 'No hay precio publicado: dile al cliente que un asesor le confirma el precio; no des ningún monto.' })
// La tasa es la misma en todas las filas: se informa una sola vez para no repetirla en cada resultado
const agrupaTasa = rs => { const tasa = rs.find(r => r.tasa_usada)?.tasa_usada; rs.forEach(r => delete r.tasa_usada); return tasa ? { tasa_usada: tasa } : {} }
// Totales exactos calculados aquí: el modelo no multiplica (se equivocaba en los bolívares)
const conTotales = (resultados, cantidad) => {
  const q = Math.floor(Number(cantidad))
  if (!(q > 1)) return
  const por = v => Math.round(v * q * 100) / 100
  for (const r of resultados) if (r.pagando_en_dolares_usd !== undefined) r.totales = { cantidad: q, pagando_en_dolares_usd: por(r.pagando_en_dolares_usd), ...(r.pagando_en_bolivares_equivale_usd && { pagando_en_bolivares_equivale_usd: por(r.pagando_en_bolivares_equivale_usd) }), pagando_en_bolivares_bs: por(r.pagando_en_bolivares_bs) }
}
// La cita debe tener fecha y hora válidas, no estar en el pasado y caer dentro del horario de la tienda (el modelo no lo cumplía solo)
const aMin = h => { const m = String(h).match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null }
function revisarHorario({ fecha, hora }, tienda, ctx) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha)) || aMin(hora) === null) return 'La fecha debe ser YYYY-MM-DD y la hora HH:MM en 24 h. Corrígelas y vuelve a llamar.'
  const hoy = ahoraCaracas()
  if (`${fecha} ${String(hora).padStart(5, '0')}` < hoy) return `Esa fecha y hora ya pasaron (ahora son las ${hoy.slice(11)} del ${hoy.slice(0, 10)}). Pídele al cliente otra hora y no digas que quedó agendada.`
  const h = tienda && horarioDe(tienda, ctx?.marca)
  if (new Date(`${fecha}T12:00:00-04:00`).getDay() === 0) return 'Los domingos la tienda está cerrada. Ofrece otro día de lunes a sábado y no digas que quedó agendada.'
  if (h && (aMin(hora) < h.desde || aMin(hora) > h.hasta)) return `Esa hora está fuera del horario de la tienda (${h.texto}). Ofrécele una hora dentro del horario y no digas que quedó agendada.`
  return null
}
const FALTA_TIENDA = { error: 'tienda_desconocida', instruccion: 'Pregunta al cliente si comprará en Maracay o en Caracas y vuelve a llamar la herramienta con la ciudad.' }

export async function ejecutar(nombre, input, ctx) {
  const tienda = input.tienda || ctx.tienda
  if (input.tienda && !ctx.tienda) ctx.tienda = input.tienda     // la recordamos durante la conversación

  if (nombre === 'buscar_cauchos') {
    if (!tienda) return FALTA_TIENDA
    if (input.rin && !input.medida && !input.marca) return { sin_medida: true, instruccion: 'El cliente solo dio el rin. Pídele la medida completa (viene en el lateral del caucho, ej. 235/60R18); no muestres precios ni sugieras medidas.' }
    let r = inventario()
    if (input.medida) r = r.filter(x => norm(x.medida).includes(norm(input.medida)))
    if (input.rin) r = r.filter(x => x.rin === input.rin)
    if (input.marca) r = r.filter(x => x.marca.toLowerCase().includes(input.marca.toLowerCase()))
    if (input.codigo) { const k = String(input.codigo).trim(); r = r.filter(x => x.codigo_cm === k || x.codigo_mc === k) }     // código exacto, sin tolerancia
    else r = agrupaModelos(r)
    const t = (await import('./store.js')).tiendas()[tienda]
    const resultados = []
    const orden = { disponible: 0, pocas_unidades: 0, por_confirmar: 1, agotado: 2 }
    const todos = r.map(x => ({ x, d: disponibilidad(x.stock, tienda) })).sort((a, b) => orden[a.d.estado] - orden[b.d.estado] || sinPrecio(a.x) - sinPrecio(b.x) || a.x.usd - b.x.usd)
    for (const { x, d } of todos.slice(0, MAX_CAUCHOS)) resultados.push({ marca: x.marca, ...(x.modelo && modeloVisible(x, input) && { modelo: x.modelo }), ...(x.tipo && { tipo: x.tipo }), ...(x.lonas && { lonas: x.lonas }), ...(x.espec?.length && { especificaciones: x.espec.map(e => `${e.k}: ${e.v}`).join('; ') }), medida: x.medida, ...(x.detalle && { presentacion: x.detalle }), ...(x.nota && { nota: x.nota }), ...(await precioONada(x, tienda)), disponibilidad: d })
    conTotales(resultados, input.cantidad)
    if (resultados.some(x => x.pagando_en_dolares_usd)) { const med = unico(r.map(x => ({ m: x.medida })), 'm'), rin = unico(r.map(x => ({ r: x.rin })), 'r'); ctx.enlace = enlaceWeb('cauchos', { ...(med && { medida: med }), ...(rin && { rin }) }, tienda) }
    return { tienda: nombreTienda(tienda), acepta_cashea: t.cashea, etiqueta_tasa: t.etiqueta_tasa, ...agrupaTasa(resultados), total_coincidencias: r.length, resultados, nota: !r.length ? 'Sin coincidencias en inventario' : r.length > MAX_CAUCHOS ? `Se muestran ${MAX_CAUCHOS} de ${r.length}; pide medida o marca para afinar` : undefined }
  }
  if (nombre === 'buscar_baterias' || nombre === 'buscar_aceites') {
    if (!tienda) return FALTA_TIENDA
    const bat = nombre === 'buscar_baterias'
    let r = bat ? baterias() : aceites()
    const tiene = (campo, v) => r.filter(x => norm(x[campo]).includes(norm(v)))
    if (input.marca) r = r.filter(x => norm(x.marca).includes(norm(input.marca)) || norm(x.descripcion).includes(norm(input.marca)))
    let compat
    if (bat && (input.vehiculo_marca || input.vehiculo_modelo)) {                     // el grupo sale SOLO de la tabla de compatibilidad, nunca de la memoria del modelo
      const filas = compatibilidad().filter(c => (!input.vehiculo_marca || norm(c.marca).includes(norm(input.vehiculo_marca))) && (!input.vehiculo_modelo || norm(c.modelo).includes(norm(input.vehiculo_modelo))) && (!input.anio || (input.anio >= c.desde && input.anio <= c.hasta)))
      if (!filas.length) return { tienda: nombreTienda(tienda), sin_datos_compatibilidad: true, instruccion: 'Ese vehículo no está en la tabla de compatibilidad. No adivines el grupo: pide el grupo que dice la batería actual o pasa a un asesor (pasar_a_humano).' }
      const grupos = new Set(filas.flatMap(c => gruposDe(c.grupo)))
      compat = { vehiculo: [...new Set(filas.map(c => `${c.marca} ${c.modelo}`))].join(', '), grupos_compatibles: [...new Set(filas.map(c => c.grupo))] }
      r = r.filter(x => gruposDe(x.grupo).some(g => grupos.has(g)))
    }
    if (bat) { if (input.grupo) r = tiene('grupo', input.grupo); if (input.amperaje) r = r.filter(x => x.amp === input.amperaje) }
    else { if (input.tipo) r = tiene('tipo', input.tipo); if (input.presentacion) r = r.filter(x => norm(x.presentacion) === norm(input.presentacion) || norm(x.presentacion).startsWith(norm(input.presentacion))) }
    const t = (await import('./store.js')).tiendas()[tienda]
    const orden = { disponible: 0, pocas_unidades: 0, por_confirmar: 1, agotado: 2 }
    const todos = r.map(x => ({ x, d: disponibilidad(x.stock, tienda) })).sort((a, b) => orden[a.d.estado] - orden[b.d.estado] || sinPrecio(a.x) - sinPrecio(b.x) || a.x.usd - b.x.usd)
    const resultados = []
    for (const { x, d } of todos.slice(0, MAX_RESULTADOS)) resultados.push({
      marca: x.marca, ...(bat ? { descripcion: x.descripcion, grupo: x.grupo, ...(x.garantia && { garantia_meses: x.garantia }) } : { tipo: x.tipo, presentacion: x.presentacion }),
      ...(x.nota && { nota: x.nota }), ...(await precioONada(x, tienda)), disponibilidad: d })
    conTotales(resultados, input.cantidad)
    if (resultados.some(x => x.pagando_en_dolares_usd)) {
      const g = bat ? unico(r.map(x => ({ g: x.grupo })), 'g') : null, ti = bat ? null : unico(r.map(x => ({ t: x.tipo })), 't'), pr = bat ? null : unico(r.map(x => ({ p: x.presentacion })), 'p')
      ctx.enlace = enlaceWeb(bat ? 'baterias' : 'aceites', { ...(g && { grupo: g }), ...(ti && { tipo: ti }), ...(pr && { presentacion: pr }) }, tienda)
    }
    return { tienda: nombreTienda(tienda), acepta_cashea: t.cashea, etiqueta_tasa: t.etiqueta_tasa, ...agrupaTasa(resultados), ...(compat && { compatibilidad: compat, aviso: 'Dile que confirme con la batería actual (grupo y polaridad) antes de comprar.' }), total_coincidencias: r.length, resultados, nota: !r.length ? 'Sin coincidencias en inventario' : r.length > MAX_RESULTADOS ? `Se muestran ${MAX_RESULTADOS} de ${r.length}; pide grupo, marca o presentación para afinar` : undefined }
  }
  if (nombre === 'buscar_bicicletas') {
    if (!tienda) return FALTA_TIENDA
    let r = bicicletas()
    if (input.rin) r = r.filter(x => x.rin === Number(input.rin))
    if (input.modelo) r = r.filter(x => norm(x.modelo) === norm(input.modelo))
    const orden = { disponible: 0, pocas_unidades: 0, por_confirmar: 1, agotado: 2 }
    const todos = r.map(x => ({ x, d: disponibilidad(x.stock, tienda) })).sort((a, b) => orden[a.d.estado] - orden[b.d.estado] || sinPrecio(a.x) - sinPrecio(b.x) || a.x.usd - b.x.usd)
    const resultados = []
    for (const { x, d } of todos.slice(0, MAX_RESULTADOS)) resultados.push({ modelo: x.modelo, rin: x.rin, ...(x.para && { para: x.para }), ...(x.colores && { colores: x.colores }), ...(await precioONada(x, tienda)), disponibilidad: d })
    conTotales(resultados, input.cantidad)
    if (resultados.some(x => x.pagando_en_dolares_usd)) { const rin = unico(r.map(x => ({ r: x.rin })), 'r'); ctx.enlace = enlaceWeb('bicicletas', rin ? { rin } : {}, tienda) }
    const t = (await import('./store.js')).tiendas()[tienda]
    return { tienda: nombreTienda(tienda), etiqueta_tasa: t.etiqueta_tasa, ...agrupaTasa(resultados), total_coincidencias: r.length, resultados, nota: !r.length ? 'Sin coincidencias en inventario' : r.length > MAX_RESULTADOS ? `Se muestran ${MAX_RESULTADOS} de ${r.length}; pide el rin para afinar` : undefined }
  }
  if (nombre === 'listar_servicios') {
    if (!tienda) return FALTA_TIENDA
    const lista = []
    for (const s of servicios()) lista.push({ servicio: s.nombre, duracion_min: s.min, ...(await precio(s.usd, tienda)) })
    return { tienda: nombreTienda(tienda), etiqueta_tasa: tiendas()[tienda].etiqueta_tasa, ...agrupaTasa(lista), servicios: lista }
  }
  if (nombre === 'guardar_cliente') {
    const data = { custom_attributes: {} }
    if (input.nombre) data.name = input.nombre
    if (input.telefono) data.phone_number = input.telefono.startsWith('+') ? input.telefono : `+58${input.telefono.replace(/^0/, '').replace(/\D/g, '')}`
    for (const k of ['vehiculo', 'placa', 'medida_caucho', 'marca_caucho', 'cantidad_cauchos']) if (input[k]) data.custom_attributes[k] = input[k]
    if (tienda) data.custom_attributes.tienda = nombreTienda(tienda)
    await cw.updateContact(ctx.contactId, data).catch(e => console.error(e.message))
    return { ok: true }
  }
  if (nombre === 'agendar_cita') {
    const malaHora = revisarHorario(input, tienda, ctx)
    if (malaHora) return { ok: false, error: malaHora }
    const propia = citas().find(c => c.conversacion === ctx.conversationId)
    if (propia && !input.reemplazar) return { ok: false, error: `Esta conversación ya tiene la cita #${propia.id} (${propia.fecha} ${propia.hora}). No agendes otra: confírmala al cliente. Si quiere cambiarla, vuelve a llamar con reemplazar=true.` }
    const { reemplazar, ...datos } = input
    if (!datos.telefono || /pendiente/i.test(datos.telefono)) datos.telefono = ctx.telefono   // en WhatsApp ya lo conocemos
    const cita = propia ? updateCita(propia.id, { ...datos, tienda }) : addCita({ ...datos, tienda, conversacion: ctx.conversationId })
    await cw.addLabels(ctx.conversationId, ['cita-agendada']).catch(() => {})
    if (ctx.contactId) await cw.updateContact(ctx.contactId, { custom_attributes: { proxima_cita: `${input.fecha} ${input.hora} · ${nombreTienda(tienda) || ''}` } }).catch(() => {})
    await cw.sendMessage(ctx.conversationId, `📅 Cita #${cita.id}${propia ? ' (reprogramada)' : ''}: ${input.nombre} · ${input.servicio} · ${input.fecha} ${input.hora}${tienda ? ' · ' + nombreTienda(tienda) : ''}`, true).catch(() => {})
    ctx.citaOk = true                                   // agent.js solo deja afirmar «cita agendada» si esto es verdad
    return { ok: true, cita }
  }
  if (nombre === 'pasar_a_humano') {
    await cw.sendMessage(ctx.conversationId, `🙋 Handoff solicitado por el bot: ${input.motivo}`, true).catch(() => {})
    await cw.addLabels(ctx.conversationId, ['requiere-humano']).catch(() => {})
    await traspasar(ctx.conversationId, ctx.equipo)
    ctx.handoff = true
    return { ok: true }
  }
  return { error: 'herramienta desconocida' }
}
