# Requerimientos de la página web (reunión con el cliente, 2 nov 2026)

Cada cambio lleva su captura del antes y del después en esta carpeta. Estado: «hecho en local» = modificado y probado en el equipo, publicado = ya está en la web.

## 1. Botón «Escríbenos» de la cabecera
**Pedido:** al elegir una ciudad, el botón mostraba ambos números de Maracay aunque se eligiera Caracas. Debe mostrar solo los de la ciudad elegida.

| Ciudad elegida | Antes | Después |
|---|---|---|
| Ninguna | CM Maracay y Master Cauchos (Caracas no aparecía) | CM Maracay, Master Cauchos y CM Caracas |
| Maracay | CM Maracay y Master Cauchos | Igual: CM Maracay y Master Cauchos |
| Caracas | CM Maracay y Master Cauchos (error) | Solo CM Caracas |

**Número de Caracas:** CM Caracas usa el 0424-3188302. Con Caracas elegida el botón abre WhatsApp directo a ese número; sin ciudad aparece en la lista de los tres. También se activó el botón de WhatsApp en la tarjeta de la sede de Caracas (antes decía «próximamente»).

**Archivos:** `web/plantilla_home.html`, `web/plantilla_catalogo.html`, `demo-flujo/catalogo_plantilla.html` (estilo del número pendiente); se regeneran `web/index.html` y `web/catalogo.html` con `python3 web/build.py`.

**Capturas:** `01-escribenos-antes-sin-ciudad.jpg`, `01-escribenos-antes-caracas.png`, `01-escribenos-despues-sin-ciudad.png`, `01-escribenos-despues-maracay.png`, `01-escribenos-despues-caracas.png`.

**Estado:** publicado en cmvenezuela.com (2 nov 2026), con el número de Caracas. Falta subir todo a git.

## 2. Filtro «Medida disponible»: quitar el número entre paréntesis
**Pedido:** en el filtro de medidas, cada opción mostraba un número entre paréntesis (ej. «195/65R15 (16)»), que el cliente podía confundir con otra cosa (era la cantidad de productos de esa medida). Debe verse solo la medida.

| Antes | Después |
|---|---|
| 185/65R15 (6) | 185/65R15 |
| 195/65R15 (16) | 195/65R15 |

Aplica en la portada (buscador «Busca por medida») y en el catálogo. Las sugerencias que salen al escribir en el buscador siguen mostrando «N opciones» debajo de cada medida (no estaba entre paréntesis ni en el filtro; queda a decisión del cliente).

**Archivos:** `web/plantilla_home.html`, `web/plantilla_catalogo.html`; se regeneran con `python3 web/build.py`.

**Capturas:** `02-medidas-antes.jpg`, `02-medidas-despues.jpg` (lista de opciones desplegada, rin 15, Maracay).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 3. Filtro «Marca»: solo las marcas disponibles
**Pedido:** la lista del filtro de marcas traía todas las marcas del catálogo, tengan o no productos. Debe cargarse solo con las marcas que están disponibles.

**Cómo funciona ahora:** la lista solo incluye marcas con productos en existencia en la ciudad elegida y que cumplan los filtros ya escogidos (por ejemplo, el rin). Si el cliente cambia el rin, la lista se actualiza. Las marcas que solo existen en la otra ciudad o sin existencia ya no salen (con «Mostrar también los agotados» vuelven a aparecer). Aplica a cauchos, aceites y al filtro de marca de baterías.

| Caso (catálogo, Maracay, cauchos) | Antes | Después |
|---|---|---|
| Sin rin elegido | 99 marcas | 66 marcas |
| Rin 15 | 99 marcas | 36 marcas |

Se comprobó que cada marca de la lista da al menos un resultado.

**Archivos:** `web/plantilla_catalogo.html`; se regenera con `python3 web/build.py`. La portada no tiene este filtro (solo accesos directos por marca, que ya mostraban solo las marcas con existencia).

**Capturas:** `03-marcas-antes.jpg`, `03-marcas-despues.jpg` (lista de marcas desplegada, rin 15, Maracay).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 4. Precios de los productos: «Oferta en divisa» y tasa euro sin símbolo de dólar
**Pedido:** en el listado de productos, cambiar el texto «pagando en dólares» por «Oferta en divisa», y quitar el símbolo de dólar donde aparece la tasa euro.

