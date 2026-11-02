# Pendientes

## Del cliente (CM Venezuela / Master Cauchos)

| Qué | Para qué |
|---|---|
| Número de WhatsApp de **CM Caracas** | Botón de WhatsApp de la sede y bandeja de Caracas |
| **Inventario y precios de Caracas**, o confirmar que usa los mismos precios y solo cambia la existencia | Hoy Caracas aparece como «próximamente» en la web y Nexo responde «por confirmar» |
| **Tabla de compatibilidad vehículo → batería** (marca, modelo, año, grupo) | Activar el buscador de baterías por vehículo (infraestructura lista; plantilla en `documentos/plantilla-compatibilidad-baterias.xlsx`) |
| **Imágenes PNG** con fondo transparente: cauchos, envases de aceite de las marcas más reconocidas y al menos 3 baterías | Tarjetas de categorías de la portada (ver `WEB.md`) |
| **Mensajes fijos** que mandan a mano (texto + imagen) y en qué momento | Herramienta de envío directo sin gastar tokens (ver abajo) |
| Aclarar si **reservan** existencias al cotizar | Nexo dice «ya guardé la reserva», pero solo guarda datos y cita |
| Hojas SERVICIOS, ALINEACION (449 vehículos) y CONSUMIBLES | Importar y mostrar en la web y en Nexo |
| Confirmar el RIF y la dirección completa de cada sede | Documentos y mensajes |
| **Protocolo de respuesta, punto 7:** formato de mensaje de precios para **baterías, aceites (combos de 4 a 8 litros + filtro) y bicicletas**, como el de cauchos | Hoy usan una línea corta por opción |
| Confirmar si el **segundo mensaje de cauchos** debe llevar también el monto en Bs, y si «Oferta válida por 12 horas» se mantiene (Nexo no la puede hacer caducar) | Formato final de precios |
| Aclarar el **punto 9** del protocolo: si preguntan la dirección al inicio, ¿se envía solo «Estamos a la orden 🙌» y la dirección al final? | Hoy Nexo envía el cierre completo si solo preguntan eso |
| Si agregan a la bienvenida que atiende **Nexo, asistente virtual** | Hoy solo lo aclara si le preguntan |
| Textos de cierre de **Master Cauchos y CM Caracas** (hoy usan el mismo formato de CM Maracay) | Despedida con dirección, horario y mapa |
| **Inventario de cauchos (formato nuevo)**: llenar **CODIGO CM / CODIGO MC** (obligatorio, exacto como en el sistema de cada tienda) y las columnas **CM / MC** (TOTAL INV es la suma); mientras estén vacías no se publica | Sin código el producto no existe; con total 0 no se muestra |
| Marcas que **siempre llevan el modelo** en la lista de precios (ej. Sportrak, Maxtrek) | Se guardan en `bot/data/formato_cauchos.json` (hoy vacío) |
| Mismo formato de inventario (códigos, CM, MC, total) para **baterías y aceites**, y el de **Caracas** | Hoy solo cauchos de Maracay |
| Tabla de **compatibilidad por marca de batería** (columnas Duncan, Titan, Fulgor…), con **posición** y **amperaje mínimo**; aclarar `N40` / `N40R` y celdas con dos grupos (`36, 42`) | Baterías: grupo + posición del positivo + amperaje; celda vacía = sin dato |
| ¿Pueden exportar de cada sistema un archivo con código y cantidad para cruzar el inventario? | Llena CM y MC automáticamente |
| Estado de la **API** con Alejandro para el inventario | Pendiente de Raúl |

## Técnicos

- **Instagram:** conectar la app de Instagram con Chatwoot (ver `docs/META.md`), crear la bandeja y probar mensajes; adaptar y probar los comentarios con el inicio de sesión de Instagram.
- **Mensajes fijos con imagen:** sección «Mensajes» en el panel y herramienta `enviar_mensaje(clave)` que envía el texto y la imagen directo a Chatwoot sin pasar por el modelo (una frase de ~15 palabras por mensaje en las instrucciones, que van en caché).
- **Meta en producción:** verificación del negocio y revisión de permisos (acceso avanzado); token permanente de WhatsApp; conectar el número real de Master Cauchos.
- **Messenger:** decidir si Nexo continúa la conversación (hoy en prueba) o se invita a WhatsApp. El bot maneja una sola página de Facebook.
- **Consumo:** pasar la cuenta de Google a pago; revisar el costo real tras la primera semana con clientes; opciones de ahorro adicionales (respuestas fijas a saludos, acortar resultados) valen ≤15 %.
- **Panel:** hoy el panel y la página de uso están separados; si el cliente lo pide, se puede mostrar el consumo dentro del panel.
- **Recargo de baterías «chatarra»:** hoy Nexo pasa a un asesor; se puede modelar el recargo.
- **Existencias de Caracas en el catálogo:** definir de dónde sale el dato (hoja del Excel o columna nueva) y agregar el campo `c` en `lista.js`.
- **Seguridad:** retirar la llave SSH de trabajo del hPanel de Hostinger al terminar; cambiar la contraseña de administrador de Chatwoot; revocar cualquier token permanente de sistema que haya quedado en capturas.
- **Panel — especificaciones por Excel:** el panel ya permite escribir las especificaciones de cada caucho y las lonas/modelo/tipo se leen del Excel nuevo; falta definir con el cliente qué especificaciones quiere y, si lo desea, agregar columnas al Excel para cargarlas en lote.
- **Equipos por empresa:** cuando se creen las bandejas reales de CM Maracay y CM Caracas, agregar sus ids a `BOT_EQUIPOS` (bandeja:equipo, hoy `2:2,3:2`) o dejar que Nexo las deduzca por el nombre de la bandeja («Maracay», «Caracas», «Master»). Crear los colaboradores reales como agentes en su equipo y sus bandejas, y borrar el colaborador de prueba. Definir si la conversación llega a una persona concreta (reparto automático de la bandeja) o solo a la lista del equipo.
