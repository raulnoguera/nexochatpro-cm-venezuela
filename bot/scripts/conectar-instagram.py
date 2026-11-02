#!/usr/bin/env python3
"""Carga en Chatwoot y en el bot la app de Instagram (inicio de sesión de Instagram) para poder crear la bandeja de Instagram.
Se ejecuta EN EL SERVIDOR: ssh -t <servidor> 'python3 /opt/nexochatpro/bot/conectar-instagram.py'
La clave secreta se pide oculta; se guarda solo en los .env del servidor y en la configuración de Chatwoot, nunca se muestra."""
import getpass, os, re, subprocess

CW, BOT = '/opt/nexochatpro/chatwoot', '/opt/nexochatpro/bot'

def leer(archivo, clave):
    for l in open(archivo):
        if l.startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    return ''

def guardar(archivo, clave, valor):
    lineas = open(archivo).read().splitlines()
    nuevo = f'{clave}={valor}'
    if any(l.startswith(clave + '=') for l in lineas):
        lineas = [nuevo if l.startswith(clave + '=') else l for l in lineas]
    else:
        lineas.append(nuevo)
    open(archivo, 'w').write('\n'.join(lineas) + '\n')

app_id = input('Id de la app de Instagram (Meta → API de Instagram → «Identificador de la app de Instagram»): ').strip()
if not re.fullmatch(r'\d{10,20}', app_id):
    raise SystemExit('El id debe ser solo números.')
secreto = getpass.getpass('Clave secreta de la app de Instagram (no se muestra): ').strip()
if not re.fullmatch(r'[0-9a-f]{32}', secreto):
    raise SystemExit('La clave secreta debe tener 32 caracteres (letras de la a a la f y números). Cópiala completa desde Meta con «Mostrar».')
verificacion = leer(f'{BOT}/.env', 'META_VERIFY_TOKEN')
if not verificacion:
    raise SystemExit('No encuentro META_VERIFY_TOKEN en el .env del bot.')

# 1) Entorno de Chatwoot y del bot
for k, v in {'INSTAGRAM_APP_ID': app_id, 'INSTAGRAM_APP_SECRET': secreto, 'INSTAGRAM_VERIFY_TOKEN': verificacion}.items():
    guardar(f'{CW}/.env', k, v)
guardar(f'{BOT}/.env', 'META_IG_APP_SECRET', secreto)

# 2) Chatwoot guarda estos valores también en su base de datos y esa copia manda sobre el entorno
RUBY = '''
datos = JSON.parse(STDIN.read)
datos.each do |k, v|
  c = InstallationConfig.find_or_initialize_by(name: k)
  c.value = v
  c.locked = false
  c.save!
end
GlobalConfig.clear_cache
puts "Configuración de Instagram guardada en Chatwoot (#{datos.keys.join(', ')})"
'''
import json
r = subprocess.run(['docker', 'compose', 'exec', '-T', 'rails', 'bundle', 'exec', 'rails', 'runner', RUBY], cwd=CW, text=True, capture_output=True,
                   input=json.dumps({'INSTAGRAM_APP_ID': app_id, 'INSTAGRAM_APP_SECRET': secreto, 'INSTAGRAM_VERIFY_TOKEN': verificacion}))
print((r.stdout + r.stderr).strip()[-300:].replace(secreto, '***'))

# 3) Recargar Chatwoot y el bot con el entorno nuevo
subprocess.run(['docker', 'compose', 'up', '-d'], cwd=CW, capture_output=True)
subprocess.run(['docker', 'compose', 'up', '-d'], cwd=BOT, capture_output=True)
print('Listo. Siguiente paso en Meta: registra la dirección de avisos y la de retorno (ver docs/META.md, sección Instagram).')
