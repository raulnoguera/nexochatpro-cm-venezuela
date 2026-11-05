// Carga y administración del catálogo por el cliente. Cada categoría (cauchos, baterías, aceites) es una lista en data/*.json
// que usan a la vez Nexo y el catálogo público (data/catalogo.json -> /catalogo.json). Se puede subir el Excel completo
// («MCY - LISTA DE PRECIOS») o crear, editar y eliminar productos y fotos desde el panel /admin.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import ExcelJS from 'exceljs'
import { usoPorDia, usoPorConversacion } from './uso.js'
import { estadoPresupuesto, LIMITE_HORA, LIMITE_DIA } from './limites.js'
import { visible, conCodigo } from './store.js'
import { estadoTasas, fijarTasas, manualesVigentes, olvidarTasasApi, consultarTasaApi } from './tasa.js'

const dir = path.resolve('data')
const carpetaImg = path.join(dir, 'imagenes')
const PUBLICO = process.env.PUBLIC_URL || 'https://crm.nexochatpro.cloud'
const SIN_CANTIDAD = 5          // «hay» sin cantidad conocida (el bot nunca dice números exactos)

const celda = v => {
  if (v && typeof v === 'object') return v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : null)
  return v
}
const txt = v => String(celda(v) ?? '').replace(/\s+/g, ' ').trim()
const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')
const sinEmoji = s => s.replace(/^[^\p{L}\p{N}]+/u, '').trim()
const nivel = q => (q <= 0 ? 0 : 2)                           // 0 agotado · 2 disponible (nunca se muestran cantidades)
const entero = v => Math.max(0, Math.floor(Number(v) || 0))

// ---------- lectura de cada hoja del Excel ----------
function medidaYRin(t) {
  let base = t.replace(/\(.*?\)/g, '').replace('🔥', '').replace(/\b(CON|SIN)\s+SET\b/gi, '').trim()
  base = base.replace(/^(\d+\/\d+)\/(\d+)$/, '$1R$2')                   // 265/50/20 -> 265/50R20
  const m = base.match(/R\s*(\d{2}(?:\.\d)?)\s*$/) || base.match(/\/(\d{2}(?:\.\d)?)(?:\s+[A-Za-z]+)?$/)   // 750/16, 215/75/17.5, 185/15 CARGA
  return m ? [base, Number(m[1])] : [base, null]
}
function cantidades(k) {
  const q = {}
  for (const [, n, quien] of String(k ?? '').matchAll(/(-?\d+)\s*(cm|master)/gi)) q[quien.toLowerCase() === 'cm' ? 'tienda_1' : 'tienda_2'] = Math.max(Number(n), 0)
  return q
}
const stockDe = (cm, mc, k) => {
  const stock = { tienda_1: cm ? SIN_CANTIDAD : 0, tienda_2: mc ? SIN_CANTIDAD : 0 }
  for (const [s, q] of Object.entries(cantidades(k))) if (stock[s]) stock[s] = q
  return stock
}
const unicos = () => { const vistos = {}; return base => { vistos[base] = (vistos[base] || 0) + 1; return `${base}-${vistos[base]}` } }

// Inventario en el formato nuevo (una pestaña por categoría): CODIGO CM | CODIGO MC | … | Precio | Bs | CM | MC | TOTAL INVENTARIO.
// Las columnas se buscan por su encabezado, no por su posición. El código es obligatorio (sin código el producto no existe) y se guarda
// tal cual, sin corregir mayúsculas ni espacios. Cada pestaña pone en `armar` lo suyo: { desc, falta, item }.
const codigo = v => String(celda(v) ?? '').trim()
const cabecera = ws => {
  const h = {}
  ws.getRow(1).eachCell((c, i) => { const k = norm(txt(c.value).normalize('NFD').replace(/[̀-ͯ]/g, '')); if (k && !h[k]) h[k] = i })
  return h
}
const esNuevo = ws => /^C[OÓ]DIGO\s*(CM|MC)$/i.test(txt(ws.getRow(1).getCell(1).value))
const sinVacios = pares => pares.filter(([, v]) => v !== '' && v != null)
const especDe = (v, columnas) => sinVacios(columnas.map(([c, nombre]) => [nombre, txt(v(c))])).map(([k, x]) => ({ k, v: x }))
const serviciosDeCelda = t => String(t ?? '').split(/[\n;]/).map(x => x.trim()).filter(x => x && x.length <= 60).slice(0, 12)

// op.sinCodigo (solo carga puntual por scripts/cargar_excel.mjs --sin-codigo): las filas sin código CM/MC también se cargan, con un id propio
// (sin código, como la lista anterior) y, si ni CM, MC ni el total traen número, como «hay» en las dos tiendas de Maracay.
function filasConCodigo(ws, armar, op = {}) {
  const items = [], omitidas = [], vistos = new Map(), h = cabecera(ws)
  ws.eachRow((row, n) => {
    if (n === 1) return
    const v = k => (h[k] ? celda(row.getCell(h[k]).value) : null)
    const cm = codigo(v('CODIGOCM')), mc = codigo(v('CODIGOMC')), r = armar(v)
    if (!r.desc && !cm && !mc) return                                                  // fila separadora
    if (!cm && !mc && !op.sinCodigo) { omitidas.push(`Fila ${n}: ${r.desc} (sin código CM ni MC, no se publica)`); return }
    if (r.falta) { omitidas.push(`Fila ${n}: código ${cm || mc} sin ${r.falta}`); return }
    for (const k of [cm && 'CM:' + cm, mc && 'MC:' + mc].filter(Boolean)) {
      if (vistos.has(k)) { omitidas.push(`Fila ${n}: código ${k.slice(3)} repetido (ya está en la fila ${vistos.get(k)}), no se carga`); return }
    }
    const precio = Number(v('PRECIO')) > 0 ? Number(v('PRECIO')) : 0, bs = Number(v('BS')), total = entero(v('TOTALINVENTARIO'))
    const sinDato = op.sinCodigo && !cm && !mc && ['CM', 'MC', 'TOTALINVENTARIO'].every(k => v(k) == null || v(k) === '')
    const stock = sinDato ? { tienda_1: SIN_CANTIDAD, tienda_2: SIN_CANTIDAD } : h.CM || h.MC ? { tienda_1: entero(v('CM')), tienda_2: entero(v('MC')) } : { tienda_1: cm ? total : 0, tienda_2: cm ? 0 : total }   // sin columnas CM y MC: el total es de la tienda del código
    const item = { sku: cm ? 'CM-' + cm : mc ? 'MC-' + mc : 'FILA-' + n, ...r.item, usd: precio, usd_bs: precio ? (bs > 0 ? bs : Math.ceil(precio * 1.05 - 1e-6)) : 0, stock }
    if (cm) item.codigo_cm = cm
    if (mc) item.codigo_mc = mc
    for (const k of [cm && 'CM:' + cm, mc && 'MC:' + mc].filter(Boolean)) vistos.set(k, n)
    items.push(item)
  })
  const parecidos = new Map()                                                          // códigos que solo se diferencian en espacios o mayúsculas: se avisa, no se unen
  for (const i of items) for (const k of [i.codigo_cm && 'CM' + norm(i.codigo_cm), i.codigo_mc && 'MC' + norm(i.codigo_mc)].filter(Boolean)) parecidos.set(k, [...(parecidos.get(k) || []), i.codigo_cm || i.codigo_mc])
  for (const l of parecidos.values()) if (l.length > 1) omitidas.push(`Aviso (sí se cargaron): los códigos «${l.join('», «')}» solo se diferencian en espacios o mayúsculas; revisa que sean productos distintos`)
  return { items, omitidas }
}

// Columnas opcionales que el cliente llena; salen como especificaciones en la ventana «Ver especificaciones» de la web
const ESPEC_CAUCHO = [['COSTEDEMONTURA', 'Costo de montura'], ['GARANTIA', 'Garantía'], ['CONSTRUCCION', 'Construcción'], ['INDICEDECARGA', 'Índice de carga'], ['INDICEDECARGADUAL', 'Índice de carga dual'],
  ['CODIGODEVELOCIDAD', 'Código de velocidad'], ['PRESIONMAXIMA', 'Presión máxima'], ['TLTT', 'TL/TT']]
