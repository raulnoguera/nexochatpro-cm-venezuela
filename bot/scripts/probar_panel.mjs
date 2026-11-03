// Prueba del panel de administración con datos temporales (no toca data/): campos nuevos de cauchos, existencia de Caracas,
// ajustes de la web y lo que sale en catalogo.json. Uso: node scripts/probar_panel.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import express from 'express'
import ExcelJS from 'exceljs'

const aqui = path.dirname(new URL(import.meta.url).pathname)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-'))
fs.mkdirSync(path.join(tmp, 'data'))
fs.copyFileSync(path.join(aqui, '../data/tiendas.json'), path.join(tmp, 'data', 'tiendas.json'))
process.chdir(tmp)
process.env.LISTA_CLAVE = 'clave-de-prueba'
const { montarLista, aCatalogo, leerExcel } = await import(pathToFileURL(path.join(aqui, '../src/lista.js')).href)
const { ejecutar } = await import(pathToFileURL(path.join(aqui, '../src/tools.js')).href)
const app = express(); app.use(express.json()); montarLista(app)
const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`
const auth = 'Basic ' + Buffer.from('x:clave-de-prueba').toString('base64')
const api = async (m, p, body) => { const r = await fetch(base + '/admin/api' + p, { method: m, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const catalogo = () => JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'catalogo.json'), 'utf8'))
let n = 0; const ok = (t, f) => { f(); n++; console.log('  ✓', t) }

try {
  const base1 = { marca: 'Sportrak', medida: '235/75R15', usd: 97, cm: 3, mc: 0 }

  // 1) caucho con los campos nuevos
  let r = await api('POST', '/cauchos/items', { ...base1, modelo: 'SP786', tipo: 'AT', lonas: 10, espec: 'Índice de carga: 91\nÍndice de velocidad: H', cc: 2 })
  const sku = r.j.sku
  ok('crea un caucho con modelo, tipo, lonas, especificaciones y Caracas', () => { assert.equal(r.s, 200); assert.equal(r.j.modelo, 'SP786'); assert.equal(r.j.tipo, 'AT'); assert.equal(r.j.lonas, 10); assert.equal(r.j.cc, 2); assert.equal(r.j.espec, 'Índice de carga: 91\nÍndice de velocidad: H') })
  const w = catalogo().cauchos.find(x => x.z === '235/75R15')
  ok('el catálogo de la web lleva mo, ti, lo, e y la existencia de Caracas', () => { assert.equal(w.mo, 'SP786'); assert.equal(w.ti, 'AT'); assert.equal(w.lo, 10); assert.deepEqual(w.e, { 'Índice de carga': '91', 'Índice de velocidad': 'H' }); assert.equal(w.c, 2) })

  // 2) sin dato de Caracas el catálogo no lo inventa
  r = await api('POST', '/cauchos/items', { ...base1, medida: '195/65R15', cc: '' })
  ok('sin dato de Caracas no se envía «c» a la web', () => { const x = catalogo().cauchos.find(y => y.z === '195/65R15'); assert.ok(!('c' in x)); assert.ok(!('mo' in x) && !('ti' in x) && !('lo' in x) && !('e' in x)) })

  // 3) borrar los campos al editar
  r = await api('PUT', `/cauchos/items/${sku}`, { ...base1, modelo: '', tipo: '', lonas: '', espec: '', cc: '' })
  ok('al vaciar los campos desaparecen de la web', () => { const x = catalogo().cauchos.find(y => y.z === '235/75R15'); assert.equal(r.s, 200); assert.ok(!('mo' in x) && !('ti' in x) && !('lo' in x) && !('e' in x) && !('c' in x)) })

  // 4) validaciones
  for (const [t, cuerpo, texto] of [
    ['especificación sin dos puntos', { ...base1, espec: 'Índice de carga 91' }, /Nombre: valor/],
    ['más de 12 especificaciones', { ...base1, espec: Array.from({ length: 13 }, (_, i) => `a${i}: 1`).join('\n') }, /Máximo 12/],
    ['lonas fuera de rango', { ...base1, lonas: 99 }, /lonas/],
    ['modelo demasiado largo', { ...base1, modelo: 'x'.repeat(41) }, /modelo/],
  ]) { r = await api('POST', '/cauchos/items', cuerpo); ok(`rechaza ${t}`, () => { assert.equal(r.s, 400); assert.match(r.j.error, texto) }) }

  // 5) ajustes de la web
  r = await api('GET', '/ajustes')
  ok('ajustes por defecto: sin servicios, sin detalle y «Por confirmar» visible', () => { assert.deepEqual(r.j, { servicios_compra: [], servicios_reglas: [], combo_detalle: '', mostrar_pendientes: true }) })
  r = await api('PUT', '/ajustes', { servicios_compra: ' Montura \n\nBalanceo\nVálvula nueva', combo_detalle: 'Filtro de aceite', mostrar_pendientes: false })
  ok('guarda los ajustes y limpia las líneas vacías', () => { assert.equal(r.s, 200); assert.deepEqual(r.j, { servicios_compra: ['Montura', 'Balanceo', 'Válvula nueva'], servicios_reglas: [], combo_detalle: 'Filtro de aceite', mostrar_pendientes: false }) })
  ok('catalogo.json trae los ajustes al instante', () => assert.deepEqual(catalogo().ajustes, r.j))
  ok('aCatalogo también los incluye', () => assert.deepEqual(aCatalogo({}).ajustes, r.j))
  r = await api('PUT', '/ajustes', { servicios_compra: Array.from({ length: 13 }, (_, i) => 'S' + i) })
  ok('rechaza más de 12 servicios', () => { assert.equal(r.s, 400); assert.match(r.j.error, /Máximo 12/) })
  r = await api('PUT', '/ajustes', { servicios_compra: ['x'.repeat(61)] })
  ok('rechaza un servicio demasiado largo', () => { assert.equal(r.s, 400) })

  // 6) acceso
  const sin = await fetch(base + '/admin/api/ajustes'); ok('los ajustes exigen la clave del panel', () => assert.equal(sin.status, 401))

  // 7) la categoría «ajustes» no se confunde con una lista de productos
  r = await api('GET', '/ajustes'); ok('GET /ajustes responde ajustes, no una categoría', () => assert.ok('servicios_compra' in r.j))
  // 7b) edición rápida (PATCH): solo cambia lo que se manda
  r = await api('POST', '/cauchos/items', { ...base1, medida: '205/55R16', modelo: 'X1', tipo: 'HT', lonas: 8, espec: 'Índice de carga: 91', etiqueta: 'Con set', cm: 4, mc: 1, cc: 6 })
  const rap = r.j.sku
  r = await api('PATCH', `/cauchos/items/${rap}`, { usd: 80 })
  ok('PATCH del precio recalcula el equivalente en bolívares y no toca lo demás', () => { assert.equal(r.s, 200); assert.equal(r.j.usd, 80); assert.equal(r.j.usd_bs, 84); assert.equal(r.j.modelo, 'X1'); assert.equal(r.j.tipo, 'HT'); assert.equal(r.j.lonas, 8); assert.equal(r.j.espec, 'Índice de carga: 91'); assert.equal(r.j.cm, 4); assert.equal(r.j.mc, 1); assert.equal(r.j.cc, 6); assert.equal(r.j.etiqueta, 'Con set') })
  r = await api('PATCH', `/cauchos/items/${rap}`, { usd: 80, usd_bs: 90 })
  ok('PATCH respeta el equivalente en bolívares si se escribe', () => assert.equal(r.j.usd_bs, 90))
  r = await api('PATCH', `/cauchos/items/${rap}`, { cm: 0, mc: 7, cc: '' })
  ok('PATCH de existencias cambia las tiendas y quita Caracas si queda vacío', () => { assert.equal(r.j.cm, 0); assert.equal(r.j.mc, 7); assert.equal(r.j.cc, ''); assert.equal(r.j.usd, 80); assert.ok(!('c' in catalogo().cauchos.find(x => x.z === '205/55R16'))) })
  r = await api('PATCH', `/cauchos/items/${rap}`, { usd: -3 })
  ok('PATCH rechaza un precio negativo', () => { assert.equal(r.s, 400); assert.match(r.j.error, /precio/) })
  r = await api('PATCH', '/cauchos/items/NO-EXISTE', { usd: 5 })
  ok('PATCH de un producto que no existe da 404', () => assert.equal(r.s, 404))
  r = await api('PATCH', '/compatibilidad/items/x', { usd: 5 })
  ok('la tabla de vehículos no tiene precios que editar', () => assert.equal(r.s, 404))

  // 7c) resumen para la pantalla de inicio
  await api('POST', '/cauchos/items', { ...base1, medida: '175/70R13', cm: 0, mc: 0 })          // uno agotado
  r = await api('GET', '/resumen')
  ok('el resumen cuenta productos, fotos, precios, agotados y Caracas', () => {
    const c = r.j.categorias.cauchos
    assert.ok(c.total >= 3 && c.sin_foto === c.total && c.sin_precio === 0)
    assert.equal(c.sin_caracas, c.total)
    assert.equal(c.agotados, 1)
    assert.equal(c.total, 4)
    assert.ok(r.j.ajustes && 'servicios_compra' in r.j.ajustes && r.j.actualizado)
    assert.equal(r.j.categorias.baterias.total, 0)
  })

  // 8) Excel del formato nuevo: la columna LONAS se lee
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('CAUCHOS')
  ws.addRow(['CODIGO CM', 'CODIGO MC', 'MEDIDA', 'MARCA', 'MODELO', 'TIPO', 'LONAS', 'Precio', 'Bs', 'CM', 'MC', 'TOTAL INV'])
  ws.addRow(['A-1', '', '235/75R15', 'Sportrak', 'SP786', 'AT', 10, 97, 100, 3, 0, 3])
  ws.addRow(['A-2', '', '195/65R15', 'Haida', '', 'HT', '', 60, 63, 2, 0, 2])
  const leido = await leerExcel(Buffer.from(await wb.xlsx.writeBuffer()))
  ok('el Excel nuevo trae modelo, tipo y lonas (y sin lonas no inventa nada)', () => { const [a, b] = leido.cauchos.items; assert.equal(a.modelo, 'SP786'); assert.equal(a.tipo, 'AT'); assert.equal(a.lonas, 10); assert.ok(!('lonas' in b)) })

  // 9) Nexo ve las lonas y las especificaciones, y no junta cauchos con lonas distintas
  fs.writeFileSync(path.join(tmp, 'data', 'inventario.json'), JSON.stringify([
    { sku: 'MAN-1', marca: 'Sportrak', modelo: 'SP786', tipo: 'AT', lonas: 10, espec: [{ k: 'Índice de carga', v: '91' }], medida: '235/75R15', rin: 15, usd: 97, usd_bs: 100, stock: { tienda_1: 3, tienda_2: 0 } },
    { sku: 'MAN-2', marca: 'Sportrak', modelo: 'SP786', tipo: 'AT', lonas: 12, medida: '235/75R15', rin: 15, usd: 97, usd_bs: 100, stock: { tienda_1: 3, tienda_2: 0 } },
  ]))
  const ctx = { conversationId: 0 }
  const res = await ejecutar('buscar_cauchos', { tienda: 'maracay', medida: '235/75R15' }, ctx).catch(e => ({ error: e.message }))
  const lista = res.resultados || []
  ok('Nexo recibe las lonas y las especificaciones', () => { assert.equal(lista.length, 2, JSON.stringify(res).slice(0, 300)); assert.deepEqual(lista.map(x => x.lonas).sort(), [10, 12]); assert.equal(lista.find(x => x.lonas === 10).especificaciones, 'Índice de carga: 91'); assert.ok(!('especificaciones' in lista.find(x => x.lonas === 12))) })

  // 10) servicios por marca / modelo / producto
  r = await api('PUT', '/ajustes', { servicios_compra: ['Montura'], mostrar_pendientes: true, combo_detalle: '', servicios_reglas: [
    { marca: 'sportrak', modelo: '', servicios: 'Balanceo' },
    { marca: 'Sportrak', modelo: 'sp-786', servicios: ['Válvula nueva', 'montura'] },
    { marca: 'Otra', servicios: ['Nada'] },
  ] })
  ok('guarda reglas por marca y por marca + modelo', () => { assert.equal(r.s, 200); assert.equal(r.j.servicios_reglas.length, 3); assert.deepEqual(r.j.servicios_reglas[0].servicios, ['Balanceo']) })
  r = await api('POST', '/cauchos/items', { marca: 'Sportrak', medida: '205/60R16', usd: 80, cm: 2, mc: 0, modelo: 'ZZ9', servicios: '-Balanceo\nAlineación' })
  ok('el producto guarda sus servicios propios', () => { assert.equal(r.s, 200); assert.equal(r.j.servicios, '-Balanceo\nAlineación') })
  const cat10 = catalogo().cauchos, sv = z => cat10.find(x => x.z === z)?.sv
  ok('SP786 recibe generales + marca + modelo, sin repetir', () => assert.deepEqual(sv('235/75R15'), ['Montura', 'Balanceo', 'Válvula nueva']))
  ok('otro modelo de la marca no recibe los del modelo, y quita/agrega los propios', () => assert.deepEqual(sv('205/60R16'), ['Montura', 'Alineación']))
  r = await api('PUT', '/ajustes', { servicios_compra: [], servicios_reglas: [], mostrar_pendientes: true, combo_detalle: '' })
  ok('sin reglas ni generales no se envía «sv» salvo los propios', () => { const c = catalogo().cauchos; assert.ok(!('sv' in c.find(x => x.z === '235/75R15'))); assert.deepEqual(c.find(x => x.z === '205/60R16').sv, ['Alineación']) })
  await api('PUT', '/ajustes', { servicios_compra: ['Montura'], servicios_reglas: [{ marca: 'Sportrak', modelo: 'SP786', servicios: ['Válvula nueva'] }], mostrar_pendientes: true, combo_detalle: '' })
  const res10 = await ejecutar('buscar_cauchos', { tienda: 'maracay', medida: '235/75R15' }, { conversationId: 0 }).catch(e => ({ error: e.message }))
  ok('Nexo recibe los servicios incluidos de cada caucho', () => assert.deepEqual(res10.resultados.find(x => x.lonas === 10).servicios_incluidos, ['Montura', 'Válvula nueva']))
  fs.writeFileSync(path.join(tmp, 'data', 'inventario.json'), JSON.stringify([
    { sku: 'EMB-1', marca: 'Sportrak SP716', medida: '175/70R13', rin: 13, usd: 50, usd_bs: 53, stock: { tienda_1: 3, tienda_2: 0 } },
    { sku: 'EMB-2', marca: 'Sportrakers', medida: '175/70R13', rin: 13, usd: 50, usd_bs: 53, stock: { tienda_1: 3, tienda_2: 0 } },
  ]))
  await api('PUT', '/ajustes', { servicios_compra: [], servicios_reglas: [{ marca: 'Sportrak', servicios: ['Balanceo'] }, { marca: 'Sportrak', modelo: 'SP716', servicios: ['Válvula'] }, { marca: 'Sportrak', modelo: 'SP999', servicios: ['No'] }], mostrar_pendientes: true, combo_detalle: '' })
  ok('la marca con el modelo dentro («Sportrak SP716») recibe sus reglas; «Sportrakers» no', () => { const c = catalogo().cauchos; assert.deepEqual(c.find(x => x.m === 'Sportrak SP716').sv, ['Balanceo', 'Válvula']); assert.ok(!('sv' in c.find(x => x.m === 'Sportrakers'))) })
  for (const [t, reglas, texto] of [
    ['regla sin marca', [{ marca: '', servicios: ['A'] }], /marca/],
    ['regla sin servicios', [{ marca: 'X', servicios: '' }], /al menos un servicio/],
    ['servicio muy largo', [{ marca: 'X', servicios: ['y'.repeat(61)] }], /60 letras/],
  ]) { r = await api('PUT', '/ajustes', { servicios_compra: [], servicios_reglas: reglas }); ok(`rechaza ${t}`, () => { assert.equal(r.s, 400); assert.match(r.j.error, texto) }) }
  console.log(`\n${n} comprobaciones correctas`)
} finally { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