| | Antes | Después |
|---|---|---|
| Etiqueta del precio | $25 pagando en dólares | $25 Oferta en divisa |
| Monto a tasa euro | ($27 a tasa euro) | (27 a tasa euro) |

El precio grande sigue con su «$» (es el precio en divisa) y la línea en bolívares no cambia. El «$» solo se quita en la línea de la tasa euro (Maracay); la de Caracas, que usa la tasa del dólar BCV, queda como estaba.

**Archivos:** `web/plantilla_catalogo.html` (las tarjetas de producto); se regenera con `python3 web/build.py`. La portada no muestra tarjetas de precio.

**Capturas:** `04-precios-antes.jpg` (web publicada), `04-precios-despues.jpg` (Maracay, cauchos).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 5. «Consultar por WhatsApp» de cada producto: elegir la tienda en Maracay
**Pedido:** al pulsar «Consultar por WhatsApp» en un producto, si la ciudad es Maracay debe dar la opción de elegir la tienda.

| | Antes | Después |
|---|---|---|
| Maracay | Abría WhatsApp directo a una sola tienda (la de más existencia, normalmente CM Maracay) | Abre una lista «Elige la tienda» con CM Maracay y Master Cauchos; el cliente elige y se abre WhatsApp de esa tienda |
| Caracas | Abre WhatsApp directo | Igual (una sola tienda) |

Cada opción indica si esa tienda tiene el producto («Disponible» o «Sin existencia ahora»). El mensaje se adapta: «Vi que está en {tienda}» si la tiene, o «Les escribo a {tienda}» si no. La lista se cierra al pulsar fuera o al abrir la de otro producto.

**Archivos:** `web/plantilla_catalogo.html` (tarjetas de producto); se regenera con `python3 web/build.py`.

**Capturas:** `05-consultar-antes.jpg` (web publicada), `05-consultar-despues.jpg` (lista de tiendas abierta, Maracay).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 6. Tarjeta del caucho: modelo, servicios incluidos y más especificaciones
**Pedido:** (a) agregar a la tarjeta los servicios que vienen con la compra de los cauchos; (b) mostrar el modelo del caucho; (c) mostrar más detalles de las especificaciones. Lo de (a) y (c) lo debe enviar el cliente; se deja la tarjeta preparada y un ejemplo impreso.

**(b) Modelo — hecho y activo con los datos actuales.** Antes el modelo salía pegado a la marca («HAIDA RUNSPIRIT») o no salía. Ahora la línea superior muestra solo la marca y debajo de la medida aparece «Modelo Runspirit». En el catálogo actual 817 de 1.108 cauchos traen el modelo en el nombre (ej. HT, AT, SP716, ES31); los demás no muestran línea de modelo porque no hay dato. Si el cliente agrega el modelo en la columna «Modelo» del Excel, también se usa.

**(d) Tipo y lonas junto a la marca — hecho y activo con los datos actuales.** A la derecha de la marca se muestra el tipo del caucho y, entre paréntesis, la cantidad de lonas: «AT (6 lonas)», «AT (10 lonas)», «HT». Se leen del nombre del producto (tipos HT, AT, MT, RT, Direccional, Mixto; lonas como «6Pr», «(10 Pr)») o del dato extra «18 Lonas». Con el catálogo actual: 663 de 1.108 cauchos tienen tipo y 133 tienen lonas; los que no traen ese dato no muestran nada. Al salir el tipo en esa línea, ya no se repite como «Modelo» (ej. «Haida HT» muestra HT a la derecha y sin línea de modelo; «Sportrak SP726 HT» muestra SP726 como modelo y HT a la derecha). Si ya viene «18 Lonas» como etiqueta, no se repite.

**(e) Etiquetas «Marca», «Tipo» y «Modelo».** Debajo de la medida, la tarjeta muestra «MARCA Sportrak» a la izquierda y «TIPO AT (10 lonas)» a la derecha, en la misma línea (el tipo lleva las lonas entre paréntesis), y debajo «MODELO SP786». Cada etiqueta lleva su valor a la derecha. Lo que no tiene dato no se muestra; si el espacio no alcanza, el tipo baja a la línea siguiente. Los servicios incluidos y las especificaciones se mantienen en la misma tarjeta (ver (a) y (c)).

