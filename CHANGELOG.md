# Historial de cambios

Resumen de lo construido, en orden. El detalle técnico está en `docs/`.

## Base del servicio
- Chatwoot autoalojado con la marca NexoChatPro (logo, iconos, nombre) detrás de Caddy con HTTPS, en un VPS propio.
- Bot «Nexo» en Node.js: atiende por la bandeja de Chatwoot, consulta el inventario, cotiza con precio en dólares y bolívares según la tienda y la tasa del BCV, guarda los datos del cliente en su ficha, agenda citas y pasa a un asesor cuando corresponde.
- Conexión del número de pruebas de WhatsApp Cloud.
- Material de demostración y comercial (`demo/`, `demo-flujo/`, `marketing/`, `brand/`).

## Seguimiento de conversaciones abandonadas
- Recordatorio único a quien dejó la conversación a medias (2 h, dentro de la ventana de 24 h, 8:00–20:00), con nota privada para el asesor. Corregido un error que «quemaba» la etiqueta antes de verificar el interés real.

## Catálogo y panel de administración
- `lista.js`: carga del Excel «MCY - LISTA DE PRECIOS» por categorías (cauchos, baterías, aceites), CRUD de productos y fotos, productos «a mano» que sobreviven a la carga, copias de seguridad, `catalogo.json` público.
- Panel `/admin` con autenticación, vista previa de cambios del Excel antes de publicar y fotos reducidas en el navegador.
- Productos sin precio como «Consultar precio»; existencias publicadas solo como agotado / pocas / disponible.
- Nexo con herramientas de baterías y aceites; buscador de baterías por vehículo (infraestructura; falta la tabla del cliente).

## Sitio web cmvenezuela.com
- Catálogo con inventario real, portada moderna, favicon del cliente, atajos rápidos, filtros por categoría.
- **Ciudad primero:** Maracay/Caracas en cada buscador; resultados por existencia de la ciudad; tasa euro (Maracay) o dólar (Caracas).
- **Buscador de cauchos:** rin → medidas disponibles, con sugerencias al escribir; el panel aparece al elegir «Cauchos».
- Sección **Nuestras sedes** (dirección, horario, WhatsApp y Google Maps) y pie de página con las tres sedes.
- **Bicicletas:** categoría completa (hoja del Excel, panel, web y Nexo).
- Cabeceras `no-cache` en el servidor para que los clientes vean siempre la última versión.
- **Atajos rápidos** retirados de la portada.
- **Accesos por marca** debajo de cada panel (cauchos, baterías, aceites), en portada y catálogo; marcas agrupadas (Haida HT/AT → Haida) y las más conocidas primero (lista `ORDEN` en las plantillas).
- **Buscador de aceites** Tipo → Viscosidad → Presentación (se va directo si solo hay litro; combos de 4 a 8 litros aparte, «incluye filtro + servicio gratis»), igual en el catálogo.

## Consumo de IA
- Migración a la **API nativa de Gemini** (informa caché y razonamiento), caché explícita de instrucciones, razonamiento bajo, historial acotado, resultados de búsqueda más cortos y formato de precio corto.
- Costo medido: de ~1,6 ¢ a ~0,36 ¢ por conversación simulada.
- Registro de consumo por día/modelo y por conversación, con canal (`/admin/uso`).
- Totales exactos calculados por la herramienta (el modelo ya no multiplica).

## Calidad de las respuestas (lo que se corrigió probando)
- Nexo ya no inventa direcciones, promociones, formas de pago ni servicios gratis, y no sugiere medidas de caucho por el vehículo.
- Dirección y horario por sede en el contexto de cada conversación.
- No se presenta dos veces tras el mensaje de bienvenida de un comentario; maneja respuestas vacías del modelo.

## Meta
- **Comentarios de Facebook:** respuesta pública + mensaje privado, con modo de prueba (`#prueba`).
- **Messenger en Chatwoot:** el bot reenvía los avisos a Chatwoot; bandeja creada con el token de la página; modo de prueba por bandeja y por contacto.
- Pendiente: Instagram, verificación del negocio y revisión de permisos.
