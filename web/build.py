"""Compone las páginas del sitio: index.html (portada) y catalogo.html (catálogo con filtros).
El catálogo de datos (catalogo.json) lo genera el servidor al publicar; la copia local es solo respaldo.
Uso: python3 build.py"""
import re, pathlib
aqui = pathlib.Path(__file__).parent
css = re.search(r"<style>(.*?)</style>", (aqui / "../demo-flujo/catalogo_plantilla.html").read_text(), re.S).group(1)
for plantilla, salida in [("plantilla_home.html", "index.html"), ("plantilla_catalogo.html", "catalogo.html")]:
    (aqui / salida).write_text((aqui / plantilla).read_text().replace("/*__CSS__*/", css))
    print(salida, "listo")