const ESPEC_BATERIA = [['ANCHO', 'Ancho'], ['LARGO', 'Largo'], ['ALTO', 'Alto'], ['VOLTAJE', 'Voltaje'], ['AMPERIOSDEARRANQUECA', 'Amperios de arranque (CA)'],
  ['ARRANQUEENFRIOCCA', 'Arranque en frío (CCA)'], ['AMPERIOSPORHORAAH', 'Amperios por hora (AH)'], ['CAPACIDADDERESERVACR', 'Capacidad de reserva (CR)']]

// Hoja «DIMENSIONES DE CAUCHOS»: MEDIDA | ANCHO | ALTO | DIAMETRO. Se suman a las especificaciones del caucho de esa medida (al principio de la lista).
const DIMENSIONES = [['ANCHO', 'Ancho'], ['ALTO', 'Alto'], ['DIAMETRO', 'Diámetro']]
const claveMedida = m => String(m ?? '').toUpperCase().replace(/R/g, '/').replace(/[^0-9./]/g, '')            // «265/50R20» y «265/50/20» son la misma medida
function leerDimensiones(wb) {
  const ws = wb.worksheets.find(w => /dimension/i.test(w.name)), dims = new Map()
  if (!ws) return dims
  const h = cabecera(ws)
  ws.eachRow((row, n) => {
    if (n === 1 || !h.MEDIDA) return
    const v = k => (h[k] ? celda(row.getCell(h[k]).value) : null), clave = claveMedida(v('MEDIDA'))
    const espec = especDe(v, DIMENSIONES)
    if (clave && espec.length) dims.set(clave, espec)
  })
  return dims
}
const NOMBRES_DIMENSION = new Set(DIMENSIONES.map(([, n]) => n))
export const conDimensiones = (items, dims) => items.map(i => {
  const d = dims.get(claveMedida(i.medida))
  return d ? { ...i, espec: [...d, ...(i.espec || []).filter(e => !NOMBRES_DIMENSION.has(e.k))] } : i
})
const armarCaucho = v => {
  const med = txt(v('MEDIDA')), marca = txt(v('MARCA')), [medida, rin] = med ? medidaYRin(med) : ['', null]
  const lonas = Number((txt(v('LONAS')).match(/\d+/) || [])[0]), espec = especDe(v, ESPEC_CAUCHO), servicios = serviciosDeCelda(v('SERVICIOS'))
  const item = { marca, modelo: txt(v('MODELO')), tipo: txt(v('TIPO')), ...(lonas > 0 && { lonas }), medida, rin }
  if (med !== medida) item.detalle = med
  if (espec.length) item.espec = espec
  if (servicios.length) item.servicios = servicios
  return { desc: `${med} ${marca}`.trim(), falta: !med || !marca ? 'medida o marca' : '', item }
}
const filasCauchosNuevo = (ws, op) => filasConCodigo(ws, armarCaucho, op)

function filasCauchos(ws, op) {
  if (esNuevo(ws)) return filasCauchosNuevo(ws, op)
  const items = [], omitidas = [], sku = unicos()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const [med, marca, usd, bs, , nota, , , cm, mc, k] = Array.from({ length: 11 }, (_, i) => celda(row.getCell(i + 1).value))
    if (!med || !marca) return
    if (/^NO HAY$/i.test(String(marca).trim())) { omitidas.push(`Fila ${n}: ${med} (marca «NO HAY», no se publica)`); return }
    const [medida, rin] = medidaYRin(String(med)), precio = Number(usd) > 0 ? Number(usd) : 0       // precio 0 = «Consultar precio»
    const item = { sku: sku((String(marca).slice(0, 3) + medida).toUpperCase().replace(/[^A-Z0-9]/g, '')), marca: String(marca).trim(), modelo: '', medida, rin, usd: precio, usd_bs: precio ? Number(bs) || precio : 0, stock: stockDe(cm, mc, k) }
    if (String(med).trim() !== medida) item.detalle = String(med).trim()
    if (nota) item.nota = String(nota).replace(/^[() ]+|[() ]+$/g, '')
    items.push(item)
  })
  return { items, omitidas }
}

// Garantía por marca: el Excel la trae como líneas «-12 Meses Velko Nomiks, AC Power, PGT» dentro del Texto1
function garantias(texto) {
  const g = []
  for (const l of String(texto || '').split('\n')) {
    const m = l.match(/^\s*-?\s*(\d+)\s*Meses?\s+(.+)$/i)
    if (m) for (const marca of m[2].split(',')) g.push([norm(marca.replace(/\(.*?\)/g, '')), Number(m[1])])
  }
  return g
}
const armarBateria = v => {                                              // el grupo de la batería va en la columna MODELO del inventario nuevo
  const marca = txt(v('MARCA')), grupo = txt(v('MODELO')), amp = Number(v('AMP')) > 0 ? Math.round(Number(v('AMP'))) : 0
  const garantia = Math.round(Number(v('GARANTIA'))), servicios = serviciosDeCelda(v('SERVICIO')), espec = especDe(v, ESPEC_BATERIA)
  const chatarra = { usd: Number(v('CHATARRADIVISA')) || 0, bs: Number(v('CHATARRABS')) || 0 }
  const item = { marca, descripcion: [amp && `${amp} AMP`, txt(v('NOMENCLATURA')), txt(v('POSICION'))].filter(Boolean).join(' / ') || grupo, grupo }
  if (amp) item.amp = amp
  if (garantia > 0) item.garantia = garantia
  if (servicios.length) item.servicios = servicios
  if (espec.length) item.espec = espec
  if (chatarra.usd > 0 || chatarra.bs > 0) item.chatarra = chatarra
  return { desc: `${marca} ${grupo}`.trim(), falta: !marca ? 'marca' : !grupo ? 'grupo (columna MODELO)' : '', item }
}
function filasBaterias(ws, op) {
  if (esNuevo(ws)) return filasConCodigo(ws, armarBateria, op)
  const items = [], omitidas = [], sku = unicos()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const c = i => celda(row.getCell(i + 1).value)
    const desc = txt(c(0)), mar = txt(c(1)), grupo = txt(c(2)), nombre = sinEmoji(txt(c(4))), usd = Number(c(5)), bs = Number(c(6))
    if (!grupo && !desc) return
    if (/^NO HAY$/i.test(mar)) { omitidas.push(`Fila ${n}: ${desc} (marca «NO HAY», no se publica)`); return }
    const marca = mar && mar !== '-' ? mar : nombre.split(' ')[0] || 'Sin marca'
    const descripcion = desc && desc !== '-' ? desc : nombre
    const amp = (`${desc} ${txt(c(3))}`.match(/(\d{3,4})\s*AMP/i) || [])[1]
    const g = garantias(c(9)).filter(([m]) => norm(marca).startsWith(m)).sort((a, b) => b[0].length - a[0].length)[0]
    const item = { sku: sku('BAT' + norm(marca).slice(0, 4) + norm(grupo).slice(0, 8) + norm(descripcion).slice(0, 12)), marca, descripcion, grupo, usd: usd > 0 ? usd : 0, usd_bs: usd > 0 ? bs || usd : 0, stock: stockDe(c(11), c(12)) }
    if (amp) item.amp = Number(amp)
    if (g) item.garantia = g[1]
    items.push(item)
  })
  return { items, omitidas }
}
const armarAceite = v => {                                               // en el inventario nuevo la presentación va en la columna COMBO
  const tipo = txt(v('ACEITE')), presentacion = txt(v('COMBO')), marca = txt(v('MARCA'))
  return { desc: `${tipo} ${marca}`.trim(), falta: !tipo || !marca ? 'tipo o marca' : '', item: { marca, tipo, presentacion } }
}
function filasAceites(ws, op) {
  if (esNuevo(ws)) return filasConCodigo(ws, armarAceite, op)
  const items = [], omitidas = [], sku = unicos()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const c = i => celda(row.getCell(i + 1).value)
    const tipo = txt(c(0)), presentacion = txt(c(1)), marca = txt(c(2)), usd = Number(c(3)), bs = Number(c(4))
    if (!tipo || !marca) return
    if (/^NO HAY$/i.test(marca)) { omitidas.push(`Fila ${n}: ${tipo} (marca «NO HAY», no se publica)`); return }
    const item = { sku: sku('ACE' + norm(marca).slice(0, 4) + norm(tipo).slice(0, 8) + norm(presentacion).slice(0, 6)), marca, tipo, presentacion, usd: usd > 0 ? usd : 0, usd_bs: usd > 0 ? bs || usd : 0, stock: stockDe(c(9), c(10)) }
    const nota = txt(c(6)); if (nota) item.nota = nota
    items.push(item)
  })
  return { items, omitidas }
}

