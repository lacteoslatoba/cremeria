---
id: T-0006
titulo: La cuenta de Twilio esta topada en 5 mensajes por dia: el registro seguira fallando aunque el formato quede bien
estado: pendiente
prioridad: alta
asignado-por: cline
asignado-a: usuario
creado: 2026-09-19 15:38:48
actualizado: 2026-09-20 21:26:09
archivos: 
criterio: un envio de prueba por WhatsApp sale delivered y POST /api/auth/register en produccion responde 200 con ok:true
contexto: Segundo bloqueador del registro, independiente del formato del telefono. La API de Twilio devuelve 63038 'Account ... exceeded the 5 daily messages limit' (HTTP 429) al intentar enviar. Ojo: la doc de cuentas trial habla de 50/dia, pero esta cuenta tiene 5/dia -- Twilio aplica restricciones adicionales segun los patrones de envio, y lleva dos dias de reintentos fallidos. Opciones del usuario: esperar a que se reinicie la ventana de 24h, subir de plan en Twilio, o salir del sandbox y usar un remitente de WhatsApp Business aprobado (que es lo que el spec ya decia que habria que hacer para produccion). NO es codigo: es configuracion de la cuenta.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-20 21:26:09 — nota de cline

Recomendacion con default, sin gastar ni tocar credenciales: NO subir el plan de Twilio. El codigo ya manda el codigo por Meta con WHATSAPP_PROVIDER=meta + META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID en Vercel y en .env.local; el texto libre dentro de la ventana de 24 h que abre el boton wa.me es gratis, y solo si el cliente no escribe primero hace falta META_WHATSAPP_TEMPLATE. Las variables estan documentadas en el README, seccion Configuracion. De tu lado solo faltan esas 3 variables: sin ellas el proveedor cae en simulado y el registro sigue funcionando con _dev_code, no se tumba.
