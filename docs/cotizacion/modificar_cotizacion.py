"""Genera la cotización del 6 de noviembre de 2026 a partir de la original del 24 de octubre (Cotizacion_CM_Venezuela.pdf).
Cambios: la página web pasa de $400 a $550 (total de pagos únicos $980, 50 % = $490), fecha de emisión 6 de noviembre y inicio el lunes 9 de noviembre.
Además agrega la sección 8 (posibles gastos adicionales por el consumo del chatbot), pasa la aceptación a la página 5 como sección 9 y deja la sección 5
(costos de Meta) en línea con la sección 8. Todo lo demás se conserva tal cual (mismo diseño, logos y textos).
Los PDF de cotización están en .gitignore (datos comerciales): el original debe estar en la raíz del proyecto como Cotizacion_CM_Venezuela.pdf.
Uso: python3 docs/cotizacion/modificar_cotizacion.py"""
import pathlib
import fitz

raiz = pathlib.Path(__file__).resolve().parents[2]
origen, destino = raiz / 'Cotizacion_CM_Venezuela.pdf', raiz / 'Cotizacion_CM_Venezuela_6_nov.pdf'

# (texto viejo, texto nuevo): se aplican dentro de la línea donde aparecen
CAMBIOS = [
    ('24 de octubre de 2026', '6 de noviembre de 2026'),
    ('B. Página web con catálogo ($400, pago único)', 'B. Página web con catálogo ($550, pago único)'),
    ('lunes 26 de octubre de 2026', 'lunes 9 de noviembre de 2026'),
    ('50% al aprobar la cotización ($415)', '50% al aprobar la cotización ($490)'),
    ('50% restante ($415)', '50% restante ($490)'),
]
# importes de la tabla del resumen: se cambian por posición (fila de la web y total), no por texto, porque «$400» también es la puesta en marcha
FUENTES = {'Helvetica': 'helv', 'Helvetica-Bold': 'hebo'}
NEGRO, AZUL, GRIS, LINEA = (0.043, 0.071, 0.125), (0.184, 0.357, 1.0), (0.42, 0.42, 0.42), (0.851, 0.851, 0.851)


def color(c):
    return ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)


def lineas(pagina):
    for b in pagina.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            yield l


def reescribir(pagina, span, nuevo_texto, fondo, desplazar=0.0):
    """Cambia solo ese tramo de texto: lo borra y lo escribe de nuevo con el mismo tipo, tamaño y color. Si estaba pegado al borde derecho, conserva ese borde.
    Devuelve cuánto creció hacia la izquierda (para mover el tramo anterior de la línea)."""
    x0, y0, x1, y1 = span['bbox']
    derecha = x1 > 540 and x0 > 300
    f = FUENTES[span['font']]
    pagina.add_redact_annot(fitz.Rect(x0 + 1.0, y0 + 1.5, x1 + 0.5, y1 - 1.5), fill=fondo)      # empieza después del espacio inicial para no tocar el «:» del tramo anterior
    pagina.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
    ancho = fitz.get_text_length(nuevo_texto, fontname=f, fontsize=span['size'])
    x = (x1 - ancho) if derecha else span['origin'][0] + desplazar
    pagina.insert_text((x, span['origin'][1]), nuevo_texto, fontname=f, fontsize=span['size'], color=color(span['color']))
    return (span['origin'][0] - x) if derecha else 0.0


def fondo_de(pagina, y):
    """Color de fondo en esa altura (blanco, o el gris claro de la fila de totales)."""
    for d in pagina.get_drawings():
        r = d['rect']
        if d.get('fill') and r.y0 <= y <= r.y1 and r.height > 5 and r.width > 400:
            return d['fill']
    return (1, 1, 1)


