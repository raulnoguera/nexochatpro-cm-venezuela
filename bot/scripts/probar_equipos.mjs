// Prueba sin red ni Chatwoot real: simula la API y comprueba a qué equipo va cada bandeja al pasar a un humano.
// Uso: node scripts/probar_equipos.mjs
import assert from 'node:assert/strict'

process.env.CHATWOOT_URL = 'http://chatwoot.simulado'
process.env.CHATWOOT_TOKEN = 'x'
process.env.CHATWOOT_ACCOUNT_ID = '1'
process.env.BOT_EQUIPOS = '9:3'                       // bandeja 9 forzada al equipo 3 aunque su nombre diga otra cosa

const llamadas = []
let fallaEquipos = false
globalThis.fetch = async (url, init = {}) => {
  const p = new URL(url).pathname.replace('/api/v1/accounts/1', '')
  const body = init.body ? JSON.parse(init.body) : undefined
  llamadas.push({ metodo: init.method, p, body })
  const json = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) })
  if (p === '/teams') return fallaEquipos ? { ok: false, status: 500, text: async () => 'boom' } : json([{ id: 1, name: 'cm maracay' }, { id: 2, name: 'master cauchos' }, { id: 3, name: 'cm caracas' }])
  if (/\/assignments$/.test(p)) return json({ id: 1 })
  if (/\/messages$/.test(p) || /\/labels$/.test(p)) return json({ payload: [] })
  throw new Error('llamada inesperada ' + p)
}

const { equipoDeBandeja } = await import('../src/equipos.js')
const { ejecutar } = await import('../src/tools.js')

const master = { tienda: 'maracay', marca: 'Master Cauchos' }
const cmMaracay = { tienda: 'maracay', marca: 'CM Venezuela' }
const cmCaracas = { tienda: 'caracas', marca: 'CM Venezuela' }
const sinEmpresa = { tienda: null, marca: null }

assert.equal(await equipoDeBandeja(2, master), 2, 'Master Cauchos -> equipo master cauchos')
assert.equal(await equipoDeBandeja(5, cmMaracay), 1, 'CM Maracay -> equipo cm maracay')
assert.equal(await equipoDeBandeja(6, cmCaracas), 3, 'CM Caracas -> equipo cm caracas')
assert.equal(await equipoDeBandeja(1, sinEmpresa), null, 'bandeja sin empresa no se asigna')
assert.equal(await equipoDeBandeja(9, master), 3, 'la tabla por id manda sobre el nombre')

// Traspaso completo: nota privada + etiqueta + asignación al equipo
llamadas.length = 0
const ctx = { conversationId: 28, equipo: 2 }
const r = await ejecutar('pasar_a_humano', { motivo: 'prueba' }, ctx)
assert.equal(r.ok, true)
assert.equal(ctx.handoff, true)
const asignacion = llamadas.find(l => /assignments$/.test(l.p))
assert.deepEqual(asignacion, { metodo: 'POST', p: '/conversations/28/assignments', body: { team_id: 2 } })

// Bandeja sin equipo: el traspaso funciona igual y no llama a asignar
llamadas.length = 0
const ctx2 = { conversationId: 29, equipo: null }
assert.equal((await ejecutar('pasar_a_humano', { motivo: 'prueba' }, ctx2)).ok, true)
assert.equal(llamadas.some(l => /assignments$/.test(l.p)), false)

// Si Chatwoot falla al asignar, el cliente igual pasa a humano (no se rompe la conversación)
const fetchOk = globalThis.fetch
globalThis.fetch = async (url, init) => (/assignments/.test(url) ? { ok: false, status: 422, text: async () => 'no' } : fetchOk(url, init))
const ctx3 = { conversationId: 30, equipo: 2 }
assert.equal((await ejecutar('pasar_a_humano', { motivo: 'prueba' }, ctx3)).ok, true)
assert.equal(ctx3.handoff, true)

console.log('Todo bien: 5 comprobaciones de equipo y 3 de traspaso')