const armarBicicleta = v => {                                            // «RIN 20» | «MODELO 130 (NIÑO)»
  const rinTxt = txt(v('RIN')), modTxt = txt(v('MODELO')), rin = Number((rinTxt.match(/\d+/) || [])[0]), para = ((modTxt.match(/\(([^)]*)\)/) || [])[1] || '').trim()
  const modelo = modTxt.replace(/\(.*?\)/g, '').replace(/^MODELO\s*/i, '').trim(), caracteristicas = txt(v('CARACTERISTICAS'))
  const item = { marca: 'Bicicleta', rin, modelo }
  if (para) item.para = para
  if (caracteristicas) item.caracteristicas = caracteristicas
  return { desc: `${rinTxt} ${modTxt}`.trim(), falta: !rin || !modelo ? 'rin o modelo' : '', item }
}
const armarOtro = v => {                                                 // pestaña «OTROS ARTICULOS»: NOMBRE (bujías, bornes…) y DESCRIPCION (marca, presentación…)
  const nombre = txt(v('NOMBRE')), descripcion = txt(v('DESCRIPCION'))
  return { desc: `${nombre} ${descripcion}`.trim(), falta: !nombre ? 'nombre' : '', item: { marca: nombre, descripcion } }
}
const filasOtros = (ws, op) => (esNuevo(ws) ? filasConCodigo(ws, armarOtro, op) : { items: [], omitidas: ['La pestaña de otros artículos necesita las columnas CODIGO CM, CODIGO MC, NOMBRE, DESCRIPCION, Precio, Bs, CM y MC.'] })
function filasBicicletas(ws, op) {                                           // «🚲RIN 20 MODELO 130 (NIÑO)» | precio | bs | # unidades en CM | colores | MC (hay en Master Cauchos)
  if (esNuevo(ws)) return filasConCodigo(ws, armarBicicleta, op)
  const items = [], omitidas = [], sku = unicos()
  const verdadero = v => ['TRUE', 'VERDADERO', '1', 'SI', 'SÍ'].includes(String(celda(v)).trim().toUpperCase())
  ws.eachRow((row, n) => {
    if (n === 1) return
    const c = i => celda(row.getCell(i + 1).value)
    const t = sinEmoji(txt(c(0)))
    if (!t) return
    const rin = (t.match(/RIN\s*(\d+)/i) || [])[1], modelo = (t.match(/MODELO\s*([A-Z0-9-]+)/i) || [])[1]
    if (!rin || !modelo) { omitidas.push(`Fila ${n}: ${t} (no se reconoce el rin o el modelo)`); return }
    const usd = parseFloat(String(c(1) ?? '').replace(',', '.')), bs = Number(c(2)), para = ((t.match(/\(([^)]*)\)/) || [])[1] || '').trim()
    const colores = txt(c(4)).replace(/[¿?]+/g, '').replace(/^[. ]+|[. ]+$/g, '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1)).join(', ')
    const item = { sku: sku('BIC' + rin + norm(modelo)), marca: 'Bicicleta', rin: Number(rin), modelo, usd: usd > 0 ? usd : 0, usd_bs: usd > 0 ? (bs > 0 ? bs : Math.ceil(usd * 1.05 - 1e-6)) : 0, stock: { tienda_1: entero(String(c(3) ?? '').replace(/[^\d]/g, '')), tienda_2: verdadero(c(5)) ? SIN_CANTIDAD : 0 } }
    if (para) item.para = para
    if (colores) item.colores = colores
    items.push(item)
  })
  return { items, omitidas }
}

// ---------- compatibilidad vehículo -> grupo de batería ----------
// «GRUPO 22 Y 42» -> ['22','42'] · «30H (BORNE)» -> ['30H'] · «24F, 34» -> ['24F','34']. Una batería sirve si comparte algún grupo con el vehículo.
export const gruposDe = t => String(t ?? '').toUpperCase().replace(/\bGRUPOS?\b/g, ' ').replace(/\(.*?\)/g, ' ').split(/[,;/+]|\bY\b/).map(norm).filter(Boolean)
const anio = v => {                                                       // «2010» -> 2010 · «08» -> 2008 · «70» -> 1970
  const n = parseInt((String(v ?? '').match(/\d+/) || [''])[0], 10)
  return Number.isFinite(n) ? (n < 100 ? (n >= 50 ? 1900 + n : 2000 + n) : n) : null
}
// Una columna por marca de batería (DUNCAN, FULGOR, MARUSSI PLUS…): la celda dice el grupo que usa esa marca en ese vehículo.
const COLUMNAS_FIJAS = new Set(['MARCA', 'VEHICULO', 'MODELO', 'DESDE', 'ANODESDE', 'INICIO', 'HASTA', 'ANOHASTA', 'FIN', 'ANO', 'ANOS', 'GRUPO', 'GRUPOS', 'GRUPODEBATERIA', 'BATERIA', 'POLARIDAD', 'AMPERAJEMINIMO'])
// Marcas de batería que traen algún grupo en la tabla. Una batería cuya marca no tiene datos usa los grupos del vehículo de cualquier marca.
export const marcasConGrupos = filas => new Set(filas.flatMap(c => Object.keys(c.grupos || {})))
// Grupos que le sirven a este vehículo con una batería de esa marca: la columna de su marca (la más larga que empieza igual: «Marussi Plus Limit» -> MARUSSIPLUS)
export const gruposParaBateria = (c, marcaBateria, conDatos) => {
  if (!c.grupos) return gruposDe(c.grupo)
  const m = norm(marcaBateria), k = [...conDatos].filter(x => m.startsWith(x)).sort((a, b) => b.length - a.length)[0]
  return k ? gruposDe(c.grupos[k]) : gruposDe(c.grupo)
}
function filasCompat(ws) {
  const items = [], omitidas = [], sku = unicos()
  const cab = cabecera(ws)
  const col = (...ns) => { for (const n of ns) if (cab[n]) return cab[n] }
  const cMarca = col('MARCA', 'VEHICULO'), cModelo = col('MODELO'), cDesde = col('DESDE', 'ANODESDE', 'INICIO'), cHasta = col('HASTA', 'ANOHASTA', 'FIN'), cAnio = col('ANO', 'ANOS'), cGrupo = col('GRUPO', 'GRUPOS', 'GRUPODEBATERIA', 'BATERIA')
  const porMarca = Object.entries(cab).filter(([k]) => !COLUMNAS_FIJAS.has(k)), cPolaridad = col('POLARIDAD'), cAmp = col('AMPERAJEMINIMO')
  if (!cMarca || !cModelo || (!cGrupo && !porMarca.length)) throw new Error('La hoja COMPATIBILIDAD necesita las columnas MARCA y MODELO, el grupo (columna GRUPO, o una columna por marca de batería) y los años (DESDE y HASTA, o AÑO).')
  ws.eachRow((row, n) => {
    if (n === 1) return
    const g = i => (i ? celda(row.getCell(i).value) : null)
    const marca = txt(g(cMarca)).toUpperCase(), modelo = txt(g(cModelo)).toUpperCase()
    const grupos = {}
    for (const [k, i] of cGrupo ? [] : porMarca) { const t = txt(g(i)); if (gruposDe(t).length) grupos[k] = t }
    const grupo = cGrupo ? txt(g(cGrupo)) : [...new Set(Object.values(grupos).flatMap(gruposDe))].join(', ')
    if (!marca && !modelo && !grupo) return
    if (!marca || !modelo || !gruposDe(grupo).length) { omitidas.push(`Fila ${n}: ${marca} ${modelo} (falta marca, modelo o grupo)`); return }
    let desde = anio(g(cDesde)), hasta = anio(g(cHasta))
    const rango = txt(g(cAnio)) || (/[-–]/.test(txt(g(cDesde))) ? txt(g(cDesde)) : '')    // «2008-2014», «08-14» o «2010»
    if (rango && (desde == null || /[-–]/.test(txt(g(cDesde))))) { const [a, b] = rango.split(/\s*[-–]\s*/); desde = anio(a); hasta = anio(b ?? a) }
    const item = { sku: sku('CMP' + norm(marca).slice(0, 6) + norm(modelo).slice(0, 8)), marca, modelo, desde: desde ?? 0, hasta: hasta ?? 9999, grupo }
    if (Object.keys(grupos).length) item.grupos = grupos
    if (cPolaridad && txt(g(cPolaridad))) item.polaridad = txt(g(cPolaridad)).toUpperCase()
    if (cAmp && Number(g(cAmp)) > 0) item.amp_min = Number(g(cAmp))
    items.push(item)
  })
  return { items, omitidas }
}