**(a) Servicios incluidos — preparado, sin datos.** En `web/plantilla_catalogo.html` hay una lista `SERVICIOS_COMPRA` (hoy vacía). Cuando el cliente confirme cuáles servicios incluye la compra (por ejemplo montura, balanceo…), se escriben ahí y todas las tarjetas de cauchos muestran el recuadro «Incluye con tu compra». Mientras esté vacía no se muestra nada.

**(c) Especificaciones — preparado, sin datos.** La tarjeta muestra un desplegable «Ver especificaciones» cuando el producto trae el campo `e` con pares etiqueta/valor (ej. índice de carga, índice de velocidad, tipo) o los atajos `ic` e `iv`. Falta que el cliente indique qué datos quiere y en qué columnas del Excel vienen; luego se conecta el cargador de inventario del bot para enviarlos a la web.

**Apartados siempre visibles.** Para que se vea cómo queda la tarjeta, los apartados «Incluye con tu compra» y «Ver especificaciones» aparecen en todas las tarjetas de cauchos; mientras el cliente no envíe los datos dicen «Por confirmar». Al cargar los datos reales se reemplaza ese texto por el contenido. Se controla con `MOSTRAR_PENDIENTES` en `web/plantilla_catalogo.html` (true = mostrarlos con «Por confirmar»; false = ocultar los que no tengan datos). Antes de publicar conviene decidir cuál de las dos opciones se deja.

**Pendiente del cliente:** lista de servicios incluidos y lista de especificaciones (con su dato por cada caucho).

**Archivos:** `web/plantilla_catalogo.html`; se regenera con `python3 web/build.py`.

**Capturas:** `06-tarjeta-antes.jpg` (web publicada), `06-tarjeta-despues.jpg` (modelo separado, datos reales), `06-tarjeta-tipo-lonas.jpg` (tipo y lonas a la derecha de la marca, sin etiquetas), `06-tarjeta-etiquetas.jpg` (tarjeta completa con datos reales: etiquetas, «Incluye con tu compra» y «Ver especificaciones» con «Por confirmar»), `06-tarjeta-ejemplo-servicios-especificaciones.jpg` (EJEMPLO con todo junto: etiquetas, servicios incluidos y especificaciones; datos de muestra marcados como tal, no son del cliente).

**Estado:** publicado en cmvenezuela.com (2 nov 2026): modelo, tipo y lonas con datos reales; servicios incluidos y especificaciones visibles con «Por confirmar» hasta que el cliente envíe los datos. Falta subir todo a git.

## 7. Baterías: filtro «Encuentra tu batería» con el estilo de la portada
**Pedido:** en la sección de baterías del catálogo, mantener el estilo del filtro de baterías como en el inicio (portada) y poner «Encuentra tu batería» en el título.

| | Antes | Después |
|---|---|---|
| Título | «Encontrar batería» | «Encuentra tu batería» |
| Estilo | Barra de título oscura centrada, etiquetas a un lado y campos oscuros con letra amarilla, botón «Buscar» con icono | Igual al buscador de la portada: tarjeta blanca centrada en la página, título centrado, etiquetas pequeñas sobre cada campo (Marca, Modelo, Año), campos claros uno bajo otro y botón amarillo ancho «Ver baterías» |

La función no cambia: Marca → Modelo → Año, el botón se activa al completar los tres y se muestra la recomendación de grupo con «Quitar vehículo». Hoy el catálogo aún no tiene la tabla de compatibilidad de vehículos cargada, así que los campos salen desactivados con el aviso «Muy pronto podrás buscar…» (igual que antes).

**Archivos:** `web/plantilla_catalogo.html` (estilos y título del buscador de vehículo); se regenera con `python3 web/build.py`.

**Capturas:** `07-baterias-antes.jpg` (web publicada), `07-baterias-despues.jpg` (datos reales, campos desactivados), `07-baterias-despues-con-vehiculo-ejemplo.jpg` (con compatibilidad de MUESTRA para ver el estado activo; el letrero rojo lo indica, no son datos del cliente).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 8. Baterías, filtro «Grupo»: quitar la palabra «grupo» de las opciones
**Pedido:** quitar la palabra «grupo» del filtro, ya que por el título de la lista se entiende que es grupo.

