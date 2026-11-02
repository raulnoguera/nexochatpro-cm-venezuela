// Prueba sin red: topes por cliente (hora y día) y tope semanal de gasto. Uso: node scripts/probar_limites.mjs
import assert from 'node:assert/strict'

const { motivoDeFreno, gastoSemana, inicioSemana, estadoPresupuesto } = await import('../src/limites.js')

// Domingo 1 nov 2026, 12:00 en Caracas (UTC-4)
const ahora = Date.parse('2026-11-01T12:00:00-04:00')
const seg = ahora / 1000
const entrantes = (n, haceSegundos) => Array.from({ length: n }, (_, i) => ({ message_type: 0, private: false, created_at: seg - haceSegundos - i }))
const salientes = n => Array.from({ length: n }, () => ({ message_type: 1, private: false, created_at: seg - 30 }))
const sinGasto = { '2026-11-01': { 'gemini-3-flash-preview': { entrada: 100000, cache: 80000, salida: 1000, pensando: 0 } } }

// Semana de lunes a domingo
assert.equal(inicioSemana(ahora), '2026-10-26')
assert.equal(inicioSemana(Date.parse('2026-11-02T00:30:00-04:00')), '2026-11-02')

// Por hora: 15 mensajes de entrada pasan, el 16.º frena (los de salida no cuentan)
assert.equal(motivoDeFreno([...entrantes(15, 60), ...salientes(30)], { datos: sinGasto, ahora }), null)
assert.equal(motivoDeFreno(entrantes(16, 60), { datos: sinGasto, ahora }), 'hora')

// Los mensajes de hace más de una hora no cuentan para el límite por hora, pero sí para el del día
assert.equal(motivoDeFreno(entrantes(16, 2 * 3600), { datos: sinGasto, ahora }), null)
assert.equal(motivoDeFreno([...entrantes(14, 60), ...entrantes(6, 2 * 3600)], { datos: sinGasto, ahora }), null, '20 en el día pasan')
assert.equal(motivoDeFreno([...entrantes(14, 60), ...entrantes(7, 2 * 3600)], { datos: sinGasto, ahora }), 'dia', '21 en el día frenan')

// Los mensajes de ayer no cuentan para el día
assert.equal(motivoDeFreno([...entrantes(10, 60), ...entrantes(30, 20 * 3600)], { datos: sinGasto, ahora }), null)

// Los mensajes privados (notas) no cuentan
assert.equal(motivoDeFreno(entrantes(16, 60).map(m => ({ ...m, private: true })), { datos: sinGasto, ahora }), null)

// Tope semanal: 20 USD. Un día de la semana anterior no cuenta
const caro = v => ({ 'gemini-3-flash-preview': { entrada: v, cache: 0, salida: 0, pensando: 0 } })      // 0,5 USD por millón de entrada
const gastoDe = d => gastoSemana(d, ahora)
assert.ok(Math.abs(gastoDe({ '2026-10-27': caro(10e6), '2026-10-31': caro(10e6) }) - 10) < 1e-9, '20 M de entrada = 10 USD')
assert.equal(gastoDe({ '2026-10-25': caro(1e9) }), 0, 'el domingo anterior ya es otra semana')
assert.equal(motivoDeFreno(entrantes(1, 60), { datos: { '2026-10-28': caro(39e6) }, ahora }), null, '19,5 USD: aún responde')
assert.equal(motivoDeFreno(entrantes(1, 60), { datos: { '2026-10-28': caro(40e6) }, ahora }), 'semana', '20 USD: frena')
assert.equal(motivoDeFreno(entrantes(16, 60), { datos: { '2026-10-28': caro(40e6) }, ahora }), 'semana', 'el tope semanal manda sobre los demás')

const e = estadoPresupuesto({ '2026-10-28': caro(32e6) }, ahora)
assert.equal(e.tope, 20); assert.ok(Math.abs(e.pct - 80) < 1e-9)

console.log('Todo bien: semana, por hora, por día, mensajes privados y tope de gasto')
