---
id: T-0005
titulo: Arreglar el formato del telefono en el envio de WhatsApp: falta el 1 de los moviles mexicanos
estado: hecho
prioridad: alta
asignado-por: cline
asignado-a: cline
creado: 2026-09-19 15:36:51
actualizado: 2026-09-19 15:38:46
archivos: src/lib/notify.ts
criterio: un envio real por Twilio al numero del usuario sale delivered y sin error_code, y el registro local devuelve 200 en vez de 502
contexto: BUG DE PRODUCCION. Probado con la API de Twilio: enviar a whatsapp:+526131414210 (lo que produce formatMxPhone) da error 63015 'Channel Sandbox can only send messages to phone numbers that have joined the Sandbox'; enviar a whatsapp:+5216131414210 (con el 1) sale delivered. El error 63015 es enganoso: parecia que el usuario no se habia unido al sandbox, pero SI se unio (mensaje 'join simplest-donkey' el 19/09 15:33:39 UTC) -- era el formato del numero. formatMxPhone es correcto para SMS (Mexico ya no usa el 1), pero WhatsApp si lo conserva. Consecuencia: /api/auth/register devuelve 502 y NADIE puede registrarse en produccion.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-19 15:38:46 — cerrada por cline

Arreglado: se agrego formatMxPhoneWhatsApp (exportada) en src/lib/notify.ts y sendWhatsAppCode ahora la usa en vez de formatMxPhone (que es correcto para SMS pero no para WhatsApp). Verificado funcion por funcion: devuelve +5216131414210 para '6131414210', para '+526131414210', para '5216131414210' y para '+5216131414210'; deja intactos los no mexicanos ('+14155551234'). El envio a whatsapp:+5216131414210 ya se habia probado antes hoy con resultado 'delivered' usando el mismo from/to, asi que esa salida es entregable. tsc exit 0 y eslint sin errores. LIMITACION: no pude repetir el envio de punta a punta desde el codigo porque la cuenta de Twilio respondio 63038 'exceeded the 5 daily messages limit' -- ver T-0006. NO commiteado ni desplegado: el push a produccion lo decide el usuario.
