# NexoChatPro · CM Venezuela

Servicio llave en mano para **CM Venezuela C.A.** y **Master Cauchos** (Maracay y Caracas): una bandeja de mensajes con CRM (Chatwoot), un asistente de IA llamado **Nexo** que atiende por WhatsApp, Messenger y comentarios de Facebook, y la página web pública **cmvenezuela.com** con el catálogo por ciudad.

> Repositorio privado. No contiene claves ni datos de clientes: los secretos van en archivos `.env` (ver `*.env.example`) y los datos del negocio viven en el servidor.

## Qué hace

| Pieza | Qué es | Dónde |
|---|---|---|
| **CRM / bandeja** | Chatwoot autoalojado (WhatsApp, Messenger, widget web) con la marca NexoChatPro | `https://crm.nexochatpro.cloud` · `deploy/chatwoot/` |
| **Nexo (el bot)** | Servicio Node.js que responde con Gemini, consulta el inventario, cotiza, guarda datos del cliente y agenda citas | `bot/` |
| **Panel de administración** | El cliente sube su Excel o edita productos y fotos; ve el consumo de IA | `https://crm.nexochatpro.cloud/admin` · `bot/src/admin.html` |
| **Comentarios de Facebook** | Responde en público y escribe por privado a quien comenta una publicación | `bot/src/meta.js` |
| **Sitio web** | Portada y catálogo estáticos (Hostinger) que leen el inventario real | `web/` |

## Cómo encaja todo

```
Cliente ── WhatsApp / Messenger / widget ──▶ Meta ──▶ Caddy (HTTPS) ──▶ Chatwoot ◀── sondea cada 2 s ── Bot (Nexo)
                                                           │                                   │
Comentarios de Facebook ─────────────▶ Meta ─▶ /meta/webhook (bot) ─▶ mensaje privado       Gemini (API nativa
                                                           │                                   + caché de instrucciones)
cmvenezuela.com (Hostinger) ◀── lee /catalogo.json ◀── Bot ◀── Panel /admin ◀── Excel del cliente
```

Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Estructura del repositorio

```
bot/        Servicio de Nexo (Node 22 + Express). src/, scripts/, Dockerfile
web/        Sitio público: plantillas HTML, build.py y los HTML generados
deploy/     Configuración de producción saneada: docker-compose, Caddyfile, .env.example
chatwoot/   Entorno local de desarrollo de Chatwoot (Docker)
brand/      Marca NexoChatPro: logos, avatar de Nexo, guía
demo/, demo-flujo/, marketing/   Material de demostración y comercial
documentos/ Reglas de precio y plantilla de compatibilidad de baterías
docs/       Documentación técnica y operativa (empieza aquí)
```

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Componentes, flujo de un mensaje, reglas de precios y existencias, archivos de datos |
| [`docs/BOT.md`](docs/BOT.md) | Cómo piensa Nexo: instrucciones, herramientas, ahorro de tokens, costos medidos |
| [`docs/WEB.md`](docs/WEB.md) | Sitio web: plantillas, lógica por ciudad, cómo compilar y publicar |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Servidor, Docker, Caddy, variables de entorno, comandos de actualización |
| [`docs/OPERACION.md`](docs/OPERACION.md) | Uso diario: panel, Excel, modos de prueba, consumo, salida a producción |
| [`docs/META.md`](docs/META.md) | WhatsApp, Messenger y comentarios de Facebook/Instagram: configuración y trampas conocidas |
| [`docs/PENDIENTES.md`](docs/PENDIENTES.md) | Qué falta y qué necesitamos del cliente |
| [`CHANGELOG.md`](CHANGELOG.md) | Historia de lo construido y de las decisiones |

## Arranque rápido en local

```bash
# 1. Chatwoot local (opcional): http://localhost:3000
cd chatwoot && docker compose up -d

# 2. Bot
cd ../bot
cp .env.example .env          # llena CHATWOOT_*, LLM_API_KEY y lo que necesites
cp data/inventario.ejemplo.json data/inventario.json
npm install
npm start                     # http://localhost:4001

# 3. Web
cd ../web && python3 build.py # genera index.html y catalogo.html
python3 -m http.server 8765   # http://localhost:8765
```

Despliegue real y comandos de actualización: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Reglas de negocio que no se negocian

- **Precios:** el precio en dólares es de contado. En bolívares se paga un equivalente en dólares (+5 % redondeado hacia arriba) a la tasa del BCV: **euro en Maracay, dólar en Caracas**; los bolívares siempre se redondean hacia arriba. Nexo nunca calcula montos: los da la herramienta.
- **Existencias:** a clientes solo se les dice «disponible», «pocas unidades» o «por confirmar», nunca cifras exactas.
- **Medidas:** Nexo nunca deduce la medida de un caucho a partir del vehículo.
- **Datos del negocio:** Nexo no inventa direcciones, teléfonos, promociones, formas de pago ni servicios gratis.
- **Datos reales de clientes:** no se conectan números reales ni se responde a clientes reales hasta cargar el inventario real y pasar a producción (ver `docs/OPERACION.md`).
