# Genera documentos/Manual_panel_admin_CM_Venezuela.pdf con las capturas de docs/manual-panel/.
# Uso: python3 docs/manual-panel/generar_manual.py   (necesita reportlab y pillow)
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether, Image, PageBreak, NextPageTemplate, CondPageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from PIL import Image as PI

FD = '/System/Library/Fonts/Supplemental/'
for n, f in [('Ar', 'Arial.ttf'), ('Ar-B', 'Arial Bold.ttf'), ('Ar-I', 'Arial Italic.ttf'), ('Ar-BI', 'Arial Bold Italic.ttf')]:
    pdfmetrics.registerFont(TTFont(n, FD + f))
for a, b, c in [(0, 0, 'Ar'), (1, 0, 'Ar-B'), (0, 1, 'Ar-I'), (1, 1, 'Ar-BI')]:
    addMapping('Ar', a, b, c)

AMARILLO = colors.HexColor('#F5D90A'); NEGRO = colors.HexColor('#141414'); GRIS = colors.HexColor('#5B5B55'); LINEA = colors.HexColor('#DEDED6')
VERDE = colors.HexColor('#0B7A4B'); AMBAR = colors.HexColor('#B27700'); ROJO = colors.HexColor('#B3261E'); FONDO = colors.HexColor('#F6F6F1')
VERDEF = colors.HexColor('#E3F4EB'); AMBARF = colors.HexColor('#FFF4D6'); ROJOF = colors.HexColor('#FBE7E5'); AZULF = colors.HexColor('#E8EEF9')
W, H = A4; M = 1.8 * cm
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = os.path.join(RAIZ, 'docs', 'manual-panel') + '/'
OUT = os.path.join(RAIZ, 'documentos', 'Manual_panel_admin_CM_Venezuela.pdf')

P = ParagraphStyle('p', fontName='Ar', fontSize=10, leading=14.2, textColor=NEGRO, spaceAfter=5)
SUB = ParagraphStyle('s', parent=P, fontSize=10.8, leading=15, textColor=GRIS, spaceAfter=8)
H1 = ParagraphStyle('h1', keepWithNext=1, fontName='Ar-B', fontSize=19, leading=23, textColor=NEGRO, spaceBefore=4, spaceAfter=8)
H2 = ParagraphStyle('h2', keepWithNext=1, fontName='Ar-B', fontSize=14, leading=17.5, textColor=NEGRO, spaceBefore=12, spaceAfter=5)
H3 = ParagraphStyle('h3', keepWithNext=1, fontName='Ar-B', fontSize=11.2, leading=14.5, textColor=NEGRO, spaceBefore=8, spaceAfter=3)
BUL = ParagraphStyle('b', parent=P, leftIndent=13, spaceAfter=2.5)
PAS = ParagraphStyle('pa', parent=P, leftIndent=19, firstLineIndent=-19, spaceAfter=4)
CEL = ParagraphStyle('c', fontName='Ar', fontSize=8.8, leading=11.6, textColor=NEGRO)
CELB = ParagraphStyle('cb', parent=CEL, fontName='Ar-B')
CAP = ParagraphStyle('cap', fontName='Ar-B', fontSize=8.6, leading=11, textColor=GRIS, alignment=1, spaceBefore=3)
LEY = ParagraphStyle('ley', fontName='Ar', fontSize=9, leading=12.2, textColor=NEGRO, leftIndent=15, firstLineIndent=-15, spaceAfter=1.5)


def bl(items): return [Paragraph(t, BUL, bulletText='•') for t in items]


def pasos(items):
    return [Paragraph(f'<font name="Ar-B" color="#B3261E">{i}.</font>&nbsp;&nbsp;{t}', PAS) for i, t in enumerate(items, 1)]


def caja(titulo, texto, color=AMBARF, borde=AMBAR):
    cuerpo = [Paragraph(f'<b>{titulo}</b>', ParagraphStyle('ct', parent=P, spaceAfter=2, textColor=borde))] + [Paragraph(t, ParagraphStyle('cp', parent=P, spaceAfter=2)) for t in (texto if isinstance(texto, list) else [texto])]
    t = Table([[cuerpo]], colWidths=[W - 2 * M])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), color), ('LINEBEFORE', (0, 0), (0, -1), 3, borde), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    return [Spacer(1, 3), t, Spacer(1, 6)]


def importante(texto, titulo='Importante'): return caja(titulo, texto, ROJOF, ROJO)
def consejo(texto, titulo='Consejo'): return caja(titulo, texto, VERDEF, VERDE)
def nota(texto, titulo='Ten en cuenta'): return caja(titulo, texto, AMBARF, AMBAR)


