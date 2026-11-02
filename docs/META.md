# Meta: WhatsApp, Messenger y comentarios

Todo usa **una sola app de Meta**: «NexoChatPro Master Cauchos» (tipo Business, publicada). Casos de uso agregados: WhatsApp, «Administrar todos los aspectos de tu página», «Interactuar con los clientes en Messenger» y «Administrar mensajes y contenido en Instagram».

## Dos niveles de acceso: la regla que condiciona todo

Mientras los permisos estén en **«Listo para la prueba»** (acceso estándar), Meta solo entrega datos de **personas con rol en la app**. Para atender a clientes reales por Messenger y comentarios hace falta la **revisión de permisos de Meta** (acceso avanzado), que depende de la **verificación del negocio** (la misma que pide WhatsApp en producción). Hoy se prueba con cuentas con rol.

## WhatsApp

- Se conecta como bandeja de WhatsApp Cloud de Chatwoot (número de pruebas de Meta; webhook `https://<dominio>/webhooks/whatsapp/<número>`).
- El token temporal de Meta **caduca**: se pega uno nuevo en la configuración de la bandeja de Chatwoot. En producción hace falta un token permanente (usuario del sistema).
- Mensaje `#131030 Recipient phone number not in allowed list`: en modo de pruebas solo se puede escribir a números agregados en «API Setup → Para».
- El número real de Master Cauchos (0414-4885724) sigue sin conectar; ver `PENDIENTES.md`.

## Comentarios de Facebook (`bot/src/meta.js`)

Flujo (opción elegida con el cliente): **respuesta pública corta + mensaje privado** con el primer paso de la cotización.

1. Meta envía `POST /meta/webhook` con el aviso `feed/comment/add`. El bot valida la firma `X-Hub-Signature-256`.
2. Filtros: ignora emojis solos, comentarios que empiezan etiquetando a alguien, los que traen enlaces, los de la propia página, las respuestas entre personas, y a quien ya se atendió en las últimas 24 h (solo en producción). Máximo 20 por minuto.
3. Envía primero el **mensaje privado** (`POST /<page-id>/messages` con `recipient.comment_id`: Meta permite **uno por comentario, dentro de 7 días**). Solo si se entrega, publica la **respuesta pública** (`POST /<comment-id>/comments`) con una de tres variantes.
4. No usa el modelo: no consume tokens.

Textos: valores por defecto en `meta.js`; se pueden cambiar con `data/comentarios.json` (`respuesta_publica` lista, `mensaje_privado`, `ignorar_palabras`). `META_MARCA` firma el mensaje (hoy «Master Cauchos», porque la página conectada es la de Master Cauchos; el bot maneja una sola página).

**Modo de prueba:** con `META_MODO` vacío solo se responde a comentarios que contengan `#prueba`. Pasar a `META_MODO=produccion` abre a todos.

**Limitaciones:** los comentarios en **Reels** no llegan por este aviso (`feed`); funcionan en publicaciones normales de texto y foto.

### Conectar la página (se hizo con `bot/scripts/conectar-meta.py`)

El asistente se ejecuta **en el servidor** y pide los secretos ocultos (no se muestran ni se guardan fuera de `.env`):

```bash
ssh -t -i <llave> root@<IP_VPS> 'python3 /opt/nexochatpro/bot/conectar-meta.py'
```

1. Valida la clave secreta de la app.
2. Pide un token de usuario del Explorador de la API de Graph con los permisos `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`, `pages_read_user_content`, `pages_messaging` (y los de Instagram cuando aplique), lo convierte en token **permanente de la página** y lo guarda con el id de la página en `.env`.
3. Reinicia el bot y suscribe la página (`subscribed_apps`, campo `feed`) y la app (`/<app-id>/subscriptions`, objeto `page`, dirección `https://<dominio>/meta/webhook` y `META_VERIFY_TOKEN`).

## Messenger en Chatwoot

Meta permite **una sola dirección de avisos por tipo de objeto en cada app**. Chatwoot espera los suyos en `/bot`, pero la app ya envía los avisos de la página al bot. Solución: **el bot recibe todo y reenvía a Chatwoot** (`http://rails:3000/bot`, con el mismo cuerpo y las firmas `X-Hub-Signature` y `X-Hub-Signature-256`, más `X-Forwarded-Proto: https`) los avisos que traen `messaging`.

