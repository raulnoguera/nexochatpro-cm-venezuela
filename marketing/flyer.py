import base64, pathlib, sys
b = pathlib.Path("/Users/raulnoguera/Projects/cauchera-crm/brand")
svg = lambda p: "data:image/svg+xml;base64," + base64.b64encode((b/p).read_bytes()).decode()
CONTACTO = sys.argv[1] if len(sys.argv) > 1 else "[tu número de WhatsApp]"
html = f"""<meta charset=utf-8><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
*{{box-sizing:border-box;margin:0}}
html,body{{width:1080px;height:1350px;overflow:hidden;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;color:#EEF2FB}}
body{{position:relative;background:#0B1220}}
.glow1{{position:absolute;width:900px;height:900px;right:-300px;top:-260px;background:radial-gradient(closest-side,rgba(91,61,245,.55),transparent)}}
.glow2{{position:absolute;width:800px;height:800px;left:-320px;bottom:-200px;background:radial-gradient(closest-side,rgba(25,211,162,.22),transparent)}}
.wrap{{position:relative;padding:62px 70px 0}}
.top{{display:flex;justify-content:space-between;align-items:center}}
.top img{{width:350px}}
.top span{{font-size:22px;font-weight:600;color:#98A3BA}}
h1{{margin-top:40px;font-size:82px;line-height:1.04;font-weight:800;letter-spacing:-.025em}}
h1 em{{font-style:normal;background:linear-gradient(90deg,#6D8CFF,#19D3A2);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{margin-top:22px;font-size:28px;line-height:1.35;color:#B8C2D8;max-width:900px}}
.mid{{margin-top:34px;display:flex;gap:46px;align-items:flex-start}}
.phone{{width:392px;height:560px;flex:none;border-radius:50px;background:#05080F;padding:12px;border:2px solid #26324B;transform:rotate(-2.5deg);box-shadow:0 30px 70px rgba(0,0,0,.5)}}
.scr{{height:100%;border-radius:40px;background:#0F1830;overflow:hidden;display:flex;flex-direction:column}}
.ph{{padding:16px 18px 12px;background:#142040;display:flex;align-items:center;gap:12px}}
.ph b{{font-size:20px;display:block}}.ph small{{color:#19D3A2;font-size:15px;font-weight:600}}
.ph .av{{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2F5BFF,#5B3DF5);display:grid;place-items:center;font-weight:800;font-size:22px}}
.bd{{padding:16px 14px;display:flex;flex-direction:column;gap:9px}}
.m{{padding:10px 14px;border-radius:16px;font-size:17px;line-height:1.3;max-width:90%}}
.c{{align-self:flex-end;background:#2A3F7A;border-bottom-right-radius:5px}}
.n{{align-self:flex-start;background:#1B2A4E;border-bottom-left-radius:5px}}
.n i{{display:block;font-style:normal;font-size:13px;font-weight:700;color:#8D79FF;margin-bottom:3px}}
.n b{{color:#6D8CFF}}
.ok{{align-self:flex-start;background:#103A33;color:#4FE3BC;border-radius:12px;padding:8px 12px;font-size:15px;font-weight:700}}
ul{{list-style:none;padding:0;display:grid;gap:26px;margin-top:4px}}
li{{display:flex;gap:16px;align-items:flex-start;font-size:28px;line-height:1.28;font-weight:600}}
li svg{{flex:none;width:44px;height:44px;margin-top:2px}}
li small{{display:block;font-size:21px;font-weight:400;color:#98A3BA;margin-top:4px}}
.ch{{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap}}
.ch span{{font-size:20px;font-weight:700;padding:9px 18px;border-radius:99px;background:#16213B;border:1px solid #26324B;display:inline-flex;align-items:center;gap:9px}}
.ch span::before{{content:"";width:11px;height:11px;border-radius:50%;background:var(--c)}}
.cta{{position:absolute;left:0;right:0;bottom:0;height:188px;background:linear-gradient(90deg,#2F5BFF,#5B3DF5);padding:0 70px;display:flex;align-items:center;justify-content:space-between;gap:30px}}
.cta h2{{font-size:46px;font-weight:800;line-height:1.05;letter-spacing:-.02em}}
.cta p{{margin-top:8px;font-size:23px;font-weight:600;color:#DCE4FF}}
.cta .btn{{flex:none;background:#19D3A2;color:#04372B;font-weight:800;font-size:21px;padding:18px 28px;border-radius:20px;text-align:center;line-height:1.2}}
.cta .btn small{{display:block;font-size:27px;font-weight:800;margin-top:6px}}
.cta .btn small.mail{{font-size:18px;font-weight:700;margin-top:4px;color:#06483A}}
</style>
<div class=glow1></div><div class=glow2></div>
<div class=wrap>
 <div class=top><img src="{svg('logo-white.svg')}"><span>Para negocios que venden por chat</span></div>
 <h1>Tu negocio <em>responde solo,</em> a cualquier hora.</h1>
 <p class=sub>Nexo, el asistente con IA de NexoChatPro, atiende a tus clientes y deja todo guardado en tu CRM.</p>
 <div class=mid>
  <div class=phone><div class=scr>
   <div class=ph><div class=av>N</div><div><b>Tu negocio</b><small>en línea</small></div></div>
   <div class=bd>
    <div class="m c">¿Tienen baterías para mi Corolla 2015?</div>
    <div class="m n"><i>Nexo · asistente virtual</i>¡Sí! Te recomiendo la Willard 24F: <b>$109</b> pagando en dólares, o Bs 122.720.</div>
    <div class="m c">¿Puedo pasar mañana a las 10?</div>
    <div class="m n"><i>Nexo · asistente virtual</i>Cita confirmada ✅ Te escribo un día antes para recordártela.</div>
    <div class=ok>Cliente y cita guardados en tu CRM</div>
   </div></div></div>
  <ul>
   <li><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="22" fill="#19D3A2"/><path d="M12 23l7 7 13-14" fill="none" stroke="#04372B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div>Responde al instante<small>mensajes y comentarios, 24 horas</small></div></li>
   <li><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="22" fill="#19D3A2"/><path d="M12 23l7 7 13-14" fill="none" stroke="#04372B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div>Cotiza con tu inventario<small>en dólares y en bolívares</small></div></li>
   <li><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="22" fill="#19D3A2"/><path d="M12 23l7 7 13-14" fill="none" stroke="#04372B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div>Agenda citas<small>y guarda cada cliente en tu CRM</small></div></li>
   <li><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="22" fill="#19D3A2"/><path d="M12 23l7 7 13-14" fill="none" stroke="#04372B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div>Te pasa a una persona<small>cuando hay que negociar</small></div></li>
  </ul>
 </div>
 <div class=ch><span style="--c:#19A974">WhatsApp</span><span style="--c:#FF7AAE">Instagram</span><span style="--c:#8FB0FF">Facebook</span><span style="--c:#4FE3BC">Marketplace</span></div>
</div>
<div class=cta><div><h2>Pide tu demo gratis</h2><p>Mira cómo atendería a tus clientes, con tus productos.</p></div><div class=btn>Escríbeme por WhatsApp<small>{CONTACTO}</small><small class=mail>gtconsultingg@gmail.com</small></div></div>
"""
pathlib.Path("flyer.html").write_text(html)
print("ok")
