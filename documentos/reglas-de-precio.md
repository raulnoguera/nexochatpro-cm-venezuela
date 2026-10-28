# Reglas de precio por tienda (bot Nexo)

Configuración en `bot/data/tiendas.json`; el cálculo está en `bot/src/precios.js`.

| | Maracay | Caracas |
|---|---|---|
| Pago en dólares | precio de lista − descuento (8 %) | precio de lista − descuento (8 %) |
| Pago en bolívares | precio de lista (USD) × **tasa euro** BCV | precio de lista (USD) × **tasa dólar** BCV |
| Cashea | No | Sí |
| Existencias | 2 tiendas (Tienda 1 y Tienda 2) | 1 tienda |

## Supuestos pendientes de confirmar con el cliente
1. **Descuento en dólares = 8 %** (valor de ejemplo). Cambiar `descuento_usd` en `tiendas.json`.
2. **"Tasa euro" = valor del euro en bolívares publicado por el BCV, multiplicado por el precio de lista en USD.**
3. El **precio de lista** del inventario es el precio base en USD, antes del descuento.

## Tasas
- Se leen cada 30 min de https://ve.dolarapi.com (dólar y euro oficial).
- Se puede fijar una tasa a mano en `bot/data/tasas.json` (solo vale el día de su fecha):
  `{"EUR": {"valor": 1000, "fecha": "2026-10-27"}}`
- Si la API falla, se usa la última buena o `FALLBACK_RATE_USD` / `FALLBACK_RATE_EUR` del `.env`.

## Existencias
- Cada producto guarda `stock` por sede: `tienda_1`, `tienda_2`, `caracas`.
- Una cantidad **negativa** (traslado pendiente de cargar) cuenta como 0. Si no hay nada positivo pero sí algún negativo, el estado es "por confirmar".
- El bot nunca dice cifras exactas: "disponible", "pocas unidades", "por confirmar" o "agotado".

## Tienda de la conversación
Se deduce del nombre de la bandeja de Chatwoot ("WhatsApp Maracay", "WhatsApp Caracas"). Si el nombre no la dice, el bot pregunta la ciudad antes de dar precios.

## Líneas de WhatsApp y marca (actualizado)
| Bandeja en Chatwoot | Número | Tienda | Marca con la que habla Nexo |
|---|---|---|---|
| WhatsApp CM Maracay | 0414-4540116 | Maracay (tienda_1) | CM Venezuela |
| WhatsApp Master Cauchos | 0414-4885724 | Maracay (tienda_2) | Master Cauchos |
| WhatsApp CM Caracas | 0424-3188302 | Caracas | CM Venezuela |

- El bot solo responde en las bandejas listadas en `BOT_INBOX_IDS` (en el `.env` del servidor). Una bandeja nueva queda en silencio
  hasta agregarla ahí; hacerlo solo cuando el inventario real esté cargado.
- El nombre de la bandeja debe incluir "Master", "Caracas" o "Maracay" para que el bot deduzca la tienda y la marca.

## Inventario real (lista MCY, 26-oct-2026)

Fuente: `MCY - LISTA DE PRECIOS.xlsx`, hoja CAUCHOS. Se importa con
`python3 bot/scripts/importar_lista.py "<ruta al xlsx>"` (genera `bot/data/inventario.json`; el de ejemplo quedó en `inventario.ejemplo.json`) y se sube al servidor junto con `src/`.

- **Precio** = dólares de contado, tal cual (ya no se aplica el 8 % de descuento a estos productos).
- **Bs** de la lista = ROUNDUP(Precio × 1,05): es el equivalente en dólares si paga en bolívares; el bot lo multiplica por la tasa de la tienda (euro BCV en Maracay, según el texto de la lista: «moneda de mayor valor publicada por el BCV/€»).
- **CM / MC** = hay en CM Maracay (`tienda_1`) / Master Cauchos (`tienda_2`). La lista no trae cantidades: «hay» se guarda como 5 y las notas «1 CM», «2 CM», «1 MASTER» se leen como cantidad real. Filas con precio 0 no se publican (484 cauchos).
- **Caracas**: la lista no trae sus existencias (siempre «por confirmar») y se le aplica el mismo precio en dólares. Falta confirmar con el cliente si Caracas usa esta lista.
- Pendiente de importar: servicios por rin y tipo de vehículo (hoja SERVICIOS), baterías y aceites.

- Los montos en bolívares se redondean siempre hacia arriba al bolívar entero (igual que el ROUNDUP de la lista); aplica a precio unitario y a totales.
