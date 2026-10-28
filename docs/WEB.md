# Sitio web (cmvenezuela.com)

Sitio estático alojado en el Hostinger del cliente. No tiene servidor propio: lee el inventario real del bot (`https://crm.nexochatpro.cloud/catalogo.json`) y, si falla, usa `catalogo.json` local como respaldo.

## Archivos (`web/`)

| Archivo | Qué es |
|---|---|
| `plantilla_home.html` | Portada (fuente) |
| `plantilla_catalogo.html` | Catálogo (fuente) |
| `build.py` | Inserta el CSS común (`demo-flujo/catalogo_plantilla.html`) en las dos plantillas y genera `index.html` y `catalogo.html` |
| `index.html`, `catalogo.html` | Páginas generadas: **es lo que se publica** |
| `assets/` | Logo, favicon (el del cliente, «CM») e iconos |
| `catalogo.json` | Copia de respaldo del catálogo (no se sube a git; ver abajo) |

**Regla:** se edita siempre la plantilla y se vuelve a ejecutar `python3 build.py`. Nunca se edita `index.html` o `catalogo.html` a mano.

## Cómo funciona

### Ciudad primero
- Todos los buscadores empiezan con **«1. Tu ciudad»** (Maracay o Caracas). Hasta elegirla, el resto está atenuado.
- La ciudad se guarda en `localStorage` (`cm_ciudad`) y viaja en el enlace (`?ciudad=maracay`).
- Los resultados muestran por defecto solo lo que **tiene existencia en la ciudad**; el botón «Mostrar también los agotados» muestra el resto.
- **Maracay** = las dos tiendas (`t1` CM Maracay, `t2` Master Cauchos), con tasa **euro** BCV. **Caracas** = campo `c` de cada producto, con tasa **dólar** BCV (`ve.dolarapi.com`).
- Mientras ningún producto traiga el campo `c`, Caracas muestra «Estamos cargando el inventario de Caracas» / «Próximamente». Cuando exista inventario de Caracas, basta con que `catalogo.json` incluya `c` (0/1/2) en los productos: la web funciona sola. Falta además el número de WhatsApp de Caracas en `TIENDAS.c.wa` (`plantilla_catalogo.html`).

### Buscador de cauchos
- En la portada, el panel de cauchos aparece **al elegir «Cauchos»**: primero el **rin**, luego una lista con **las medidas disponibles en ese rin y ciudad**, y una barra para escribir que **sugiere medidas reales** (ignora `/`, espacios y `R`; «175 65» ofrece 175/65R14). Si lo escrito no existe, lo dice.
- En el catálogo las mismas dos casillas reemplazan a los botones de ancho/perfil/rin.

### Parámetros de la URL del catálogo
`?ciudad=` `cat=` (`cauchos|baterias|aceites|bicicletas`) `q=` `rin=` `medida=` `grupo=` `tipo=` `presentacion=` `marca=` `vm=` `vd=` `va=` (vehículo para baterías).

### Formato de `catalogo.json` (claves cortas)
Comunes: `m` marca, `u` precio USD, `b` equivalente USD en bolívares, `t1`/`t2` existencia en Maracay (0/1/2), `c` existencia en Caracas (futuro), `x` etiqueta, `i` foto.
Cauchos `z` medida, `r` rin · Baterías `d` descripción, `g` grupo, `k` grupos, `a` amperaje, `w` garantía · Aceites `t` tipo, `p` presentación · Bicicletas `r` rin, `d` modelo, `p` para quién, `co` colores · Compatibilidad `o` marca, `d` modelo, `a`/`b` años, `g` grupos, `r` texto del grupo.

### Secciones de la portada
Buscador, categorías (con contador por ciudad), atajos rápidos (medidas, rines, marcas y aceites con más opciones), «Compra con confianza», **Nuestras sedes** (dirección, horario, WhatsApp y Google Maps de cada sede) y pie de página.

## Compilar y probar

```bash
cd web
python3 build.py
python3 -m http.server 8765      # http://localhost:8765
```

El navegador puede guardar la página; para forzar recarga usa `?v=2` en la URL o recarga sin caché.

## Publicar

1. `python3 build.py`.
2. Subir por SSH al Hostinger (datos de acceso en tu gestor de contraseñas, no en este repositorio):

```bash
scp -i <llave> -P <puerto> index.html catalogo.html <usuario>@<host>:domains/cmvenezuela.com/public_html/
```

3. Verificar: `curl -s https://cmvenezuela.com/ | grep -c 'id="sedes"'`.

`public_html/.htaccess` (solo en el servidor) envía `Cache-Control: no-cache, must-revalidate` para `.html` y `.json`, así los clientes siempre ven la última versión:

```apache
<IfModule mod_headers.c>
<FilesMatch "\.(html|json)$">
Header set Cache-Control "no-cache, must-revalidate"
</FilesMatch>
</IfModule>
```

En la cuenta de Hostinger hay muchos sitios ajenos: **solo se toca** `domains/cmvenezuela.com/public_html`.

## Respaldo del catálogo

```bash
curl -s https://crm.nexochatpro.cloud/catalogo.json -o web/catalogo.json
scp ... web/catalogo.json <usuario>@<host>:domains/cmvenezuela.com/public_html/
```

## Imágenes PNG de las categorías (pendiente)

El CSS ya está listo (`.tile .pic`). Para activar las imágenes, agregar dentro de cada tarjeta de `#categorias` en `plantilla_home.html`:

```html
<img class="pic" src="assets/cat-cauchos.png" alt="" loading="lazy" onerror="this.remove()">
```

Si falta el archivo, la tarjeta conserva su ícono. Los PNG deben tener fondo transparente, 800–1.000 px y menos de 500 KB. Para baterías y aceites se prevén varias imágenes agrupadas, lo que requerirá un pequeño ajuste de diseño.
