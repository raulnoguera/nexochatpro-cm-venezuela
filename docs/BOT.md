# Nexo, el asistente

## Instrucciones (prompt)

Viven en `bot/src/agent.js`, divididas en dos partes:

- **`sistemaFijo(marca)`**: personalidad, estilo (WhatsApp: mensajes cortos, sin markdown) y reglas. Es igual en todas las conversaciones de una marca, y por eso se sube a la **caché de Gemini**.
- **`contexto(ctx)`**: lo que cambia en cada conversación: fecha y hora de Caracas, tienda, dirección y horario de la sede, teléfono conocido y ficha del cliente (datos guardados antes).

Reglas importantes (no relajarlas sin hablar con el cliente):
- Los precios salen solo de las herramientas, en formato corto: `Haida HT: $96 en divisa · $101 en Bs tasa euro`. Al dar un total incluye también el monto en bolívares.
- «Consultar precio» (`por_consultar`): no dar ningún monto.
- Nunca deducir una medida de caucho por el vehículo; si solo conoce el rin, no se muestran precios: se pide la medida.
- Las baterías por vehículo salen **solo** de la tabla de compatibilidad (`buscar_baterias` con `vehiculo_marca`, `vehiculo_modelo`, `anio`).
- No inventar direcciones, teléfonos, redes, formas de pago, promociones, descuentos ni servicios gratis; si no sabe, pasa a un asesor.
- Una sola cita por conversación; no hay límite de cupo, solo el horario de la sede.
- Descuentos, pagos, reclamos → `pasar_a_humano`.

## Herramientas (`bot/src/tools.js`)

| Herramienta | Qué hace |
|---|---|
| `buscar_cauchos` | Por medida, rin o marca. Con solo el rin y sin marca no devuelve precios |
| `buscar_baterias` | Por grupo, amperaje, marca o vehículo |
| `buscar_aceites` | Por tipo/viscosidad, presentación o marca |
| `buscar_bicicletas` | Por rin o modelo |
| `listar_servicios` | Servicios del taller con precio |
| `guardar_cliente` | Guarda nombre, teléfono, vehículo y datos de la compra en el contacto de Chatwoot |
| `agendar_cita` | Crea la cita y deja una nota privada para el asesor |
| `pasar_a_humano` | Etiqueta `requiere-humano` y avisa al asesor |

Las búsquedas devuelven como máximo 6 resultados, la tasa una sola vez y, si se pasa `cantidad`, los **totales ya calculados**. El historial de Chatwoot solo trae texto, así que para dar un total correcto Nexo vuelve a buscar con la cantidad.

## Modelo y ahorro de tokens

- API nativa de Gemini (`generateContent`), no la compatible con OpenAI: informa los tokens en caché y de razonamiento.
- **Caché explícita:** las instrucciones fijas y las herramientas (~2.800 tokens) se suben una vez a `cachedContents` (TTL 1 h, se renueva sola) y se cobran con ~90 % de descuento. Si la caché falla, el bot envía todo completo. `LLM_CACHE=0` la desactiva.
- **Razonamiento en nivel bajo** (`LLM_PENSAR=low`): con el nivel por defecto de Google era el 26 % del costo, sin mejora visible.
- Historial limitado a 16 mensajes. Los mensajes del bot anteriores al primero del cliente (p. ej. la bienvenida a quien comentó) se anteponen al primer mensaje para que no se presente dos veces.
- Si el modelo responde vacío: tras `pasar_a_humano` se envía un aviso fijo; en otro caso se reintenta.

### Costos medidos (precios de lista de Google, estimación)

| Configuración | Costo por conversación (8 conversaciones simuladas) |
|---|---|
| Sin caché, razonamiento por defecto | ~1,6 ¢ |
| Sin caché, razonamiento bajo | ~0,97 ¢ |
| **Con caché y razonamiento bajo (actual)** | **~0,36 ¢** |

Conversaciones reales de prueba: una de 7 mensajes con cita costó ~0,97 ¢ y una respuesta suelta ~0,05 ¢. Con 3.000 conversaciones a la semana, entre ~$47 y ~$125 al mes. La cifra firme saldrá de la primera semana con clientes reales (`/admin/uso`).

Flash-Lite como modelo principal costaría la mitad, pero en las pruebas dejó a un cliente sin cotización, sugirió medidas de caucho e inventó formas de pago: **se usa solo como respaldo**.

Medir y comparar: `bot/scripts/medir_consumo.mjs` y `bot/scripts/comparar_modelos.mjs`.

## Registro de consumo

- `data/uso.json`: llamadas, tokens de entrada, caché, razonamiento, salida, errores y 429 por día y modelo.
- `data/uso_conversaciones.json`: costo estimado por conversación de Chatwoot, con el canal.
- Se ven en `https://crm.nexochatpro.cloud/admin/uso` (misma clave que el panel). Las pruebas con `conversationId: 0` no se registran por conversación.

## Pruebas rápidas desde el servidor

```bash
docker exec nexochatpro-bot node --input-type=module -e '
import { responder } from "./src/agent.js"
const p = [{ message_type: 0, private: false, content: "Hola, busco cauchos 195/65R15" }]
console.log(await responder(p, { conversationId: 0, tienda: "maracay", marca: "CM Venezuela", ficha: {} }))'
```

Con `conversationId: 0` no se registra gasto por conversación ni se escribe en Chatwoot. Cuidado: `agendar_cita` sí escribe `data/citas.json`.

## Trampas conocidas

- El código del bot se copia dentro de la imagen: tras cambiar `src/` hay que reconstruir (`docker compose up -d --build`); `--force-recreate` solo aplica cambios de `.env`.
- La caché del modelo se identifica por modelo y marca. Se recrea sola al reiniciar el bot.
- El historial de Chatwoot no trae los montos de las herramientas: nunca pedirle a Nexo que «recuerde» un monto en bolívares; debe volver a buscar.
