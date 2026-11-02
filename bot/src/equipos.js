import * as cw from './chatwoot.js'

// Equipo de Chatwoot al que va una conversación cuando pasa a un humano. Primero por id de bandeja (BOT_EQUIPOS="2:2,3:2" = bandeja:equipo);
// si la bandeja no está en la lista, por la empresa que se deduce de su nombre (equipos "master cauchos", "cm caracas", "cm maracay").
// Una bandeja sin empresa (la web de prueba) no se asigna a ningún equipo.
const FIJOS = new Map((process.env.BOT_EQUIPOS || '').split(',').map(x => x.trim().split(':').map(Number)).filter(([b, e]) => b && e))
const nombreEquipo = ctx => (ctx.marca === 'Master Cauchos' ? 'master cauchos' : ctx.tienda === 'caracas' ? 'cm caracas' : ctx.tienda === 'maracay' ? 'cm maracay' : null)

let equipos = { ts: 0, lista: [] }
export async function equipoDeBandeja(id, ctx) {
  if (FIJOS.has(id)) return FIJOS.get(id)
  const nombre = nombreEquipo(ctx)
  if (!nombre) return null
  if (Date.now() - equipos.ts > 5 * 60 * 1000) equipos = { ts: Date.now(), lista: await cw.teams().catch(() => equipos.lista) }
  return equipos.lista.find(t => t.name.toLowerCase() === nombre)?.id ?? null
}

export const traspasar = (conv, equipo) => (equipo ? cw.asignarEquipo(conv, equipo).catch(e => console.error('Equipo', conv, e.message)) : undefined)
