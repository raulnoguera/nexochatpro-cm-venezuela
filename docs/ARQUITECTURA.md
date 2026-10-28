# Arquitectura

## Componentes

| Componente | Tecnología | Notas |
|---|---|---|
| Chatwoot | Rails + Sidekiq + Postgres (pgvector) + Redis, en Docker | Bandeja multicanal y CRM. v4.x |
| Caddy | Caddy 2 | HTTPS automático. Enruta `/admin`, `/img`, `/catalogo.json` y `/meta/*` al bot y el resto a Chatwoot |
| Bot (Nexo) | Node 22 + Express, contenedor `nexochatpro-bot`, puerto 4001 | Está en la red Docker de Chatwoot (`chatwoot_default`) |
| Modelo | Gemini (`gemini-3-flash-preview`, respaldo `gemini-flash-lite-latest`) por la API nativa | Llamadas de funciones + caché explícita de instrucciones |
| Sitio web | HTML estático en Hostinger | Lee el catálogo del bot; con respaldo local |
| Meta | WhatsApp Cloud API, Messenger, webhooks de Facebook | Una sola app de Meta para todo |

## Flujo de un mensaje

1. El cliente escribe por WhatsApp o Messenger. Meta avisa a Chatwoot (WhatsApp directo; Messenger pasa antes por el bot, que reenvía a Chatwoot; ver `docs/META.md`).
2. Chatwoot crea o actualiza la conversación en su bandeja.
3. El bot **sondea cada 2 segundos** las conversaciones abiertas de las bandejas autorizadas (`BOT_INBOX_IDS`). Si el último mensaje es del cliente, lo atiende. No usa webhooks de Chatwoot porque este rechaza destinos de red privada.
4. `agent.js` arma la petición a Gemini: instrucciones fijas (en caché), contexto de la conversación (hora, tienda, dirección, horario, ficha del cliente) e historial reciente (últimos 16 mensajes).
5. Gemini puede llamar herramientas (`tools.js`): buscar productos, guardar datos, agendar citas, pasar a un asesor. Las herramientas leen los archivos de `bot/data/` y devuelven precios ya calculados.
6. La respuesta se publica en Chatwoot con `content_attributes.bot = true`; Chatwoot la entrega al canal.
7. Si un humano responde en la conversación, o hay una etiqueta `requiere-humano`, el bot deja de intervenir.

**Seguimiento:** si el cliente dejó la conversación a medias (último mensaje del bot) y pasaron `SEGUIMIENTO_MINUTOS` (120) dentro de la ventana de 24 h y en horario de 8:00 a 20:00 de Caracas, Nexo le escribe una sola vez y deja una nota privada para el asesor.

## Reglas de precio y existencia

- `usd`: precio de contado en dólares. `usd_bs`: «equivalente en dólares si paga en bolívares» (por defecto `ceil(usd × 1.05)`).
- Bolívares = `usd_bs × tasa`, redondeado hacia arriba al bolívar entero. La tasa sale de `ve.dolarapi.com`: **euro oficial en Maracay, dólar oficial en Caracas** (`data/tiendas.json`).
- `usd = 0` significa «Consultar precio»: Nexo no da ningún monto y ofrece pasar a un asesor.
- Existencia por tienda: el Excel trae si hay en CM Maracay y en Master Cauchos; internamente se guardan unidades. Al público solo se muestran **0 = agotado, 1 = pocas unidades (1–2), 2 = disponible**.
- Hoja **BICICLETAS** del Excel: la columna `#` son unidades en CM Maracay y `MC` indica si hay en Master Cauchos.
- Los totales de varias unidades los calcula la herramienta de búsqueda (parámetro `cantidad`): el modelo nunca multiplica (se equivocaba en los bolívares).

## Categorías y archivos de datos (`bot/data/`)

Cada categoría es una lista de productos con `sku`, `marca`, precios y `stock: {tienda_1, tienda_2}`:

| Categoría | Archivo | Campos propios | Hoja del Excel |
|---|---|---|---|
| Cauchos | `inventario.json` | `medida`, `rin`, `modelo`, `detalle`, `nota` | `CAUCHOS` |
| Baterías | `baterias.json` | `descripcion`, `grupo`, `amp`, `garantia` | `BATERIAS` |
| Aceites | `aceites.json` | `tipo`, `presentacion` | `ACEITES` |
| Bicicletas | `bicicletas.json` | `rin`, `modelo`, `para`, `colores` | `BICICLETAS` |
| Vehículo → batería | `compatibilidad.json` | `marca`, `modelo`, `desde`, `hasta`, `grupo` | `COMPATIBILIDAD` |

- Los productos creados a mano en el panel tienen `sku` con prefijo `MAN-` y **sobreviven** a una nueva carga del Excel. Las fotos se conservan por `sku`.
- Cada vez que se guarda una lista se regenera `catalogo.json`, el catálogo compacto y público que usan la web y Nexo.
- Antes de reemplazar una lista se guarda una copia en `data/respaldos/`.
- Las hojas SERVICIOS, ALINEACION y CONSUMIBLES del Excel todavía no se importan (ver `PENDIENTES.md`).

## Módulos del bot (`bot/src/`)

| Archivo | Responsabilidad |
|---|---|
| `index.js` | Servidor Express, sondeo de Chatwoot, bandejas permitidas y en prueba, seguimiento |
| `agent.js` | Instrucciones de Nexo, llamada a Gemini (API nativa), caché explícita, historial |
| `tools.js` | Herramientas que el modelo puede llamar |
| `precios.js`, `tasa.js` | Cálculo de precio por tienda, existencias y tasas del BCV |
| `store.js` | Lectura de los archivos de `data/` |
| `lista.js` | Carga de Excel, CRUD de productos y fotos, panel de administración, `catalogo.json` |
| `admin.html`, `uso.html` | Panel de administración y página de consumo |
| `uso.js` | Registro de tokens y costo por día y por conversación |
| `meta.js` | Webhook de Meta: comentarios de Facebook y reenvío de mensajes de Messenger a Chatwoot |
| `chatwoot.js` | Cliente mínimo de la API de Chatwoot |

## Seguridad

- El panel `/admin` usa autenticación básica con `LISTA_CLAVE`. Si la variable no existe, el panel responde 404.
- Las fotos se validan por sus bytes iniciales (JPG, PNG, WebP) y se reducen en el navegador.
- El webhook de Meta valida la firma `X-Hub-Signature-256` con la clave de la app.
- Los secretos solo existen en `.env` del servidor. El repositorio no los contiene.