doc = fitz.open(origen)
hechos = []
for n, pagina in enumerate(doc, start=1):
    fila_web = pagina.search_for('B. Página web con catálogo')
    for linea in list(lineas(pagina)):
        for span in linea['spans']:
            texto, nuevo = span['text'], span['text']
            for viejo, cambio in CAMBIOS:
                if viejo in nuevo:
                    nuevo = nuevo.replace(viejo, cambio); hechos.append((n, viejo))
            # tabla del resumen económico: importes alineados a la derecha (se cambian por posición porque «$400» también es la puesta en marcha)
            if n == 3 and texto in ('$400', '$830') and span['bbox'][0] > 450:
                if texto == '$830':
                    nuevo = '$980'; hechos.append((n, '$830'))
                elif fila_web and abs(fila_web[0].y0 - span['bbox'][1]) < 4:
                    nuevo = '$550'; hechos.append((n, 'tabla B'))
            if nuevo != texto:
                fondo = fondo_de(pagina, (span['bbox'][1] + span['bbox'][3]) / 2)
                x1, x0 = span['bbox'][2], span['bbox'][0]
                if x1 > 540 and x0 > 300:                                    # texto pegado a la derecha: si crece, el tramo anterior (p. ej. «Fecha:») se corre a la izquierda
                    crece = fitz.get_text_length(nuevo, fontname=FUENTES[span['font']], fontsize=span['size']) - (x1 - x0)
                    previos = [t for t in linea['spans'] if t is not span and t['bbox'][2] <= x0 + 0.5]
                    if crece > 0.01:
                        for t in previos:
                            reescribir(pagina, t, t['text'], fondo, desplazar=-crece)
                reescribir(pagina, span, nuevo, fondo)

# ---------- sección 5: costos de Meta, en línea con la sección 8 ----------
COSTOS_META = ('Costos de Meta:', ' la cuenta de WhatsApp Business estará a nombre de CM Venezuela, con su propio método de pago, y Meta le factura directamente. Los mensajes que escribe el cliente son gratuitos. Las respuestas del asistente dentro de las 24 horas son gratuitas hasta 1.000 mensajes al mes por número de WhatsApp; a partir de ahí Meta podría cobrarlas, según su documentación técnica (ver sección 8). Los mensajes de plantilla (promociones, recordatorios, seguimientos fuera de las 24 horas) se cobran según su categoría. Las tarifas son las vigentes de Meta y pueden cambiar.')
p3 = doc[2]
instantanea = fitz.open('pdf', doc.tobytes())          # copia de la página tal como está, para mover hacia abajo lo que sigue
bloque = next(b for b in p3.get_text('dict')['blocks'] if b.get('lines') and 'Costos de Meta' in ''.join(sp['text'] for sp in b['lines'][0]['spans']))
x_ini, y_ini, y_fin = 71.0, bloque['bbox'][1], bloque['bbox'][3]
etiqueta, cuerpo = COSTOS_META
ancho_et = fitz.get_text_length(etiqueta, fontname='hebo', fontsize=10)
lineas_nuevas, actual, primera = [], '', True
for palabra in cuerpo.strip().split(' '):
    disponible = (548.4 - (77.6 + ancho_et + 2.8)) if primera else (548.4 - 77.6)
    prueba = (actual + ' ' + palabra).strip()
    if fitz.get_text_length(prueba, fontname='helv', fontsize=10) <= disponible:
        actual = prueba
    else:
        lineas_nuevas.append(actual); actual = palabra; primera = False
lineas_nuevas.append(actual)
dy = (len(lineas_nuevas) - 4) * 14.0
ultimo_texto = max(b['bbox'][3] for b in p3.get_text('dict')['blocks'] if b.get('lines') and b['bbox'][1] < 740)
assert ultimo_texto + dy <= 742, f'la sección 5 no cabe en la página 3 ({ultimo_texto + dy:.0f} > 742)'
p3.add_redact_annot(fitz.Rect(x_ini, y_ini + 1, 556, y_fin), fill=(1, 1, 1))                 # solo el texto del párrafo (la viñeta se queda)
p3.add_redact_annot(fitz.Rect(56, y_fin + 1, 556, 744), fill=(1, 1, 1))                      # y todo lo que sigue, que se vuelve a colocar más abajo
p3.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
y0 = bloque['lines'][0]['spans'][0]['origin'][1]
p3.insert_text((77.6, y0), etiqueta, fontname='hebo', fontsize=10, color=NEGRO)
p3.insert_text((77.6 + ancho_et + 2.8, y0), lineas_nuevas[0], fontname='helv', fontsize=10, color=NEGRO)
for i, l in enumerate(lineas_nuevas[1:], start=1):
    p3.insert_text((77.6, y0 + 14 * i), l, fontname='helv', fontsize=10, color=NEGRO)
