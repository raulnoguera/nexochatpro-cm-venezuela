// Corre las mismas preguntas con el modelo configurado para comparar calidad de respuestas entre modelos.
// Uso: docker exec -e LLM_MODEL=<modelo> -e LLM_FALLBACK_MODEL= nexochatpro-bot node comparar_modelos.mjs
import { responder } from './src/agent.js'
const P = [
  ['Hola, necesito cauchos 195/65R15 para un Aveo', 'maracay'],
  ['Y baterias grupo 34 tienes?', 'maracay'],
  ['Qué aceite 20W-50 mineral tienen en litro?', 'maracay'],
  ['Qué medida de caucho le sirve a una Hilux 2015?', 'maracay'],
  ['Me das descuento si compro 4 cauchos?', 'maracay'],
  ['cuanto cuesta el balanceo y la alineación?', 'caracas'],
  ['Hola cuanto cuestan los cauchos 205/55R16', null],
  ['aceptan cashea?', 'maracay'],
]
for (const [t, tienda] of P) {
  const r = await responder([{ message_type: 0, private: false, content: t }], { conversationId: 0, tienda, marca: tienda === 'caracas' ? 'CM Venezuela' : 'CM Venezuela', ficha: {} }).catch(e => 'ERROR ' + e.message)
  console.log(`\n### ${t}\n${r}`)
}
