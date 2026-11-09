"""Resumen de cambios del 5 y 6 de noviembre de 2026 para CM Venezuela (mismo formato de los resúmenes anteriores).
Uso: python3 docs/resumen-cambios/generar_resumen_6_nov.py  ->  documentos/Resumen_cambios_6_nov_CM_Venezuela.pdf
Las capturas están en docs/resumen-cambios/img (de cmvenezuela.com, vista de celular)."""
import pathlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether, Image, CondPageBreak
from reportlab.lib.utils import ImageReader

aqui = pathlib.Path(__file__).resolve().parent
salida = aqui.parents[1] / 'documentos' / 'Resumen_cambios_6_nov_CM_Venezuela.pdf'
IMG = aqui / 'img'
FECHA = '5 y 6 de noviembre de 2026'
NEGRO, GRIS, GRIS_CLARO, AMARILLO, VERDE, AMBAR, LINEA, ZEBRA = HexColor('#141414'), HexColor('#5b5b55'), HexColor('#cfcfc8'), HexColor('#f5d90a'), HexColor('#0b7a4b'), HexColor('#b27700'), HexColor('#e3e3dc'), HexColor('#f6f6f1')
W, H = A4
MARGEN = 54
ANCHO = W - 2 * MARGEN

normal = ParagraphStyle('n', fontName='Helvetica', fontSize=9.4, leading=13, textColor=NEGRO)
suave = ParagraphStyle('s', parent=normal, textColor=GRIS, fontSize=10.2, leading=14.5)
h1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=14.5, leading=18, textColor=NEGRO, spaceAfter=4)
h2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=NEGRO, spaceBefore=10, spaceAfter=5, keepWithNext=1)
sub = ParagraphStyle('sub', fontName='Helvetica-Bold', fontSize=9.4, leading=13, textColor=NEGRO, spaceBefore=5, spaceAfter=2)
punto = ParagraphStyle('p', parent=normal, leftIndent=11, bulletIndent=2, spaceAfter=1.5)
celda = ParagraphStyle('c', parent=normal, fontSize=8.8, leading=11.6)
celda_b = ParagraphStyle('cb', parent=celda, fontName='Helvetica-Bold')
pie_img = ParagraphStyle('pi', fontName='Helvetica-Bold', fontSize=7.8, leading=10, textColor=GRIS, alignment=1)


def pie(c, doc):
    c.saveState()
    c.setStrokeColor(LINEA); c.setLineWidth(0.6); c.line(MARGEN, 36, W - MARGEN, 36)
    c.setFont('Helvetica', 8.2); c.setFillColor(GRIS)
    c.drawString(MARGEN, 24, f'CM Venezuela · Resumen de cambios · {FECHA}')
    c.drawRightString(W - MARGEN, 24, f'Página {doc.page}')
    c.restoreState()


def primera(c, doc):
    c.saveState()
    c.setFillColor(NEGRO); c.rect(0, H - 92, W, 92, fill=1, stroke=0)
    c.setFillColor(AMARILLO); c.rect(0, H - 100, W, 8, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 17); c.drawString(MARGEN, H - 42, 'CM VENEZUELA')
    c.setFillColor(GRIS_CLARO); c.setFont('Helvetica', 10.5)
    c.drawString(MARGEN, H - 62, 'Resumen de cambios  |  panel, tarjetas del catálogo, compatibilidad de baterías y página de inicio')
    c.restoreState()
    pie(c, doc)


def bullets(lista):
    return [Paragraph(t, punto, bulletText='•') for t in lista]


ESTADO_COLOR = {'Publicado': VERDE, 'En producción': VERDE, 'En prueba': AMBAR, 'Pendiente': AMBAR}


