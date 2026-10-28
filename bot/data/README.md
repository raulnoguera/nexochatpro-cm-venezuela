# Datos del bot

Esta carpeta es un volumen de Docker en el servidor (`/opt/nexochatpro/bot/data`). **Los datos reales del cliente no se suben a git**; aquí solo hay ejemplos y la configuración mínima.

| Archivo | Qué es | ¿En git? |
|---|---|---|
| `tiendas.json` | Ciudades y tiendas: tasa de cambio que usa cada ciudad, descuento, Cashea, direcciones y horarios | Sí |
| `servicios.json` | Servicios del taller con su precio de referencia | Sí (valores de ejemplo) |
| `inventario.ejemplo.json` | Ejemplo del formato de cauchos | Sí |
| `inventario.json`, `baterias.json`, `aceites.json`, `bicicletas.json` | Listas de productos (las genera la carga del Excel o el panel de administración) | No |
| `compatibilidad.json` | Tabla vehículo → grupo de batería | No |
| `catalogo.json` | Catálogo público compacto que lee la web (`/catalogo.json`); se regenera solo al guardar | No |
| `imagenes/` | Fotos de productos subidas desde el panel | No |
| `respaldos/` | Copia automática de cada lista antes de reemplazarla | No |
| `citas.json` | Citas agendadas por Nexo (datos personales de clientes) | No |
| `uso.json`, `uso_conversaciones.json` | Consumo de tokens por día y por conversación | No |
| `comentarios.json` | Opcional: textos de la respuesta a comentarios (ver `docs/META.md`) | No |

Para empezar de cero en local, copia `inventario.ejemplo.json` a `inventario.json`.
