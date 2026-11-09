// Acceso al panel de administración: pantalla de inicio de sesión (usuario y clave) con sesión por cookie, y usuarios del cliente.
// - La clave maestra (LISTA_CLAVE) sigue funcionando: con cualquier usuario en la pantalla de login, y con la ventana de clave del navegador (scripts y pruebas).
// - Los usuarios del cliente se guardan en data/usuarios.json con la clave cifrada (scrypt); nunca se guarda ni se muestra la clave.
// - La sesión es una cookie firmada (HttpOnly, SameSite=Lax, solo para /admin) de 30 días; al cambiar la clave de un usuario se cierran sus sesiones.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'

const dir = path.resolve('data')
const COOKIE = 'cm_sesion', DURACION = 30 * 24 * 3600 * 1000
const clave = () => process.env.LISTA_CLAVE
const iguales = (x, y) => { const a = Buffer.from(String(x)), b = Buffer.from(String(y)); return a.length === b.length && crypto.timingSafeEqual(a, b) }
const huella = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 12)
const pausa = ms => new Promise(r => setTimeout(r, ms))

// ---------- usuarios ----------
const archivo = () => path.join(dir, 'usuarios.json')
const leerUsuarios = () => { try { return JSON.parse(fs.readFileSync(archivo(), 'utf8')) } catch { return [] } }
const guardarUsuarios = l => { fs.mkdirSync(dir, { recursive: true }); const f = archivo(); fs.writeFileSync(f + '.tmp', JSON.stringify(l, null, 1), { mode: 0o600 }); fs.renameSync(f + '.tmp', f) }
const cifrar = c => { const sal = crypto.randomBytes(16); return `${sal.toString('hex')}:${crypto.scryptSync(c, sal, 64).toString('hex')}` }
const coincide = (c, guardada) => { const [sal, h] = String(guardada).split(':'); if (!sal || !h) return false; return iguales(crypto.scryptSync(c, Buffer.from(sal, 'hex'), 64).toString('hex'), h) }
const NOMBRE_OK = /^[a-z0-9._-]{3,30}$/
function validarClaveNueva(c) {
  const t = String(c ?? '')
  if (t.length < 8) throw new Error('La clave debe tener al menos 8 caracteres.')
  if (t.length > 100) throw new Error('La clave es demasiado larga (máximo 100 caracteres).')
  return t
}

// ---------- sesión ----------
function secreto() {
  if (process.env.SESION_SECRETO) return process.env.SESION_SECRETO
  const f = path.join(dir, 'sesion.key')
  try { return fs.readFileSync(f, 'utf8').trim() } catch { /* se crea abajo */ }
  fs.mkdirSync(dir, { recursive: true }); const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s, { mode: 0o600 }); return s
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const firma = t => crypto.createHmac('sha256', secreto()).update(t).digest('base64url')
const versionDe = u => (u.rol === 'dueno' ? huella('maestra' + clave()) : huella(u.hash))
function emitir(u) { const p = b64({ u: u.nombre, r: u.rol, v: versionDe(u), e: Date.now() + DURACION }); return `${p}.${firma(p)}` }
function leerSesion(req) {
  const m = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(COOKIE + '='))
  if (!m) return null
  const [p, f] = m.slice(COOKIE.length + 1).split('.')
  if (!p || !f || !iguales(f, firma(p))) return null
  let d; try { d = JSON.parse(Buffer.from(p, 'base64url').toString()) } catch { return null }
  if (!d.e || d.e < Date.now()) return null
  const u = d.r === 'dueno' ? { nombre: d.u, rol: 'dueno' } : leerUsuarios().find(x => x.nombre === d.u)
  if (!u || versionDe(u) !== d.v) return null                    // clave cambiada o usuario quitado: la sesión ya no vale
  return { nombre: u.nombre, rol: u.rol }
}
const seguro = req => req.secure || req.headers['x-forwarded-proto'] === 'https'
const poner = (req, res, valor, maxAge) => res.append('Set-Cookie', `${COOKIE}=${valor}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${seguro(req) ? '; Secure' : ''}`)

// ---------- frenar intentos ----------
const fallos = new Map()
const ipDe = req => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()
const bloqueado = ip => { const f = fallos.get(ip); return f && f.n >= 8 && f.hasta > Date.now() }
const fallar = ip => { const f = fallos.get(ip); fallos.set(ip, { n: f && f.hasta > Date.now() ? f.n + 1 : 1, hasta: Date.now() + 15 * 60 * 1000 }) }