def encabezado(n, titulo, estado):
    num = Paragraph(f'<font color="#141414"><b>{n}</b></font>', ParagraphStyle('num', fontName='Helvetica-Bold', fontSize=11, alignment=1, leading=14))
    tit = Paragraph(f'<b>{titulo}</b>', ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=11.6, leading=14.5, textColor=NEGRO))
    est = Paragraph(f'<font color="{ESTADO_COLOR.get(estado.split(" · ")[0], VERDE).hexval().replace("0x", "#")}"><b>{estado.split(" · ")[0]}</b></font>', ParagraphStyle('e', fontName='Helvetica-Bold', fontSize=8.6, leading=11, alignment=2))
    t = Table([[num, tit, est]], colWidths=[30, ANCHO - 30 - 92, 92])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (0, 0), AMARILLO), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (1, 0), (1, 0), 10), ('RIGHTPADDING', (2, 0), (2, 0), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LINEBELOW', (0, 0), (-1, 0), 0.6, LINEA)]))
    return t


def imagenes(lista, ancho_img=150):
    celdas, pies = [], []
    for archivo, leyenda in lista:
        ir = ImageReader(str(IMG / archivo)); iw, ih = ir.getSize()
        celdas.append(Image(str(IMG / archivo), width=ancho_img, height=ancho_img * ih / iw)); pies.append(Paragraph(leyenda, pie_img))
    n = len(celdas)
    t = Table([celdas, pies], colWidths=[ANCHO / n] * n)
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, 0), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    return t


def tabla(cabecera, filas, anchos, zebra=True):
    datos = [[Paragraph(f'<b>{c}</b>', ParagraphStyle('th', parent=celda_b, textColor=NEGRO)) for c in cabecera]] + [[Paragraph(str(x), celda) for x in f] for f in filas]
    t = Table(datos, colWidths=anchos, repeatRows=1)
    est = [('BACKGROUND', (0, 0), (-1, 0), AMARILLO), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), 0.5, LINEA), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
    if zebra:
        est += [('BACKGROUND', (0, i), (-1, i), ZEBRA) for i in range(2, len(datos), 2)]
    t.setStyle(TableStyle(est))
    return t