| Opciones de la lista «Grupo» | Antes | Después |
|---|---|---|
| | GRUPO 4D · GRUPO 22 Y 42 · GRUPO 24 · GRUPO 27 · GRUPO 34 … | 4D · 22 Y 42 · 24 · 27 · 34 … |
| Sin cambio | 30H (BORNE) · 30H (TORNILLO) · PARA AVEO · PARA OPTRA | igual (no llevaban la palabra «grupo») |

El filtro sigue funcionando igual: al elegir «24» solo quedan las baterías del grupo 24. La etiqueta «Grupo» sobre la lista y la opción «Todos los grupos» se mantienen. No se tocaron las etiquetas dentro de las tarjetas de batería (ahí sigue «GRUPO 24»); si el cliente quiere quitarlas también, es un cambio aparte.

**Archivos:** `web/plantilla_catalogo.html`; se regenera con `python3 web/build.py`.

**Capturas:** `08-grupo-antes.jpg` (web publicada), `08-grupo-despues.jpg` (lista de opciones desplegada).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 9. No mostrar productos si el cliente no ha buscado nada (todas las categorías)
**Pedido:** no mostrar el listado si la persona no ha buscado nada en los filtros; aplica a las diferentes categorías.

| Categoría (Maracay, sin filtros) | Antes | Después |
|---|---|---|
| Cauchos | 491 resultados listados | Ninguno: mensaje «Usa los filtros para ver los productos» |
| Baterías | 8 listadas | Ninguna: mismo mensaje |
| Aceites | 48 listados (primera página) | Ninguno: mismo mensaje |
| Bicicletas | 30 listadas | Ninguna: mismo mensaje |

Cada categoría indica qué hacer: cauchos («Elige el rin y la medida, la marca, o escribe la medida»), baterías («Elige tu vehículo, el grupo o la marca»), aceites («Elige el tipo, la viscosidad o la marca, o escribe lo que buscas») y bicicletas («Elige el rin o escribe el modelo»).

**Cuándo sí se muestran:** en cuanto el cliente elige cualquier filtro (rin, medida, marca, grupo, tipo, viscosidad…), escribe en el buscador, toca una marca de la cinta, o llega desde la portada con una medida o marca ya elegida. «Mostrar también los agotados» solo no cuenta como búsqueda. «Limpiar» o cambiar de categoría vuelve al estado sin productos. Antes de elegir ciudad sigue saliendo «Elige tu ciudad para empezar».

Se comprobó en las cuatro categorías: sin filtros 0 tarjetas; con filtro, aparecen (cauchos rin 15: 48 en la primera página; baterías grupo 24: 1; aceites con marca: 12; bicicletas con filtro: 6).

**Archivos:** `web/plantilla_catalogo.html`; se regenera con `python3 web/build.py`.

**Capturas:** `09-sin-busqueda-antes.jpg` (web publicada: 491 cauchos sin buscar), `09-sin-busqueda-despues.jpg` (mensaje en lugar del listado).

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 10. Aceites: los combos incluyen filtro
**Pedido:** los combos de aceite incluyen filtro; el detalle de esa información lo enviará el cliente.

| | Antes | Después |
|---|---|---|
| Tarjeta de un combo (4 litros o más) | Solo «4 Litros»; no decía nada del filtro (solo el recuadro de filtros decía «Incluye filtro + servicio GRATIS») | Recuadro «Incluye con tu combo: Filtro» y la línea «Detalle del filtro: por confirmar» |
| Tarjeta de 1 litro o paila | Sin cambio | Sin cambio (no es combo) |

Solo los combos llevan el apartado (en Maracay hoy: 22 combos de 4 litros). **Preparado para el detalle:** cuando el cliente indique qué filtro incluye (marca, tipo…), se escribe en `COMBO_DETALLE` en `web/plantilla_catalogo.html` y la línea «por confirmar» se reemplaza por ese texto («Filtro · detalle»). Con `MOSTRAR_PENDIENTES = false` (el mismo interruptor del requerimiento 6) la línea «por confirmar» se oculta y queda solo «Filtro».

**Pendiente del cliente:** detalle del filtro que incluye cada combo. Además, el texto del filtro de combos dice «Incluye filtro + servicio GRATIS»: conviene que el cliente confirme si el servicio gratis también aplica a todos los combos.

**Archivos:** `web/plantilla_catalogo.html`; se regenera con `python3 web/build.py`.