// Especificaciones: en el panel se escriben una por línea («Índice de carga: 91»); se guardan como [{ k, v }] y la web las muestra en ese orden
const especDeTexto = t => {
  const l = String(t ?? '').split('\n').map(x => x.trim()).filter(Boolean)
  if (l.length > 12) throw new Error('Máximo 12 especificaciones por producto.')
  return l.map(x => {
    const i = x.indexOf(':'), k = x.slice(0, i).trim(), v = x.slice(i + 1).trim()
    if (i < 1 || !k || !v) throw new Error(`Escribe cada especificación como «Nombre: valor» (revisa «${x.slice(0, 40)}»).`)
    if (k.length > 40 || v.length > 60) throw new Error(`La especificación «${k.slice(0, 20)}» es muy larga.`)
    return { k, v }
  })
}
const especATexto = e => (e || []).map(x => `${x.k}: ${x.v}`).join('\n')

// ---------- ajustes de la web (los edita el cliente en el panel; la web los lee desde catalogo.json) ----------
const AJUSTES_BASE = { servicios_compra: [], servicios_reglas: [], combo_detalle: '', mostrar_pendientes: true }
export const leerAjustes = () => {
  try { return { ...AJUSTES_BASE, ...JSON.parse(fs.readFileSync(path.join(dir, 'ajustes_web.json'), 'utf8')) } } catch { return { ...AJUSTES_BASE } }
}
// Servicios por marca o por marca + modelo: [{ marca, modelo?, servicios: [..] }]. Se suman a los generales (servicios_compra).
const lineas = v => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map(x => String(x).trim()).filter(Boolean)
function validarReglas(r) {
  if (r == null || r === '') return []
  if (!Array.isArray(r)) throw new Error('Las reglas de servicios no tienen el formato correcto.')
  if (r.length > 60) throw new Error('Máximo 60 reglas de servicios.')
  return r.map((x, n) => {
    const marca = String(x?.marca ?? '').trim(), modelo = String(x?.modelo ?? '').trim(), servicios = lineas(x?.servicios)
    if (!marca || marca.length > 40) throw new Error(`Regla ${n + 1}: escribe la marca.`)
    if (modelo.length > 40) throw new Error(`Regla ${n + 1}: el modelo es muy largo (máximo 40 letras).`)
    if (!servicios.length) throw new Error(`Regla ${n + 1} (${marca}): escribe al menos un servicio.`)
    if (servicios.length > 12) throw new Error(`Regla ${n + 1} (${marca}): máximo 12 servicios.`)
    if (servicios.some(y => y.length > 60)) throw new Error(`Regla ${n + 1} (${marca}): cada servicio debe tener máximo 60 letras.`)
    return { marca, modelo, servicios }
  })
}
// ¿La regla {marca, modelo?} vale para este caucho? En algunos productos el modelo viene dentro de la marca («Sportrak SP716»):
// la marca coincide si empieza por la de la regla (palabras completas) y el modelo si es el campo modelo o una palabra de «marca modelo».
const pal = t => ` ${String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()} `
export const coincide = (r, i) => {
  if (!pal(i.marca).startsWith(pal(r.marca))) return false
  return !r.modelo || norm(r.modelo) === norm(i.modelo || '') || pal(`${i.marca} ${i.modelo || ''}`).includes(pal(r.modelo))
}
// Servicios que vienen con un caucho: los generales + los de las reglas que cumple (marca, o marca + modelo) + los propios del producto.
// En el producto, una línea que empieza con «-» quita ese servicio solo para él (ej. «-Válvula nueva»).
export const serviciosDe = (i, aj = leerAjustes()) => {
  const lista = [...(aj.servicios_compra || [])]
  for (const r of aj.servicios_reglas || []) {
    if (!coincide(r, i)) continue
    lista.push(...r.servicios)
  }
  const quitar = new Set()
  for (const x of i.servicios || []) { if (x.startsWith('-')) quitar.add(norm(x.slice(1))); else lista.push(x) }
  const vistos = new Set()
  return lista.filter(x => { const k = norm(x); if (!k || quitar.has(k) || vistos.has(k)) return false; vistos.add(k); return true })
}
// Marcas y modelos que existen, para elegirlos en las reglas. Marca = primera palabra del nombre (se puede escribir otra a mano);
// modelo = el campo modelo si lo hay, o la palabra con número que sigue a la marca («Sportrak SP716 HT» -> SP716).
const TIPO_O_LONAS = /^(\d+PR|PR|HT|AT|MT|RT|XT|LT|DIR|DIRECCIONAL|MIXTO|TACO|TUBELESS|RADIAL|WIDE)$/
export function opcionesMarcas(items) {
  const marcas = new Map()
  for (const i of items) {
    const palabras = String(i.marca || '').replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean)
    if (!palabras.length) continue
    const k = palabras[0].toUpperCase(), m = marcas.get(k) ?? { marca: palabras[0], total: 0, modelos: new Set() }
    m.total++
    const mod = i.modelo || palabras.slice(1).find(w => /\d/.test(w) && !TIPO_O_LONAS.test(w.toUpperCase().replace(/[^A-Z0-9]/g, '')))
    if (mod) m.modelos.add(mod.toUpperCase())
    marcas.set(k, m)
  }
  return [...marcas.values()].sort((a, b) => a.marca.localeCompare(b.marca, 'es')).map(m => ({ marca: m.marca, total: m.total, modelos: [...m.modelos].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })) }))
}
export function validarAjustes(b) {
  const servicios = (Array.isArray(b.servicios_compra) ? b.servicios_compra : String(b.servicios_compra ?? '').split('\n')).map(x => String(x).trim()).filter(Boolean)
  if (servicios.length > 12) throw new Error('Máximo 12 servicios.')
  if (servicios.some(x => x.length > 60)) throw new Error('Cada servicio debe tener máximo 60 letras.')
  const combo = String(b.combo_detalle ?? '').trim()
  if (combo.length > 80) throw new Error('El detalle del filtro debe tener máximo 80 letras.')
  return { servicios_compra: servicios, servicios_reglas: validarReglas(b.servicios_reglas), combo_detalle: combo, mostrar_pendientes: b.mostrar_pendientes !== false && b.mostrar_pendientes !== 'false' }
}

const extra = i => {
  if ('etiqueta' in i) return i.etiqueta                                   // texto escrito a mano en el panel
  const t = [...(i.detalle || '').matchAll(/\(([^)]*)\)|\b(CON SET|SIN SET)\b/g)].map(m => m[1] || m[2])
  if ((i.nota || '').startsWith('Diseño')) t.push(i.nota)
  return t.map(x => (x === x.toUpperCase() ? x[0] + x.slice(1).toLowerCase() : x)).join(' · ')
}
const comun = i => ({ m: i.marca, u: i.usd, b: i.usd_bs, t1: nivel(i.stock.tienda_1), t2: nivel(i.stock.tienda_2), ...(i.stock.caracas != null && { c: nivel(i.stock.caracas) }), x: extra(i), ...(i.imagen && { i: `${PUBLICO}/img/${i.imagen}` }) })

