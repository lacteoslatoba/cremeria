---
id: T-0007
titulo: Que un fallo de WhatsApp no tumbe el registro (OTP best-effort) y backend de Meta listo
estado: hecho
prioridad: alta
asignado-por: usuario
asignado-a: cline
creado: 2026-09-20 19:50:08
actualizado: 2026-09-20 19:53:13
archivos: src/lib/notify.ts,src/app/api/auth/register/route.ts,src/app/login/page.tsx
criterio: con la cuenta de Twilio topada, POST /api/auth/register responde 200 con ok:true en vez de 502, y el cliente puede terminar de registrarse viendo el codigo; ademas notify.ts elige proveedor por variable de entorno (meta o twilio)
contexto: El commit 914ae4e hizo que un fallo de envio devuelva 502 y eso dejo el registro muerto en produccion (Twilio topado en 5 mensajes/dia, error 63038). Ningun proveedor es infalible: el OTP no debe poder bloquear el registro. Se agrega backend de Meta (WhatsApp Cloud API) elegido por WHATSAPP_PROVIDER, con la opcion gratis: texto libre dentro de la ventana de 24h que abre el cliente, y plantilla como alternativa.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-20 19:53:13 — cerrada por cline

OTP best-effort aplicado: register/route.ts ya no devuelve 502 cuando falla el envio -- sigue el registro, guarda el PendingRegistration y responde entregado:false + _dev_code (con OTP_ESTRICTO=true se recupera el 502). login/page.tsx muestra el codigo en un aviso ambar cuando entregado es false. notify.ts agrega el backend de Meta elegido con WHATSAPP_PROVIDER (meta o twilio), con texto libre primero (gratis dentro de la ventana de 24h) y plantilla como respaldo. Evidencia: dev server recien levantado (el anterior era un huerfano de 18h), POST /api/auth/register -> 200 {ok:true, phone:5550000003, entregado:false, _dev_code:179968} con la cuenta de Twilio topada; antes de este cambio eso era un 502. tsc exit 0 y eslint 0 errores. Commit local, NO subido: el push a produccion lo decide el usuario. Pendiente del usuario: crear la app de Meta y poner META_WHATSAPP_TOKEN y META_PHONE_NUMBER_ID.