**Capturas:** `10-combos-aceite-antes.jpg` (web publicada), `10-combos-aceite-despues.jpg`.

**Estado:** publicado en cmvenezuela.com (2 nov 2026). Falta subir todo a git.

## 11. Panel de administración ajustado a lo nuevo
**Pedido:** que el panel de administración (gestión de productos, especificaciones, etc.) esté ajustado a lo que se agregó en la web.

| Antes | Ahora |
|---|---|
| El formulario de cauchos solo pedía marca y medida; modelo y tipo solo entraban por Excel | Campos **Modelo**, **Tipo**, **Lonas** y **Especificaciones** (una por línea, «Nombre: valor») |
| No existían las especificaciones | Se guardan por caucho y la web las muestra en «Ver especificaciones»; Nexo también las ve |
| Servicios incluidos y detalle del filtro de combos estaban escritos en el código de la web | Sección **Ajustes de la web** en el panel (acceso directo arriba): servicios, detalle del filtro e interruptor de «Por confirmar»; se ven al instante, sin republicar la web |
| Sin existencia de Caracas | Campo **Hay en CM Caracas** (vacío = aún sin dato); la web y Nexo lo usan |
| El Excel nuevo no leía las lonas | Se lee la columna LONAS |

**Archivos:** `bot/src/lista.js`, `bot/src/admin.html`, `bot/src/store.js`, `bot/src/tools.js`, `web/plantilla_catalogo.html`; prueba `bot/scripts/probar_panel.mjs` (18 comprobaciones).

**Capturas:** `11-panel-formulario-cauchos.jpg`, `11-panel-ajustes-web.jpg`.

**Estado:** desplegado el 2 de noviembre de 2026: panel en el servidor y web publicada en cmvenezuela.com. Falta subir el código a git.

## 12. Rediseño del panel de administración
**Pedido:** el panel no gusta; se puede mejorar: diseño y aspecto, más fácil de usar, un inicio con resumen y poder modificar precio, especificaciones, etc. de cada producto.

| Antes | Ahora |
|---|---|
| Una sola página larga con pestañas y todo al final | Navegación lateral (Inicio, categorías, Ajustes de la web, Cargar Excel) con el contador de cada categoría |
| Sin pantalla de inicio | **Inicio** con el resumen: productos por categoría y cuántos están sin foto, sin precio, agotados o sin dato de Caracas (cada número abre la lista ya filtrada), ajustes de la web y consumo semanal de Nexo |
| Para cambiar un precio había que abrir cada producto | **Edición rápida en la lista:** precio, equivalente en bolívares y existencias (CM Maracay, Master Cauchos, Caracas) se cambian en la misma fila y se guardan solos |
| Solo búsqueda y marca | Filtros por chip (sin foto, sin precio, agotados, sin dato de Caracas) y orden por marca, precio o existencia |
| Formulario largo y plano | Formulario con secciones (Producto, Precio y existencias, Foto) y botones fijos; modelo, tipo, lonas y especificaciones siguen ahí |

**Archivos:** `bot/src/admin.html` (rediseño completo), `bot/src/lista.js` (`GET /admin/api/resumen` y `PATCH …/items/:sku`), prueba `bot/scripts/probar_panel.mjs` (25 comprobaciones).

**Capturas:** `12-panel-inicio.jpg`, `12-panel-lista-editable.jpg`, `12-panel-formulario.jpg`.

**Estado:** hecho, probado en local y desplegado en el servidor (2 nov 2026).

## 13. Servicios incluidos según la marca o el modelo (panel + web + Nexo)

**Qué pidió el cliente:** los servicios que vienen con la compra no aplican a todos los cauchos; pueden variar por marca o por modelo. La lista real la enviará el cliente.

**Cómo quedó (estructura lista, sin datos reales):**
- En *Ajustes de la web*: servicios generales (para todos) y **reglas** `marca` o `marca + modelo` con sus servicios. Los de una regla se suman a los generales; sin repetir.
- En el formulario de cada caucho: *Servicios solo de este caucho*; con «-» delante se quita uno general solo para ese producto (ej. `-Balanceo`).
- La marca coincide aunque el modelo venga dentro de ella («Sportrak SP716» recibe las reglas de «Sportrak»); «Sportrakers» no.
- El catálogo trae `sv` (lista final) en cada caucho; la tarjeta muestra «Incluye con tu compra» con esa lista, o «Por confirmar» si no hay. Nexo recibe `servicios_incluidos` en `buscar_cauchos`.

