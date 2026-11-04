// Carga la lista de precios completa sin pasar por el panel: node scripts/cargar_excel.mjs "/ruta/MCY - LISTA DE PRECIOS.xlsx" [--sin-codigo]
import fs from 'node:fs'
import { leerExcel, aplicarLista } from '../src/lista.js'
const leido = await leerExcel(fs.readFileSync(process.argv[2]), { sinCodigo: process.argv.includes('--sin-codigo') })
console.log(aplicarLista(Object.fromEntries(Object.entries(leido).map(([c, r]) => [c, r.items]))))
