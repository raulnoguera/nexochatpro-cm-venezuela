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
  ok('ajustes por defecto: sin servicios, sin detalle, «Por confirmar» visible y las explicaciones de la hoja del cliente', () => { const { ayudas_espec, ...resto } = r.j; assert.deepEqual(resto, { servicios_compra: [], servicios_reglas: [], combo_detalle: '', mostrar_pendientes: true }); assert.ok(ayudas_espec['Índice de carga']) })
  r = await api('PUT', '/ajustes', { servicios_compra: ' Montura \n\nBalanceo\nVálvula nueva', combo_detalle: 'Filtro de aceite', mostrar_pendientes: false })
  ok('guarda los ajustes y limpia las líneas vacías', () => { assert.equal(r.s, 200); const { ayudas_espec, ...resto } = r.j; assert.deepEqual(resto, { servicios_compra: ['Montura', 'Balanceo', 'Válvula nueva'], servicios_reglas: [], combo_detalle: 'Filtro de aceite', mostrar_pendientes: false }); assert.ok(ayudas_espec['Índice de carga']) })
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

  // 11) listas de marcas/modelos y contador de alcance de las reglas
  fs.writeFileSync(path.join(tmp, 'data', 'inventario.json'), JSON.stringify([
    ['Sportrak SP716 HT', ''], ['Sportrak SP716', ''], ['Sportrak SP778', ''], ['Sportrak 16Pr (Mixto)', ''], ['Haida HD878 AT', ''], ['Haida', ''], ['Milemax HT', ''], ['Kumho', 'KU31'],
  ].map(([marca, modelo], n) => ({ sku: 'OPC-' + n, marca, ...(modelo && { modelo }), medida: '175/70R13', rin: 13, usd: 50, usd_bs: 53, stock: { tienda_1: 3, tienda_2: 0 } }))))
  r = await api('GET', '/ajustes/opciones')
  const por = m => r.j.marcas.find(x => x.marca === m)
  ok('lista las marcas (primera palabra) con su total', () => { assert.deepEqual(r.j.marcas.map(x => x.marca), ['Haida', 'Kumho', 'Milemax', 'Sportrak']); assert.equal(por('Sportrak').total, 4) })
  ok('saca el modelo del nombre sin confundirlo con tipo ni lonas', () => { assert.deepEqual(por('Sportrak').modelos, ['SP716', 'SP778']); assert.deepEqual(por('Haida').modelos, ['HD878']); assert.deepEqual(por('Milemax').modelos, []) })
  ok('usa el campo modelo cuando existe', () => assert.deepEqual(por('Kumho').modelos, ['KU31']))
  r = await api('POST', '/ajustes/alcance', { reglas: [{ marca: 'Sportrak', modelo: '' }, { marca: 'sportrak', modelo: 'SP716' }, { marca: 'Milemax', modelo: 'SP716' }, { marca: '', modelo: '' }] })
  ok('cuenta a cuántos cauchos alcanza cada regla (0 si no coincide)', () => assert.deepEqual(r.j.alcance, [4, 2, 0, 0]))
  const sin2 = await fetch(base + '/admin/api/ajustes/opciones'); ok('las listas exigen la clave del panel', () => assert.equal(sin2.status, 401))

  // 8) inventario nuevo: una pestaña por categoría, columnas por encabezado, compatibilidad con una columna por marca de batería
  const libro = new ExcelJS.Workbook()
  const hoja = (nombre, filas) => { const w = libro.addWorksheet(nombre); filas.forEach(f => w.addRow(f)) }
  hoja('INVENTARIO CAUCHOS', [['CODIGO CM', 'CODIGO MC', 'MEDIDA', 'MARCA', 'MODELO', 'TIPO', 'LONAS', 'Precio', 'Bs', 'CM', 'MC', 'TOTAL INVENTARIO', 'COSTE DE MONTURA', 'SERVICIOS', 'GARANTIA', 'CONSTRUCCION', 'INDICE DE CARGA', 'INDICE DE CARGA DUAL', 'CODIGO DE VELOCIDAD', 'PRESION MAXIMA', 'TL/TT'],
    ['C1', '', '265/60R18', 'Habilead', 'RS21', 'AT', '10 Pr', 120, 126, 2, 0, 2, 10, 'Válvula nueva\nBalanceo', '1 año', 'Radial', 114, '', 'T', '51 psi', 'TL'],
    ['', '', '235/75R15', 'Sportrak', '', 'HT', '', 90, 95]])
  hoja('DIMENSIONES DE CAUCHOS', [['MEDIDA', 'ANCHO', 'ALTO', 'DIAMETRO'], ['165/65/13', '16,5 cm', '54,5 cm', '33 cm (13 in)'], ['265/60/18', '26,5 cm', '79,5 cm', '45,7 cm (18 in)']])
  hoja('INVENTARIO DE BATERIA', [['CODIGO CM', 'CODIGO MC', 'MARCA', 'MODELO', 'NOMENCLATURA', 'POSICION', 'AMP', 'PRECIO', 'BS', 'CM', 'MC', 'TOTAL INVENTARIO', 'SERVICIO', 'GARANTIA', 'CHATARRA DIVISA', 'CHATARRA BS', 'ANCHO', 'LARGO', 'ALTO', 'VOLTAJE'],
    ['B1', '', 'Fulgor Black', 24, 'BORNE', 'Derecha', 800, 100, 105, 3, 0, 3, 'Instalación gratis', 12, 10, 11, '24 cm', '17 cm', '19 cm', '12 V'],
    ['B2', '', 'Duncan', '4D', '', '', 1300, 140, 147, 1, 0, 1], ['B3', '', 'Velko Basank', 34, '', '', 700, 90, 95, 2, 0, 2]])
  hoja('INVENTARIO DE ACEITES', [['CODIGO CM', 'CODIGO MC', 'Aceite', 'Combo', 'Marca', 'Precio', 'Bs'], ['A1', '', '20W-50', '4 Litros', 'Mobil', 30, 32, 5], ['', 'A2', '2 Tiempos', 'Litro', 'Oilven', 8, 9]])
  hoja('OTROS ARTICULOS', [['CODIGO CM', 'CODIGO MC', 'NOMBRE', 'DESCRIPCION', 'Precio', 'Bs', 'CM', 'MC', 'TOTAL INVENTARIO'], ['O1', '', 'Bujias', 'Champion', 3, 4, 5, 0, 5], [null, null, null, null, null, null], ['O2', '', 'Tuercas de seguridad', 'Set de 4 Tuercas + 1 llave', 20, 21, 2, 0, 2], ['', '', 'Bornes', 'Plomo ', 4, 5]])
  hoja('Copia de BICICLETAS', [['CODIGO MC', 'RIN', 'MODELO', 'PRECIO', 'BS', 'TOTAL INVENTARIO', 'CARACTERISTICAS'], ['K1', 'RIN 20', 'MODELO 130 (NIÑO)', 90, 95, 4, 'Aro de aluminio']])
  hoja('COMPATIBILIDAD', [['MARCA', 'MODELO', 'AÑO DESDE', 'AÑO HASTA', 'POLARIDAD', 'DUNCAN', 'FULGOR', 'FULGOR BLACK', 'FULGOR EVERLITE', 'AMPERAJE MINIMO'],
    ['FORD', 'F-350', 2000, 2010, 'DERECHA', '4D', 24, 34, '', 700], ['TOYOTA', 'COROLLA', 2009, 2019, 'IZQUIERDA', '', '22NF', '22NF', '', ''], ['ACURA', 'X', 2000, 2001, '', '', '', '', '', '']])
  const nuevo = await leerExcel(Buffer.from(await libro.xlsx.writeBuffer()))
  ok('lee las pestañas del inventario nuevo por su nombre (sin confundir DIMENSIONES con cauchos)', () => { assert.equal(nuevo.cauchos.items.length, 1); assert.equal(nuevo.baterias.items.length, 3); assert.equal(nuevo.aceites.items.length, 2); assert.equal(nuevo.bicicletas.items.length, 1) })
  ok('un caucho sin código no se publica y se avisa', () => assert.ok(nuevo.cauchos.omitidas.some(o => /235\/75R15 Sportrak \(sin código/.test(o))))
  const c1 = nuevo.cauchos.items[0]
  ok('cauchos: columnas nuevas como especificaciones y servicios del producto', () => { assert.equal(c1.modelo, 'RS21'); assert.equal(c1.lonas, 10); assert.deepEqual(c1.servicios, ['Válvula nueva', 'Balanceo']); assert.deepEqual(c1.espec.map(x => x.k), ['Ancho', 'Alto', 'Diámetro', 'Costo de montura', 'Garantía', 'Construcción', 'Índice de carga', 'Código de velocidad', 'Presión máxima', 'TL/TT']) })
  ok('cauchos: las dimensiones de su medida van primero en las especificaciones (265/60R18 = 265/60/18)', () => { assert.deepEqual(c1.espec.slice(0, 3), [{ k: 'Ancho', v: '26,5 cm' }, { k: 'Alto', v: '79,5 cm' }, { k: 'Diámetro', v: '45,7 cm (18 in)' }]); assert.equal(c1.espec[3].k, 'Costo de montura') })
  ok('otros artículos: NOMBRE queda como artículo y DESCRIPCION como descripción; separadores y filas sin código no cuentan', () => { assert.equal(nuevo.otros.items.length, 2); assert.deepEqual([nuevo.otros.items[0].marca, nuevo.otros.items[0].descripcion, nuevo.otros.items[0].sku], ['Bujias', 'Champion', 'CM-O1']); assert.ok(nuevo.otros.omitidas.some(o => /Bornes Plomo \(sin código/.test(o))) })
  const cw = aCatalogo({ otros: nuevo.otros.items }).otros
  ok('el catálogo de la web lleva «otros» con artículo (m) y descripción (d)', () => { assert.equal(cw.length, 2); assert.deepEqual(cw.map(x => [x.m, x.d, x.u]).sort(), [['Bujias', 'Champion', 3], ['Tuercas de seguridad', 'Set de 4 Tuercas + 1 llave', 20]]) })
  const b1 = nuevo.baterias.items[0]
  ok('baterías: el grupo sale de la columna MODELO (24 y no 24.0), con garantía, chatarra y medidas', () => { assert.equal(b1.grupo, '24'); assert.equal(b1.amp, 800); assert.equal(b1.descripcion, '800 AMP / BORNE / Derecha'); assert.equal(b1.garantia, 12); assert.deepEqual(b1.chatarra, { usd: 10, bs: 11 }); assert.equal(b1.espec.find(x => x.k === 'Voltaje').v, '12 V'); assert.deepEqual(b1.servicios, ['Instalación gratis']) })
  ok('aceites: la presentación sale de COMBO; el código MC también sirve', () => { assert.equal(nuevo.aceites.items[0].presentacion, '4 Litros'); assert.equal(nuevo.aceites.items[1].sku, 'MC-A2'); assert.equal(nuevo.aceites.items[1].stock.tienda_2, 0) })
  ok('bicicletas: rin, modelo y para salen del texto; el total es de la tienda del código', () => { const b = nuevo.bicicletas.items[0]; assert.equal(b.rin, 20); assert.equal(b.modelo, '130'); assert.equal(b.para, 'NIÑO'); assert.equal(b.stock.tienda_2, 4) })
  const sinCod = await leerExcel(Buffer.from(await libro.xlsx.writeBuffer()), { sinCodigo: true })
  ok('con sinCodigo las filas sin código se cargan como «hay» y sin código, y las de antes no cambian', () => { const x = sinCod.cauchos.items.find(i => i.marca === 'Sportrak'); assert.ok(x && !x.codigo_cm && x.sku.startsWith('FILA-')); assert.equal(x.stock.tienda_1, 5); assert.equal(sinCod.cauchos.items.find(i => i.marca === 'Habilead').stock.tienda_1, 2) })
  const f350 = nuevo.compatibilidad.items.find(x => x.modelo === 'F-350')
  ok('compatibilidad: una columna por marca de batería, con polaridad y amperaje mínimo', () => { assert.deepEqual(f350.grupos, { DUNCAN: '4D', FULGOR: '24', FULGORBLACK: '34' }); assert.equal(f350.polaridad, 'DERECHA'); assert.equal(f350.amp_min, 700); assert.equal(f350.grupo, '4D, 24, 34') })
  ok('un vehículo sin grupo en ninguna marca se omite', () => assert.ok(nuevo.compatibilidad.omitidas.some(o => /ACURA X/.test(o))))
  const bufLibro = Buffer.from(await libro.xlsx.writeBuffer()), post = q => fetch(base + '/admin/api/excel/revisar' + q, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: bufLibro }).then(async r => ({ s: r.status, j: await r.json() }))
  const rechazo = await post('')
  ok('sin códigos el panel normal sigue rechazando el archivo', () => { assert.equal(rechazo.s, 200); assert.equal(rechazo.j.cauchos.total, 1); assert.ok(rechazo.j.cauchos.omitidas.some(o => /sin código/.test(o))) })
  const vp = await post('?sincodigo=1'), pub = await api('POST', '/excel/publicar')
  ok('?sincodigo=1 muestra todo el archivo (con ejemplos) y no deja nada pendiente de publicar', () => { assert.equal(vp.j.cauchos.total, 2); assert.equal(vp.j.cauchos.vista_previa, true); assert.ok(vp.j.cauchos.muestra.length && vp.j.cauchos.con_espec >= 1); assert.equal(pub.s, 400) })
  const fv = await api('GET', '/excel/filas/cauchos?filtro=todas&q=habilead')
  ok('la vista previa permite ver las filas de la categoría, con buscador, y sus filas omitidas', async () => {})
  assert.equal(fv.s, 200); assert.deepEqual(fv.j.cab.slice(0, 3), ['Código', 'Medida', 'Marca']); assert.equal(fv.j.filtradas, 1); assert.equal(fv.j.filas[0][2], 'Habilead')
  const sp = await api('GET', '/excel/filas/cauchos?filtro=sin_codigo'), om = await api('GET', '/excel/filas/cauchos?filtro=omitidas')
  ok('filtros de la revisión: sin código y filas que no se publican', () => { assert.equal(sp.j.filtradas, 1); assert.equal(sp.j.filas[0][2], 'Sportrak'); assert.equal(om.s, 200); assert.deepEqual(om.j.cab, ['Fila omitida']); assert.equal(om.j.total, vp.j.cauchos.omitidas.length) })
  await post('')                                                          // revisión real (con códigos), ya no es vista previa
  const antesAceites = (await api('GET', '/aceites/items')).j.length
  const pc = await api('POST', '/excel/publicar', { categorias: ['cauchos'] }), mal = await api('POST', '/excel/publicar', { categorias: ['noexiste'] })
  ok('publica solo la categoría confirmada y las demás siguen pendientes', async () => {})
  assert.equal(pc.s, 200); assert.deepEqual(pc.j.restantes.sort(), ['aceites', 'baterias', 'bicicletas', 'compatibilidad', 'otros']); assert.equal((await api('GET', '/cauchos/items')).j.length >= 1, true)
  assert.equal((await api('GET', '/aceites/items')).j.length, antesAceites); assert.equal(mal.s, 400)
  const f2 = await api('GET', '/excel/filas/aceites'), f3 = await api('GET', '/excel/filas/cauchos')
  ok('lo publicado sale de la revisión; lo demás sigue disponible para revisar', () => { assert.equal(f2.s, 200); assert.equal(f3.s, 404) })
  const { esCoherente, ajustarEuro } = await import(pathToFileURL(path.join(aqui, '../src/tasa.js')).href)
  ok('la tasa del euro se descarta si no es coherente con el dólar (1,006 con dólar a 894)', () => { assert.equal(esCoherente(1.006, 894.89), false); assert.equal(esCoherente(1040, 894.89), true); assert.equal(esCoherente(999.77, 894.89), true); assert.equal(esCoherente(1000, 0), true) })
  ok('el euro sin separador de miles (1,006) se corrige a 1.006; un dato absurdo se descarta', () => { assert.equal(ajustarEuro(1.006, 894.89), 1006); assert.equal(ajustarEuro(1040, 894.89), 1040); assert.equal(ajustarEuro(5, 894.89), null); assert.equal(ajustarEuro(1.006, 0), 1006) })
  // 8b) una categoría sin ninguna fila publicable (p. ej. sin códigos) no se puede publicar: vaciaría la lista actual
  const libroSinCodigo = new ExcelJS.Workbook(), wsS = libroSinCodigo.addWorksheet('INVENTARIO CAUCHOS')
  wsS.addRow(['CODIGO CM', 'CODIGO MC', 'MEDIDA', 'MARCA', 'MODELO', 'TIPO', 'LONAS', 'Precio', 'Bs']); wsS.addRow(['', '', '195/65R15', 'Marca X', '', 'HT', '', 50, 53])
  const wsA = libroSinCodigo.addWorksheet('INVENTARIO DE ACEITES'); wsA.addRow(['CODIGO CM', 'CODIGO MC', 'Aceite', 'Combo', 'Marca', 'Precio', 'Bs']); wsA.addRow(['AX1', '', '20W-50', 'Litro', 'Mobil', 9, 10])     // con otra hoja válida el archivo se revisa, y cauchos queda con 0 filas publicables
  const bufSin = Buffer.from(await libroSinCodigo.xlsx.writeBuffer())
  await fetch(base + '/admin/api/excel/revisar', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: bufSin })
  const vacio = await api('POST', '/excel/publicar', { categorias: ['cauchos'] }), cauchosAntes = (await api('GET', '/cauchos/items')).j.length
  ok('publicar una categoría sin filas publicables se rechaza con un mensaje y no vacía la lista', () => { assert.equal(vacio.s, 400); assert.match(vacio.j.error, /ninguna fila del archivo se puede publicar/); assert.ok(cauchosAntes >= 1) })
  await post('')

  // 9) volver a cargar el Excel con otro precio avisa qué cambia y marca lo que el administrador había editado a mano
  const marca0 = (await api('GET', '/cauchos/items')).j.find(x => x.sku === 'CM-C1')
  await api('PATCH', '/cauchos/items/CM-C1', { usd: 130 })                  // edición a mano en el panel
  const hojaC = libro.getWorksheet('INVENTARIO CAUCHOS'); hojaC.getCell('H2').value = 125; hojaC.getCell('I2').value = 131
  const bufNuevo = Buffer.from(await libro.xlsx.writeBuffer())
  const rv = await fetch(base + '/admin/api/excel/revisar', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: bufNuevo }).then(async r => ({ s: r.status, j: await r.json() }))
  const fm = await api('GET', '/excel/filas/cauchos?filtro=a_mano'), fc = await api('GET', '/excel/filas/cauchos?filtro=cambiados'), fs0 = await api('GET', '/excel/filas/cauchos?filtro=sin_codigo')
  ok('al volver a cargar con otro precio, el panel dice qué cambia en ese código y que se había editado a mano', () => {
    assert.equal(marca0.codigo_cm, 'C1'); assert.equal(rv.s, 200); const c = rv.j.cauchos
    assert.equal(c.cambiados.length, 1); assert.equal(c.cambiados[0].codigo, 'C1'); assert.ok(c.cambiados[0].cambios.includes('Precio: REF 130 → REF 125')); assert.equal(c.a_mano, 1); assert.equal(c.cambiados[0].a_mano, true)
    assert.deepEqual(c.precios, ['Habilead 265/60R18: REF 130 → REF 125']) })
  ok('las filas del archivo traen la columna «Qué cambia» y se filtran por cambiados o editados a mano', () => { assert.equal(fm.j.filtradas, 1); assert.equal(fm.j.cab.at(-1), 'Qué cambia'); assert.match(fm.j.filas[0].at(-1), /Precio: REF 130 → REF 125/); assert.equal(fc.j.filtradas, 1); assert.equal(fs0.j.filtradas, 0) })
  hojaC.getCell('H2').value = 120; hojaC.getCell('I2').value = 126          // se deja el libro como estaba para las pruebas siguientes
  await post('')

  const fetchReal = globalThis.fetch; let apiBCV = 'ok'                    // simula la API del BCV (ok / caída) sin salir a internet
  globalThis.fetch = (u, o) => (String(u).includes('dolarapi') ? (apiBCV === 'ok' ? Promise.resolve({ json: async () => ({ promedio: String(u).includes('euros') ? 1006.0326 : 894.8876, fechaActualizacion: '2026-11-05T00:00:00-04:00' }) }) : Promise.reject(new Error('sin red'))) : fetchReal(u, o))
  // 10) precios y existencias propios de Caracas: archivo de Caracas (CODIGO CCS), selector de tienda, Maracay intacto
  const libroC = new ExcelJS.Workbook(), wsC = libroC.addWorksheet('INVENTARIO CAUCHOS')
  wsC.addRow(['CODIGO CCS', 'MEDIDA', 'MARCA', 'MODELO', 'TIPO', 'LONAS', 'Precio', 'Bs', 'CCS'])
  wsC.addRow(['K1', '265/60R18', 'Habilead', 'RS21', 'AT', '10 Pr', 150, 158, 4]); wsC.addRow(['K2', '225/65R17', 'Marca Z', 'Z1', 'HT', '', 80, 84, 2])
  const bufC = Buffer.from(await libroC.xlsx.writeBuffer()), postC = q => fetch(base + '/admin/api/excel/revisar?tienda=caracas' + q, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: bufC }).then(async r => ({ s: r.status, j: await r.json() }))
  const maracayAntes = (await api('GET', '/cauchos/items')).j.find(x => x.sku === 'CM-C1')
  const rc = await postC('')
  ok('el archivo de Caracas se revisa aparte: empareja Habilead por sus datos, crea Marca Z solo para Caracas y muestra qué cambia', () => {
    assert.equal(rc.s, 200); const c = rc.j.cauchos; assert.equal(c.total, 2); assert.equal(c.nuevos.length, 1); assert.match(c.nuevos[0], /Marca Z/); assert.equal(c.cambiados.length, 1)
    assert.ok(c.cambiados[0].cambios.some(x => /Precio en Caracas: por consultar → REF 150/.test(x))); assert.ok(c.cambiados[0].cambios.some(x => /Existencia Caracas: \(vacío\) → 4/.test(x))) })
  const pubC = await api('POST', '/excel/publicar', { categorias: ['cauchos'] }), lc = (await api('GET', '/cauchos/items')).j
  const hab = lc.find(x => x.sku === 'CM-C1'), marcaZ = lc.find(x => x.marca === 'Marca Z')
  ok('publicar el archivo de Caracas pone su precio y existencia sin tocar los de Maracay y crea lo que solo vende Caracas', () => {
    assert.equal(pubC.s, 200); assert.equal(hab.usd_c, 150); assert.equal(hab.usd_bs_c, 158); assert.equal(hab.cc, 4); assert.equal(hab.codigo_ccs, 'K1'); assert.equal(hab.usd, maracayAntes.usd); assert.equal(hab.cm, maracayAntes.cm)
    assert.equal(marcaZ.solo, 'caracas'); assert.equal(marcaZ.usd, 0); assert.equal(marcaZ.usd_c, 80) })
  const wcat = catalogo().cauchos
  ok('la web recibe el precio de Caracas (uc, bc) y marca el producto que solo vende Caracas (sc)', () => { const w = wcat.find(x => x.z === '265/60R18'); assert.equal(w.uc, 150); assert.equal(w.bc, 158); assert.equal(w.u, maracayAntes.usd); assert.equal(wcat.find(x => x.m === 'Marca Z').sc, 1) })
  const rcCar = await ejecutar('buscar_cauchos', { tienda: 'caracas', medida: '265/60R18' }, { conversationId: 0 }).catch(e => ({ error: e.message })), rcMar = await ejecutar('buscar_cauchos', { tienda: 'maracay', medida: '265/60R18' }, { conversationId: 0 }).catch(e => ({ error: e.message }))
  const zMar = await ejecutar('buscar_cauchos', { tienda: 'maracay', medida: '225/65R17' }, { conversationId: 0 }).catch(e => ({ error: e.message }))
  ok('Nexo usa el precio de la ciudad del cliente y no ofrece en Maracay lo que solo vende Caracas', () => {
    assert.equal(rcCar.resultados[0].pagando_en_dolares_usd, 150); assert.equal(rcMar.resultados[0].pagando_en_dolares_usd, maracayAntes.usd); assert.equal(zMar.total_coincidencias ?? zMar.resultados?.length ?? 0, 0) })
  await post('')                                                          // recargar Maracay no borra lo de Caracas
  await api('POST', '/excel/publicar', { categorias: ['cauchos'] }); const trasMaracay = (await api('GET', '/cauchos/items')).j
  ok('recargar el archivo de Maracay conserva el precio, la existencia y el código de Caracas, y el producto solo de Caracas', () => {
    const h = trasMaracay.find(x => x.sku === 'CM-C1'); assert.equal(h.usd_c, 150); assert.equal(h.cc, 4); assert.equal(h.codigo_ccs, 'K1'); assert.ok(trasMaracay.some(x => x.marca === 'Marca Z' && x.solo === 'caracas')) })
  await post('')
  const pc2 = await api('PATCH', '/cauchos/items/CM-C1', { usd_c: 160 }), pc3 = await api('PATCH', '/cauchos/items/CM-C1', { usd_c: '' })
  ok('desde el panel se edita el precio de Caracas (el equivalente en bolívares se calcula) y vaciarlo lo quita', () => { assert.equal(pc2.j.usd_c, 160); assert.equal(pc2.j.usd_bs_c, 168); assert.equal(pc3.j.usd_c, '') })
  await postC(''); await api('POST', '/excel/publicar', { categorias: ['cauchos'] })
  const rc2 = await postC('')
  ok('volver a subir el mismo archivo de Caracas no marca cambios', () => assert.equal(rc2.j.cauchos.cambiados.length, 0))

  const t1 = await api('PUT', '/tasas', { euro: '1006,03', dolar: 894.89 }), cj = catalogo()
  ok('el administrador fija la tasa de hoy: queda en uso, vale para Nexo y viaja a la web en catalogo.json', () => { assert.equal(t1.s, 200); assert.equal(t1.j.euro.en_uso.rate, 1006.03); assert.equal(t1.j.euro.en_uso.fuente, 'fijada a mano'); assert.equal(t1.j.dolar.manual.valor, 894.89); assert.equal(cj.tasas.euro.valor, 1006.03); assert.equal(cj.tasas.euro.fecha, new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })) })
  const t2 = await api('PUT', '/tasas', { euro: 5 }), t3 = await api('GET', '/tasas'), t5 = await api('PUT', '/tasas', { euro: 'abc' })
  ok('una tasa incoherente o inválida se rechaza y no cambia nada', () => { assert.equal(t2.s, 400); assert.match(t2.j.error, /coherentes/); assert.equal(t3.j.euro.en_uso.rate, 1006.03); assert.equal(t5.s, 400) })
  await api('PUT', '/tasas', { euro: 1010 }); apiBCV = 'caida'
  const t6 = await api('PUT', '/tasas', { euro: null, actualizar: true }), t7 = await api('GET', '/tasas'); apiBCV = 'ok'
  ok('«Actualizar del BCV» con la API caída avisa con un mensaje y conserva la tasa fijada', () => { assert.equal(t6.s, 400); assert.match(t6.j.error, /API del BCV/); assert.equal(t7.j.euro.manual.valor, 1010); assert.equal(t7.j.euro.api, null) })
  const t4 = await api('PUT', '/tasas', { euro: null, dolar: null, actualizar: true })
  ok('«Actualizar del BCV»: quita la tasa fijada, vuelve a consultar la API y la web ya no recibe la fijada', () => { assert.equal(t4.s, 200); assert.equal(t4.j.euro.manual, null); assert.equal(t4.j.euro.en_uso.fuente, 'BCV'); assert.equal(catalogo().tasas.euro, null) })
  const { gruposDe } = await import(pathToFileURL(path.join(aqui, '../src/lista.js')).href)
  ok('una batería grupo 30HCT también sirve a un vehículo que pide 30H (y no al revés con otros grupos)', () => { assert.deepEqual(gruposDe('30HCT'), ['30HCT', '30H']); assert.deepEqual(gruposDe('GRUPO 30H'), ['30H']); assert.deepEqual(gruposDe('24, 34'), ['24', '34']); assert.ok(gruposDe('30HCT').some(g => gruposDe('30H').includes(g))) })
  const { gruposParaBateria, marcasConGrupos } = await import(pathToFileURL(path.join(aqui, '../src/lista.js')).href), conDatos = marcasConGrupos(nuevo.compatibilidad.items)
  ok('el grupo depende de la marca de la batería (la más específica) y, sin columna, no se recomienda por vehículo', () => {
    assert.deepEqual(gruposParaBateria(f350, 'Fulgor Black', conDatos), ['34']); assert.deepEqual(gruposParaBateria(f350, 'Fulgor', conDatos), ['24']); assert.deepEqual(gruposParaBateria(f350, 'Duncan Quattro', conDatos), ['4D'])
    assert.deepEqual(gruposParaBateria(f350, 'Velko Basank', conDatos), []); assert.deepEqual(gruposParaBateria(f350, 'Fulgor Everlite', conDatos), [])
    assert.deepEqual(gruposParaBateria(f350, 'Fulgor Everlite', new Set([...conDatos, 'FULGOREVERLITE'])), []) })   // con su propia columna vacía tampoco hereda
  fs.writeFileSync(path.join(tmp, 'data', 'compatibilidad.json'), JSON.stringify(nuevo.compatibilidad.items))
  fs.writeFileSync(path.join(tmp, 'data', 'baterias.json'), JSON.stringify(nuevo.baterias.items))
  const cat = aCatalogo({ baterias: nuevo.baterias.items, compatibilidad: nuevo.compatibilidad.items })
  ok('el catálogo de la web lleva los grupos por marca y las especificaciones de la batería', () => { assert.deepEqual(cat.compatibilidad.find(x => x.d === 'F-350').m, { DUNCAN: ['4D'], FULGOR: ['24'], FULGORBLACK: ['34'] }); assert.equal(cat.baterias.find(x => x.g === '24').e.Voltaje, '12 V') })
  const rb = await ejecutar('buscar_baterias', { tienda: 'maracay', vehiculo_marca: 'Ford', vehiculo_modelo: 'F-350', anio: 2005 }, { conversationId: 0 }).catch(e => ({ error: e.message }))
  ok('Nexo, para una F-350: ofrece solo la Duncan 4D (la Velko no tiene columna: no se recomienda por vehículo) y no la Fulgor Black grupo 24', () => {
    assert.ok(!rb.error, rb.error); assert.deepEqual(rb.resultados.map(x => x.marca).sort(), ['Duncan']); assert.deepEqual(rb.compatibilidad?.grupo_segun_marca_de_bateria?.DUNCAN, ['4D']) })
  const vc = await api('GET', '/compatibilidad/items'), vf = (vc.j || []).find(x => x.modelo === 'F-350')
  ok('el panel muestra el grupo de cada marca de batería en «Vehículos → batería»', () => { assert.equal(vc.s, 200); assert.ok(vf, 'F-350 en la vista'); assert.match(vf.por_marca, /Duncan: 4D/); assert.match(vf.por_marca, /Fulgor: 24/); assert.match(vf.por_marca, /Fulgor Black: 34/) })
  const { sirvePolaridad, polaridadDe } = await import(pathToFileURL(path.join(aqui, '../src/lista.js')).href)
  ok('polaridad: el vehículo y la batería deben coincidir, salvo en los grupos 30H, 30HCT, 4D y 8D o si falta el dato', () => {
    assert.equal(polaridadDe('1100 AMP / MR / DERECHA'), 'DERECHA'); assert.equal(polaridadDe('1100 AMP / BORNE'), '')
    assert.equal(sirvePolaridad('DERECHA', '24', '1100 AMP / MR / DERECHA'), true); assert.equal(sirvePolaridad('DERECHA', '24', '1100 AMP / IZQUIERDA'), false); assert.equal(sirvePolaridad('IZQUIERDA', '34', '900 AMP / DERECHA'), false)
    for (const g of ['30H', '30HCT', '4D', '8D']) assert.equal(sirvePolaridad('DERECHA', g, '1300 AMP / IZQUIERDA'), true)
    assert.equal(sirvePolaridad('', '24', '1100 AMP / IZQUIERDA'), true); assert.equal(sirvePolaridad('DERECHA', '24', '1100 AMP / BORNE'), true)
    assert.equal(cat.compatibilidad.find(x => x.d === 'F-350').p, 'DERECHA') })
  const catS = aCatalogo({ baterias: [{ ...nuevo.baterias.items[0], servicios: ['Instalación gratis', '-Montaje'], espec: [{ k: 'Largo', v: '260' }, { k: 'Voltaje', v: '12 V' }] }] })
  ok('la tarjeta de batería recibe sus servicios del inventario (sin los generales de cauchos) y sus especificaciones', () => { assert.deepEqual(catS.baterias[0].sv, ['Instalación gratis']); assert.equal(catS.baterias[0].e.Largo, '260') })
  // 10b) carga manual con los mismos datos que trae el Excel (códigos, servicios, especificaciones, polaridad, chatarra, grupos por marca…)
  const bBase = { marca: 'Fulgor', usd: 90, cm: 2, mc: 0, codigo_cm: 'ZZ-001', codigo_mc: 'ZM-001', codigo_ccs: 'ZC-001' }
  const bm = await api('POST', '/baterias/items', { ...bBase, descripcion: '1000 AMP', grupo: '24', polaridad: 'DERECHA', servicios: 'Instalación gratis\nPrueba de carga', espec: 'Largo: 260\nAncho: 173\nAlto: 225\nVoltaje: 12 V', chatarra_usd: 8, chatarra_bs: 400, garantia: 12 })
  const bmv = (await api('GET', '/baterias/items')).j.find(x => x.sku === bm.j.sku)
  ok('batería a mano: guarda códigos, polaridad (en la descripción), servicios, especificaciones y chatarra, y los devuelve para editar', () => { assert.equal(bm.s, 200); assert.equal(bmv.descripcion, '1000 AMP / DERECHA'); assert.equal(bmv.polaridad, 'DERECHA'); assert.equal(bmv.codigo_mc, 'ZM-001'); assert.equal(bmv.codigo_ccs, 'ZC-001'); assert.equal(bmv.servicios, 'Instalación gratis\nPrueba de carga'); assert.match(bmv.espec, /Largo: 260/); assert.equal(bmv.chatarra_usd, 8) })
  const wbat = catalogo().baterias.find(x => x.g === '24' && x.e?.Largo === '260')
  ok('la web recibe de esa batería los servicios, las medidas y la polaridad', () => { assert.ok(wbat); assert.deepEqual(wbat.sv, ['Instalación gratis', 'Prueba de carga']); assert.match(wbat.d, /DERECHA/) })
  const dupc = await api('POST', '/baterias/items', { ...bBase, descripcion: '800 AMP', grupo: '34' }), badPol = await api('POST', '/baterias/items', { ...bBase, codigo_cm: 'ZZ-002', codigo_mc: '', codigo_ccs: '', descripcion: '800 AMP', grupo: '34', polaridad: 'ARRIBA' })
  ok('un código repetido o una polaridad inválida se rechazan con un mensaje claro', () => { assert.equal(dupc.s, 400); assert.match(dupc.j.error, /ya lo tiene otro producto/); assert.equal(badPol.s, 400); assert.match(badPol.j.error, /DERECHA o IZQUIERDA/) })
  const ed = await api('PUT', `/baterias/items/${bm.j.sku}`, { ...bBase, descripcion: '1000 AMP / DERECHA', grupo: '24', polaridad: 'IZQUIERDA', servicios: '', espec: '', chatarra_usd: '', chatarra_bs: '' })
  const edv = (await api('GET', '/baterias/items')).j.find(x => x.sku === bm.j.sku)
  ok('al editar se puede cambiar la polaridad y vaciar servicios, especificaciones y chatarra', () => { assert.equal(ed.s, 200); assert.equal(edv.descripcion, '1000 AMP / IZQUIERDA'); assert.equal(edv.servicios, ''); assert.equal(edv.espec, ''); assert.equal(edv.chatarra_usd, '') })
  const cm = await api('POST', '/compatibilidad/items', { marca: 'zzmarca', modelo: 'prueba', desde: 2010, hasta: 2015, grupo: '', polaridad: 'IZQUIERDA', amp_min: 600, grupos: 'Fulgor: 24\nMarussi Plus: 34' })
  const cmv = (await api('GET', '/compatibilidad/items')).j.find(x => x.sku === cm.j.sku), cmw = catalogo().compatibilidad.find(x => x.o === 'ZZMARCA')
  ok('vehículo a mano: grupo por marca, polaridad y amperaje mínimo (el grupo general sale de las marcas)', () => { assert.equal(cm.s, 200); assert.equal(cmv.polaridad, 'IZQUIERDA'); assert.equal(cmv.amp_min, 600); assert.match(cmv.grupos, /Fulgor: 24/); assert.deepEqual(cmw.m, { FULGOR: ['24'], MARUSSIPLUS: ['34'] }); assert.equal(cmw.p, 'IZQUIERDA'); assert.equal(cmw.g.join(','), '24,34') })
  const bi = await api('POST', '/bicicletas/items', { marca: 'Bicicleta', usd: 100, cm: 1, mc: 0, rin: 20, modelo: '999', caracteristicas: 'Aluminio, frenos V-brake' })
  const cmE = await api('PUT', `/compatibilidad/items/${cm.j.sku}`, { marca: 'zzmarca', modelo: 'prueba', desde: 2010, hasta: 2015, grupo: '24, 34', polaridad: 'IZQUIERDA', amp_min: 600, grupos: 'Fulgor: 24\nDuncan: 4D' })
  const cmM = await api('GET', '/compatibilidad/marcas'), cmQ = await api('PUT', `/compatibilidad/items/${cm.j.sku}`, { marca: 'zzmarca', modelo: 'prueba', grupo: '24', grupos: '' })
  ok('al editar las marcas de un vehículo el grupo general se actualiza solo; se pueden quitar todas; la lista de marcas ofrece las conocidas', () => { assert.equal(cmE.s, 200); assert.equal(cmE.j.grupo, '24, 4D'); assert.match(cmE.j.grupos, /Duncan: 4D/); assert.ok(!/Marussi/.test(cmE.j.grupos)); assert.equal(cmQ.s, 200); assert.equal(cmQ.j.grupos, ''); assert.equal(cmQ.j.grupo, '24'); assert.ok(cmM.j.marcas.includes('Fulgor')) })
  const biv = (await api('GET', '/bicicletas/items')).j.find(x => x.sku === bi.j.sku)
  ok('bicicleta a mano: guarda las características', () => { assert.equal(bi.s, 200); assert.equal(biv.caracteristicas, 'Aluminio, frenos V-brake') })
  // 10c) explicaciones de las especificaciones (columna W del inventario de cauchos) y dibujo del caucho
  const { ayudasDeHoja, AYUDAS_BASE } = await import(pathToFileURL(path.join(aqui, '../src/lista.js')).href)
  const libroW = new ExcelJS.Workbook(), hojaW = libroW.addWorksheet('INVENTARIO CAUCHOS')
  ;['Índice de carga:', 'Carga máxima que soporta.', 'Código de velocidad:', 'Velocidad máxima.', 'TL = Tubeless', 'No requiere tripa.', 'TT = Tube Type', 'Requiere tripa.'].forEach((t, i) => { hojaW.getCell(i + 1, 23).value = t })
  const ayW = ayudasDeHoja(hojaW)
  ok('la columna W se lee como pares título/explicación, con TL y TT juntos', () => { assert.equal(ayW['Índice de carga'], 'Carga máxima que soporta.'); assert.equal(ayW['Código de velocidad'], 'Velocidad máxima.'); assert.match(ayW['TL/TT'], /TL = Tubeless: No requiere tripa\. TT = Tube Type: Requiere tripa\./) })
  const ajA = await api('GET', '/ajustes')
  ok('sin tocar nada, la web recibe las explicaciones de la hoja del cliente', () => { assert.deepEqual(ajA.j.ayudas_espec, AYUDAS_BASE); assert.deepEqual(catalogo().ajustes.ayudas_espec, AYUDAS_BASE) })
  const ajB = await api('PUT', '/ajustes', { servicios_compra: '', combo_detalle: '', ayudas_espec: 'Índice de carga: Texto nuevo\nVoltaje: Tensión de la batería.' })
  const ajC = await api('PUT', '/ajustes', { servicios_compra: '', combo_detalle: '' }), ajD = await api('PUT', '/ajustes', { servicios_compra: '', ayudas_espec: 'sin dos puntos' })
  ok('el administrador edita las explicaciones; si guarda sin enviarlas se conservan; una línea mal escrita se rechaza', () => { assert.equal(ajB.s, 200); assert.equal(ajB.j.ayudas_espec['Índice de carga'], 'Texto nuevo'); assert.equal(catalogo().ajustes.ayudas_espec.Voltaje, 'Tensión de la batería.'); assert.equal(ajC.j.ayudas_espec['Índice de carga'], 'Texto nuevo'); assert.equal(ajD.s, 400); assert.match(ajD.j.error, /Nombre: explicación/) })
  await api('PUT', '/ajustes', { servicios_compra: '', combo_detalle: '', ayudas_espec: Object.entries(AYUDAS_BASE).map(([k, t]) => `${k}: ${t}`).join('\n') })
  // 11) carrusel de marcas: el administrador elige las marcas, sube el logo y fija el orden
  const car0 = await api('GET', '/carrusel')
  ok('sin configurar, el carrusel se arma solo con las marcas conocidas que hay en la lista', () => { assert.equal(car0.s, 200); assert.equal(car0.j.cauchos.personalizado, false); assert.ok(car0.j.cauchos.marcas.some(x => x.marca === 'Habilead')); assert.deepEqual(Object.keys(car0.j), ['cauchos', 'baterias', 'aceites']) })
  const raw = (ruta, cuerpo) => fetch(base + '/admin/api' + ruta, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }, body: cuerpo }).then(async r => ({ s: r.status, j: await r.json() }))
  const logo = await raw('/carrusel/imagen', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])), notImg = await raw('/carrusel/imagen', Buffer.from('no soy una imagen'))
  ok('se sube un logo PNG y se rechaza lo que no es una imagen', () => { assert.equal(logo.s, 200); assert.match(logo.j.imagen, /^[0-9a-f]{16}\.png$/); assert.ok(fs.existsSync(path.join(tmp, 'data', 'imagenes', logo.j.imagen))); assert.equal(notImg.s, 400) })
  const guardado = await api('PUT', '/carrusel/cauchos', { marcas: [{ marca: 'Habilead', imagen: logo.j.imagen, visible: true }, { marca: 'Sportrak', imagen: null, visible: false }, { marca: 'Marca Z', imagen: null }] })
  const wc = catalogo().carrusel
  ok('el carrusel guardado queda en ese orden y la web recibe solo las marcas visibles, con la URL del logo', () => {
    assert.equal(guardado.s, 200); assert.equal(guardado.j.personalizado, true); assert.deepEqual(wc.cauchos.map(x => x.m), ['Habilead', 'Marca Z']); assert.ok(wc.cauchos[0].i.endsWith('/img/' + logo.j.imagen)); assert.ok(!('i' in wc.cauchos[1])); assert.ok(!('baterias' in wc)) })
  ok('el panel avisa de las marcas del carrusel que no tienen productos en la lista', () => { const m = guardado.j.marcas; assert.equal(m.find(x => x.marca === 'Habilead').sin_productos, false); assert.equal(m.find(x => x.marca === 'Marca Z').sin_productos, true) })
  const dup = await api('PUT', '/carrusel/cauchos', { marcas: [{ marca: 'Habilead' }, { marca: 'habilead' }] }), falso = await api('PUT', '/carrusel/cauchos', { marcas: [{ marca: 'X', imagen: '0000000000000000.png' }] })
  const mucho = await api('PUT', '/carrusel/cauchos', { marcas: Array.from({ length: 41 }, (_, i) => ({ marca: 'M' + i })) }), otra = await api('PUT', '/carrusel/bicicletas', { marcas: [] })
  ok('se rechazan marcas repetidas, logos que no existen, más de 40 marcas y categorías sin carrusel', () => { assert.equal(dup.s, 400); assert.match(dup.j.error, /repetida/); assert.equal(falso.s, 400); assert.match(falso.j.error, /ya no existe/); assert.equal(mucho.s, 400); assert.equal(otra.s, 404) })
  await post(''); await api('POST', '/excel/publicar', { categorias: ['cauchos'] })
  ok('cargar un Excel no borra los logos del carrusel', () => assert.ok(fs.existsSync(path.join(tmp, 'data', 'imagenes', logo.j.imagen))))
  const reset = await api('DELETE', '/carrusel/cauchos')
  ok('«volver al automático» quita el carrusel personalizado y borra el logo que ya no se usa', () => { assert.equal(reset.s, 200); assert.equal(reset.j.personalizado, false); assert.ok(!('cauchos' in catalogo().carrusel)); assert.ok(!fs.existsSync(path.join(tmp, 'data', 'imagenes', logo.j.imagen))) })

  console.log(`\n${n} comprobaciones correctas`)
} finally { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