// Cada categoría: archivo, hoja del Excel, cómo se lee, cómo se muestra y qué campos tiene el formulario
export const CATS = {
  cauchos: {
    archivo: 'inventario.json', hoja: 'CAUCHOS', leer: filasCauchos,
    nombre: i => `${i.marca} ${i.medida}`,
    web: (i, aj) => ({ ...comun(i), z: i.medida, r: i.rin, ...(serviciosDe(i, aj).length && { sv: serviciosDe(i, aj) }), ...(i.modelo && { mo: i.modelo }), ...(i.tipo && { ti: i.tipo }), ...(i.lonas && { lo: i.lonas }), ...(i.espec?.length && { e: Object.fromEntries(i.espec.map(x => [x.k, x.v])) }) }),
    orden: (a, b) => (a.r ?? 0) - (b.r ?? 0) || a.z.localeCompare(b.z) || a.u - b.u,
    campos: b => {
      const medida = String(b.medida ?? '').trim()
      if (!medida || medida.length > 30) throw new Error('Escribe la medida, por ejemplo 265/60R18.')
      const modelo = String(b.modelo ?? '').trim(), tipo = String(b.tipo ?? '').trim()
      if (modelo.length > 40) throw new Error('El modelo es muy largo (máximo 40 letras).')
      if (tipo.length > 30) throw new Error('El tipo es muy largo (máximo 30 letras).')
      const lonas = b.lonas === '' || b.lonas == null ? 0 : Math.round(Number(b.lonas))
      if (!(lonas >= 0 && lonas <= 40)) throw new Error('Las lonas deben ser un número, por ejemplo 16.')
      const servicios = lineas(b.servicios)
      if (servicios.length > 12) throw new Error('Máximo 12 servicios por producto.')
      if (servicios.some(x => x.length > 61)) throw new Error('Cada servicio debe tener máximo 60 letras.')
      return { medida, rin: b.rin === '' || b.rin == null ? medidaYRin(medida)[1] : Number(b.rin), modelo, tipo, lonas, espec: especDeTexto(b.espec), servicios }
    },
    vista: i => ({ medida: i.medida, rin: i.rin, modelo: i.modelo ?? '', tipo: i.tipo ?? '', lonas: i.lonas ?? '', espec: especATexto(i.espec), servicios: (i.servicios || []).join('\n') }),
  },
  baterias: {
    archivo: 'baterias.json', hoja: 'BATERIAS', leer: filasBaterias,
    nombre: i => `${i.marca} ${i.descripcion}`,
    web: i => ({ ...comun(i), d: i.descripcion, g: i.grupo, k: gruposDe(i.grupo), ...(i.amp && { a: i.amp }), ...(i.garantia && { w: i.garantia }), ...(i.espec?.length && { e: Object.fromEntries(i.espec.map(x => [x.k, x.v])) }) }),
    orden: (a, b) => a.g.localeCompare(b.g, 'es', { numeric: true }) || a.u - b.u,
    campos: b => {
      const descripcion = String(b.descripcion ?? '').trim(), grupo = String(b.grupo ?? '').trim()
      if (!descripcion || descripcion.length > 80) throw new Error('Escribe la descripción, por ejemplo 1000 AMP / 24R.')
      if (!grupo || grupo.length > 40) throw new Error('Escribe el grupo, por ejemplo GRUPO 24.')
      const amp = Number(b.amp) > 0 ? Math.round(Number(b.amp)) : (descripcion.match(/(\d{3,4})\s*AMP/i) || [])[1]
      const o = { descripcion, grupo }
      if (amp) o.amp = Number(amp)
      if (Number(b.garantia) > 0) o.garantia = Math.round(Number(b.garantia))
      return o
    },
    vista: i => ({ descripcion: i.descripcion, grupo: i.grupo, amp: i.amp ?? '', garantia: i.garantia ?? '' }),
  },
  aceites: {
    archivo: 'aceites.json', hoja: 'ACEITES', leer: filasAceites,
    nombre: i => `${i.marca} ${i.tipo} ${i.presentacion}`,
    web: i => ({ ...comun(i), t: i.tipo, p: i.presentacion }),
    orden: (a, b) => a.t.localeCompare(b.t, 'es', { numeric: true }) || a.p.localeCompare(b.p, 'es', { numeric: true }) || a.u - b.u,
    campos: b => {
      const tipo = String(b.tipo ?? '').trim(), presentacion = String(b.presentacion ?? '').trim()
      if (!tipo || tipo.length > 60) throw new Error('Escribe el tipo de aceite, por ejemplo 20W-50 MINERAL.')
      if (!presentacion || presentacion.length > 40) throw new Error('Escribe la presentación, por ejemplo Litro o 4 Litros.')
      return { tipo, presentacion }
    },
    vista: i => ({ tipo: i.tipo, presentacion: i.presentacion }),
  },
}

CATS.bicicletas = {
  archivo: 'bicicletas.json', hoja: 'BICICLETAS', leer: filasBicicletas,
  nombre: i => `Bicicleta rin ${i.rin} modelo ${i.modelo}`,
  web: i => ({ ...comun(i), r: i.rin, d: i.modelo, ...(i.para && { p: i.para }), ...(i.colores && { co: i.colores }) }),
  orden: (a, b) => a.r - b.r || String(a.d).localeCompare(String(b.d), 'es', { numeric: true }) || a.u - b.u,
  campos: b => {
    const rin = Math.round(Number(b.rin)), modelo = String(b.modelo ?? '').trim()
    if (!(rin >= 10 && rin <= 32)) throw new Error('Escribe el rin de la bicicleta, por ejemplo 20.')
    if (!modelo || modelo.length > 30) throw new Error('Escribe el modelo, por ejemplo 130.')
    return { rin, modelo, para: String(b.para ?? '').trim().slice(0, 30), colores: String(b.colores ?? '').trim().slice(0, 120) }
  },
  vista: i => ({ rin: i.rin, modelo: i.modelo, para: i.para ?? '', colores: i.colores ?? '' }),
}

CATS.otros = {                                                             // bornes, bujías, tuercas…: «marca» guarda el nombre del artículo
  archivo: 'otros.json', hoja: 'OTROS', leer: filasOtros,
  nombre: i => `${i.marca} ${i.descripcion}`,
  web: i => ({ ...comun(i), d: i.descripcion }),
  orden: (a, b) => a.m.localeCompare(b.m, 'es') || String(a.d).localeCompare(String(b.d), 'es') || a.u - b.u,
  campos: b => {
    const descripcion = String(b.descripcion ?? '').trim()
    if (!descripcion || descripcion.length > 80) throw new Error('Escribe la descripción, por ejemplo Champion o Set de 4 tuercas + 1 llave.')
    return { descripcion }
  },
  vista: i => ({ descripcion: i.descripcion }),
}

CATS.compatibilidad = {
  archivo: 'compatibilidad.json', hoja: 'COMPATIBILIDAD', leer: filasCompat, sinProductos: true,
  nombre: i => `${i.marca} ${i.modelo} ${i.desde || ''}-${i.hasta === 9999 ? '' : i.hasta}`,
  web: i => ({ o: i.marca, d: i.modelo, a: i.desde, b: i.hasta, g: gruposDe(i.grupo), r: i.grupo, ...(i.grupos && { m: Object.fromEntries(Object.entries(i.grupos).map(([k, t]) => [k, gruposDe(t)])) }) }),
  orden: (a, b) => a.o.localeCompare(b.o) || a.d.localeCompare(b.d, 'es', { numeric: true }) || a.a - b.a,
  validar: (b, previo = {}) => {
    const marca = String(b.marca ?? '').trim().toUpperCase(), modelo = String(b.modelo ?? '').trim().toUpperCase(), grupo = String(b.grupo ?? '').trim()
    if (!marca || marca.length > 40) throw new Error('Escribe la marca del vehículo.')
    if (!modelo || modelo.length > 60) throw new Error('Escribe el modelo del vehículo.')
    if (!gruposDe(grupo).length) throw new Error('Escribe el grupo de batería, por ejemplo GRUPO 24 (varios separados por coma).')
    const desde = b.desde === '' || b.desde == null ? 0 : anio(b.desde), hasta = b.hasta === '' || b.hasta == null ? 9999 : anio(b.hasta)
    if (desde == null || hasta == null || desde > hasta) throw new Error('Revisa los años: «desde» no puede ser mayor que «hasta».')
    return { ...previo, marca, modelo, desde, hasta, grupo }
  },
  vistaCompleta: i => ({ sku: i.sku, marca: i.marca, modelo: i.modelo, desde: i.desde || '', hasta: i.hasta === 9999 ? '' : i.hasta, grupo: i.grupo, manual: i.sku.startsWith('MAN-') }),
}
const ruta = cat => path.join(dir, CATS[cat].archivo)
const leer = cat => (fs.existsSync(ruta(cat)) ? JSON.parse(fs.readFileSync(ruta(cat), 'utf8')) : [])
const escribir = (nombre, datos) => { const f = path.join(dir, nombre); fs.writeFileSync(f + '.tmp', JSON.stringify(datos)); fs.renameSync(f + '.tmp', f) }