CAMBIOS = [
    dict(t='Carga del inventario por Excel, con revisión antes de publicar', e='En producción · faltan datos del cliente', falta_res='Códigos, existencias y precios',
         pedido=['Cargar los archivos de Excel del cliente (inventario con varias pestañas y tabla de compatibilidad) y poder revisar antes de publicar.'],
         quedo=['El panel lee las pestañas del archivo por el nombre de sus columnas: cauchos, baterías, aceites, otros artículos, bicicletas, compatibilidad y dimensiones.',
                'Después de subir el archivo aparece una <b>vista previa por categoría</b> con lo que se va a publicar; cada categoría se confirma por separado.',
                'Si se vuelve a cargar una lista con precios u otros datos distintos, el panel avisa qué cambia en cada producto y cuáles fueron <b>editados a mano</b> antes de pisarlos.',
                'Nunca se publica una categoría vacía: así no se borra lo que ya está publicado.',
                'Como el archivo aún no trae códigos de producto, se hizo una carga especial sin códigos para que la web y Nexo ya trabajen con los productos.'],
         falta=['Código CM o MC de cada producto y existencias reales de cada tienda (columnas CM y MC).']),
    dict(t='Productos sin precio cargado se muestran como agotados', e='En producción',
         pedido=['El cliente indicó que un producto sin precio cargado es porque no hay en inventario.'],
         quedo=['Los <b>606 productos</b> que no tenían precio (49 baterías, 204 cauchos, 335 aceites y 18 bicicletas) pasaron a agotados en las dos tiendas de Maracay; los precios y demás datos no cambiaron.',
                'En la web salen solo al activar «Mostrar también los agotados» y Nexo los ve como agotados.',
                'La regla también aplica a las próximas cargas: cuando el archivo no trae existencias, un producto con precio queda como «hay» y uno sin precio queda agotado.']),
    dict(t='Tasa del BCV: corrección y control desde el panel', e='En producción',
         pedido=['Corregir la tasa euro, que aparecía mal, y poder actualizarla desde el panel sin depender de nadie.'],
         quedo=['La tasa se lee sola de la API y se actualiza sin intervención; la corrección detecta cuando la API trae un valor fuera de escala.',
                'En el panel se puede <b>fijar la tasa a mano</b> (vale solo ese día) y hay un botón <b>«Actualizar del BCV»</b> para volver a consultar la API.',
                'Si la API no responde, el botón lo dice con un mensaje y se conserva la tasa que ya estaba.']),
    dict(t='Tienda de Caracas con precios y existencias propios', e='En producción · faltan datos del cliente', falta_res='Archivo con inventario de Caracas',
         pedido=['Poder cargar el inventario de Caracas aparte, con sus propios precios, y elegir a qué tienda se carga desde el panel.'],
         quedo=['«Cargar Excel» tiene un <b>selector de tienda</b> (Maracay o Caracas) arriba; el formato es el mismo y el código de Caracas es CCS (referencial hasta que el cliente confirme el suyo).',
                'Cada producto puede tener precio y existencia propios en Caracas; las cargas de Maracay no los borran.',
                'La web muestra a cada ciudad sus precios y sus existencias.'],
         falta=['El archivo de inventario de Caracas y su código.']),
    dict(t='Categoría «Otros» con los artículos de la pestaña OTROS ARTICULOS', e='En producción',
         pedido=['Tomar los artículos de la pestaña «OTROS ARTICULOS» y publicarlos en «Otros».'],
         quedo=['Quedaron cargados <b>12 artículos</b> (bornes, bujías, espárragos y tuercas), con filtro por artículo.']),
    dict(t='Panel: listas en «Tabla tipo Excel» y carga manual completa', e='En producción',
         pedido=['Ver cada lista como se ve en el Excel y poder cargar a mano la misma información que trae el archivo.'],
         quedo=['Cada lista del panel tiene un botón para cambiar entre <b>Tarjetas</b> y <b>Tabla tipo Excel</b>, con orden por columnas y navegación con el teclado.',
                'El formulario manual ahora lleva los mismos datos del Excel: <b>códigos CM, MC y CCS</b>; en baterías, polaridad, servicios, medidas y especificaciones y recargo por la batería vieja; en bicicletas, características; y en vehículos, polaridad, amperaje mínimo y grupo por marca.']),
    dict(t='Carrusel de marcas editable desde el panel', e='En producción · faltan datos del cliente', falta_res='Logos de las marcas',
         pedido=['Que el administrador cargue los logos de las marcas del carrusel y elija el orden.'],
         quedo=['Nueva sección <b>«Carrusel de marcas»</b>: se agregan marcas, se sube el logo, se arrastra para ordenar y se muestran u ocultan.',
                'Las marcas agregadas por el administrador se muestran siempre; si una marca no tiene productos en la lista, el panel lo avisa.',
                'En el celular la cinta ahora se detiene al tocarla y reanuda suave unos segundos después (antes podía quedarse parada).'],
         falta=['Los logos de las marcas (hoy se muestra el nombre).']),
    dict(t='Manual del panel de administración', e='Publicado',
         pedido=['Un paso a paso completo, con imágenes, para entregar al cliente.'],
         quedo=['Manual en PDF de 34 páginas: cada opción del panel, cómo cargar los archivos, actualizar la tasa, los mensajes que aparecen y las restricciones.']),
    dict(t='Nexo en modo de prueba en todos los canales', e='En prueba',
         pedido=['Que Nexo no responda a clientes reales mientras se valida, solo en modo de lectura.'],
         quedo=['En WhatsApp, Messenger e Instagram, Nexo responde únicamente las conversaciones marcadas como <b>prueba</b>. Las demás las recibe el equipo en el CRM.',
                'Se eliminaron los servicios y vehículos de prueba.',
                'Los mensajes del Instagram que se veían en el CRM eran el saludo automático de la propia cuenta, no de Nexo.']),
    dict(t='Compatibilidad de baterías: cada marca con su grupo', e='En producción · faltan datos del cliente', falta_res='Columnas de marcas vacías',
         pedido=['Que, para cada vehículo, cada marca de batería use su propio grupo, y poder ver y editar esa información en el panel.'],
         quedo=['La búsqueda por vehículo de la web y Nexo ofrecen solo las baterías del grupo que corresponde a <b>su marca</b>. Una marca sin columna en la tabla ya no hereda los grupos de otras.',
                '<b>Fulgor Everlite</b> se trata como línea propia: no usa el grupo de Fulgor.',
                'En el panel, «Vehículos → batería» muestra el grupo de cada marca y permite <b>agregar, editar o quitar</b> marcas con su grupo; el grupo general se arma solo.',
                'Se corrigió un error que ocultaba Marussi Plus y Fulgor Black en la búsqueda por vehículo.'],
         falta=['Completar las columnas de las marcas que hoy están vacías (Titan, PGT, Durfen, AC Delco, Aokly, New Earth, Energon y Velko) y el amperaje mínimo.'],
         imgs=[('bateria_vehiculo.jpg', 'AHORA · el aviso indica el grupo por marca y la polaridad')]),
    dict(t='Filtro por polaridad y baterías agotadas en la búsqueda por vehículo', e='En producción',
         pedido=['Mostrar solo las baterías de la polaridad del vehículo, salvo en los grupos 30H, 30HCT, 4D y 8D, y mostrar también las agotadas para poder validar la compatibilidad.'],
         quedo=['La polaridad del vehículo (izquierda o derecha) se compara con la de la batería. Los grupos 30H, 30HCT, 4D y 8D no se filtran por polaridad.',
                'Con un vehículo elegido, las baterías que le sirven pero están agotadas salen <b>al final con la etiqueta «Agotada»</b> y el botón <b>«Consultar disponibilidad»</b>.']),
    dict(t='Tarjeta de batería: título compuesto, polaridad, servicios, medidas y especificaciones', e='En producción · faltan datos del cliente', falta_res='Medidas y especificaciones',
         pedido=['Título con marca, grupo, nomenclatura y amperaje; mostrar polaridad, servicios, las medidas con un dibujo y las especificaciones del archivo.'],
         quedo=['Título compuesto: <b>«Marussi Plus 24 MR 900 AMP»</b> (marca, grupo, nomenclatura y amperaje), con la polaridad debajo.',
                '«Ver medidas y especificaciones» abre una ventana con el <b>dibujo de la batería y sus tres medidas</b> y las especificaciones (voltaje, arranque, amperios por hora, reserva).',
                'Los servicios de cada batería salen en «Incluye con tu compra», tomados del inventario.'],
         falta=['Ancho, largo, alto, voltaje, amperios de arranque (CA y CCA), amperios por hora y capacidad de reserva, y los servicios de cada batería, en el Excel.'],
         imgs=[('bateria_tarjeta.jpg', 'AHORA · tarjeta de batería')]),
    dict(t='Tarjeta de caucho: título, modelo, dibujo de dimensiones y explicaciones', e='En producción · faltan datos del cliente', falta_res='Especificaciones de los cauchos',
         pedido=['Título «Marca Tipo Medida» con el modelo debajo, el dibujo con las dimensiones y las explicaciones de la columna W como información de cada especificación.'],
         quedo=['Título compuesto: <b>«Goddard HT 165/65R13»</b>, y debajo el modelo («Transforce 100»).',
                '«Ver especificaciones» muestra el <b>dibujo del caucho</b> con alto, diámetro del rin y ancho, tomados de la pestaña de dimensiones.',
                'Cada especificación que tiene explicación lleva un icono <b>«i»</b> que despliega su texto (índice de carga, índice de carga dual, código de velocidad, presión máxima y TL/TT). Los textos se pueden editar en «Ajustes de la web».'],
         falta=['Índices de carga y velocidad, presión máxima, TL/TT, garantía, construcción y costo de montura de los cauchos.'],
         imgs=[('caucho_tarjeta.jpg', 'AHORA · tarjeta de caucho'), ('caucho_dimensiones.jpg', 'AHORA · dibujo de dimensiones')]),
    dict(t='Todas las tarjetas: estado arriba a la derecha y WhatsApp al final', e='Publicado',
         pedido=['Mostrar solo «Disponible», arriba a la derecha en línea con el título, y poner «Consultar por WhatsApp» al final de la tarjeta.'],
         quedo=['El estado dice solo <b>«Disponible»</b> (o «Agotado»), sin la ciudad, a la derecha del título en todas las categorías.',
                'El botón de WhatsApp quedó al final, después de los servicios y las especificaciones.']),
    dict(t='Filtros más limpios y ajustes en aceites', e='Publicado',
         pedido=['Quitar títulos de las listas del buscador de baterías, separar mejor «Mostrar agotados» y «Limpiar», y ajustar los filtros y las tarjetas de aceites.'],
         quedo=['El buscador de baterías ya no lleva títulos sobre las listas y el botón «Ver baterías» tiene el icono de batería.',
                '«Mostrar también los agotados» y «Limpiar» tienen más espacio en baterías, otros y bicicletas.',
                'En aceites, <b>«1 litro» sale primero</b> en el filtro de presentación, los combos dicen <b>«+ Filtro»</b> y en la tarjeta la marca va grande con la viscosidad pequeña.'],
         imgs=[('aceites_filtros.jpg', 'AHORA · filtros de aceites')]),
    dict(t='Página de inicio: textos, botón de ayuda y ortografía', e='Publicado',
         pedido=['Cambiar el título de la tarjeta de precios y el texto principal, arreglar el botón «¿No sabes cuál te sirve?» y revisar la ortografía.'],
         quedo=['La tarjeta dice <b>«Los mejores precios del mercado con descuentos especiales»</b> y el texto principal comienza con «Ves el monto en dólares y en bolívares a la tasa del BCV de hoy, sin sorpresas».',
                'El botón «Hablar por WhatsApp» de «¿No sabes cuál te sirve?» ahora funciona como «Escríbenos»: abre el WhatsApp de la ciudad elegida o un menú para elegir la tienda.',
                'Corrección ortográfica de los nombres del inventario al mostrarlos: SINTÉTICO, SEMISINTÉTICO, HIDRÁULICO, Bujías, Espárragos y NGK.'],
         imgs=[('home.jpg', 'AHORA · inicio')]),
]

