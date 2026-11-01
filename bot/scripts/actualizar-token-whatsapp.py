#!/usr/bin/env python3
"""Cambia el token de acceso de una bandeja de WhatsApp Cloud en Chatwoot (el temporal de Meta caduca a las 24 h).
Se ejecuta EN EL SERVIDOR: ssh -t <servidor> 'python3 /opt/nexochatpro/bot/actualizar-token-whatsapp.py'
El token se pide oculto; no se muestra ni se guarda fuera de la base de datos de Chatwoot."""
import getpass, subprocess

RUBY = r'''
require "net/http"
token = STDIN.read.strip
ch = Channel::Whatsapp.joins(:inbox).where(inboxes: { id: ENV.fetch("INBOX_ID").to_i }).first
abort "No hay una bandeja de WhatsApp con ese id" unless ch
pid = ch.provider_config["phone_number_id"]
res = Net::HTTP.get_response(URI("https://graph.facebook.com/v21.0/#{pid}?access_token=#{token}"))
abort "Meta rechazó el token (#{res.code}): #{res.body[0, 200]}" unless res.code == "200"
ch.provider_config = ch.provider_config.merge("api_key" => token)
ch.save!
puts "Listo: token actualizado en la bandeja #{ch.inbox.name} (#{ENV['INBOX_ID']})"
'''

inbox = input('Id de la bandeja de WhatsApp en Chatwoot [2]: ').strip() or '2'
token = getpass.getpass('Pega el token de acceso de Meta (no se muestra): ').strip()
if len(token) < 50:
    raise SystemExit('Ese token se ve demasiado corto. Cópialo completo desde Meta → WhatsApp → Configuración de la API.')
r = subprocess.run(['docker', 'compose', 'exec', '-T', '-e', f'INBOX_ID={inbox}', 'rails', 'bundle', 'exec', 'rails', 'runner', RUBY],
                   cwd='/opt/nexochatpro/chatwoot', input=token, text=True, capture_output=True)
print((r.stdout + r.stderr).strip()[-600:])
