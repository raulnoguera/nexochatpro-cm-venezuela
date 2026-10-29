// Prueba el protocolo de respuesta sin tocar Chatwoot: node --env-file=.env scripts/probar_protocolo.mjs
import { responder } from '../src/agent.js'

const casos = [
  ['Saludo solo', ['Hola buenas tardes']],
  ['Caucho sin medida', ['Buenas, cuánto cuestan los cauchos?']],
  ['Caucho con medida', ['Hola, precio de 165/70R13']],
  ['Batería', ['Buenas, necesito una batería']],
  ['Aceite', ['Hola quiero un cambio de aceite']],
  ['Alineación', ['Buenas, hacen alineación?']],
  ['Balanceo', ['Hola, cuánto el balanceo?']],
  ['Dirección primero', ['Hola, dónde están ubicados?']],
]
for (const [nombre, msgs] of casos) {
  const hist = msgs.map(content => ({ message_type: 0, private: false, content }))
  const ctx = { conversationId: 0, tienda: 'maracay', marca: 'CM Venezuela', telefono: '+584141234567', ficha: {} }
  const r = await responder(hist, ctx).catch(e => 'ERROR ' + e.message)
  console.log(`\n=== ${nombre}: «${msgs.at(-1)}»\n${r}\n(enlace: ${ctx.enlace || '-'})`)
}