**Archivos:** `bot/src/lista.js` (`serviciosDe`, reglas en `/ajustes`), `bot/src/tools.js`, `bot/src/admin.html`, `web/plantilla_catalogo.html`, prueba `bot/scripts/probar_panel.mjs` (35 comprobaciones).

**Estado:** hecho, probado en local y desplegado (2 nov 2026); falta cargar la lista del cliente.

## 14. Reglas de servicios: listas de marcas y modelos y contador de alcance

**Por qué:** al probar una regla («Milemax» + «SP716») no se veía en la web porque ningún Milemax es SP716, y nada lo avisaba.

**Cómo quedó:**
- La marca y el modelo de cada regla se eligen de una lista (se puede escribir a mano). La marca es la primera palabra del nombre; el modelo sale del campo modelo, o de la palabra con número que sigue a la marca («Sportrak SP716 HT» → SP716), sin confundirla con tipos ni lonas. Con la columna MODELO del Excel nuevo la lista será exacta.
- Cada regla muestra «Aplica a N cauchos» o, si no alcanza a ninguno, «No aplica a ningún caucho: revisa la marca y el modelo».

**Archivos:** `bot/src/lista.js` (`coincide`, `opcionesMarcas`, `GET /admin/api/ajustes/opciones`, `POST /admin/api/ajustes/alcance`), `bot/src/admin.html`, prueba `bot/scripts/probar_panel.mjs` (40 comprobaciones).

**Estado:** hecho, probado en local y desplegado en el servidor (2 nov 2026); la web no cambia.

## 15. Filtro por modelo en el catálogo de cauchos

**Qué faltaba:** además del filtro de marca, poder filtrar los cauchos por modelo.

**Cómo quedó:** al elegir una marca aparece la lista «Modelo» (por ejemplo, Sportrak → SP716, SP726, SP778…). Solo trae los modelos de esa marca que hay en la ciudad elegida y con los demás filtros ya puestos (rin, medida, texto). Si la marca no tiene modelos, el filtro no aparece. Al cambiar de marca, o al pulsar «Limpiar», el modelo se borra. La lista de marcas no se reduce al elegir un modelo. Los modelos salen del campo modelo del catálogo o, si no lo hay, del nombre del producto, igual que el «Modelo» de la tarjeta.

**Archivos:** `web/plantilla_catalogo.html` (`modelosDisp`, parámetro `sinModelo` en `filtrar`) y `web/catalogo.html` (generado).

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (2 nov 2026).

## 16. Panel: el modelo de cada regla se elige de una lista filtrada por la marca

**Qué faltaba:** en el panel, al crear la regla de servicios, el campo «Modelo» no filtraba por la marca elegida (era un campo de texto con sugerencias).

**Cómo quedó:** el modelo es una lista desplegable. Sin marca dice «Primero la marca» y está desactivada; al escribir o elegir la marca se llena con los modelos de esa marca (Sportrak → SP366, SP706, SP716…) y la primera opción es «Toda la marca». Al cambiar la marca, el modelo vuelve a «Toda la marca». Un modelo ya guardado se conserva aunque ya no esté en el inventario. El contador «Aplica a N cauchos» sigue funcionando.

**Archivos:** `bot/src/admin.html` (`filaRegla`).

**Estado:** hecho, probado en local y desplegado en el servidor (2 nov 2026).

## 17. Panel: no se podía guardar un vehículo (Vehículos → batería)

**Qué pasaba:** al pulsar «Guardar» en un vehículo nuevo no ocurría nada. El formulario es el mismo de los productos y su campo «Precio en dólares» es obligatorio; en los vehículos ese campo está oculto, y el navegador bloqueaba el envío sin mostrar ningún aviso.

**Arreglo:** el precio solo es obligatorio cuando no se está en Vehículos → batería. Los productos siguen exigiéndolo.

**Archivos:** `bot/src/admin.html` (`abrir`).

**Estado:** arreglado, probado en local (un vehículo nuevo se guarda y aparece en la lista) y desplegado en el servidor (2 nov 2026).