FALTA = [
    ('Códigos de producto CM y MC en el Excel', 'Que cada producto tenga su código y se publique con su existencia real', 1),
    ('Existencias reales por tienda (columnas CM y MC)', 'Dejar de mostrar «Disponible» sin confirmar', 1),
    ('Precio de los productos que hoy no lo tienen', 'Hoy se muestran como agotados; con precio y existencia pasan a la venta', 2),
    ('Servicios que vienen con la compra, por marca o por modelo', 'Llenar «Incluye con tu compra» en cada tarjeta', 12),
    ('Especificaciones de los cauchos (garantía, construcción, índices de carga y velocidad, presión, TL/TT, costo de montura)', 'Completar la ventana «Ver especificaciones» con sus iconos «i»', 14),
    ('Datos técnicos de las baterías (medidas, voltaje, amperios de arranque y de reserva)', 'Mostrar el dibujo con medidas y las especificaciones', 12),
    ('Grupos de las marcas de batería que hoy están vacías en la tabla de compatibilidad, y el amperaje mínimo', 'Que cada marca ofrezca el grupo correcto para cada vehículo', 10),
    ('Inventario y precios de Caracas, y su código', 'Que Caracas muestre sus productos', 4),
    ('Logos de las marcas', 'Reemplazar el nombre por el logo en el carrusel', 7),
    ('Corregir en el Excel nombres con errores o repetidos de marca (por ejemplo Gonherl, Lubrichampions y Lubrichampios, Aoqishi y Aoquishi, Fireston y Firestone, Roackblade y Rockblade)', 'Que una misma marca no salga dividida en los filtros', 1),
]


