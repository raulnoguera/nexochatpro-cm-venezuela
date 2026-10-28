"""Convierte la hoja CAUCHOS de «MCY - LISTA DE PRECIOS.xlsx» en data/inventario.json.

Uso: python3 scripts/importar_lista.py "/ruta/MCY - LISTA DE PRECIOS.xlsx"

Reglas de la lista:
  Precio = dólares de contado; Bs = ROUNDUP(Precio x 1.05) (dólares-equivalente si paga en bolívares).
  CM / MC  = hay en CM Maracay (tienda_1) / Master Cauchos (tienda_2). La lista no trae cantidades,
  salvo anotaciones tipo «1 CM» en la columna K. Filas con Precio 0 no se publican.
"""
import json, re, sys, openpyxl

SIN_CANTIDAD = 5          # «hay» sin cantidad conocida (el bot nunca dice números exactos)

def medida_y_rin(txt):
    base = re.sub(r'\(.*?\)', '', txt).replace('🔥', '')
    base = re.sub(r'\b(CON|SIN)\s+SET\b', '', base, flags=re.I).strip()
    base = re.sub(r'^(\d+/\d+)/(\d+)$', r'\1R\2', base)          # 265/50/20 -> 265/50R20
    m = re.search(r'R\s*(\d{2}(?:\.\d)?)\s*$', base)
    m = m or re.search(r'/(\d{2}(?:\.\d)?)(?:\s+[A-Za-z]+)?$', base)   # 750/16, 215/75/17.5, 185/15 CARGA
    if not m: return base, None
    rin = float(m.group(1))
    return base, int(rin) if rin == int(rin) else rin

def cantidades(k):
    q = {}
    for n, quien in re.findall(r'(-?\d+)\s*(cm|master)', str(k or ''), re.I):
        q['tienda_1' if quien.lower() == 'cm' else 'tienda_2'] = max(int(n), 0)
    return q

ws = openpyxl.load_workbook(sys.argv[1], data_only=True)['CAUCHOS']
out, vistos = [], {}
for fila in list(ws.iter_rows(values_only=True))[1:]:
    med, marca, usd, bs, _g, nota, _t1, _t2, cm, mc, k = (list(fila) + [None] * 11)[:11]
    if not med or not marca or not (usd or 0) > 0: continue
    medida, rin = medida_y_rin(str(med))
    stock = {'tienda_1': SIN_CANTIDAD if cm else 0, 'tienda_2': SIN_CANTIDAD if mc else 0}
    for s, n in cantidades(k).items():
        if stock[s]: stock[s] = n
    sku = re.sub(r'[^A-Z0-9]', '', (str(marca)[:3] + medida).upper())
    vistos[sku] = vistos.get(sku, 0) + 1
    item = {'sku': f'{sku}-{vistos[sku]}', 'marca': str(marca).strip(), 'modelo': '', 'medida': medida, 'rin': rin,
            'usd': float(usd), 'usd_bs': float(bs or usd), 'stock': stock}
    if str(med).strip() != medida: item['detalle'] = str(med).strip()
    if nota: item['nota'] = str(nota).strip('() ')
    out.append(item)
json.dump(out, open('data/inventario.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'cauchos importados')