## 18. Panel: icono de la pestaña (favicon)

**Qué faltaba:** las páginas `/admin` y `/admin/uso` no tenían icono en la pestaña del navegador ni al guardarlas en la pantalla de inicio.

**Cómo quedó:** usan los mismos iconos de la web (`favicon.ico`, `icon-192.png`, `apple-touch-icon.png`), cargados desde `cmvenezuela.com/assets`, como ya se hace con el logo del panel.

**Archivos:** `bot/src/admin.html`, `bot/src/uso.html`.

**Estado:** hecho y desplegado en el servidor (2 nov 2026).

## 19. Portada en móvil: las tarjetas de categorías y servicios, de a 2

**Qué pidió el cliente (reunión del 3 nov):** en la versión móvil, que las tarjetas del Home (categorías y servicios) se muestren de a 2.

**Cómo quedó:** en pantallas de hasta 639 px, «¿Qué estás buscando?» muestra Cauchos y Baterías en la primera fila, Aceites y Bicicletas en la segunda, y **Servicios ocupa el ancho completo** en la tercera (son 5 tarjetas, así que no queda una suelta a medias). Las tarjetas se hicieron más compactas (título, icono, textos e insignia «N disponibles» más pequeños) para que nada se corte. En tablet (3 por fila) y escritorio (5 por fila) no cambia nada.

**Archivos:** `web/plantilla_home.html` (CSS de `.tiles` y `.tile` en móvil) y `web/index.html` (generado).

**Capturas:** `19-home-tarjetas-movil-antes.jpg`, `19-home-tarjetas-movil-despues.jpg`.

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).

## 20. Nuevo apartado «Otros» y nuevo orden de las secciones

**Qué pidió el cliente (reunión del 3 nov):** agregar un apartado «Otros», dejarlo antes de Bicicletas, y poner Bicicletas después de Servicios.

**Cómo quedó:**
- **Tarjetas de la portada:** Cauchos, Baterías, Aceites, **Servicios, Otros, Bicicletas**. En móvil son 3 filas de 2 (ya no hace falta que Servicios ocupe todo el ancho); en escritorio, las 6 en una fila (título y relleno algo menores para que «Bicicletas» quepa).
- **Menú y buscador de la portada y pestañas del catálogo:** Cauchos, Baterías, Aceites, **Otros**, Bicicletas (Servicios no es una pestaña, es un enlace a WhatsApp).
- **«Otros» todavía sin productos:** el catálogo muestra «Estamos preparando esta sección… escríbenos por WhatsApp», sin buscador. El catálogo ya lee una lista `otros` de `catalogo.json` (campos `m` marca y `d` descripción, más precio y existencias como las demás categorías), así que cuando el cliente diga qué lleva, solo falta cargarla desde el panel.
- Se interpretó el orden pedido como Servicios → Otros → Bicicletas.

**Pendiente:** que el cliente diga qué productos van en «Otros» y, para cargarlos, agregar esa categoría al panel y al Excel.

**Archivos:** `web/plantilla_home.html`, `web/plantilla_catalogo.html` y los generados `index.html` y `catalogo.html`.

**Capturas (móvil):** `20-home-otros-movil-antes.jpg`, `20-home-otros-movil-despues.jpg`.

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).

## 21. Tarjeta de Servicios con el mismo diseño que las demás

**Qué pidió el cliente (reunión del 3 nov):** que la tarjeta de Servicios tenga el diseño de las otras tarjetas.

**Cómo quedó:** la tarjeta de Servicios dejó su fondo blanco con borde y ahora es oscura, con el icono amarillo y el mismo texto gris claro y brillo de las demás. El texto («Montura, balanceo, rotación y alineación. Pregúntanos por WhatsApp.») y el enlace a WhatsApp no cambiaron. Como esa descripción es más larga, en móvil la fila de Aceites y Servicios queda un poco más alta que las otras; en escritorio todas miden lo mismo.

**Archivos:** `web/plantilla_home.html` (se quitaron los estilos propios de `.tile.srv`) y `web/index.html` (generado).

**Capturas (móvil):** `21-servicios-tarjeta-antes.jpg`, `21-servicios-tarjeta-despues.jpg`.

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).

## 22. Tarjeta de Servicios: WhatsApp según la ciudad