def tabla(filas, cols, cab, zebra=True):
    d = [[Paragraph(c, CELB) for c in cab]] + [[Paragraph(str(x), CEL) for x in r] for r in filas]
    t = Table(d, colWidths=cols, repeatRows=1)
    st = [('BACKGROUND', (0, 0), (-1, 0), AMARILLO), ('GRID', (0, 0), (-1, -1), 0.5, LINEA), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
    if zebra: st.append(('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, FONDO]))
    t.setStyle(TableStyle(st))
    return [t, Spacer(1, 7)]


def fig(archivo, leyenda=None, pie=None, w=13.8 * cm):
    a, b = PI.open(D + archivo).size
    im = Image(D + archivo, width=w, height=w * b / a)
    t = Table([[im]], colWidths=[w + 0.2 * cm]); t.hAlign = 'CENTER'
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.7, LINEA), ('LEFTPADDING', (0, 0), (-1, -1), 2), ('RIGHTPADDING', (0, 0), (-1, -1), 2), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    el = [t]
    if pie: el.append(Paragraph(pie, CAP))
    if leyenda:
        el.append(Spacer(1, 3))
        el += [Paragraph(f'<font name="Ar-B" color="#B3261E">{i}</font>&nbsp;&nbsp;{x}', LEY) for i, x in enumerate(leyenda, 1)]
    return [KeepTogether(el), Spacer(1, 8)]


def pie(c, d):
    c.saveState(); c.setFont('Ar', 8.2); c.setFillColor(GRIS)
    c.drawString(M, 1.1 * cm, 'CM Venezuela · Manual del panel de administración'); c.drawRightString(W - M, 1.1 * cm, f'Página {d.page}')
    c.setStrokeColor(LINEA); c.line(M, 1.5 * cm, W - M, 1.5 * cm); c.restoreState()


def portada(c, d):
    c.saveState(); c.setFillColor(NEGRO); c.rect(0, H - 9.5 * cm, W, 9.5 * cm, fill=1, stroke=0); c.setFillColor(AMARILLO); c.rect(0, H - 9.5 * cm, W, 0.25 * cm, fill=1, stroke=0)
    c.setFont('Ar-B', 20); c.drawString(M, H - 3.2 * cm, 'CM VENEZUELA')
    c.setFont('Ar-B', 31); c.setFillColor(colors.white); c.drawString(M, H - 5.6 * cm, 'Manual del panel')
    c.drawString(M, H - 7.0 * cm, 'de administración')
    c.setFont('Ar', 12); c.setFillColor(colors.HexColor('#CFCFC8')); c.drawString(M, H - 8.5 * cm, 'Paso a paso: productos, precios, tasa de cambio, carga del Excel y mensajes')
    c.restoreState(); pie(c, d)


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=2 * cm,
                      title='Manual del panel de administración · CM Venezuela', author='NexoChatPro')
doc.addPageTemplates([PageTemplate('p1', [Frame(M, 2 * cm, W - 2 * M, H - 9.5 * cm - 2 * cm - 0.6 * cm, id='f1')], onPage=portada),
                      PageTemplate('p', [Frame(M, 2 * cm, W - 2 * M, H - M - 2 * cm, id='f2')], onPage=pie)])
AN = 12.6 * cm     # ancho de las capturas pequeñas

S = [Spacer(1, 0.4 * cm),
     Paragraph('Para quién es este manual', H2),
     Paragraph('Para quien administra los productos, los precios y la información de la página <b>cmvenezuela.com</b> y del asistente <b>Nexo</b>. No hace falta saber de informática: cada pantalla se explica con una captura, los pasos en orden, los mensajes que puede dar el panel y lo que no se puede hacer.', SUB),
     Paragraph('Contenido', H2)]
S += tabla([
    ['1', 'Cómo funciona todo (qué cambia, dónde se ve y cuánto tarda)'],
    ['2', 'Entrar al panel'],
    ['3', 'Pantalla de inicio y menú'],
    ['4', 'Tasa de cambio del día (ver, fijar y actualizar)'],
    ['5', 'Lista de productos: buscar, filtrar y cambiar precio o existencias'],
    ['6', 'Crear, editar y eliminar un producto, y poner fotos'],
    ['7', 'Vehículos → batería'],
    ['8', 'Ajustes de la web (servicios incluidos y «Por confirmar»)'],
    ['9', 'Cargar el Excel (Maracay y Caracas): formato del archivo y paso a paso completo'],
    ['10', 'Consumo de Nexo'],
    ['11', 'Restricciones y límites'],
    ['12', 'Todos los mensajes del panel, qué significan y qué hacer'],
    ['13', 'Preguntas frecuentes y lista de verificación antes de cargar'],
], [1.2 * cm, W - 2 * M - 1.2 * cm], ['#', 'Sección'])
S += [NextPageTemplate('p'), PageBreak()]

# ============ 1. Cómo funciona ============
S += [Paragraph('1. Cómo funciona todo', H1),
      Paragraph('El panel es el único lugar donde se escriben los productos y los precios. De ahí los leen la página web y Nexo (el asistente que responde por WhatsApp, Instagram y Facebook), así que <b>no hay que actualizar nada en otro sitio</b>.', P)]
S += tabla([
    ['Cambias un precio, una existencia, una foto o un dato de un producto', 'La web de cmvenezuela.com', 'En menos de 1 minuto (recarga la página si la tenías abierta)'],
    ['Lo mismo', 'Nexo', 'En el siguiente mensaje en que busque ese producto. Lo que ya dijo en una conversación abierta no se corrige solo.'],
    ['Fijas la tasa de cambio', 'Nexo / La web', 'Nexo al instante / la web en menos de 1 minuto'],
    ['Guardas los Ajustes de la web (servicios, detalle del combo)', 'La web y Nexo', 'En menos de 1 minuto'],
    ['Subes y publicas un Excel', 'La web y Nexo', 'En menos de 1 minuto'],
], [6.2 * cm, 3.6 * cm, 7.4 * cm], ['Qué haces', 'Dónde se ve', 'Cuánto tarda'])
S += [Paragraph('Las categorías del panel', H3)]
S += bl(['<b>Cauchos, Baterías, Aceites, Otros (bornes, bujías, tuercas…) y Bicicletas</b>: los productos con su precio y existencias.',
         '<b>Vehículos → batería</b>: la tabla que dice qué grupo de batería usa cada vehículo (activa el buscador «Encuentra tu batería» de la web).',
         '<b>Tasa de cambio</b>: para mostrar los precios en bolívares. El euro se usa en Maracay y el dólar en Caracas.',
         '<b>Maracay y Caracas tienen cada una su precio y su existencia</b>: cada producto guarda el precio de Maracay (con las existencias de CM Maracay y Master Cauchos) y, aparte, el precio y la existencia de Caracas.',
         '<b>Ajustes de la web</b>: los servicios que vienen con la compra de los cauchos y el detalle del filtro de los combos de aceite.'])
S += nota('Lo que cambies aquí se refleja de verdad en la web y en Nexo. Antes de publicar un cambio grande (por ejemplo, un Excel completo) el panel te muestra qué va a cambiar, pero una vez publicado ya lo ven los clientes.', 'Ten en cuenta')

# ============ 2. Entrar ============
S += [Paragraph('2. Entrar al panel', H1)]
S += pasos(['Abre el navegador (Chrome, Safari o Edge) en el computador o en el teléfono.',
            'Escribe la dirección <b>https://crm.nexochatpro.cloud/admin</b>.',
            'El navegador abre una ventanita que pide <b>usuario y clave</b>. En el usuario puedes escribir cualquier cosa (por ejemplo «admin»). En la clave escribe la clave del panel, que se entrega por separado y de forma privada.',
            'Pulsa «Iniciar sesión». Se abre la pantalla de inicio (sección 3).'])
S += tabla([['Escribes una clave incorrecta', 'La ventana vuelve a pedir la clave (tarda un segundo en responder). Si el navegador muestra «Necesitas la clave para entrar.», la clave no es la correcta.'],
            ['Quieres salir', 'Cierra la pestaña o el navegador. El panel no tiene botón «Cerrar sesión»: el navegador olvida la clave al cerrarse.'],
            ['Quieres usarlo en el teléfono', 'Funciona igual. En pantallas pequeñas el menú de la izquierda pasa a una barra arriba.']],
           [5.2 * cm, 12 * cm], ['Situación', 'Qué pasa'])
S += importante('La clave da acceso a todo: precios, fotos y publicación. No la compartas por mensajes abiertos ni la dejes guardada en computadores de uso común. Si crees que alguien más la conoce, pide que la cambien.')

# ============ 3. Inicio ============
S += [CondPageBreak(13 * cm), Paragraph('3. Pantalla de inicio y menú', H1),
      Paragraph('Al entrar ves el <b>Resumen</b>: cuántos productos hay en cada categoría y qué les falta. Es el mejor lugar para saber qué hay que completar.', P)]
S += fig('01-inicio.jpg', ['Menú de la izquierda: te lleva a cada categoría y a las demás secciones. El número gris es la cantidad de productos.',
                          'Accesos rápidos: «+ Nuevo producto», «Cargar Excel» y «Ajustes de la web».',
                          'Una tarjeta por categoría: cuántos productos hay.',
                          'Avisos de lo que falta: «sin foto», «sin precio», «agotados», «sin dato de Caracas» y «sin precio en Caracas». Si no falta nada, el aviso aparece en verde («0 sin precio» con una marca de verificación). Al pulsarlos se abre la lista ya filtrada.',
                          '«Ver todos» abre la lista completa de esa categoría.'], 'Pantalla de inicio')
S += fig('27-inicio-abajo.jpg', None, 'Más abajo en el inicio: vehículos, ajustes y consumo de Nexo', w=AN)
S += tabla([['Vehículos → batería', 'Cuántos vehículos hay cargados. Si hay, la búsqueda «Encuentra tu batería» de la web está activa.'],
            ['Ajustes de la web', 'Cuántos servicios se incluyen con la compra de los cauchos y el detalle del filtro de los combos. «Abrir ajustes» te lleva a la sección 8.'],
            ['Consumo de Nexo esta semana', 'Cuánto ha gastado el asistente esta semana frente al tope semanal, y los límites por cliente (sección 10).'],
            ['Tasa de cambio del día', 'La tasa que usan la web y Nexo, con su botón para fijarla o actualizarla (sección 4).']],
           [4.6 * cm, 12.6 * cm], ['Tarjeta', 'Qué muestra'])
S += [Paragraph('El menú de la izquierda', H3)]
S += bl(['<b>Productos</b>: Cauchos, Baterías, Aceites, Otros, Bicicletas y Vehículos → batería. Cada uno abre su lista.',
         '<b>Web y datos</b>: «Ajustes de la web», «Cargar Excel», «Consumo de Nexo» (se abre en otra pestaña) y «Ver la web» (abre cmvenezuela.com).'])

# ============ 4. Tasa ============
S += [PageBreak(), Paragraph('4. Tasa de cambio del día', H1),
      Paragraph('La tasa convierte los precios a bolívares en la web y en Nexo. El <b>euro</b> se usa para Maracay y el <b>dólar</b> para Caracas. El panel la lee solo del BCV, pero puedes fijarla tú si la fuente falla o se equivoca.', P)]
S += fig('02-tasa.jpg', ['La tasa que se está usando ahora y de dónde viene.',
                        'Lo que dice la API del BCV en este momento (para comparar).',
                        'Casilla para escribir la tasa que quieres fijar. Puedes escribirla con coma o con punto: <b>1006,03</b> o <b>1006.03</b>.',
                        '«Fijar hoy»: guarda la tasa que escribiste.',
                        '«Actualizar del BCV»: vuelve a leer la tasa del BCV ahora mismo y, si habías fijado una a mano, la quita.'], 'Tarjeta «Tasa de cambio del día» (en el inicio)')
S += [Paragraph('De dónde viene la tasa (lo que dice debajo del nombre)', H3)]
S += tabla([['BCV · fecha', 'La tasa viene de la API del BCV. Se vuelve a consultar sola cada 5 minutos y la tarjeta se refresca sola cada minuto.'],
            ['Fijada a mano para hoy', 'La escribiste tú. Manda sobre la del BCV, pero <b>solo vale hoy</b>: mañana se vuelve a usar la del BCV.'],
            ['Respaldo del servidor (la API no responde)', 'No se pudo leer el BCV y se usa un valor de respaldo guardado. Conviene fijar la tasa a mano o pulsar «Actualizar».'],
            ['sin tasa', 'No hay tasa disponible. La web esconde los precios en bolívares («Precios en dólares de contado. Pregúntanos el monto en bolívares por WhatsApp.»).']],
           [5.6 * cm, 11.6 * cm], ['Dice', 'Significa'])
S += [Paragraph('Cómo fijar la tasa de hoy', H3)]
S += pasos(['En el inicio, baja a la tarjeta «Tasa de cambio del día».',
            'En la fila del euro (o del dólar) escribe la tasa en la casilla, por ejemplo <b>1006,03</b>.',
            'Pulsa «Fijar hoy». La fila cambia a «Fijada a mano para hoy» y muestra tu valor.'])
S += fig('03-tasa-fijada.jpg', None, 'La tasa del euro fijada a mano para hoy', w=AN)
S += fig('04-tasa-ok.jpg', None, 'Mensaje de confirmación: Nexo la usa de inmediato y la web en menos de un minuto', w=AN)
S += [CondPageBreak(12 * cm), Paragraph('Cómo volver a la tasa del BCV', H3)]
S += pasos(['Pulsa «Actualizar del BCV» en la fila que quieras.',
            'El panel vuelve a leer el BCV, quita la tasa fijada y muestra el mensaje «Listo: se usa la tasa del BCV (… Bs)».'])
S += fig('06-tasa-actualizar.jpg', None, 'Después de pulsar «Actualizar del BCV»', w=AN)
S += [CondPageBreak(12 * cm), Paragraph('Si algo sale mal', H3)]
S += fig('05-tasa-error.jpg', None, 'El panel rechaza una tasa que no tiene sentido y no cambia nada', w=AN)
S += tabla([['Esas tasas no son coherentes: el euro debe valer entre 0,8 y 2 veces el dólar (euro 5, dólar 894.8876).', 'Escribiste un valor que no se parece a la otra moneda (por ejemplo un euro de 5 con el dólar en 894). Revisa que no falten ceros o el separador de miles.'],
            ['Escribe la tasa, por ejemplo 1006,03.', 'Pulsaste «Fijar hoy» con la casilla vacía.'],
            ['Escribe la tasa del euro como un número mayor que 0 (ejemplo 1006,03).', 'Lo escrito no es un número, es 0 o es negativo.'],
            ['No se pudo leer la tasa del euro desde la API del BCV: no responde o dio un dato inválido. Se mantiene la tasa en uso (…).', 'Pulsaste «Actualizar del BCV» y la API del BCV no respondió. No se quitó nada: sigue la tasa que estaba. Inténtalo de nuevo en unos minutos o fija la tasa a mano.']],
           [7.4 * cm, 9.8 * cm], ['Mensaje', 'Qué significa y qué hacer'])
S += consejo('Si el BCV publica una tasa distinta a la que ves, pulsa «Actualizar del BCV». Si la API se equivoca o está caída, fija la tasa a mano. Recuerda que una tasa fijada vale solo el día en que la fijas.')

# ============ 5. Lista ============
S += [PageBreak(), Paragraph('5. Lista de productos', H1),
      Paragraph('Cada categoría tiene su lista. Se abre desde el menú o desde las tarjetas del inicio. Es el lugar para buscar un producto y cambiar su precio o sus existencias rápidamente.', P)]
S += fig('07-lista.jpg', ['Buscador: escribe una marca, una medida, un grupo o un tipo («Buscar por marca, medida, grupo o tipo»).',
                         'Filtro por marca: «Todas las marcas» o elige una.',
                         'Ordenar: marca (A–Z), precio de menor a mayor, precio de mayor a menor, o más existencia primero.',
                         'Filtros rápidos con su cantidad: Todos, Sin foto, Sin precio, Agotados, Sin dato de Caracas y Sin precio en Caracas.',
                         '«+ Nuevo producto» (sección 6).'], 'Lista de Cauchos con el buscador y los filtros')
S += [Paragraph('Cambiar el estilo de vista: tarjetas o tabla tipo Excel', H3),
      Paragraph('Arriba de cada lista (Cauchos, Baterías, Aceites, Otros, Bicicletas y Vehículos → batería) hay un botón con dos opciones. <b>«Tarjetas»</b> muestra cada producto en una tarjeta con su foto; <b>«Tabla tipo Excel»</b> los muestra en filas y columnas, como en el archivo de Excel, con las mismas columnas y 100 productos por página. El panel recuerda la que elijas la próxima vez que entres.', P)]
S += fig('30-vista-tabla.jpg', ['Botón de estilo de vista: «Tarjetas» o «Tabla tipo Excel». La opción activa se ve en amarillo.',
                               'En la tabla, la fila de títulos queda fija arriba y la columna con el número de fila queda fija a la izquierda mientras te desplazas.',
                               'Precio, Bs, CM, MC, Precio Caracas, Bs Caracas y CCS se editan en la propia celda (se guardan al salir de la casilla); lo demás se cambia con «Editar» (a la derecha de cada fila).'], 'Lista de Cauchos en «Tabla tipo Excel»')
S += [Paragraph('Cambiar el precio o las existencias directamente en la lista', H3)]
S += pasos(['Busca el producto (por ejemplo escribe «habilead» en el buscador).',
            'Haz clic en la casilla que quieres cambiar, por ejemplo el <b>precio</b>.',
            'Escribe el valor nuevo.',
            'Haz clic fuera de la casilla (o pulsa Tab). <b>Se guarda solo</b> y aparece el aviso «Guardado. Ya se ve en la web y en Nexo.»'])
S += fig('08-edicion-linea.jpg', ['<b>Precio $</b>: el precio en dólares de Maracay. Si es 0, la web muestra «Consultar precio».',
                                 '<b>Equiv. Bs</b>: el equivalente en dólares si el cliente paga en bolívares. Si lo dejas vacío, se calcula solo (+5 %).',
                                 '<b>CM</b>: unidades en CM Maracay.', '<b>Master</b>: unidades en Master Cauchos.',
                                 '<b>Caracas</b>: unidades en CM Caracas. El guion («—») significa que todavía no hay dato de Caracas.',
                                 '«Editar» (foto, modelo, especificaciones…) y «Eliminar».'], 'Edición rápida en la lista')
S += fig('29-lista-precio-caracas.jpg', None, 'Cada producto muestra el precio de Maracay y, al lado, el precio y la existencia de Caracas', w=AN)
S += tabla([['Precio Caracas $ / Equiv. Bs Caracas / Caracas', 'El precio propio de Caracas, su equivalente en dólares si paga en bolívares (vacío = se calcula +5 %) y la existencia en CM Caracas. Vacíos significan que ese producto todavía no tiene precio o dato de Caracas: Caracas mostrará «Consultar precio».'],
            ['Hay en las dos tiendas de Maracay (CM y Master) y 0 en ambas', 'El producto se ve como agotado en Maracay. La web, por defecto, solo muestra lo que hay en la ciudad elegida.'],
            ['Dejas el campo de Caracas vacío', 'Significa «aún sin dato»: Caracas no mostrará ese producto con existencia.'],
            ['Pones un precio 0', 'La web muestra «Consultar precio» y Nexo lo comunica así.']],
           [6.4 * cm, 10.8 * cm], ['Si…', 'Entonces…'])
S += [Paragraph('Otras acciones de la lista', H3)]
S += bl(['<b>Siguiente / Anterior</b>: la lista muestra 40 productos por página.',
         '<b>Eliminar</b>: pide confirmar con el mensaje «¿Eliminar «marca …»?». Si el producto viene del Excel, avisa: «Si este producto sigue en el Excel, volverá a aparecer con la próxima carga». Después aparece «Producto eliminado.»',
         'Los avisos de colores del inicio (sin foto, sin precio…) abren esta misma lista ya filtrada.'])

# ============ 6. Crear/editar ============
S += [PageBreak(), Paragraph('6. Crear, editar y eliminar un producto', H1),
      Paragraph('Con «+ Nuevo producto» creas uno; con «Editar» en la lista cambias todo lo de un producto (incluidas la foto, el modelo y las especificaciones).', P)]
S += pasos(['Entra a la categoría (por ejemplo Cauchos).', 'Pulsa «+ Nuevo producto» (o «Editar» en una fila).', 'Llena los campos (los obligatorios están en la tabla de abajo).',
            'Pulsa «Guardar». Si falta algo, el mensaje aparece en rojo abajo a la izquierda y el producto no se guarda.'])
S += fig('09-form-editar.jpg', None, 'Ventana de edición de un caucho: datos del producto', w=AN)
S += fig('10-form-precio-foto.jpg', None, 'Parte de abajo de la misma ventana: precio, existencias y foto (se desplaza hacia abajo)', w=AN)
S += [Paragraph('Qué campos tiene cada categoría', H3)]
S += tabla([
    ['Cauchos', 'Marca*, Medida* (ej. 265/60R18), Modelo, Tipo (HT, AT, MT…), Lonas (número), Servicios solo de este caucho, Especificaciones (una por línea «Nombre: valor»), Texto extra',
     'Modelo ≤ 40 letras, Tipo ≤ 30, Lonas es un número, hasta 12 especificaciones (nombre ≤ 40 y valor ≤ 60 letras), hasta 12 servicios'],
    ['Baterías', 'Marca*, Descripción* (ej. 1000 AMP / 24R), Grupo* (ej. GRUPO 24), Amperaje, Garantía en meses', 'Descripción ≤ 80 letras, Grupo ≤ 40'],
    ['Aceites', 'Marca*, Tipo / viscosidad* (ej. 20W-50 MINERAL), Presentación* (Litro, 4 Litros…)', 'Tipo ≤ 60 letras, Presentación ≤ 40'],
    ['Otros', 'Artículo* (en la casilla «Artículo (bujías, bornes, tuercas…)»), Descripción* (ej. Champion)', 'Descripción ≤ 80 letras'],
    ['Bicicletas', 'Rin* (10 a 32), Modelo* (ej. 130), Para (NIÑO, NIÑA…), Colores (separados por coma). No lleva marca', 'Modelo ≤ 30 letras, Para ≤ 30, Colores ≤ 120'],
], [2.3 * cm, 9.5 * cm, 5.4 * cm], ['Categoría', 'Campos (* = obligatorio)', 'Límites'])
S += [Paragraph('Los campos de precio y existencias (todas las categorías de productos)', H3)]
S += tabla([
    ['Precio en dólares*', 'Obligatorio. Es el precio de Maracay. Escribe 0 si el precio se consulta (la web muestra «Consultar precio»). No admite números negativos.'],
    ['Equivalente en $ si paga en bolívares', 'Opcional. Vacío = se calcula solo (+5 %). Es el monto en dólares que se convierte a bolívares con la tasa.'],
    ['Precio en dólares en Caracas', 'Opcional. El precio de ese producto en CM Caracas. Vacío = sin precio en Caracas («Consultar precio» en la web y en Nexo).'],
    ['Equivalente en $ en Caracas si paga en bolívares', 'Opcional. Vacío = se calcula solo (+5 %).'],
    ['Hay en CM Maracay / Hay en Master Cauchos', 'Unidades que hay (0 si no hay).'],
    ['Hay en CM Caracas', 'Vacío significa «aún sin dato».'],
    ['Texto extra que se ve en la web', 'Opcional, hasta 60 letras. Por ejemplo «Con set».'],
    ['Marca*', 'Obligatoria en todas menos Bicicletas (hasta 60 letras). Al escribirla el panel sugiere las marcas que ya existen.'],
], [5.6 * cm, 11.6 * cm], ['Campo', 'Cómo se llena'])
S += fig('26-form-bateria.jpg', None, 'Ventana de una batería nueva', w=AN)
S += [Paragraph('Cómo poner una foto', H3)]
S += pasos(['En la ventana del producto, baja hasta la sección «Foto».', 'Pulsa «Seleccionar archivo» y elige una imagen <b>JPG, PNG o WebP</b> (hasta 5 MB). El panel la reduce solo antes de subirla.',
            'Si quieres la misma foto para toda la marca, marca «Usar también esta foto en los otros N productos de «marca»».', 'Pulsa «Guardar».'])
S += bl(['Para quitar la foto pulsa «Quitar foto» y «Guardar».', 'Si el archivo no es JPG, PNG o WebP, el panel dice «La imagen debe ser JPG, PNG o WebP.»'])
S += fig('11-form-error.jpg', None, 'Ejemplo de error al guardar: falta la medida (el mensaje sale abajo, en rojo)', w=AN)
S += nota(['Un producto <b>creado a mano</b> en el panel no se toca nunca al cargar un Excel. Un producto <b>que viene del Excel</b> y que editas aquí se reemplaza con los datos del archivo la próxima vez que se cargue (el panel te avisa cuáles antes de publicar; ver sección 9).',
           'Las fotos sí se conservan siempre que el producto siga en el Excel con el mismo código.'])

# ============ 7. Vehículos ============
S += [PageBreak(), Paragraph('7. Vehículos → batería', H1),
      Paragraph('Esta tabla dice qué grupo de batería necesita cada vehículo. La web la usa en «Encuentra tu batería» y Nexo para recomendar solo baterías que le sirven al vehículo del cliente.', P)]
S += fig('13-vehiculos-lista.jpg', None, 'Lista de vehículos (con el buscador y el filtro por marca)', w=AN)
S += pasos(['Entra a «Vehículos → batería» en el menú.', 'Busca el vehículo o pulsa «+ Nuevo vehículo».',
            'Escribe la marca, el modelo, el rango de años (opcional) y el grupo o grupos de batería, separados por coma (por ejemplo «GRUPO 34, GRUPO 24»).', 'Pulsa «Guardar».'])
S += fig('14-vehiculo-form.jpg', None, 'Ventana de un vehículo nuevo', w=AN)
S += tabla([['Revisa los años: «desde» no puede ser mayor que «hasta».', 'Escribiste un año de inicio posterior al final.'],
            ['Escribe la marca del vehículo. / Escribe el modelo del vehículo.', 'Falta la marca o el modelo.'],
            ['Escribe el grupo de batería, por ejemplo GRUPO 24 (varios separados por coma).', 'Falta el grupo.']],
           [8.2 * cm, 9 * cm], ['Mensaje', 'Qué significa'])
S += bl(['Si dejas los años vacíos, el grupo vale para <b>todos</b> los años de ese modelo.',
         'Para que cada <b>marca de batería</b> use su propio grupo (por ejemplo Fulgor grupo 24 y Duncan grupo 4D en el mismo vehículo) hay que cargar la hoja COMPATIBILIDAD por Excel (sección 9). Desde el panel se escribe una sola lista de grupos para el vehículo.',
         'El grupo <b>30HCT</b> se trata igual que <b>30H</b>: un vehículo que pide 30H también encuentra las baterías 30HCT.'])

# ============ 8. Ajustes ============
S += [PageBreak(), Paragraph('8. Ajustes de la web', H1),
      Paragraph('Aquí se escribe lo que sale en la tarjeta de cada caucho («Incluye con tu compra») y en los combos de aceite. Lo que guardas se ve en la web en menos de un minuto.', P)]
S += fig('12-ajustes.jpg', None, 'Ajustes de la web con un ejemplo de servicios y de una regla por marca', w=AN)
S += [Paragraph('Servicios que vienen con la compra de los cauchos', H3)]
S += pasos(['Entra a «Ajustes de la web».', 'En «Servicios que vienen con la compra de los cauchos» escribe <b>uno por línea</b> (por ejemplo Montura, Balanceo, Válvula nueva). Valen para todos los cauchos.', 'Pulsa «Guardar ajustes». Aparece «Guardado. Ya se ve en la web.»'])
S += [Paragraph('Servicios distintos según la marca o el modelo', H3)]
S += pasos(['Pulsa «+ Agregar regla».', 'Escribe o elige la <b>marca</b> (la lista sugiere las marcas que existen).', 'Elige el <b>modelo</b> de esa marca, o deja «Toda la marca» para aplicarlo a todos sus cauchos.',
            'Escribe los servicios extra de esa regla (uno por línea). Se <b>suman</b> a los generales.', 'Mira la línea verde «Aplica a N cauchos»: dice a cuántos cauchos publicados alcanza la regla. Si dice «Aplica a 0 cauchos», revisa la marca o el modelo.', 'Pulsa «Guardar ajustes».'])
S += bl(['Para quitar una regla pulsa la «X» de su fila y guarda.',
        '<b>Servicios de un solo caucho</b>: se escriben en «Editar» de ese caucho. Con un guion delante (por ejemplo «-Balanceo») se quita un servicio general solo en ese caucho.',
        '<b>Detalle del filtro que incluyen los combos de aceite</b>: texto corto (hasta 80 letras), por ejemplo «Filtro de aceite». Se muestra en los combos de la web.',
        '<b>Mostrar «Por confirmar»</b>: si está marcado, donde todavía no hay información la web dice «Por confirmar». Si lo apagas, esos apartados se esconden hasta que tengan datos.'])
S += tabla([['Máximo 12 servicios. / Cada servicio debe tener máximo 60 letras.', 'Te pasaste del límite de servicios generales o de largo.'],
            ['Máximo 60 reglas de servicios.', 'Hay demasiadas reglas.'],
            ['Regla N: escribe la marca.', 'Una regla sin marca.'],
            ['Regla N (marca): escribe al menos un servicio. / máximo 12 servicios / cada servicio debe tener máximo 60 letras.', 'Una regla sin servicios o con demasiados.'],
            ['Regla N: el modelo es muy largo (máximo 40 letras).', 'Modelo de más de 40 letras.'],
            ['El detalle del filtro debe tener máximo 80 letras.', 'Texto del combo demasiado largo.']],
           [8.6 * cm, 8.6 * cm], ['Mensaje', 'Qué significa'])

# ============ 9. Excel ============
S += [PageBreak(), Paragraph('9. Cargar el Excel', H1),
      Paragraph('Es la forma de actualizar muchos productos a la vez. Se sube un solo archivo de Excel (.xlsx) con una pestaña por categoría, <b>uno para Maracay y otro para Caracas</b>. El panel <b>nunca publica nada sin que lo revises y lo confirmes</b>.', P)]
S += [Paragraph('9.1 El archivo: pestañas y columnas', H2),
      Paragraph('Las columnas se reconocen por el <b>nombre del encabezado</b> (fila 1), no por su posición, y el orden de las pestañas no importa. Las filas vacías se ignoran.', P)]
S += tabla([
    ['INVENTARIO CAUCHOS', 'CODIGO CM, CODIGO MC, MEDIDA, MARCA, MODELO, TIPO, LONAS, Precio, Bs, CM, MC, TOTAL INVENTARIO', 'COSTE DE MONTURA, SERVICIOS, GARANTIA, CONSTRUCCION, INDICE DE CARGA, INDICE DE CARGA DUAL, CODIGO DE VELOCIDAD, PRESION MAXIMA, TL/TT (salen como especificaciones o servicios)'],
    ['DIMENSIONES DE CAUCHOS', 'MEDIDA, ANCHO, ALTO, DIAMETRO', 'Ponen ancho, alto y diámetro en las especificaciones de los cauchos de esa medida (265/60R18 es lo mismo que 265/60/18)'],
    ['INVENTARIO DE BATERIA', 'CODIGO CM, CODIGO MC, MARCA, MODELO (aquí va el <b>grupo</b>), AMP, PRECIO, BS, CM, MC, TOTAL INVENTARIO', 'NOMENCLATURA, POSICION, SERVICIO, GARANTIA, CHATARRA DIVISA, CHATARRA BS, ANCHO, LARGO, ALTO, VOLTAJE, AMPERIOS DE ARRANQUE (CA), ARRANQUE EN FRIO (CCA), AMPERIOS POR HORA (AH), CAPACIDAD DE RESERVA (CR)'],
    ['INVENTARIO DE ACEITES', 'CODIGO CM, CODIGO MC, Aceite (tipo), Combo (presentación), Marca, Precio, Bs, CM, MC, TOTAL INVENTARIO', '—'],
    ['OTROS ARTICULOS', 'CODIGO CM, CODIGO MC, NOMBRE (artículo), DESCRIPCION, Precio, Bs, CM, MC, TOTAL INVENTARIO', '—'],
    ['… BICICLETAS (cualquier nombre que contenga «bicicleta»)', 'CODIGO MC, RIN (ej. RIN 20), MODELO (ej. MODELO 130 (NIÑO)), PRECIO, BS, TOTAL INVENTARIO', 'CARACTERISTICAS (se guarda; aún no se muestra)'],
    ['COMPATIBILIDAD', 'MARCA, MODELO, AÑO DESDE, AÑO HASTA y <b>una columna por marca de batería</b> (DUNCAN, FULGOR, MARUSSI…) con el grupo que usa ese vehículo', 'POLARIDAD, AMPERAJE MINIMO'],
], [3.6 * cm, 7.2 * cm, 6.4 * cm], ['Pestaña', 'Columnas necesarias', 'Columnas opcionales'])
S += [Paragraph('El archivo de Caracas', H3), Paragraph('Tiene el <b>mismo formato</b> y las mismas pestañas que el de Maracay, con estas diferencias:', P)]
S += tabla([['Código', 'Se usa <b>CODIGO CCS</b> (el código de CM Caracas) en lugar de CODIGO CM y CODIGO MC. Es obligatorio, igual que en Maracay.'],
            ['Existencia', 'La columna <b>CCS</b> (existencia en CM Caracas). Si no existe, se usa TOTAL INVENTARIO.'],
            ['Precio y Bs', 'Las columnas Precio y Bs son los precios de <b>Caracas</b>.'],
            ['Compatibilidad y dimensiones', 'No hace falta: la tabla de vehículos y las dimensiones son las mismas para las dos ciudades.']],
           [3.4 * cm, 13.8 * cm], ['', 'Cómo es el archivo de Caracas'], zebra=False)
S += [Paragraph('Reglas del archivo', H3)]
S += bl(['<b>El código es obligatorio.</b> Cada producto necesita su CODIGO CM o su CODIGO MC (o los dos; en Caracas, su CODIGO CCS). Sin código el producto no existe para el panel. Los códigos se guardan tal cual, sin corregirlos.',
         '<b>Un producto con código y sin existencia (CM + MC = 0) no se publica en la web</b> hasta que tenga existencia (Nexo lo da como agotado). Para que se vea, ponle al menos una unidad.',
         '<b>Precio</b>: si está vacío o es 0, la web muestra «Consultar precio». <b>Bs</b> es el equivalente en dólares si paga en bolívares; si lo dejas vacío se calcula +5 %.',
         '<b>Existencias</b>: las columnas CM (CM Maracay) y MC (Master Cauchos), números enteros. El archivo de Maracay no trae Caracas: esa existencia viene en el archivo de Caracas (columna CCS) o se escribe en el panel.',
         'Solo se aceptan archivos <b>.xlsx</b> de hasta 15 MB. Un código repetido en dos filas no se carga (la segunda se avisa).',
         'Una categoría solo se actualiza si su pestaña está en el archivo. Si no subes una pestaña, esa categoría no se toca.',
         '<b>Cada archivo toca solo su ciudad</b>: al cargar el de Maracay se conservan los precios, las existencias y los códigos de Caracas, y al cargar el de Caracas no se toca nada de Maracay.'])
S += [Paragraph('9.2 Paso a paso', H2)]
S += pasos(['Entra a «Cargar Excel» en el menú (o al botón «Cargar Excel» del inicio).', '<b>Elige la tienda</b> del archivo en «¿Para qué tienda es este archivo?»: <b>Maracay</b> (CM Maracay y Master Cauchos) o <b>Caracas</b> (CM Caracas). Debajo aparece una nota con el formato de esa tienda.', 'Pulsa «Seleccionar archivo» y elige el Excel.',
            '<b>(Opcional)</b> Si solo quieres ver qué trae el archivo, marca la casilla «Solo ver qué trae el archivo, aunque no tenga códigos CM/MC». No se carga nada: es una vista previa.',
            'Pulsa «Revisar archivo». Aparece «Revisando…» y, en unos segundos, una tarjeta por cada categoría que traiga el archivo.',
            'Revisa cada categoría (9.3). Entra a «Ver todas las filas» si quieres comprobar producto por producto.',
            'En cada categoría que esté bien pulsa «Confirmar …». La tarjeta pasa a «Confirmada».', 'Pulsa «Publicar lo confirmado (N)». El panel pide una última confirmación que resume lo que va a cambiar.',
            'Al terminar aparece «Listo: N … publicados. La web y Nexo ya usan la lista nueva.» y las categorías que no confirmaste siguen pendientes.'])
S += fig('28-excel-selector-tienda.jpg', ['«¿Para qué tienda es este archivo?»: Maracay o Caracas.', 'Nota con el formato de la tienda elegida.', '«Seleccionar archivo» y «Revisar archivo».'], 'Pantalla de carga con el selector de tienda (aquí con Caracas elegida)')
S += fig('15-excel-inicio.jpg', ['«Seleccionar archivo»: elige el Excel (.xlsx).', 'Casilla de «solo vista previa»: revisa el archivo sin poder publicarlo.', '«Revisar archivo»: lee el Excel y muestra qué cambiaría. No publica nada.'], 'Pantalla «Cargar lista de precios» (con Maracay elegida)')
S += [CondPageBreak(12 * cm), Paragraph('9.3 Cómo leer la tarjeta de cada categoría', H2)]
S += fig('19-excel-confirmada.jpg', ['Estado de la categoría: «Pendiente» o «Confirmada».', '«Ver todas las filas»: abre la tabla con todos los productos del archivo.', '«Quitar confirmación»: la deja otra vez en pendiente (en una categoría sin confirmar este botón dice «Confirmar …»).'], 'Tarjeta de una categoría ya confirmada')
S += tabla([
    ['en la lista', 'Cuántos productos publicables trae el archivo para esa categoría.'],
    ['sin precio', 'Cuántos de ellos no tienen precio (saldrán como «Consultar precio»).'],
    ['con especificaciones', 'Cuántos tienen especificaciones (medidas, índices…).'],
    ['nuevos', 'Productos que no estaban publicados (por código).'],
    ['con cambios', 'Productos que ya estaban y que cambian en algo (precio, existencias, especificaciones…).'],
    ['con precio distinto', 'De esos, cuántos cambian de precio.'],
    ['no se publican', 'Filas del archivo que se descartan (falta el código, falta la marca o la medida, código repetido…). Se ven en «Ver todas las filas» → «Filas que no se publican».'],
    ['Salen de la lista N productos que estaban antes', 'Productos publicados hoy que ya no están en el archivo. Si publicas, desaparecen.'],
    ['Atención: la lista nueva es mucho más corta que la actual', 'El archivo trae menos del 70 % de lo publicado. Casi siempre es el archivo equivocado o incompleto: revísalo antes de confirmar.'],
], [5.2 * cm, 12 * cm], ['Aparece', 'Significa'])
S += fig('18-excel-tabla.jpg', ['Buscador dentro de la categoría.', 'Filtro: Todas las filas, Con cambios respecto a lo publicado, Editados a mano en el panel, Sin precio, Sin especificaciones, Sin código y Filas que no se publican.', 'Paginación (50 filas por página).'], 'Tabla de todas las filas del archivo (aquí filtrada por «Sin precio»)')
S += bl(['La tabla se desplaza a los lados para ver todas las columnas. Cuando hay cambios aparece al final la columna <b>«Qué cambia»</b>.',
         'Si en el filtro eliges «Filas que no se publican», ves la lista de filas descartadas y el motivo (por ejemplo «Fila 12: código X sin medida o marca»).'])
S += caja('Si el archivo es de Caracas', ['Las tarjetas cuentan lo de Caracas: «nuevos» son los productos que Maracay no tiene (se crean solo para Caracas), «con cambios» son los que cambian de precio o de existencia en Caracas y «salen de la lista» los que ya tenían datos de Caracas y no vienen en el archivo (pierden lo de Caracas; si solo existían en Caracas, desaparecen).', 'Un producto se une a lo ya publicado por su código CCS o, si todavía no lo tiene, por sus datos (medida, marca, modelo y tipo en cauchos). La primera vez que cargues Caracas, revisa en «Ver todas las filas» que las uniones sean las correctas.'], AZULF, colors.HexColor('#1F4E9E'))
S += [CondPageBreak(12 * cm), Paragraph('9.4 Avisos cuando vuelves a cargar un archivo', H2),
      Paragraph('Si el producto ya estaba publicado, el panel lo compara <b>por código</b> con el archivo nuevo y te dice exactamente qué campo cambia: precio, precio en bolívares, existencias de CM, Master y Caracas, marca, modelo, tipo, medida, especificaciones, servicios, garantía y etiqueta.', P)]
S += fig('22-excel-a-mano.jpg', ['Aviso en rojo: hay productos que se editaron a mano en el panel y esta carga los sobrescribe con lo del Excel.', 'Lista de esos productos (con la fecha en que se editaron).', 'Lista de todos los productos que cambian y qué cambia en cada uno.', 'Lista de los productos con precio distinto.', '«Confirmar …»: solo después de revisar.'], 'Aviso de productos editados a mano que se van a sobrescribir')
S += fig('23-excel-detalle.jpg', None, 'Detalle abierto: «Precio: REF 250 → REF 301» muestra el precio publicado y el nuevo', w=AN)
S += fig('24-excel-quecambia.jpg', None, 'En la tabla, la columna «Qué cambia» (filtrada por «Editados a mano»)', w=AN)
S += [CondPageBreak(12 * cm), Paragraph('9.5 Publicar', H2)]
S += fig('20-excel-publicar.jpg', ['«Publicar lo confirmado (N)»: N es el número de categorías confirmadas. Aparece desactivado hasta que confirmes una.', '«Cancelar»: descarta la revisión sin publicar nada.', 'Las categorías pendientes siguen abajo, con su botón «Confirmar …».'], 'Parte de abajo de la pantalla')
S += [Paragraph('Al pulsar «Publicar lo confirmado» el panel muestra un cuadro como este, con un resumen:', P),
      Paragraph('<i>«Se van a publicar: Cauchos. Cambian 4 productos ya publicados (3 con precio distinto). 1 fue editado a mano en el panel y se sobrescribe. La web y Nexo usarán estas listas ahora mismo. ¿Continuar?»</i>', ParagraphStyle('q', parent=P, leftIndent=14, textColor=GRIS))]
S += fig('21-excel-publicado.jpg', None, 'Mensaje al terminar: lo publicado y lo que queda pendiente', w=AN)
S += [Paragraph('9.6 ¿Qué se conserva y qué se reemplaza al publicar una categoría?', H2)]
S += tabla([['Se conservan', 'Las fotos de los productos que siguen en el archivo. Los productos creados a mano en el panel. Las demás categorías que no confirmaste. Los datos de la otra tienda (Maracay o Caracas).'],
            ['Se reemplaza', 'Todo lo que viene del Excel en esa categoría y tienda: la lista de productos queda igual al archivo. Un producto que ya no está en el archivo (o no tiene existencia) desaparece. Lo editado a mano en un producto que viene del Excel se pierde.'],
            ['Se guarda un respaldo', 'Antes de reemplazar una categoría el sistema guarda una copia de la lista anterior, por si hay que volver atrás. Pídela al soporte.']],
           [3.6 * cm, 13.6 * cm], ['', ''], zebra=False)
S += importante(['<b>La primera vez que cargues un Excel con códigos</b> después de haber cargado uno sin códigos, el panel mostrará todos los productos como «nuevos» y los anteriores como «salen de la lista». Es normal: el código es lo que identifica a cada producto y antes no existía. Revisa que los totales coincidan y publica.',
                 '<b>Si el archivo trae menos productos de los que hay publicados</b> (o una categoría llega en 0), el panel te avisa en rojo. Una categoría sin ninguna fila publicable <b>no se puede confirmar</b>, para no vaciar la lista actual por error.'])
S += [Paragraph('9.7 Si el archivo todavía no tiene códigos', H2),
      Paragraph('Mientras los productos no tengan CODIGO CM o CODIGO MC (CODIGO CCS en Caracas), el panel no publica nada. Tienes dos caminos:', P)]
S += bl(['<b>Ver qué trae el archivo sin publicar</b>: marca la casilla «Solo ver qué trae el archivo, aunque no tenga códigos CM/MC». Verás todas las filas, los precios y las especificaciones, pero no hay botón de publicar.',
         '<b>Publicarlo temporalmente sin códigos</b>: solo lo puede hacer el soporte técnico con una carga especial. Los productos se publican sin código y con existencia «disponible» en las tiendas de Maracay, hasta que lleguen los códigos y las existencias reales. Escribe al soporte con el archivo adjunto.'])
S += [Paragraph('9.8 Mensajes de la carga y qué hacer', H2)]
S += tabla([
    ['No se pudo leer el archivo. Debe ser un Excel .xlsx.', 'El archivo está dañado o no es .xlsx (por ejemplo .xls o .csv). Ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)».'],
    ['Ninguna fila tiene código: N productos se quedaron fuera porque les falta el CODIGO CM o el CODIGO MC. Llena esas columnas y vuelve a subir el archivo.', 'El archivo no tiene códigos. Complétalos o usa la vista previa (9.7).'],
    ['No se encontró ningún producto con precio. Sube la lista con sus hojas…', 'Las pestañas no tienen los nombres esperados o están vacías. Revisa los nombres (9.1).'],
    ['Fila N: … (sin código CCS, no se publica)', 'En un archivo de Caracas, esa fila no tiene CODIGO CCS y se descarta.'],
    ['Esto es solo una vista previa: el archivo no tiene códigos y no se puede publicar.', 'Marcaste la casilla de vista previa. Es normal: desmárcala y vuelve a revisar cuando tengas códigos.'],
    ['Primero sube y revisa el archivo.', 'Pulsaste publicar sin haber revisado un archivo (o ya lo publicaste).'],
    ['Elige categorías que estén en el archivo revisado.', 'Intentaste publicar una categoría que ya no está pendiente.'],
    ['No se publica cauchos: ninguna fila del archivo se puede publicar…', 'Esa categoría quedó en 0 filas publicables (casi siempre falta el código). No se publica para no vaciar la lista.'],
    ['Fila N: … (sin código CM ni MC, no se publica)', 'Esa fila no tiene código y se descarta.'],
    ['Fila N: código X sin medida o marca (o «sin marca», «sin tipo o marca», «sin rin o modelo»)', 'Falta un dato obligatorio en esa fila.'],
    ['Fila N: código X repetido (ya está en la fila M), no se carga', 'Dos filas con el mismo código. Se carga la primera.'],
    ['Aviso (sí se cargaron): los códigos «A», «B» solo se diferencian en espacios o mayúsculas…', 'Se cargaron los dos, pero revisa que sean productos distintos.'],
    ['Aviso (sí se cargaron): N medidas sin dimensiones en la hoja DIMENSIONES DE CAUCHOS: …', 'Esas medidas no aparecen en la pestaña de dimensiones. Los cauchos se cargaron igual, sin ancho/alto/diámetro.'],
    ['Fila N: MARCA MODELO (falta marca, modelo o grupo)', 'Una fila de COMPATIBILIDAD sin marca, modelo o ningún grupo de batería.'],
    ['La hoja COMPATIBILIDAD necesita las columnas MARCA y MODELO, el grupo… y los años…', 'La pestaña de compatibilidad no tiene esos encabezados.'],
], [8.6 * cm, 8.6 * cm], ['Mensaje', 'Qué significa y qué hacer'])

# ============ 10. Consumo ============
S += [PageBreak(), Paragraph('10. Consumo de Nexo', H1),
      Paragraph('Nexo usa un servicio de inteligencia artificial que tiene un costo por uso. El panel te muestra cuánto se ha gastado para que no haya sorpresas.', P)]
S += fig('25-consumo.jpg', None, 'Página «Uso del modelo» (se abre en otra pestaña desde «Consumo de Nexo»)', w=AN)
S += bl(['<b>Tope semanal</b>: la línea de arriba dice cuánto se ha gastado en la semana (de lunes a domingo) y el tope. Al llegar al tope, Nexo deja de responder y pasa las conversaciones a un asesor humano.',
         '<b>Límite por cliente</b>: cada cliente puede enviar un máximo de mensajes por hora y por día (hoy 15 por hora y 20 por día) para evitar abusos.',
         '<b>Llamadas y tokens por día</b>: el detalle de uso. Se llena cuando hay conversaciones reales.',
         '<b>Gasto por conversación</b>: cuánto costó cada conversación.',
         'En el inicio, la tarjeta «Consumo de Nexo esta semana» muestra el avance con una barra que se pone amarilla al acercarse al tope y roja al alcanzarlo.'])

# ============ 11. Restricciones ============
S += [Paragraph('11. Restricciones y límites', H1)]
S += tabla([
    ['Archivo Excel', 'Solo .xlsx, hasta 15 MB. Los productos necesitan CODIGO CM o CODIGO MC (CODIGO CCS en el archivo de Caracas).'],
    ['Existencia en el Excel', 'Un producto con código y sin existencia (CM + MC = 0) no se publica en la web.'],
    ['Publicar una categoría', 'Solo si tiene al menos un producto publicable. No se puede confirmar una categoría vacía.'],
    ['Vista previa sin códigos', 'Permite revisar todo pero no publicar.'],
    ['Fotos', 'JPG, PNG o WebP, hasta 5 MB.'],
    ['Lista de productos', '40 productos por página. Tabla de revisión del Excel: 50 filas por página.'],
    ['Tasa de cambio fijada a mano', 'Vale solo el día en que se fija. El euro debe estar entre 0,8 y 2 veces el dólar.'],
    ['Especificaciones por caucho', 'Hasta 12 (nombre ≤ 40 letras y valor ≤ 60).'],
    ['Servicios', 'Hasta 12 generales y hasta 12 por regla o por producto, de máximo 60 letras cada uno. Hasta 60 reglas por marca o modelo.'],
    ['Detalle del filtro del combo', 'Hasta 80 letras.'],
    ['Textos de productos', 'Marca ≤ 60 letras, Modelo de caucho ≤ 40, Tipo ≤ 30, Descripción ≤ 80, Grupo ≤ 40, Tipo de aceite ≤ 60, Presentación ≤ 40, Modelo de bicicleta ≤ 30, Texto extra ≤ 60.'],
    ['Rin de bicicleta', 'Entre 10 y 32.'],
    ['Años de un vehículo', 'Entre 1900 y 2100; «desde» no puede ser mayor que «hasta».'],
    ['Precio y existencia de Caracas', 'Se cargan con el archivo de Caracas (CODIGO CCS y columna CCS) o se escriben en el panel. Sin precio de Caracas, la web y Nexo dicen «Consultar precio» para Caracas.'],
    ['Productos solo de Caracas', 'Se crean al cargar el archivo de Caracas y no se ofrecen en Maracay.'],
    ['Respuestas de Nexo', '15 mensajes por hora y 20 por día por cliente; tope semanal de gasto (ver sección 10).'],
], [5.2 * cm, 12 * cm], ['Tema', 'Límite o regla'])

# ============ 12. Mensajes ============
S += [PageBreak(), Paragraph('12. Mensajes frecuentes del panel', H1),
      Paragraph('Además de los mensajes de cada sección, estos aparecen en cualquier parte del panel:', P)]
S += tabla([
    ['Guardado. Ya se ve en la web y en Nexo.', 'Verde. El cambio de un producto se guardó. (Se ve en menos de 1 minuto en la web.)'],
    ['Producto eliminado.', 'Verde. El producto se borró. Si venía del Excel y sigue en el archivo, volverá con la próxima carga.'],
    ['Guardado. Ya se ve en la web.', 'Verde, en Ajustes de la web.'],
    ['Escribe el precio en dólares (0 si el precio se consulta).', 'Falta el precio o es negativo.'],
    ['Escribe el precio de Caracas en dólares (vacío si todavía no tiene).', 'El precio de Caracas no es un número válido o es negativo.'],
    ['Primero escribe el precio de Caracas.', 'Intentaste poner el equivalente en bolívares de Caracas sin tener precio de Caracas.'],
    ['Escribe el equivalente en dólares si paga en bolívares.', 'El equivalente en bolívares no es un número válido.'],
    ['Escribe la marca (máximo 60 letras).', 'Falta la marca o es muy larga.'],
    ['Escribe la medida, por ejemplo 265/60R18.', 'Caucho sin medida.'],
    ['Las lonas deben ser un número, por ejemplo 16.', 'Escribiste letras en Lonas.'],
    ['Escribe cada especificación como «Nombre: valor» (revisa «…»). / Máximo 12 especificaciones por producto. / La especificación «…» es muy larga.', 'El formato de las especificaciones es incorrecto o te pasaste de límites.'],
    ['Escribe la descripción, por ejemplo 1000 AMP / 24R. (baterías) / … Champion o Set de 4 tuercas + 1 llave. (otros)', 'Falta la descripción.'],
    ['Escribe el grupo, por ejemplo GRUPO 24.', 'Batería sin grupo.'],
    ['Escribe el tipo de aceite, por ejemplo 20W-50 MINERAL. / Escribe la presentación, por ejemplo Litro o 4 Litros.', 'Falta el tipo o la presentación del aceite.'],
    ['Escribe el rin de la bicicleta, por ejemplo 20. / Escribe el modelo, por ejemplo 130.', 'Falta el rin (10 a 32) o el modelo de la bicicleta.'],
    ['La imagen debe ser JPG, PNG o WebP.', 'La foto no tiene un formato permitido.'],
    ['Ese producto ya no existe.', 'Otra persona lo eliminó mientras lo editabas. Actualiza la página.'],
    ['No se pudo completar la acción.', 'Error general. Actualiza la página y vuelve a intentarlo; si se repite, avisa al soporte.'],
], [8.2 * cm, 9 * cm], ['Mensaje', 'Significado'])

# ============ 13. FAQ ============
S += [Paragraph('13. Preguntas frecuentes', H1)]
faq = [
    ('Cambié un precio y no lo veo en la web', 'Espera hasta un minuto y recarga la página (actualiza el navegador). Si sigue igual, comprueba en el panel que la casilla guardó (debe aparecer «Guardado…»).'),
    ('Subí el Excel y todas las categorías dicen «0 en la lista»', 'El archivo no tiene códigos (o tiene los encabezados con otro nombre). Mira «Filas que no se publican»: el motivo aparece en cada fila. Sin códigos el panel no publica; usa la vista previa o pide la carga especial al soporte.'),
    ('Un producto desapareció después de cargar', 'O ya no estaba en el archivo, o tiene código pero la existencia (CM + MC) es 0. Revisa la pestaña del Excel y ponle existencia.'),
    ('Edité un precio en el panel y volvió al anterior', 'Se cargó un Excel que traía el precio anterior y lo sobrescribió. Antes de publicar, el panel avisa de los «Editados a mano». Para que quede, cámbialo también en el Excel.'),
    ('La web no muestra los precios en bolívares', 'No hay una tasa válida. Entra al inicio, mira «Tasa de cambio del día» y pulsa «Actualizar del BCV» o fíjala a mano.'),
    ('Nexo dice un precio y la web otro', 'Nexo da el precio del momento en que buscó. Si cambiaste el precio hace poco, la conversación que ya estaba abierta conserva el anterior; en la siguiente consulta usará el nuevo.'),
    ('¿Cómo agrego los datos de Caracas?', 'Con el archivo de Caracas: en «Cargar Excel» elige «Caracas» en «¿Para qué tienda es este archivo?», sube el archivo (con CODIGO CCS y la columna CCS) y sigue la revisión. Para un solo producto, escribe su precio y existencia en las casillas de Caracas de la lista o al editarlo.'),
    ('Caracas muestra «Consultar precio» en un producto', 'Ese producto no tiene precio de Caracas todavía. Cárgalo con el archivo de Caracas o escríbelo en el panel («Precio Caracas $»). En el inicio, el aviso «sin precio en Caracas» te dice cuántos faltan.'),
    ('¿Puedo deshacer una carga?', 'Antes de reemplazar una categoría, el sistema guarda una copia de la lista anterior. Si te equivocas, escribe al soporte cuanto antes para restaurarla.'),
    ('¿Qué hago si el panel no abre o da error?', 'Actualiza la página. Si pide la clave otra vez, escríbela de nuevo. Si sigue sin abrir, avisa al soporte con una captura de pantalla.'),
]
for q, a in faq:
    S += [KeepTogether([Paragraph(f'<b>{q}</b>', ParagraphStyle('fq', parent=P, spaceAfter=1, textColor=NEGRO)), Paragraph(a, ParagraphStyle('fa', parent=P, leftIndent=10, textColor=GRIS))])]
S += [Paragraph('Lista de verificación antes de publicar un Excel', H2)]
S += bl(['Todas las filas tienen CODIGO CM o CODIGO MC (CODIGO CCS en el archivo de Caracas).', 'Elegiste la tienda correcta (Maracay o Caracas) antes de revisar el archivo.',
         'Los productos que quieres que se vean tienen existencia (CM + MC mayor que 0; CCS en Caracas).',
         'Los precios están en la columna «Precio» (0 o vacío = «Consultar precio»); en el archivo de Caracas son los precios de Caracas.',
         'Los nombres de las pestañas y los encabezados no se cambiaron.', 'Los totales de cada tarjeta se parecen a lo que esperas (el panel avisa si el archivo es mucho más corto que lo publicado).',
         'Revisaste la lista «Productos que cambian» y los «Editados a mano».', 'Confirmaste solo las categorías que quieres publicar.'])
S += consejo('Si tienes dudas con un mensaje que no está en este manual, haz una captura de pantalla completa y envíala al soporte junto con el archivo que estabas cargando. Así se resuelve más rápido.', 'Soporte')

doc.build(S)
print('listo', OUT)
