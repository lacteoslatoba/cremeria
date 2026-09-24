---
id: T-0017
titulo: Subir cuenta de Twilio a pagada (para SMS de verificacion, si se retoma)
estado: pendiente
prioridad: baja
asignado-por: claude-code
asignado-a: usuario
creado: 2026-09-23 00:03:17
actualizado: 2026-09-23 00:03:17
archivos: 
criterio: Balance API de Twilio muestra type distinto de Trial
contexto: El usuario intento subir de trial a pagado en console.twilio.com/account/upgrade. RFC (CACF851217LJ2) y perfil de negocio ya quedaron capturados. Pago con PayPal (lacteoslatoba@gmail.com, tarjeta Visa prepagada terminacion 9215) fallo con error generico de PayPal. Pago con tarjeta directa en Twilio tambien fallo (motivo no confirmado -- el usuario no compartio el mensaje exacto). Posible causa: la Visa prepagada no soporta cargos recurrentes/en USD o no tiene saldo suficiente. No es bloqueante: el registro de clientes ya no depende de verificacion de telefono (se quito, ver commit cfaedce). Retomar solo si el usuario quiere verificacion real por SMS despues.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
