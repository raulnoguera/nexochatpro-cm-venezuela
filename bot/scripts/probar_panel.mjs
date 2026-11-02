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
  ok('ajustes por defecto: sin servicios, sin detalle y «Por confirmar» visible', () => { assert.deepEqual(r.j, { servicios_compra: [], combo_detalle: '', mostrar_pendientes: true }) })
  r = await api('PUT', '/ajustes', { servicios_compra: ' Montura \n\nBalanceo\nVálvula nueva', combo_detalle: 'Filtro de aceite', mostrar_pendientes: false })
  ok('guarda los ajustes y limpia las líneas vacías', () => { assert.equal(r.s, 200); assert.deepEqual(r.j, { servicios_compra: ['Montura', 'Balanceo', 'Válvula nueva'], combo_detalle: 'Filtro de aceite', mostrar_pendientes: false }) })
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
  console.log(`\n${n} comprobaciones correctas`)
} finally { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
