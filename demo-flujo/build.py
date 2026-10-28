import base64, pathlib
b = pathlib.Path("../brand")
def svg(p): return "data:image/svg+xml;base64," + base64.b64encode((b/p).read_bytes()).decode()
png = "data:image/png;base64," + base64.b64encode(pathlib.Path("cm-small.png").read_bytes()).decode()
h = pathlib.Path("plantilla.html").read_text()
for k, v in {"__LOGO_LIGHT__": svg("logo.svg"), "__LOGO_DARK__": svg("logo-white.svg"), "__MARK__": svg("logo-mark.svg"), "__CM__": png}.items():
    h = h.replace(k, v)
pathlib.Path("flujo.html").write_text(h)
h2 = pathlib.Path("plantilla_social.html").read_text()
for k2, v2 in {"__LOGO_LIGHT__": svg("logo.svg"), "__LOGO_DARK__": svg("logo-white.svg"), "__MARK__": svg("logo-mark.svg"), "__CM__": png}.items():
    h2 = h2.replace(k2, v2)
pathlib.Path("social.html").write_text(h2)
print(len(h) // 1024, "KB")
