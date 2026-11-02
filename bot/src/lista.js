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

// Inventario de cauchos, formato nuevo: CODIGO CM | CODIGO MC | MEDIDA | MARCA | MODELO | TIPO | LONAS | Precio | Bs | CM | MC | TOTAL INV
// El código es obligatorio (sin código el producto no existe) y se guarda tal cual, sin corregir mayúsculas ni espacios.
const codigo = v => String(celda(v) ?? '').trim()
function filasCauchosNuevo(ws) {
  const items = [], omitidas = [], vistos = new Map()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const c = i => celda(row.getCell(i).value)
    const cm = codigo(c(1)), mc = codigo(c(2)), med = txt(c(3)), marca = txt(c(4))
    if (!med && !marca && !cm && !mc) return                                           // fila separadora
    if (!cm && !mc) { omitidas.push(`Fila ${n}: ${med} ${marca} (sin código CM ni MC, no se publica)`); return }
    if (!med || !marca) { omitidas.push(`Fila ${n}: código ${cm || mc} sin medida o marca`); return }
    for (const k of [cm && 'CM:' + cm, mc && 'MC:' + mc].filter(Boolean)) {
      if (vistos.has(k)) { omitidas.push(`Fila ${n}: código ${k.slice(3)} repetido (ya está en la fila ${vistos.get(k)}), no se carga`); return }
    }
    const [medida, rin] = medidaYRin(med), precio = Number(c(8)) > 0 ? Number(c(8)) : 0
    const bs = Number(c(9)), qcm = entero(c(10)), qmc = entero(c(11))
    const lonas = Number((txt(c(7)).match(/\d+/) || [])[0])
    const item = { sku: cm ? 'CM-' + cm : 'MC-' + mc, marca, modelo: txt(c(5)), tipo: txt(c(6)), ...(lonas > 0 && { lonas }), medida, rin, usd: precio, usd_bs: precio ? (bs > 0 ? bs : Math.ceil(precio * 1.05 - 1e-6)) : 0, stock: { tienda_1: qcm, tienda_2: qmc } }
    if (cm) item.codigo_cm = cm
    if (mc) item.codigo_mc = mc
    if (med !== medida) item.detalle = med
    for (const k of [cm && 'CM:' + cm, mc && 'MC:' + mc].filter(Boolean)) vistos.set(k, n)
    items.push(item)
  })
  const parecidos = new Map()                                                          // códigos que solo se diferencian en espacios o mayúsculas: se avisa, no se unen
  for (const i of items) for (const k of [i.codigo_cm && 'CM' + norm(i.codigo_cm), i.codigo_mc && 'MC' + norm(i.codigo_mc)].filter(Boolean)) parecidos.set(k, [...(parecidos.get(k) || []), i.codigo_cm || i.codigo_mc])
  for (const l of parecidos.values()) if (l.length > 1) omitidas.push(`Aviso (sí se cargaron): los códigos «${l.join('», «')}» solo se diferencian en espacios o mayúsculas; revisa que sean productos distintos`)
  return { items, omitidas }
}

