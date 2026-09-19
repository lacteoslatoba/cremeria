---
id: T-0006
titulo: La cuenta de Twilio esta topada en 5 mensajes por dia: el registro seguira fallando aunque el formato quede bien
estado: pendiente
prioridad: alta
asignado-por: cline
asignado-a: usuario
creado: 2026-09-19 15:38:48
actualizado: 2026-09-19 15:38:48
archivos: 
criterio: un envio de prueba por WhatsApp sale delivered y POST /api/auth/register en produccion responde 200 con ok:true
contexto: Segundo bloqueador del registro, independiente del formato del telefono. La API de Twilio devuelve 63038 'Account ... exceeded the 5 daily messages limit' (HTTP 429) al intentar enviar. Ojo: la doc de cuentas trial habla de 50/dia, pero esta cuenta tiene 5/dia -- Twilio aplica restricciones adicionales segun los patrones de envio, y lleva dos dias de reintentos fallidos. Opciones del usuario: esperar a que se reinicie la ventana de 24h, subir de plan en Twilio, o salir del sandbox y usar un remitente de WhatsApp Business aprobado (que es lo que el spec ya decia que habria que hacer para produccion). NO es codigo: es configuracion de la cuenta.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