// ---------- middleware ----------
export async function autenticar(req, res, next) {
  if (!clave()) return res.status(404).end()
  const cab = req.headers.authorization || ''
  if (cab.startsWith('Basic ')) {                                                // ventana de clave del navegador, scripts y pruebas
    const [, ...p] = Buffer.from(cab.slice(6), 'base64').toString().split(':')
    if (iguales(p.join(':'), clave())) { req.usuario = { nombre: 'dueño', rol: 'dueno', basica: true }; return next() }
    await pausa(800)
  } else {
    const s = leerSesion(req)
    if (s) {
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-panel'] !== '1') return res.status(403).json({ error: 'Solicitud no permitida desde esta página.' })      // evita que otra web actúe con la sesión abierta
      req.usuario = s; return next()
    }
  }
  if (!req.originalUrl.startsWith('/admin/api') && req.accepts(['html', 'json']) === 'html') return res.redirect('/admin/login?volver=' + encodeURIComponent(req.originalUrl))
  res.status(401).json({ error: 'Inicia sesión para continuar.' })
}
const soloDueno = (req, res, next) => (req.usuario?.rol === 'dueno' ? next() : res.status(403).json({ error: 'Solo el administrador principal puede hacer esto.' }))

// ---------- pantalla de login y salida ----------
const paginaLogin = fs.readFileSync(new URL('./login.html', import.meta.url), 'utf8')
export function montarAcceso(app) {
  app.get('/admin/login', (req, res) => {
    if (clave() && leerSesion(req)) return res.redirect('/admin')
    res.set('Cache-Control', 'no-store').type('html').send(paginaLogin)
  })
  app.post('/admin/login', express.json(), async (req, res) => {
    if (!clave()) return res.status(404).end()
    const ip = ipDe(req)
    if (bloqueado(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' })
    const nombre = String(req.body?.usuario ?? '').trim().toLowerCase(), c = String(req.body?.clave ?? '')
    let u = null
    const guardado = nombre ? leerUsuarios().find(x => x.nombre === nombre) : null
    if (guardado && coincide(c, guardado.hash)) u = guardado
    else if (c && iguales(c, clave())) u = { nombre: nombre || 'dueño', rol: 'dueno' }
    if (!u) { fallar(ip); await pausa(800); return res.status(401).json({ error: 'Usuario o clave incorrectos.' }) }
    fallos.delete(ip)
    poner(req, res, emitir(u), DURACION)
    res.json({ ok: true, usuario: u.nombre, rol: u.rol })
  })
  app.post('/admin/salir', (req, res) => { poner(req, res, '', 0); res.json({ ok: true }) })
}

// ---------- API (se monta detrás de autenticar) ----------
export function rutasAcceso(api) {
  api.get('/yo', (req, res) => res.json({ usuario: req.usuario.nombre, rol: req.usuario.rol, cambia_clave: !req.usuario.basica && req.usuario.rol !== 'dueno' }))
  api.get('/accesos', soloDueno, (_req, res) => res.json(leerUsuarios().map(u => ({ usuario: u.nombre, rol: u.rol, creado: u.creado, cambiado: u.cambiado }))))
  api.put('/accesos/:usuario', soloDueno, express.json(), (req, res) => {           // crea el acceso del cliente o le cambia la clave (solo el administrador principal)
    try {
      const nombre = String(req.params.usuario).trim().toLowerCase()
      if (!NOMBRE_OK.test(nombre)) throw new Error('El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo, sin espacios.')
      const c = validarClaveNueva(req.body?.clave)
      const lista = leerUsuarios(), i = lista.findIndex(x => x.nombre === nombre), ahora = new Date().toISOString()
      if (i < 0 && lista.length >= 10) throw new Error('Máximo 10 accesos.')
      if (i < 0) lista.push({ nombre, rol: 'cliente', hash: cifrar(c), creado: ahora }); else lista[i] = { ...lista[i], hash: cifrar(c), cambiado: ahora }
      guardarUsuarios(lista)
      res.json({ usuario: nombre, rol: 'cliente', creado: i < 0 })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  api.delete('/accesos/:usuario', soloDueno, (req, res) => {
    const nombre = String(req.params.usuario).toLowerCase(), lista = leerUsuarios()
    if (!lista.some(x => x.nombre === nombre)) return res.status(404).json({ error: 'Ese acceso no existe.' })
    guardarUsuarios(lista.filter(x => x.nombre !== nombre)); res.json({ ok: true })
  })
  api.post('/mi-clave', express.json(), async (req, res) => {                        // cada usuario del cliente cambia su propia clave
    try {
      if (req.usuario.rol === 'dueno') throw new Error('La clave del administrador principal se cambia en el servidor, no desde el panel.')
      const lista = leerUsuarios(), i = lista.findIndex(x => x.nombre === req.usuario.nombre)
      if (i < 0 || !coincide(String(req.body?.actual ?? ''), lista[i].hash)) { await pausa(800); throw new Error('La clave actual no es correcta.') }
      lista[i] = { ...lista[i], hash: cifrar(validarClaveNueva(req.body?.nueva)), cambiado: new Date().toISOString() }
      guardarUsuarios(lista)
      poner(req, res, emitir(lista[i]), DURACION)                                      // esta sesión sigue abierta; las demás se cierran
      res.json({ ok: true })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
}
