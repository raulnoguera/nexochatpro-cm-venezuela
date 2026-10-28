import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('data')
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const citasFile = path.join(dir, 'citas.json')

export const inventario = () => read('inventario.json')
export const baterias = () => (fs.existsSync(path.join(dir, 'baterias.json')) ? read('baterias.json') : [])
export const bicicletas = () => (fs.existsSync(path.join(dir, 'bicicletas.json')) ? read('bicicletas.json') : [])
export const aceites = () => (fs.existsSync(path.join(dir, 'aceites.json')) ? read('aceites.json') : [])
export const compatibilidad = () => (fs.existsSync(path.join(dir, 'compatibilidad.json')) ? read('compatibilidad.json') : [])
export const servicios = () => read('servicios.json')
export const citas = () => (fs.existsSync(citasFile) ? JSON.parse(fs.readFileSync(citasFile, 'utf8')) : [])
export const addCita = c => {
  const all = citas()
  const cita = { id: all.length + 1, creada: new Date().toISOString(), ...c }
  fs.writeFileSync(citasFile, JSON.stringify([...all, cita], null, 2))
  return cita
}

export const tiendas = () => read('tiendas.json')

export const updateCita = (id, cambios) => {
  const all = citas()
  const i = all.findIndex(c => c.id === id)
  all[i] = { ...all[i], ...cambios, actualizada: new Date().toISOString() }
  fs.writeFileSync(citasFile, JSON.stringify(all, null, 2))
  return all[i]
}
