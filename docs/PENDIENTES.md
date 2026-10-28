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

## Técnicos

- **Instagram:** token propio, adaptación de `meta.js` al inicio de sesión de Instagram y pruebas.
- **Mensajes fijos con imagen:** sección «Mensajes» en el panel y herramienta `enviar_mensaje(clave)` que envía el texto y la imagen directo a Chatwoot sin pasar por el modelo (una frase de ~15 palabras por mensaje en las instrucciones, que van en caché).
- **Meta en producción:** verificación del negocio y revisión de permisos (acceso avanzado); token permanente de WhatsApp; conectar el número real de Master Cauchos.
- **Messenger:** decidir si Nexo continúa la conversación (hoy en prueba) o se invita a WhatsApp. El bot maneja una sola página de Facebook.
- **Consumo:** pasar la cuenta de Google a pago; revisar el costo real tras la primera semana con clientes; opciones de ahorro adicionales (respuestas fijas a saludos, acortar resultados) valen ≤15 %.
- **Panel:** hoy el panel y la página de uso están separados; si el cliente lo pide, se puede mostrar el consumo dentro del panel.
- **Recargo de baterías «chatarra»:** hoy Nexo pasa a un asesor; se puede modelar el recargo.
- **Existencias de Caracas en el catálogo:** definir de dónde sale el dato (hoja del Excel o columna nueva) y agregar el campo `c` en `lista.js`.
- **Seguridad:** retirar la llave SSH de trabajo del hPanel de Hostinger al terminar; cambiar la contraseña de administrador de Chatwoot; revocar cualquier token permanente de sistema que haya quedado en capturas.
