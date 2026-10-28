#!/usr/bin/env python3
"""Conecta el bot con Facebook e Instagram: valida la clave de la app, convierte el token de usuario en el token
permanente de la página, guarda todo en .env sin mostrarlo, reinicia el bot y registra los webhooks de comentarios."""
import getpass, json, os, re, subprocess, sys, time, urllib.parse, urllib.request, urllib.error

APP_ID = "1652089316559570"
G = "https://graph.facebook.com/v23.0"
ENV = "/opt/nexochatpro/bot/.env"
CALLBACK = "https://crm.nexochatpro.cloud/meta/webhook"

def llamar(metodo, ruta, datos=None, token=None):
    url = G + ruta
    cuerpo = None
    if datos and metodo == "GET":
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(datos)
    elif datos:
        cuerpo = urllib.parse.urlencode(datos).encode()
    req = urllib.request.Request(url, data=cuerpo, method=metodo)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read()).get("error", {})
        except Exception:
            err = {}
        raise SystemExit(f"Meta respondió con error en {metodo} {ruta.split('?')[0]}: {err.get('message', e.code)}")

def guardar(clave, valor):
    lineas = open(ENV).read().splitlines() if os.path.exists(ENV) else []
    lineas = [l for l in lineas if not l.startswith(clave + "=")]
    lineas.append(f"{clave}={valor}")
    open(ENV, "w").write("\n".join(lineas) + "\n")

def verificar_token_verificacion():
    for l in open(ENV).read().splitlines():
        if l.startswith("META_VERIFY_TOKEN="):
            return l.split("=", 1)[1]
    raise SystemExit("Falta META_VERIFY_TOKEN en .env")

print("Conexión con Facebook e Instagram (nada de lo que escribas se muestra en pantalla)\n")
secreto = getpass.getpass("1) Clave secreta de la app (Configuración de la app → Básica → Clave secreta de la app): ").strip()
app = llamar("GET", "/" + APP_ID, {"fields": "name"}, token=f"{APP_ID}|{secreto}")
print(f"   Clave correcta. App: {app.get('name')}\n")

corto = getpass.getpass("2) Token de usuario generado en el Explorador de la API de Graph: ").strip()
largo = llamar("GET", "/oauth/access_token", {"grant_type": "fb_exchange_token", "client_id": APP_ID, "client_secret": secreto, "fb_exchange_token": corto})["access_token"]
cuentas = llamar("GET", "/me/accounts", {"fields": "id,name,access_token,instagram_business_account{id,username}", "limit": "50"}, token=largo).get("data", [])
if not cuentas:
    raise SystemExit("El token no da acceso a ninguna página. Al generarlo, elige la página de CM y el permiso pages_show_list.")
if len(cuentas) == 1:
    pag = cuentas[0]
else:
    for i, c in enumerate(cuentas, 1):
        print(f"   {i}) {c['name']}" + (f"  (Instagram: @{c['instagram_business_account'].get('username')})" if c.get("instagram_business_account") else ""))
    pag = cuentas[int(input("   ¿Cuál página usamos? Número: ")) - 1]
ig = (pag.get("instagram_business_account") or {})
print(f"   Página: {pag['name']}  |  Instagram: {('@' + ig['username']) if ig.get('username') else 'no vinculado'}\n")

guardar("META_APP_SECRET", secreto)
guardar("META_PAGE_ID", pag["id"])
guardar("META_PAGE_TOKEN", pag["access_token"])
if ig.get("id"):
    guardar("META_IG_ID", ig["id"])
print("3) Credenciales guardadas en el servidor. Reiniciando el bot...")
subprocess.run(["docker", "compose", "up", "-d"], cwd="/opt/nexochatpro/bot", capture_output=True)
time.sleep(6)

print("4) Suscribiendo la página a los comentarios...")
print("   ", llamar("POST", f"/{pag['id']}/subscribed_apps", {"subscribed_fields": "feed"}, token=pag["access_token"]))
vt = verificar_token_verificacion()
app_token = f"{APP_ID}|{secreto}"
print("5) Registrando el webhook de la página (Meta verificará la dirección del bot)...")
print("   ", llamar("POST", f"/{APP_ID}/subscriptions", {"object": "page", "callback_url": CALLBACK, "verify_token": vt, "fields": "feed"}, token=app_token))
if ig.get("id"):
    print("6) Registrando el webhook de Instagram...")
    print("   ", llamar("POST", f"/{APP_ID}/subscriptions", {"object": "instagram", "callback_url": CALLBACK, "verify_token": vt, "fields": "comments"}, token=app_token))
print("\nListo. Ya puedes probar comentando desde una cuenta con rol en la app.")