export const aCatalogo = todo => {
  const salida = { actualizado: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) }
  const aj = leerAjustes()
  for (const [cat, c] of Object.entries(CATS)) salida[cat] = (todo[cat] ?? leer(cat)).filter(visible).map(i => c.web(i, aj)).sort(c.orden)
  salida.items = salida.cauchos                                            // compatibilidad con la primera versión de la web
  salida.ajustes = aj
  salida.tasas = manualesVigentes()                                           // tasa fijada a mano en el panel (si vale hoy); la web la prefiere a la de la API
  return salida
}
const guardar = (cat, items) => {                                          // Nexo y la web siempre ven lo mismo
  escribir(CATS[cat].archivo, items)
  escribir('catalogo.json', aCatalogo({ [cat]: items }))
}
const respaldar = cat => {
  if (!fs.existsSync(ruta(cat))) return
  fs.mkdirSync(path.join(dir, 'respaldos'), { recursive: true })
  fs.copyFileSync(ruta(cat), path.join(dir, 'respaldos', `${cat}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`))
}

// ---------- Excel ----------
// Nombres con que el cliente puede llamar a cada pestaña («INVENTARIO CAUCHOS», «INVENTARIO DE BATERIA», «Copia de BICICLETAS»…); «DIMENSIONES DE CAUCHOS» no cuenta
const HOJAS = { cauchos: /^(inventario\s+(de\s+)?)?caucho/i, baterias: /^(inventario\s+(de\s+)?)?bater/i, aceites: /^(inventario\s+(de\s+)?)?aceite/i, bicicletas: /bicicleta/i, otros: /^otros?\b/i, compatibilidad: /compat/i }
export async function leerExcel(buffer, op = {}) {
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(buffer) } catch { throw new Error('No se pudo leer el archivo. Debe ser un Excel .xlsx.') }
  const out = {}
  for (const [cat, c] of Object.entries(CATS)) { const ws = wb.getWorksheet(c.hoja) || wb.worksheets.find(w => HOJAS[cat]?.test(w.name.trim())); if (ws) out[cat] = c.leer(ws, op) }
  const dims = leerDimensiones(wb)
  if (out.cauchos && dims.size) {
    out.cauchos.items = conDimensiones(out.cauchos.items, dims)
    const sin = [...new Set(out.cauchos.items.filter(i => i.medida && !dims.has(claveMedida(i.medida))).map(i => i.medida))]
    if (sin.length) out.cauchos.omitidas.push(`Aviso (sí se cargaron): ${sin.length} medidas sin dimensiones en la hoja DIMENSIONES DE CAUCHOS: ${sin.join(', ')}`)
  }
  const sinCodigo = Object.values(out).reduce((n, r) => n + r.omitidas.filter(o => /sin código CM ni MC/.test(o)).length, 0)
  if (!Object.values(out).some(r => r.items.length) && sinCodigo) throw new Error(`Ninguna fila tiene código: ${sinCodigo} productos se quedaron fuera porque les falta el CODIGO CM o el CODIGO MC. Llena esas columnas y vuelve a subir el archivo.`)
  if (!Object.values(out).some(r => r.items.length)) throw new Error('No se encontró ningún producto con precio. Sube la lista «MCY - LISTA DE PRECIOS» con sus hojas CAUCHOS, BATERIAS y ACEITES.')
  return out
}
function comparar(cat, antes, despues) {
  const a = new Map(antes.map(i => [i.sku, i])), d = new Map(despues.map(i => [i.sku, i]))
  const nombre = CATS[cat].nombre
  return {
    nuevos: [...d.values()].filter(i => !a.has(i.sku)).map(nombre),
    quitados: [...a.values()].filter(i => !d.has(i.sku)).map(nombre),
    precios: [...d.values()].filter(i => a.has(i.sku) && (a.get(i.sku).usd !== i.usd || a.get(i.sku).usd_bs !== i.usd_bs)).map(i => `${nombre(i)}: $${a.get(i.sku).usd} → $${i.usd}`),
  }
}

// ---------- acceso ----------
const clave = () => process.env.LISTA_CLAVE
const iguales = (x, y) => { const a = Buffer.from(x), b = Buffer.from(y); return a.length === b.length && crypto.timingSafeEqual(a, b) }
async function autenticar(req, res, next) {
  if (!clave()) return res.status(404).end()
  const [, ...p] = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString().split(':')
  if (iguales(p.join(':'), clave())) return next()
  await new Promise(r => setTimeout(r, 800))                                   // frena intentos repetidos
  res.set('WWW-Authenticate', 'Basic realm="Administración CM Venezuela", charset="UTF-8"').status(401).send('Necesitas la clave para entrar.')
}

function validar(cat, b, previo = {}) {
  if (CATS[cat].validar) return CATS[cat].validar(b, previo)
  const marca = String(b.marca ?? '').trim(), usd = b.usd === '' || b.usd == null ? NaN : Number(b.usd)
  if (!marca || marca.length > 60) throw new Error('Escribe la marca (máximo 60 letras).')
  const propios = CATS[cat].campos(b)
  if (!(usd >= 0)) throw new Error('Escribe el precio en dólares (0 si el precio se consulta).')
  const usd_bs = usd === 0 ? 0 : Number(b.usd_bs) > 0 ? Number(b.usd_bs) : Math.ceil(usd * 1.05 - 1e-6)    // equivalente en dólares si paga en bolívares
  const stock = { tienda_1: entero(b.cm), tienda_2: entero(b.mc) }
  if (b.cc !== '' && b.cc != null) stock.caracas = entero(b.cc)               // vacío = todavía sin dato de Caracas
  const item = { ...previo, marca, ...propios, usd, usd_bs, stock }
  item.etiqueta = String(b.etiqueta ?? '').trim().slice(0, 60)
  return item
}
const vista = (cat, i) => CATS[cat].vistaCompleta?.(i) ?? ({ sku: i.sku, marca: i.marca, ...(conCodigo(i) && { codigo_cm: i.codigo_cm ?? '', codigo_mc: i.codigo_mc ?? '' }), usd: i.usd, usd_bs: i.usd_bs, cm: i.stock.tienda_1, mc: i.stock.tienda_2, cc: i.stock.caracas ?? '', etiqueta: extra(i), imagen: i.imagen || null, manual: i.sku.startsWith('MAN-'), ...CATS[cat].vista(i) })

const TIPOS = [[[0xff, 0xd8, 0xff], 'jpg'], [[0x89, 0x50, 0x4e, 0x47], 'png'], [[0x52, 0x49, 0x46, 0x46], 'webp']]
const extension = b => TIPOS.find(([m]) => m.every((x, i) => b[i] === x))?.[1]
const enUso = f => Object.keys(CATS).some(cat => leer(cat).some(i => i.imagen === f))
const borrarSiSobra = f => { if (f && !enUso(f)) fs.rmSync(path.join(carpetaImg, f), { force: true }) }

// Reemplaza las listas leídas del Excel conservando las fotos y los productos creados a mano. También la usa scripts/cargar_excel.mjs.
export function aplicarLista(porCategoria) {
  const totales = {}
  for (const [c, nuevos] of Object.entries(porCategoria)) {
    const actual = leer(c)
    const imagenes = new Map(actual.filter(i => i.imagen).map(i => [i.sku, i.imagen]))
    const manuales = actual.filter(i => i.sku.startsWith('MAN-'))                // los productos creados a mano no los toca el Excel
    respaldar(c)
    guardar(c, [...nuevos.map(i => (imagenes.has(i.sku) ? { ...i, imagen: imagenes.get(i.sku) } : i)), ...manuales])
    totales[c] = nuevos.length + manuales.length
  }
  fs.mkdirSync(carpetaImg, { recursive: true })
  for (const f of fs.readdirSync(carpetaImg)) borrarSiSobra(f)
  console.log('Lista publicada:', JSON.stringify(totales))
  return totales
}

// Pone las dimensiones de la hoja DIMENSIONES DE CAUCHOS en los cauchos ya publicados, sin tocar precios, existencias ni fotos
export async function cargarDimensiones(buffer) {
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(buffer) } catch { throw new Error('No se pudo leer el archivo. Debe ser un Excel .xlsx.') }
  const dims = leerDimensiones(wb)
  if (!dims.size) throw new Error('No se encontró la hoja DIMENSIONES DE CAUCHOS con las columnas MEDIDA, ANCHO, ALTO y DIAMETRO.')
  const items = leer('cauchos'), nuevos = conDimensiones(items, dims)
  respaldar('cauchos'); guardar('cauchos', nuevos)
  return { cauchos: items.length, con_dimensiones: nuevos.filter((i, n) => i !== items[n]).length }
}

