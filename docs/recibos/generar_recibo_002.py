"""Recibo de pago N.º 002 (USD 275,00) a partir del recibo N.º 001 (documentos/Recibo_de_pago_CM_Venezuela.pdf).
Cambios: número, fecha, monto y su texto, concepto (abono al saldo del 50 % restante) y resumen del pago con una fila más:
total acordado 980 · pago 001 (490) · pago 002 (275) · saldo pendiente 215. El resto (logo, datos, firmas, avisos) se conserva tal cual.
Los recibos están en .gitignore (documentos/Recibo_*.pdf). Uso: python3 docs/recibos/generar_recibo_002.py"""
import pathlib
import fitz

raiz = pathlib.Path(__file__).resolve().parents[2]
origen, destino = raiz / 'documentos' / 'Recibo_de_pago_CM_Venezuela.pdf', raiz / 'documentos' / 'Recibo_de_pago_CM_Venezuela_002.pdf'
NUMERO, FECHA, MONTO, MONTO_TXT = '002', '6 de noviembre de 2026', 275, 'Doscientos setenta y cinco dólares estadounidenses'
TOTAL, PAGO_1 = 980, 490
SALDO = TOTAL - PAGO_1 - MONTO
NEGRO, GRIS_FONDO, LINEA = (0.043, 0.071, 0.125), (0.957, 0.965, 0.980), (0.851, 0.871, 0.910)
FUENTES = {'Helvetica': 'helv', 'Helvetica-Bold': 'hebo'}
usd = lambda n: f'USD {n:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def color(c):
    return ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)


def tramos(pagina):
    return [(l, s) for b in pagina.get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans']]


def reescribir(pagina, span, texto, borde_derecho=None, desplazar=0.0):
    """Borra ese tramo y lo escribe de nuevo igual (tipo, tamaño, color). borde_derecho: si se da, el texto termina ahí."""
    x0, y0, x1, y1 = span['bbox']
    f = FUENTES[span['font']]
    pagina.add_redact_annot(fitz.Rect(x0 + 1.0, y0 + 1.5, x1 + 0.5, y1 - 1.5), fill=(1, 1, 1))
    pagina.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
    ancho = fitz.get_text_length(texto, fontname=f, fontsize=span['size'])
    x = (borde_derecho - ancho) if borde_derecho else span['origin'][0] + desplazar
    pagina.insert_text((x, span['origin'][1]), texto, fontname=f, fontsize=span['size'], color=color(span['color']))
    return span['origin'][0] - x


doc = fitz.open(origen)
p = doc[0]
instantanea = fitz.open('pdf', doc.tobytes())
buscar = lambda inicio: next((l, s) for l, s in tramos(p) if s['text'].strip().startswith(inicio))

# ---- cabecera y pie ----
reescribir(p, buscar('Recibo de pago N.º')[1], 'Recibo de pago N.º ' + NUMERO + '  |  NexoChatPro  |  Raúl Noguera')
reescribir(p, buscar('Documento generado')[1], 'Documento generado el ' + FECHA, borde_derecho=554.4)
reescribir(p, buscar('001')[1], ' ' + NUMERO, borde_derecho=548.4)
l_fecha, s_fecha = buscar('26 de octubre')
nuevo_fecha = ' ' + FECHA
crece = fitz.get_text_length(nuevo_fecha, fontname='helv', fontsize=10) - (s_fecha['bbox'][2] - s_fecha['bbox'][0])
etiqueta = next(s for s in l_fecha['spans'] if s['text'].startswith('Fecha'))
reescribir(p, etiqueta, etiqueta['text'], desplazar=-crece)
reescribir(p, s_fecha, nuevo_fecha, borde_derecho=548.4)

# ---- monto ----
reescribir(p, buscar('USD 490,00')[1], usd(MONTO))
reescribir(p, buscar('Cuatrocientos')[1], MONTO_TXT, borde_derecho=538.4)

# ---- concepto: primera línea (la lista de servicios se conserva) ----
l_con, _ = buscar('Pago inicial')
x0, y0, x1, y1 = l_con['bbox']
y_base = l_con['spans'][0]['origin'][1]
p.add_redact_annot(fitz.Rect(x0, y0 + 1.5, 556, y1 - 1.5), fill=(1, 1, 1)); p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
partes = [('helv', 'Abono al '), ('hebo', 'saldo del 50% restante'), ('helv', ' (contra entrega) de los servicios contratados, que comprenden:')]
x = x0
assert sum(fitz.get_text_length(t, fontname=f, fontsize=10.5) for f, t in partes) <= 484, 'la línea del concepto no cabe'
for f, t in partes:
    p.insert_text((x, y_base), t, fontname=f, fontsize=10.5, color=NEGRO)
    x += fitz.get_text_length(t, fontname=f, fontsize=10.5)

# ---- resumen del pago: una fila más, y lo de abajo baja 30 pt ----
DY = 30
p.add_redact_annot(fitz.Rect(56, 535.5, 556, 740), fill=(1, 1, 1)); p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
p.draw_rect(fitz.Rect(57.6, 564.8, 554.4, 594.8), color=None, fill=GRIS_FONDO)             # la fila destacada ahora es el pago de este recibo
for y in (534.8, 564.8, 594.8):
    p.draw_line((57.6, y), (554.4, y), color=LINEA, width=0.5)
filas = [(552.8, f'Pago recibido (50%) · recibo N.º 001', usd(PAGO_1), 'helv'),
         (582.8, f'Pago recibido · recibo N.º {NUMERO}', usd(MONTO), 'hebo'),
         (612.8, 'Saldo pendiente (contra entrega)', usd(SALDO), 'helv')]
for y, izq, der, f in filas:
    p.insert_text((63.6, y), izq, fontname=f, fontsize=10, color=NEGRO)
    p.insert_text((548.4 - fitz.get_text_length(der, fontname=f, fontsize=10), y), der, fontname=f, fontsize=10, color=NEGRO)
corte = fitz.Rect(56, 596, 556, 716)
p.show_pdf_page(fitz.Rect(corte.x0, corte.y0 + DY, corte.x1, corte.y1 + DY), instantanea, 0, clip=corte)

doc.save(destino, garbage=3, deflate=True)
print('Guardado:', destino, '| saldo pendiente:', usd(SALDO))
