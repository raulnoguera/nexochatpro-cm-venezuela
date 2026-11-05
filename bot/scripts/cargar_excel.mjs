// Carga la lista de precios completa sin pasar por el panel: node scripts/cargar_excel.mjs "/ruta/MCY - LISTA DE PRECIOS.xlsx" [--sin-codigo | --solo-dimensiones] [--solo=otros,cauchos] [--tienda=caracas]
import fs from 'node:fs'
import { leerExcel, aplicarLista, aplicarListaCaracas, cargarDimensiones } from '../src/lista.js'
if (process.argv.includes('--solo-dimensiones')) { console.log(await cargarDimensiones(fs.readFileSync(process.argv[2]))); process.exit(0) }     // solo la hoja DIMENSIONES DE CAUCHOS, sobre lo ya publicado
const tienda = process.argv.includes('--tienda=caracas') ? 'caracas' : 'maracay'      // archivo de CM Caracas: CODIGO CCS y existencia en la columna CCS; solo toca precios y existencias de Caracas
const leido = await leerExcel(fs.readFileSync(process.argv[2]), { sinCodigo: process.argv.includes('--sin-codigo'), tienda })
const solo = (process.argv.find(a => a.startsWith('--solo='))?.slice(7) || '').split(',').filter(Boolean)      // --solo=otros: publica únicamente esas categorías
console.log((tienda === 'caracas' ? aplicarListaCaracas : aplicarLista)(Object.fromEntries(Object.entries(leido).filter(([c]) => !solo.length || solo.includes(c)).map(([c, r]) => [c, r.items]))))