corte = fitz.Rect(56, y_fin + 1, 556, 744)
p3.show_pdf_page(fitz.Rect(corte.x0, corte.y0 + dy, corte.x1, corte.y1 + dy), instantanea, 2, clip=corte)
hechos.append((3, f'sección 5: costos de Meta ({len(lineas_nuevas)} líneas, +{dy:.0f} pt)'))

# ---------- sección nueva: posibles gastos adicionales por el consumo del chatbot ----------
SECCION = {
    'titulo': '8. Posibles gastos adicionales por el consumo del chatbot',
    'intro': 'El servicio mensual cubre el consumo del chatbot hasta 3.000 conversaciones al mes (sección 5). Estos son los gastos que podrían sumarse según cuántos clientes escriban:',
    'puntos': [
        ('Inteligencia artificial:', ' cada bloque adicional de 1.000 conversaciones por encima de las 3.000 incluidas cuesta $7, con aviso previo. El costo real medido es de unos $0,007 por conversación.'),
        ('WhatsApp (Meta), a cargo del cliente:', ' lo que escribe el cliente es gratis. Los primeros 1.000 mensajes de servicio al mes por número de WhatsApp también; según la documentación técnica de Meta, del 1.001 en adelante cuestan $0,0113 por mensaje (la página comercial de Meta los indica gratis; la primera factura de Meta confirmará cuál aplica).'),
        ('Plantillas fuera de las 24 horas:', ' se cobran por categoría; las de marketing son las más caras (referencia no oficial: aprox. $0,074 por mensaje; las de utilidad, aprox. $0,0113).'),
        ('Instagram y Facebook Messenger:', ' según Meta, sin cargo por mensaje.'),
    ],
    'tabla_titulo': 'Estimación del cargo de Meta por número de WhatsApp si aplica el cobro desde el mensaje 1.001 (unos 9 mensajes del chatbot por conversación):',
    'tabla': [('Conversaciones al mes', 'Mensajes del chatbot', 'Cargo de Meta estimado'), ('100', '900', '$0'), ('300', '2.700', 'aprox. $19'), ('1.000', '9.000', 'aprox. $90'), ('3.000', '27.000', 'aprox. $294')],
    'cierre': ('Controles:', ' el chatbot trabaja con un tope semanal de inteligencia artificial de $20, un límite de mensajes por cliente y un panel de uso con el gasto de la semana. Las tarifas son las vigentes de Meta y de Google y pueden cambiar; las cifras son estimaciones.'),
}


def ajustar(texto, fuente, tam, ancho):
    """Parte un texto en líneas que quepan en ese ancho (mismo ancho de Helvetica que usa el PDF)."""
    lineas_, actual = [], ''
    for palabra in texto.split(' '):
        prueba = (actual + ' ' + palabra).strip()
        if fitz.get_text_length(prueba, fontname=fuente, fontsize=tam) <= ancho:
            actual = prueba
        else:
            lineas_.append(actual); actual = palabra
    return lineas_ + [actual]


def parrafo(pagina, x, y, texto, ancho, fuente='helv', tam=10, paso=14.5, color_=NEGRO):
    for l in ajustar(texto, fuente, tam, ancho):
        pagina.insert_text((x, y), l, fontname=fuente, fontsize=tam, color=color_)
        y += paso
    return y


