// Carga la lista de precios completa sin pasar por el panel: node scripts/cargar_excel.mjs "/ruta/MCY - LISTA DE PRECIOS.xlsx" [--sin-codigo | --solo-dimensiones]
import fs from 'node:fs'
import { leerExcel, aplicarLista, cargarDimensiones } from '../src/lista.js'
if (process.argv.includes('--solo-dimensiones')) { console.log(await cargarDimensiones(fs.readFileSync(process.argv[2]))); process.exit(0) }     // solo la hoja DIMENSIONES DE CAUCHOS, sobre lo ya publicado
const leido = await leerExcel(fs.readFileSync(process.argv[2]), { sinCodigo: process.argv.includes('--sin-codigo') })
console.log(aplicarLista(Object.fromEntries(Object.entries(leido).map(([c, r]) => [c, r.items]))))