// Archivo que se está revisando en «Cargar Excel»: lo leído y las filas omitidas por categoría. previa = solo vista previa (sin códigos): no se puede publicar.
let revision = null
const precioTxt = i => (i.usd > 0 ? 'REF ' + i.usd : 'por consultar')
const existencia = st => `CM ${st?.tienda_1 === SIN_CANTIDAD ? 'hay' : st?.tienda_1 ?? 0} · MC ${st?.tienda_2 === SIN_CANTIDAD ? 'hay' : st?.tienda_2 ?? 0}`
const codigoDe = i => i.codigo_cm || i.codigo_mc || '—'
const especTxt = i => (i.espec || []).map(x => `${x.k}: ${x.v}`).join(' · ')
// Columnas de la tabla de revisión de cada categoría
const TABLA_REVISION = {
  cauchos: { cab: ['Código', 'Medida', 'Marca', 'Modelo', 'Tipo', 'Precio', 'Existencia', 'Especificaciones', 'Servicios'],
    fila: i => [codigoDe(i), i.medida, i.marca, i.modelo || '', [i.tipo, i.lonas && i.lonas + ' lonas'].filter(Boolean).join(' '), precioTxt(i), existencia(i.stock), especTxt(i), (i.servicios || []).join(' · ')] },
  baterias: { cab: ['Código', 'Marca', 'Grupo', 'Descripción', 'Precio', 'Existencia', 'Garantía', 'Especificaciones'],
    fila: i => [codigoDe(i), i.marca, i.grupo, i.descripcion, precioTxt(i), existencia(i.stock), i.garantia ? i.garantia + ' meses' : '', especTxt(i)] },
  aceites: { cab: ['Código', 'Tipo', 'Presentación', 'Marca', 'Precio', 'Existencia'], fila: i => [codigoDe(i), i.tipo, i.presentacion, i.marca, precioTxt(i), existencia(i.stock)] },
  bicicletas: { cab: ['Código', 'Rin', 'Modelo', 'Para', 'Precio', 'Existencia'], fila: i => [codigoDe(i), i.rin, i.modelo, i.para || '', precioTxt(i), existencia(i.stock)] },
  otros: { cab: ['Código', 'Artículo', 'Descripción', 'Precio', 'Existencia'], fila: i => [codigoDe(i), i.marca, i.descripcion, precioTxt(i), existencia(i.stock)] },
  compatibilidad: { cab: ['Vehículo', 'Años', 'Grupos', 'Por marca de batería'],
    fila: i => [`${i.marca} ${i.modelo}`, `${i.desde || 'todos'}${i.hasta && i.hasta !== 9999 ? '–' + i.hasta : i.desde ? ' en adelante' : ''}`, i.grupo, Object.entries(i.grupos || {}).map(([k, g]) => `${k}: ${g}`).join(' · ')] },
}
const FILTROS_REVISION = {
  sin_precio: i => !(i.usd > 0), sin_espec: i => !i.espec?.length, sin_codigo: i => !i.codigo_cm && !i.codigo_mc,
}
const pagina = fs.readFileSync(new URL('./admin.html', import.meta.url), 'utf8')
const paginaUso = fs.readFileSync(new URL('./uso.html', import.meta.url), 'utf8')