function filasCauchos(ws) {
  if (/^C[OÓ]DIGO\s*CM$/i.test(txt(ws.getRow(1).getCell(1).value))) return filasCauchosNuevo(ws)
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
function filasBaterias(ws) {
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
function filasAceites(ws) {
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

function filasBicicletas(ws) {                                           // «🚲RIN 20 MODELO 130 (NIÑO)» | precio | bs | # unidades en CM | colores | MC (hay en Master Cauchos)
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
function filasCompat(ws) {
  const items = [], omitidas = [], sku = unicos()
  const cab = {}
  ws.getRow(1).eachCell((c, i) => { const h = norm(txt(c.value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')); if (h) cab[h] = i })
  const col = (...ns) => { for (const n of ns) if (cab[n]) return cab[n] }
  const cMarca = col('MARCA', 'VEHICULO'), cModelo = col('MODELO'), cDesde = col('DESDE', 'ANODESDE', 'INICIO'), cHasta = col('HASTA', 'ANOHASTA', 'FIN'), cAnio = col('ANO', 'ANOS'), cGrupo = col('GRUPO', 'GRUPOS', 'GRUPODEBATERIA', 'BATERIA')
  if (!cMarca || !cModelo || !cGrupo) throw new Error('La hoja COMPATIBILIDAD necesita las columnas MARCA, MODELO y GRUPO (y los años: DESDE y HASTA, o AÑO).')
  ws.eachRow((row, n) => {
    if (n === 1) return
    const g = i => (i ? celda(row.getCell(i).value) : null)
    const marca = txt(g(cMarca)).toUpperCase(), modelo = txt(g(cModelo)).toUpperCase(), grupo = txt(g(cGrupo))
    if (!marca && !modelo && !grupo) return
    if (!marca || !modelo || !gruposDe(grupo).length) { omitidas.push(`Fila ${n}: ${marca} ${modelo} (falta marca, modelo o grupo)`); return }
    let desde = anio(g(cDesde)), hasta = anio(g(cHasta))
    const rango = txt(g(cAnio)) || (/[-–]/.test(txt(g(cDesde))) ? txt(g(cDesde)) : '')    // «2008-2014», «08-14» o «2010»
    if (rango && (desde == null || /[-–]/.test(txt(g(cDesde))))) { const [a, b] = rango.split(/\s*[-–]\s*/); desde = anio(a); hasta = anio(b ?? a) }
    items.push({ sku: sku('CMP' + norm(marca).slice(0, 6) + norm(modelo).slice(0, 8)), marca, modelo, desde: desde ?? 0, hasta: hasta ?? 9999, grupo })
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
const AJUSTES_BASE = { servicios_compra: [], combo_detalle: '', mostrar_pendientes: true }
export const leerAjustes = () => {
  try { return { ...AJUSTES_BASE, ...JSON.parse(fs.readFileSync(path.join(dir, 'ajustes_web.json'), 'utf8')) } } catch { return { ...AJUSTES_BASE } }
}
export function validarAjustes(b) {
  const servicios = (Array.isArray(b.servicios_compra) ? b.servicios_compra : String(b.servicios_compra ?? '').split('\n')).map(x => String(x).trim()).filter(Boolean)
  if (servicios.length > 12) throw new Error('Máximo 12 servicios.')
  if (servicios.some(x => x.length > 60)) throw new Error('Cada servicio debe tener máximo 60 letras.')
  const combo = String(b.combo_detalle ?? '').trim()
  if (combo.length > 80) throw new Error('El detalle del filtro debe tener máximo 80 letras.')
  return { servicios_compra: servicios, combo_detalle: combo, mostrar_pendientes: b.mostrar_pendientes !== false && b.mostrar_pendientes !== 'false' }
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
    web: i => ({ ...comun(i), z: i.medida, r: i.rin, ...(i.modelo && { mo: i.modelo }), ...(i.tipo && { ti: i.tipo }), ...(i.lonas && { lo: i.lonas }), ...(i.espec?.length && { e: Object.fromEntries(i.espec.map(x => [x.k, x.v])) }) }),
    orden: (a, b) => (a.r ?? 0) - (b.r ?? 0) || a.z.localeCompare(b.z) || a.u - b.u,
    campos: b => {
      const medida = String(b.medida ?? '').trim()
      if (!medida || medida.length > 30) throw new Error('Escribe la medida, por ejemplo 265/60R18.')
      const modelo = String(b.modelo ?? '').trim(), tipo = String(b.tipo ?? '').trim()
      if (modelo.length > 40) throw new Error('El modelo es muy largo (máximo 40 letras).')
      if (tipo.length > 30) throw new Error('El tipo es muy largo (máximo 30 letras).')
      const lonas = b.lonas === '' || b.lonas == null ? 0 : Math.round(Number(b.lonas))
      if (!(lonas >= 0 && lonas <= 40)) throw new Error('Las lonas deben ser un número, por ejemplo 16.')
      return { medida, rin: b.rin === '' || b.rin == null ? medidaYRin(medida)[1] : Number(b.rin), modelo, tipo, lonas, espec: especDeTexto(b.espec) }
    },
    vista: i => ({ medida: i.medida, rin: i.rin, modelo: i.modelo ?? '', tipo: i.tipo ?? '', lonas: i.lonas ?? '', espec: especATexto(i.espec) }),
  },
  baterias: {
    archivo: 'baterias.json', hoja: 'BATERIAS', leer: filasBaterias,
    nombre: i => `${i.marca} ${i.descripcion}`,
    web: i => ({ ...comun(i), d: i.descripcion, g: i.grupo, k: gruposDe(i.grupo), ...(i.amp && { a: i.amp }), ...(i.garantia && { w: i.garantia }) }),
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

CATS.compatibilidad = {
  archivo: 'compatibilidad.json', hoja: 'COMPATIBILIDAD', leer: filasCompat, sinProductos: true,
  nombre: i => `${i.marca} ${i.modelo} ${i.desde || ''}-${i.hasta === 9999 ? '' : i.hasta}`,
  web: i => ({ o: i.marca, d: i.modelo, a: i.desde, b: i.hasta, g: gruposDe(i.grupo), r: i.grupo }),
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
  for (const [cat, c] of Object.entries(CATS)) salida[cat] = (todo[cat] ?? leer(cat)).filter(visible).map(c.web).sort(c.orden)
  salida.items = salida.cauchos                                            // compatibilidad con la primera versión de la web
  salida.ajustes = leerAjustes()
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
export async function leerExcel(buffer) {
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(buffer) } catch { throw new Error('No se pudo leer el archivo. Debe ser un Excel .xlsx.') }
  const out = {}
  for (const [cat, c] of Object.entries(CATS)) { const ws = wb.getWorksheet(c.hoja) || (cat === 'cauchos' ? wb.worksheets.find(w => /caucho/i.test(w.name)) : null); if (ws) out[cat] = c.leer(ws) }
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

let pendiente = null
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

  // ---- ajustes de la web: servicios incluidos con los cauchos, detalle del filtro de los combos y los «Por confirmar»
  api.get('/ajustes', (_req, res) => res.json(leerAjustes()))
  api.put('/ajustes', express.json(), (req, res) => {
    try {
      const a = validarAjustes(req.body || {})
      escribir('ajustes_web.json', a)
      escribir('catalogo.json', aCatalogo({}))
      res.json(a)
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  // ---- carga masiva desde el Excel (todas las hojas a la vez)
  api.post('/excel/revisar', express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
    try {
      const leido = await leerExcel(req.body)
      pendiente = Object.fromEntries(Object.entries(leido).map(([c, r]) => [c, r.items]))
      res.json(Object.fromEntries(Object.entries(leido).map(([c, r]) => {
        const actual = leer(c).filter(i => !i.sku.startsWith('MAN-'))
        return [c, { total: r.items.length, antes: actual.length, omitidas: r.omitidas, ...comparar(c, actual, r.items) }]
      })))
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  api.post('/excel/publicar', (_req, res) => {
    if (!pendiente) return res.status(400).json({ error: 'Primero sube y revisa el archivo.' })
    const totales = aplicarLista(pendiente); pendiente = null
    res.json({ ok: true, totales })
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
