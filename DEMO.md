# Guion de demo (10 min)

**Antes de entrar:** Docker y el bot corriendo, `./reset-demo.sh`, Chatwoot abierto en una pestaña
(http://localhost:3000, sesión iniciada) y la demo en otra (http://localhost:4001/demo/). Idealmente el chat también en tu celular.

1. **Problema (1 min).** "¿Cuántos mensajes pierden fuera de horario o por no contestar rápido?"
2. **Consulta de precio (2 min).** En el widget: "Hola, tienen cauchos 195/65R15? cuanto cuestan?"
   → precios en USD y Bs a tasa BCV, con opción económica y de mejor calidad.
3. **Stock real (1 min).** Pide la Pirelli 195/65R15: no tiene stock y el bot lo dice (no inventa).
4. **Cita y CRM (3 min).** "Soy Raul, 0414 1234567, Corolla 2015, quiero montaje y balanceo mañana 10am".
   → en Chatwoot enseña el contacto con nombre, teléfono, vehículo y la etiqueta `cita-agendada`.
5. **Choque de horario (1 min).** Pide otra cita a la misma hora: ofrece alternativas.
6. **Traspaso a humano (1 min).** "Quiero un descuento por 4 cauchos, hablar con una persona"
   → etiqueta `requiere-humano` y nota interna; el asesor toma la conversación desde Chatwoot.
7. **Cierre (1 min).** Canales: WhatsApp, Instagram y Messenger entran a la misma bandeja (falta verificar
   Meta, tarda días). Próximos pasos: cargar su inventario real, conectar canales, panel de citas, recordatorios.

**Si algo falla:** el bot reintenta solo; si no responde en 15 s, espera y reenvía. No cierres el chat con el
botón de salida (resuelve la conversación).