export function montarLista(app) {
  fs.mkdirSync(carpetaImg, { recursive: true })
  app.get('/catalogo.json', (_req, res) => {
    const f = path.join(dir, 'catalogo.json')
    if (!fs.existsSync(f)) return res.status(404).end()
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }).type('json').send(fs.readFileSync(f))
  })
  app.use('/img', (_req, res, next) => { res.set({ 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }); next() },
    express.static(carpetaImg, { maxAge: '30d', immutable: true, index: false }))

  app.get('/lista', (_req, res) => res.redirect('/admin'))
  app.get('/admin', autenticar, (_req, res) => res.type('html').send(pagina))
  app.get('/admin/uso', autenticar, (_req, res) => res.type('html').send(paginaUso))
  const api = express.Router()
  api.use(autenticar)
  app.use('/admin/api', api)
  api.get('/uso', (_req, res) => res.json(usoPorDia()))
  api.get('/uso/conversaciones', (_req, res) => res.json(usoPorConversacion()))
  api.get('/uso/presupuesto', (_req, res) => res.json({ ...estadoPresupuesto(), limite_hora: LIMITE_HORA, limite_dia: LIMITE_DIA }))

  // ---- tasa del día: la que usan Nexo y la web, lo que dice la API del BCV y la que el administrador fija a mano para hoy
  api.get('/tasas', async (_req, res) => res.json(await estadoTasas()))
  api.put('/tasas', express.json(), async (req, res) => {
    try {
      if (req.body?.actualizar) {                                              // «Actualizar del BCV»: vuelve a consultar la API ahora; si no responde, avisa y no toca la tasa fijada
        olvidarTasasApi()
        for (const [k, moneda] of [['euro', 'EUR'], ['dolar', 'USD']]) {
          if (req.body[k] === null && !(await consultarTasaApi(moneda))) {
            const e = (await estadoTasas())[k].en_uso
            throw new Error(`No se pudo leer la tasa del ${k === 'euro' ? 'euro' : 'dólar'} desde la API del BCV: no responde o dio un dato inválido. Se mantiene la tasa en uso (${e.rate ? e.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 }) + ' Bs' : 'sin tasa'}, ${e.fuente}). Inténtalo de nuevo en unos minutos o fija la tasa a mano.`)
          }
        }
      }
      const estado = await fijarTasas(req.body || {})
      const f = path.join(dir, 'catalogo.json')
      if (fs.existsSync(f)) { const c = JSON.parse(fs.readFileSync(f, 'utf8')); c.tasas = manualesVigentes(); escribir('catalogo.json', c) }   // la web lee la tasa fijada desde aquí
      res.json(estado)
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  // ---- ajustes de la web: servicios incluidos con los cauchos, detalle del filtro de los combos y los «Por confirmar»
  api.get('/ajustes', (_req, res) => res.json(leerAjustes()))
  api.get('/ajustes/opciones', (_req, res) => res.json({ marcas: opcionesMarcas(leer('cauchos').filter(visible)) }))
  api.post('/ajustes/alcance', express.json(), (req, res) => {                    // a cuántos cauchos publicados alcanza cada regla
    const reglas = Array.isArray(req.body?.reglas) ? req.body.reglas.slice(0, 60) : []
    const items = leer('cauchos').filter(visible)
    res.json({ alcance: reglas.map(r => (String(r?.marca ?? '').trim() ? items.filter(i => coincide({ marca: String(r.marca).trim(), modelo: String(r.modelo ?? '').trim() }, i)).length : 0)) })
  })
  api.put('/ajustes', express.json(), (req, res) => {
    try {
      const a = validarAjustes(req.body || {})
      escribir('ajustes_web.json', a)
      escribir('catalogo.json', aCatalogo({}))
      res.json(a)
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  // ---- resumen de la pantalla de inicio: cuántos productos hay y qué les falta
  api.get('/resumen', (_req, res) => {
    const categorias = {}
    for (const [c, def] of Object.entries(CATS)) {
      const items = leer(c)
      if (def.sinProductos) { categorias[c] = { total: items.length }; continue }
      categorias[c] = {
        total: items.length,
        sin_foto: items.filter(i => !i.imagen).length,
        sin_precio: items.filter(i => !(i.usd > 0)).length,
        agotados: items.filter(i => (i.stock?.tienda_1 ?? 0) + (i.stock?.tienda_2 ?? 0) + (i.stock?.caracas ?? 0) <= 0).length,
        sin_caracas: items.filter(i => i.stock?.caracas == null).length,
      }
    }
    let actualizado = null; try { actualizado = JSON.parse(fs.readFileSync(path.join(dir, 'catalogo.json'), 'utf8')).actualizado } catch {}
    res.json({ categorias, actualizado, ajustes: leerAjustes() })
  })

  // ---- carga masiva desde el Excel (todas las hojas a la vez)
  // ?sincodigo=1: solo vista previa de un archivo que todavía no trae los códigos CM/MC. No guarda nada, así que no se puede publicar.
  api.post('/excel/revisar', express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
    try {
      const prev = req.query.sincodigo === '1'
      const leido = await leerExcel(req.body, { sinCodigo: prev })
      revision = { items: Object.fromEntries(Object.entries(leido).map(([c, r]) => [c, r.items])), omitidas: Object.fromEntries(Object.entries(leido).map(([c, r]) => [c, r.omitidas])), previa: prev }
      res.json(Object.fromEntries(Object.entries(leido).map(([c, r]) => {
        const actual = leer(c).filter(i => !i.sku.startsWith('MAN-'))
        const precio = i => (CATS[c].sinProductos ? i.grupo : i.usd > 0 ? 'REF ' + i.usd : 'precio por consultar')
        return [c, { total: r.items.length, antes: actual.length, omitidas: r.omitidas, vista_previa: prev, sin_precio: CATS[c].sinProductos ? 0 : r.items.filter(i => !(i.usd > 0)).length,
          con_espec: r.items.filter(i => i.espec?.length).length, muestra: r.items.slice(0, 8).map(i => `${CATS[c].nombre(i)} · ${precio(i)}${i.espec?.length ? ' · ' + i.espec.map(x => x.k + ' ' + x.v).join(', ') : ''}`), ...comparar(c, actual, r.items) }]
      })))
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  // Todas las filas de una categoría del archivo revisado, con buscador y filtros, para revisarlas antes de confirmar
  api.get('/excel/filas/:cat', (req, res) => {
    const c = req.params.cat, t = TABLA_REVISION[c]
    if (!revision || !t || !revision.items[c]) return res.status(404).json({ error: 'Primero sube y revisa el archivo.' })
    const { q = '', filtro = 'todas' } = req.query, pagina = Math.max(1, Number(req.query.pagina) || 1), POR = 50
    if (filtro === 'omitidas') return res.json({ cab: ['Fila omitida'], filas: revision.omitidas[c].map(x => [x]), total: revision.omitidas[c].length, filtradas: revision.omitidas[c].length, pagina: 1, paginas: 1 })
    const f = FILTROS_REVISION[filtro], buscar = String(q).toLowerCase().trim()
    const filas = revision.items[c].filter(i => (!f || f(i)) && (!buscar || t.fila(i).join(' ').toLowerCase().includes(buscar)))
    res.json({ cab: t.cab, filas: filas.slice((pagina - 1) * POR, pagina * POR).map(t.fila), total: revision.items[c].length, filtradas: filas.length, pagina, paginas: Math.max(1, Math.ceil(filas.length / POR)) })
  })
  // Publica solo las categorías confirmadas (body { categorias: [...] }); sin lista, todas las revisadas. Las demás siguen pendientes de revisar.
  api.post('/excel/publicar', express.json(), (req, res) => {
    if (!revision) return res.status(400).json({ error: 'Primero sube y revisa el archivo.' })
    if (revision.previa) return res.status(400).json({ error: 'Esto es solo una vista previa: el archivo no tiene códigos y no se puede publicar.' })
    const pedidas = Array.isArray(req.body?.categorias) ? req.body.categorias : Object.keys(revision.items)
    if (!pedidas.length || pedidas.some(c => !revision.items[c])) return res.status(400).json({ error: 'Elige categorías que estén en el archivo revisado.' })
    const totales = aplicarLista(Object.fromEntries(pedidas.map(c => [c, revision.items[c]])))
    for (const c of pedidas) { delete revision.items[c]; delete revision.omitidas[c] }
    const restantes = Object.keys(revision.items); if (!restantes.length) revision = null
    res.json({ ok: true, totales, restantes })
  })

  // ---- productos (CRUD) por categoría
  const cat = express.Router({ mergeParams: true })
  api.use('/:cat', (req, res, next) => (CATS[req.params.cat] ? next() : res.status(404).json({ error: 'Categoría desconocida.' })), cat)
  cat.get('/items', (req, res) => res.json(leer(req.params.cat).map(i => vista(req.params.cat, i))))
  cat.post('/items', (req, res) => {
    try {
      const c = req.params.cat, items = leer(c)
      const item = validar(c, req.body); item.sku = 'MAN-' + crypto.randomBytes(4).toString('hex').toUpperCase()
      respaldar(c); guardar(c, [...items, item]); res.json(vista(c, item))
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  cat.put('/items/:sku', (req, res) => {
    try {
      const c = req.params.cat, items = leer(c), i = items.findIndex(x => x.sku === req.params.sku)
      if (i < 0) return res.status(404).json({ error: 'Ese producto ya no existe.' })
      items[i] = validar(c, req.body, items[i]); guardar(c, items); res.json(vista(c, items[i]))
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  cat.patch('/items/:sku', (req, res) => {                                     // edición rápida desde la lista: precio y existencias, sin tocar el resto
    try {
      const c = req.params.cat, items = leer(c), i = items.findIndex(x => x.sku === req.params.sku), b = req.body || {}
      if (CATS[c].sinProductos) return res.status(404).json({ error: 'Esta lista no tiene precios.' })
      if (i < 0) return res.status(404).json({ error: 'Ese producto ya no existe.' })
      const it = { ...items[i], stock: { ...items[i].stock } }
      if ('usd' in b) {
        const usd = b.usd === '' || b.usd == null ? NaN : Number(b.usd)
        if (!(usd >= 0)) throw new Error('Escribe el precio en dólares (0 si el precio se consulta).')
        it.usd = usd; it.usd_bs = usd === 0 ? 0 : Number(b.usd_bs) > 0 ? Number(b.usd_bs) : Math.ceil(usd * 1.05 - 1e-6)
      } else if ('usd_bs' in b) {
        const bs = b.usd_bs === '' || b.usd_bs == null ? NaN : Number(b.usd_bs)
        if (!(bs >= 0)) throw new Error('Escribe el equivalente en dólares si paga en bolívares.')
        it.usd_bs = bs
      }
      for (const [campo, tienda] of [['cm', 'tienda_1'], ['mc', 'tienda_2']]) if (campo in b) it.stock[tienda] = entero(b[campo])
      if ('cc' in b) { if (b.cc === '' || b.cc == null) delete it.stock.caracas; else it.stock.caracas = entero(b.cc) }
      items[i] = it; guardar(c, items); res.json(vista(c, it))
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  cat.delete('/items/:sku', (req, res) => {
    const c = req.params.cat, items = leer(c), i = items.findIndex(x => x.sku === req.params.sku)
    if (i < 0) return res.status(404).json({ error: 'Ese producto ya no existe.' })
    const [quitado] = items.splice(i, 1)
    respaldar(c); guardar(c, items); borrarSiSobra(quitado.imagen); res.json({ ok: true })
  })

  // ---- foto del producto (el navegador la reduce antes de subirla)
  cat.post('/items/:sku/imagen', express.raw({ type: () => true, limit: '5mb' }), (req, res) => {
    const c = req.params.cat, items = leer(c), it = items.find(x => x.sku === req.params.sku)
    if (!it) return res.status(404).json({ error: 'Ese producto ya no existe.' })
    const ext = Buffer.isBuffer(req.body) && extension(req.body)
    if (!ext) return res.status(400).json({ error: 'La imagen debe ser JPG, PNG o WebP.' })
    const archivo = `${crypto.randomBytes(8).toString('hex')}.${ext}`
    fs.writeFileSync(path.join(carpetaImg, archivo), req.body)
    const cambiados = items.filter(x => x.sku === it.sku || (req.query.marca === '1' && x.marca === it.marca))   // «usar también en los demás de esta marca»
    const viejas = cambiados.map(x => x.imagen).filter(Boolean)
    cambiados.forEach(x => { x.imagen = archivo })
    guardar(c, items); viejas.forEach(borrarSiSobra)
    res.json({ imagen: archivo, aplicados: cambiados.length })
  })
  cat.delete('/items/:sku/imagen', (req, res) => {
    const c = req.params.cat, items = leer(c), it = items.find(x => x.sku === req.params.sku)
    if (!it) return res.status(404).json({ error: 'Ese producto ya no existe.' })
    const f = it.imagen; delete it.imagen; guardar(c, items); borrarSiSobra(f); res.json({ ok: true })
  })
}
