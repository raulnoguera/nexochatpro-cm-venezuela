# Despliegue

## Servidor (VPS)

Un VPS con Docker y Docker Compose. Estructura:

```
/opt/nexochatpro/
├── chatwoot/            # deploy/chatwoot/ de este repositorio + .env real
│   ├── docker-compose.yml   (caddy, rails, sidekiq, postgres, redis)
│   ├── Caddyfile
│   ├── brand/, icons/       (marca e iconos de Chatwoot)
│   └── .env
└── bot/                 # bot/ de este repositorio
    ├── docker-compose.yml   (deploy/bot/docker-compose.yml)
    ├── Dockerfile, package*.json, src/
    ├── data/                # volumen: datos del cliente (ver bot/data/README.md)
    └── .env
```

La dirección del VPS, el usuario y la llave SSH no están en este repositorio. Los datos reales están en tu gestor de contraseñas.

## Primera instalación (resumen)

1. DNS: un registro `A` del dominio (p. ej. `crm.nexochatpro.cloud`) hacia la IP del VPS.
2. Copiar `deploy/chatwoot/` a `/opt/nexochatpro/chatwoot/`, crear `.env` desde `.env.example` (`SECRET_KEY_BASE` con `openssl rand -hex 64`; contraseña de Postgres propia) y ajustar el dominio en `Caddyfile`.
3. `docker compose up -d` en esa carpeta. La primera vez, preparar la base y crear el administrador de Chatwoot (`docker compose run --rm rails bundle exec rails db:chatwoot_prepare`). Caddy obtiene el certificado HTTPS solo.
4. En Chatwoot: crear el usuario agente **Nexo** (su token de acceso será `CHATWOOT_TOKEN`) y las bandejas.
5. Copiar `bot/` a `/opt/nexochatpro/bot/`, crear `.env` desde `.env.example` y `docker compose up -d --build`. El bot se une a la red `chatwoot_default`.
6. Cargar el inventario desde el panel `/admin` (ver `OPERACION.md`).

## Caddy

```caddy
crm.nexochatpro.cloud {
	encode gzip
	handle_path /brand/* { root * /srv/brand
		file_server }
	@bot path /lista /admin /admin/* /img/* /catalogo.json /meta/*
	handle @bot { reverse_proxy nexochatpro-bot:4001 }
	reverse_proxy rails:3000
}
```

**Trampa:** el `Caddyfile` está montado como archivo. Editarlo con `sed -i` crea un archivo nuevo y el contenedor sigue viendo el viejo. Escribe **en el mismo archivo** (sin reemplazarlo) y recarga: `docker exec chatwoot-caddy-1 caddy reload --config /etc/caddy/Caddyfile`; si no se aplica, `docker restart chatwoot-caddy-1`.

## Actualizar el bot

```bash
# desde tu computador, en la carpeta bot/
scp -i <llave> src/*.js src/*.html root@<IP_VPS>:/opt/nexochatpro/bot/src/
ssh -i <llave> root@<IP_VPS> 'cd /opt/nexochatpro/bot && docker compose up -d --build'
```

- **Cambio en `src/`** → `--build` (el código se copia dentro de la imagen).
- **Cambio solo en `.env`** → `docker compose up -d --force-recreate`.
- Comprobar: `docker logs --tail 5 nexochatpro-bot` debe mostrar «Bot escuchando en http://localhost:4001».

## Actualizar Chatwoot

Cambiar variables de `.env` de Chatwoot exige `docker compose up -d --force-recreate rails sidekiq`. Hay una excepción importante para las claves de Facebook (`FB_*`): ver `META.md`.

## Variables de entorno

`bot/.env.example` y `deploy/chatwoot/.env.example` listan todas las variables con su explicación.

## Datos y respaldos

- `bot/data/` (volumen del bot): `respaldos/` guarda automáticamente una copia de cada lista antes de reemplazarla. Respalda la carpeta completa con regularidad.
- Postgres de Chatwoot: volumen `pgdata`. Haz un `pg_dump` periódico.
- El `.env` de cada carpeta es la única copia de las claves: guárdalo también en tu gestor de contraseñas.

## Sitio web

Se publica aparte, por SSH, al Hostinger del cliente. Ver `WEB.md`.