**Qué pidió el cliente (reunión del 3 nov):** que la tarjeta de Servicios lleve al WhatsApp de la ciudad elegida y que, si es Maracay, deje escoger la tienda.

**Antes:** abría siempre el WhatsApp de CM Maracay, sin importar la ciudad.

**Cómo quedó:**
- **Caracas:** abre directamente el WhatsApp de CM Caracas con el mensaje «Hola, quiero consultar por servicios (montura, balanceo, alineación)».
- **Maracay:** muestra un menú «Servicios: elige la tienda» con CM Maracay y Master Cauchos (nombre y dirección); cada opción abre su WhatsApp con el mismo mensaje.
- **Sin ciudad elegida:** el menú muestra las tres tiendas, igual que el botón «Escríbenos» de la barra. (Si se prefiere pedir primero la ciudad, es un cambio pequeño.)
- Un segundo toque en la tarjeta o tocar fuera cierra el menú; en móvil queda dentro de la pantalla.

**Archivos:** `web/plantilla_home.html` (`waItems`, `MSG_SERV`, menú `#svmenu`) y `web/index.html` (generado).

**Captura (móvil, Maracay):** `22-servicios-whatsapp-maracay.jpg`.

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).

## 23. «Ver especificaciones» en una ventana emergente

**Qué pidió el cliente (reunión del 3 nov):** que al pulsar «Ver especificaciones» en la tarjeta de un caucho salga un popup y no se despliegue dentro de la tarjeta, para no alargarla.

**Antes:** el texto se abría dentro de la tarjeta y la estiraba (ver `23-especificaciones-antes.jpg`).

**Cómo quedó:** «Ver especificaciones» es un botón (con un icono de información) que abre una ventana emergente con el título «Especificaciones», la marca, el modelo y la medida del caucho, y la lista de especificaciones. La tarjeta no cambia de tamaño. Se cierra con la ×, con «Cerrar», tocando fuera de la ventana o con Esc. Si el caucho aún no tiene especificaciones, la ventana dice «Por confirmar» (como antes, mientras «Mostrar Por confirmar» esté activo en Ajustes de la web). Captura: `23-especificaciones-popup.jpg`.

**Archivos:** `web/plantilla_catalogo.html` (`bloqueCaucho`, `#espdlg`) y `web/catalogo.html` (generado).

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).

## 24. Tarjeta de caucho: marca y modelo destacados, sin «Rin», lo que incluye al final, y precios en REF

**Qué pidió el cliente (reunión del 3 nov):**
1. Que la marca y el modelo del caucho destaquen más.
2. Quitar «Rin 16» de la tarjeta del caucho.
3. Bajar «Incluye con tu compra» y «Ver especificaciones» al final de la tarjeta.
4. En los precios en divisas, quitar el signo de dólar y poner **REF**; también en la línea de la tasa euro. Aplica a todos los productos.

**Cómo quedó:**
- **Marca y modelo** con letra más grande (19 px en lugar de 14) y en negrita; el tipo (HT, AT…) se queda al lado derecho con su tamaño de antes.
- **Sin «Rin N»:** el rin sigue sirviendo para filtrar y buscar, pero ya no sale como etiqueta en la tarjeta. Si la tarjeta se queda sin etiquetas, no deja espacio vacío.
- **Orden de la tarjeta:** medida, marca/modelo/tipo, disponibilidad, **precio, botón de WhatsApp** y, al final, «Incluye con tu compra» y «Ver especificaciones». (Se interpretó «de último» como debajo del botón; si se prefiere entre el precio y el botón, es un cambio pequeño.) En los aceites el bloque del filtro de los combos queda donde estaba.
- **REF:** el precio principal pasa de «$52» a «REF 52» (con REF más pequeño), y la línea de la tasa de «(55 a tasa euro)» a «(REF 55 a tasa euro)». Se verificó en cauchos, baterías, aceites y bicicletas; no queda ningún signo «$» en las tarjetas.

**Archivos:** `web/plantilla_catalogo.html` (`ref`, `refGrande`, `datosCaucho`, `card`, estilos) y `web/catalogo.html` (generado).

**Capturas (móvil, el mismo caucho):** `24-tarjeta-caucho-antes.jpg`, `24-tarjeta-caucho-despues.jpg`.

**Estado:** hecho, probado en local y publicado en cmvenezuela.com (3 nov 2026).