Pasos que se siguieron:

1. **Campos de la página y de la app:** `feed, messages, messaging_postbacks, message_deliveries, message_reads, message_echoes` (`bot/scripts/suscribir_meta.mjs`).
2. **Crear la bandeja** sin «Continuar con Facebook» (la app solo tiene «Inicio de sesión con Facebook para empresas», que el botón de Chatwoot no soporta): `bot/scripts/crear_bandeja_messenger.mjs` llama a `POST /api/v1/accounts/<id>/callbacks/register_facebook_page` con el token permanente de la página.
3. **Agregar a Nexo como colaborador** de la bandeja (lo hace un administrador desde Chatwoot).
4. Sumar la bandeja a `BOT_INBOX_IDS` y, mientras se prueba, a `BOT_PRUEBA_INBOX_IDS`.

### Trampas encontradas

- **Chatwoot guarda `FB_APP_ID`, `FB_APP_SECRET` y `FB_VERIFY_TOKEN` en su base de datos** (`installation_configs`) y esa copia **manda sobre el entorno**. Con los valores vacíos, el envío a Messenger fallaba con «no implicit conversion of nil into String». Arreglo: copiar los valores del entorno a esas filas con `rails runner` y `GlobalConfig.clear_cache`.
- **Al crear la bandeja, Chatwoot reemplaza las suscripciones de la página** y quita `feed`: hay que volver a suscribir con la lista completa.
- Los envíos fallidos de Chatwoot pasan a la cola «muerta» y no se reintentan.
- El usuario del bot (agente) no ve una bandeja nueva hasta que se le agrega como colaborador.
- Una conversación **resuelta** abre una conversación nueva cuando el cliente vuelve a escribir.

## Instagram en Chatwoot

Chatwoot trae el canal de Instagram (inicio de sesión de Instagram): recibe en `/webhooks/instagram`, el inicio de sesión vuelve a `/instagram/callback` y usa `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` e `INSTAGRAM_VERIFY_TOKEN` (la clave y el id son los de la **app de Instagram**, distintos a los de Facebook: Meta → caso de uso «API de Instagram» → «Configuración de la API con inicio de sesión de Instagram»).

Como en Messenger, Meta permite una sola dirección de avisos por objeto, así que **el bot recibe los avisos de Instagram y reenvía los mensajes a Chatwoot** (`http://rails:3000/webhooks/instagram`). Meta firma esos avisos con la clave de la app de Instagram: el bot acepta las dos claves (`META_APP_SECRET` y `META_IG_APP_SECRET`). Los comentarios los sigue atendiendo el bot. Prueba sin Meta: `node scripts/probar_instagram_mensajes.mjs`.

Pasos:

1. **Meta, paso 1:** «Add all required permissions» (`instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`).
2. **Meta, paso 2:** «Agregar cuenta» con la cuenta de Instagram profesional y aceptar la invitación de probador en la app de Instagram (Configuración → Sitios web y herramientas).
3. **Servidor:** `ssh -t -i <llave> root@<IP_VPS> 'python3 /opt/nexochatpro/bot/conectar-instagram.py'`. Pide el id y la clave secreta de la app de Instagram (oculta) y los carga en los `.env` y en la base de Chatwoot (esa copia manda sobre el entorno; ver la trampa de Messenger).
4. **Meta, paso 3 (webhooks):** URL `https://<dominio>/meta/webhook` y el mismo `META_VERIFY_TOKEN`; suscribir `messages` y `comments`. La app debe estar publicada.
5. **Meta, paso 4 (inicio de sesión de empresa):** URI de redirección OAuth válida `https://<dominio>/instagram/callback`.
6. **Chatwoot:** Ajustes → Bandejas → Agregar → Instagram → «Continuar con Instagram». Luego agregar a Nexo como colaborador de la bandeja y sumar la bandeja a `BOT_INBOX_IDS` (y a `BOT_PRUEBA_INBOX_IDS` mientras se prueba).

Mientras los permisos estén en acceso estándar solo atiende cuentas con rol en la app. El camino de comentarios de Instagram del bot (`meta.js`) está escrito para el inicio de sesión de Facebook y **no ha sido probado** con la clave de Instagram.