def punto(pagina, y, negrita, resto):
    """Viñeta con un encabezado en negrita y el texto que sigue (envuelto con sangría)."""
    pagina.draw_circle((68.4, y - 3.4), 1.5, color=NEGRO, fill=NEGRO)      # viñeta (Helvetica base no trae «•» en este PDF)
    x0, ancho = 75.0, 473.0
    pagina.insert_text((x0, y), negrita, fontname='hebo', fontsize=10, color=NEGRO)
    corte = fitz.get_text_length(negrita, fontname='hebo', fontsize=10)
    palabras, linea, primera = resto.strip().split(' '), '', True
    for p_ in palabras:
        disp = ancho - (corte if primera else 0)
        prueba = (linea + ' ' + p_).strip()
        if fitz.get_text_length(prueba, fontname='helv', fontsize=10) <= disp - 4:
            linea = prueba
        else:
            pagina.insert_text((x0 + (corte + 3 if primera else 0), y), linea, fontname='helv', fontsize=10, color=NEGRO)
            y += 14.5; primera = False; linea = p_
    pagina.insert_text((x0 + (corte + 3 if primera else 0), y), linea, fontname='helv', fontsize=10, color=NEGRO)
    return y + 14.5 + 3


def pie(pagina, numero):
    pagina.draw_line((57.6, 745.2), (554.4, 745.2), color=LINEA, width=0.8)
    pagina.insert_text((57.6, 759.5), 'NexoChatPro  |  Cotización para CM Venezuela, C.A.  |  6 de noviembre de 2026', fontname='helv', fontsize=8, color=GRIS)
    t = f'Página {numero}'
    pagina.insert_text((554.4 - fitz.get_text_length(t, fontname='helv', fontsize=8), 759.5), t, fontname='helv', fontsize=8, color=GRIS)


# 1) quitar «8. Aceptación» (título, texto y firmas) de la página 4 y guardarlo para ponerlo en una página nueva
p4 = doc[3]
caja = fitz.Rect(56, 328, 556, 445)
bloques = [l for b in p4.get_text('dict')['blocks'] if b.get('lines') and fitz.Rect(b['bbox']).y0 >= 330 and fitz.Rect(b['bbox']).y1 <= 445 for l in b['lines']]
assert any('Aceptación' in ''.join(s_['text'] for s_ in l['spans']) for l in bloques), 'no se encontró la sección de aceptación'
p4.add_redact_annot(caja, fill=(1, 1, 1)); p4.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

# 2) la sección nueva ocupa ese lugar en la página 4
y = 346
p4.insert_text((64, y), SECCION['titulo'], fontname='hebo', fontsize=12.5, color=AZUL); y += 20
y = parrafo(p4, 64, y, SECCION['intro'], 484) + 3
for negrita, resto in SECCION['puntos']:
    y = punto(p4, y, negrita, resto)
y += 3
y = parrafo(p4, 64, y, SECCION['tabla_titulo'], 484, 'helv', 9.5, 13) + 4
colx = (64, 280, 420)
p4.draw_rect(fitz.Rect(57.6, y - 11, 554.4, y + 8), color=None, fill=NEGRO)
for i, t in enumerate(SECCION['tabla'][0]):
    ancho_t = fitz.get_text_length(t, fontname='hebo', fontsize=9.5)
    p4.insert_text(((548 - ancho_t) if i == 2 else colx[i], y + 2.5), t, fontname='hebo', fontsize=9.5, color=(1, 1, 1))
y += 8
for fila in SECCION['tabla'][1:]:
    y += 19
    for i, t in enumerate(fila):
        ancho_t = fitz.get_text_length(t, fontname='helv', fontsize=9.5)
        p4.insert_text(((548 - ancho_t) if i == 2 else colx[i], y - 5), t, fontname='helv', fontsize=9.5, color=NEGRO)
    p4.draw_line((57.6, y + 4), (554.4, y + 4), color=LINEA, width=0.8)
y += 22
punto(p4, y, *SECCION['cierre'])

# 3) página 5: la aceptación (numerada 9) con sus firmas, con el mismo pie
p5 = doc.new_page(width=612, height=792)
dy = 63 - min(l['bbox'][1] for l in bloques)
for l in bloques:
    for s_ in l['spans']:
        t = s_['text'].replace('8. Aceptación', '9. Aceptación')
        p5.insert_text((s_['origin'][0], s_['origin'][1] + dy), t, fontname=FUENTES[s_['font']], fontsize=s_['size'], color=color(s_['color']))
pie(p5, 5)

doc.save(destino, garbage=3, deflate=True)
print('Guardado:', destino)
for h in hechos:
    print('  página', *h)
