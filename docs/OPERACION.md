# Operación diaria

## Panel de administración

`https://crm.nexochatpro.cloud/admin` (clave: `LISTA_CLAVE`). Es lo que se entrega al cliente.

- **Navegación lateral:** Inicio, Cauchos, Baterías, Aceites, Bicicletas, Vehículos → batería, Ajustes de la web, Cargar Excel, y enlaces al consumo de Nexo y a la web.
- **Inicio:** resumen con el total de productos de cada categoría y cuántos están sin foto, sin precio, agotados o sin dato de Caracas (cada número lleva a la lista ya filtrada), el estado de los ajustes de la web y el consumo semanal de Nexo.
- **Edición rápida en la lista:** el precio, el equivalente en bolívares y las existencias (CM Maracay, Master Cauchos y Caracas) se cambian directamente en la fila y se guardan al salir de la casilla (`PATCH /admin/api/<categoría>/items/<sku>`); la lista se puede filtrar (sin foto, sin precio, agotados, sin dato de Caracas) y ordenar. «Editar» abre el formulario completo (modelo, tipo, lonas, especificaciones, foto…).
- **Crear, editar y eliminar** productos; **subir foto** (se reduce a 900 px en el navegador); «usar la misma foto en los demás de esta marca».
- **Cauchos:** además de marca y medida, el formulario lleva **Modelo**, **Tipo** (HT, AT, MT…), **Lonas** y **Especificaciones** (una por línea, «Índice de carga: 91»). La web las muestra en la tarjeta (Marca, Tipo con las lonas, Modelo y el desplegable «Ver especificaciones») y Nexo las ve al buscar cauchos. Lo que se deja vacío no se muestra.
- **Existencia de Caracas:** todos los productos tienen el campo «Hay en CM Caracas»; vacío significa que aún no hay dato (la web sigue diciendo «cargando el inventario de Caracas»).
- **Ajustes de la web** (acceso directo arriba): servicios que vienen con la compra de los cauchos (uno por línea), detalle del filtro que incluyen los combos de aceite e interruptor de «Por confirmar» (apagado esconde los apartados que aún no tienen información). Se guarda en `data/ajustes_web.json`, viaja en `catalogo.json` y la web lo aplica sin republicar.
- **Excel:** sección «Cargar lista». Se sube el archivo «MCY - LISTA DE PRECIOS.xlsx», el panel muestra qué cambia (productos nuevos, precios distintos, los que salen) y solo se publica al confirmar.
  - Hojas que se leen: `CAUCHOS`, `BATERIAS`, `ACEITES`, `BICICLETAS` y `COMPATIBILIDAD` (opcional).
  - Cauchos en el formato nuevo: `CODIGO CM | CODIGO MC | MEDIDA | MARCA | MODELO | TIPO | LONAS | Precio | Bs | CM | MC | TOTAL INV`. Modelo, tipo y lonas (número) se leen de sus columnas; las especificaciones y la existencia de Caracas todavía se escriben desde el panel.
  - Los productos creados a mano (`MAN-…`) y las fotos se conservan.
  - Filas con marca «NO HAY» no se publican. Precio 0 → «Consultar precio».
  - Bicicletas: la columna `#` son las unidades en CM Maracay y `MC` marca si hay en Master Cauchos.
- Todo cambio se ve enseguida en la web y en Nexo.

## Consumo de la IA

`https://crm.nexochatpro.cloud/admin/uso` (misma clave; no tiene enlace desde el panel): tokens, caché y costo estimado por día y modelo, y gasto por conversación con su canal. Detalle en `BOT.md`.

Recomendado antes de clientes reales: pasar la cuenta de Google AI a **nivel de pago** (el gratuito tiene límites bajos y Google usa el contenido para mejorar sus productos) y poner un presupuesto con alertas en Google Cloud.

## Modos de prueba (protegen a los clientes reales)

| Dónde | Cómo funciona | Cómo se apaga |
|---|---|---|
| Comentarios de Facebook | Con `META_MODO` vacío, el bot solo responde a comentarios que contengan `#prueba` | `META_MODO=produccion` |
| Bandeja de Messenger | Con la bandeja en `BOT_PRUEBA_INBOX_IDS`, Nexo solo responde a conversaciones con la etiqueta `prueba` o de un contacto en `BOT_PRUEBA_CONTACT_IDS` | Quitar el id de la bandeja de `BOT_PRUEBA_INBOX_IDS` |
| Cualquier bandeja | Nexo solo atiende las de `BOT_INBOX_IDS` | Agregar el id |

Tras cambiar `.env`: `docker compose up -d --force-recreate`.

**Probar sin costo ni riesgo:** `conversationId: 0` en las pruebas desde consola no escribe en Chatwoot ni en el registro de gasto (ver `BOT.md`).

## Limpiar datos de prueba

- Citas: vaciar `data/citas.json` (`[]`) después de respaldarlo.
- Contactos de prueba en Chatwoot: limpiar sus atributos personalizados (`vehiculo`, `medida_caucho`, `marca_caucho`, `cantidad_cauchos`, `proxima_cita`, `tienda`) para que Nexo no los recuerde.
- Registro de gasto: `data/uso_conversaciones.json` mezcla pruebas y conversaciones reales; se puede reiniciar antes de empezar con clientes.

## Checklist para salir a producción

- [ ] Inventario real cargado (incluida Caracas) y precios revisados.
- [ ] Dirección, horario y WhatsApp de las tres sedes (`data/tiendas.json` y web).
- [ ] Cuenta de Google en nivel de pago con presupuesto y alertas.
- [ ] Número real de WhatsApp de Master Cauchos conectado, con **verificación del negocio en Meta** y **token permanente** (los temporales caducan).
- [ ] Revisión de permisos de Meta (acceso avanzado) para que lleguen los mensajes y comentarios de clientes reales: ver `META.md`.
- [ ] Mensajes fijos de CM (textos e imágenes) cargados, si se usan.
- [ ] Quitar los modos de prueba (tabla anterior) y limpiar los datos de prueba.
- [ ] Contraseña de administrador de Chatwoot cambiada y `LISTA_CLAVE` entregada al cliente.
- [ ] Retirar la llave SSH de trabajo del hPanel de Hostinger al terminar.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Nexo no responde en una bandeja | La bandeja no está en `BOT_INBOX_IDS`; o está en prueba sin etiqueta; o el usuario Nexo no es colaborador de la bandeja; o la conversación tiene `requiere-humano` |
| «#131030 Recipient phone number not in allowed list» | El número de WhatsApp sigue en modo de pruebas: agregar el destinatario en la lista permitida de Meta, o pasar a producción |
| La respuesta aparece en Chatwoot pero no llega a Messenger | Credenciales de Facebook vacías en la base de datos de Chatwoot (ver `META.md`) |
| El cliente ve una versión vieja de la web | Caché del navegador; el sitio ya envía `no-cache`, recargar sin caché |
| Un total en bolívares no cuadra | Nexo debe volver a buscar con `cantidad`; si pasa, revisar `tools.js` (`conTotales`) |