def construir():
    doc = BaseDocTemplate(str(salida), pagesize=A4, leftMargin=MARGEN, rightMargin=MARGEN, topMargin=48, bottomMargin=50,
                          title='Resumen de cambios · CM Venezuela', author='NexoChatPro')
    marco1 = Frame(MARGEN, 50, ANCHO, H - 100 - 24 - 50, id='p1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    marco = Frame(MARGEN, 50, ANCHO, H - 48 - 50, id='p', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id='primera', frames=[marco1], onPage=primera, autoNextPageTemplate='resto'), PageTemplate(id='resto', frames=[marco], onPage=pie)])
    s = []
    s.append(Spacer(1, 4))
    s.append(Paragraph('Qué se hizo desde la entrega del 5 de noviembre', h1))
    s.append(Paragraph('Este documento resume lo realizado después del resumen del 3 al 5 de noviembre: la carga y la revisión del inventario, la tasa del BCV, la tienda de Caracas, '
                       'los ajustes del panel de administración y de las tarjetas del catálogo, la compatibilidad de baterías por marca y los textos de la página de inicio de cmvenezuela.com. '
                       '<b>Todo lo que aparece aquí ya está en funcionamiento.</b> Al final se detalla lo que falta del cliente para completar la información.', suave))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Resumen', h2))
    filas = [[str(i), c['t'], c['e'].split(' · ')[0], c.get('falta_res', '—')] for i, c in enumerate(CAMBIOS, 1)]
    s.append(tabla(['#', 'Cambio', 'Estado', 'Falta del cliente'], filas, [22, ANCHO - 22 - 92 - 128, 92, 128]))
    for i, c in enumerate(CAMBIOS, 1):
        bloque = [Spacer(1, 12), encabezado(i, c['t'], c['e']), Spacer(1, 3), Paragraph('Lo que se pidió', sub)] + bullets(c['pedido']) + [Paragraph('Cómo quedó', sub)] + bullets(c['quedo'])
        if c.get('falta'):
            bloque += [Paragraph('Falta del cliente', sub)] + bullets(c['falta'])
        s.append(CondPageBreak(130))
        s.append(KeepTogether(bloque[:4]))
        s += bloque[4:]
        if c.get('imgs'):
            s.append(Spacer(1, 4)); s.append(KeepTogether([imagenes(c['imgs'], 170 if len(c['imgs']) == 1 else 160)]))
    s.append(CondPageBreak(300))
    s.append(Paragraph('Lo que necesitamos del cliente', h2))
    s.append(Paragraph('Estos datos completan lo que hoy aparece como «Por confirmar», «Disponible» sin confirmar o «Agotado» por falta de precio. Con cada uno que llegue, se carga y se publica; todo se carga de una vez desde el Excel.', suave))
    s.append(Spacer(1, 6))
    s.append(tabla(['#', 'Qué necesitamos', 'Para qué sirve', 'Cambio'], [[i, a, b, c] for i, (a, b, c) in enumerate(FALTA, 1)], [22, ANCHO - 22 - 170 - 52, 170, 52]))
    s.append(Paragraph('Para los canales de mensajes', h2))
    s += bullets(['<b>Número real de WhatsApp de Master Cauchos:</b> al vincularlo con Meta apareció el error #4563001 («Desafío de autenticación no válido») en el paso de importar contactos e historial. Se está resolviendo; si no cede tras reintentar, se reporta a Meta con el identificador de la sesión y se evalúa migrar el número o usar uno aparte.',
                  'Confirmar si los mensajes de Facebook llegan a la página «Master Cauchos» o a un perfil personal: Nexo solo puede conectarse a páginas.',
                  'Acceso de administrador, invitando por correo y sin contraseñas, a las páginas, cuentas de Instagram y de WhatsApp Business de CM Maracay, CM Caracas y Master Cauchos.',
                  'Indicar en qué portafolio de Meta están sus campañas. El portafolio «mastercauchos» todavía no tiene la verificación del negocio, que pide RIF, registro mercantil y comprobante de dirección.'])
    s.append(Paragraph('Cómo enviarlo', h2))
    s += bullets(['Los datos de inventario conviene enviarlos en el mismo Excel que ya se usa, llenando las columnas que ya trae: códigos, existencias, precios, servicios, especificaciones y datos técnicos de las baterías.',
                  'Los logos pueden enviarse como imágenes (JPG, PNG o WebP) de hasta 2 MB cada una; los textos y decisiones, por mensaje.'])
    doc.build(s)
    print('Guardado:', salida)


construir()
