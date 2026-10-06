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

### 2026-10-05 — nota de Claude Code: el usuario eligio esta via (SMS por Twilio)

Mike eligio Twilio pagado sobre Meta para los dos mensajes: activacion de usuario y codigo de
entrega. Estado hoy por la API: cuenta `active`, `type: Trial`, saldo 2.515 USD.

Lo que ya quedo listo en el codigo (apagado, no cambia nada hasta prenderlo):

- Activacion por SMS en el registro, detras de `REGISTRO_VERIFICAR_TELEFONO=sms`
  (src/app/api/auth/register/route.ts + paso "Verifica tu telefono" en src/app/login/page.tsx).
  Si Twilio rechaza el numero -> 400 "revisa el numero"; si falla la cuenta o el servicio ->
  alta directa como hoy, para no volver a dejar a los clientes sin poder registrarse.
- El codigo de entrega ya sale por SMS al pagar (notifyDeliveryCode); no necesita cambios.

Pasos cuando la cuenta ya sea pagada:

1. Comprobar: Balance/cuenta de Twilio con `type` distinto de `Trial`.
2. Poner `REGISTRO_VERIFICAR_TELEFONO=sms` en .env.local y en Vercel (Production).
3. Probar un registro con un numero NUEVO (manda 1 SMS real, crea 1 usuario real: hacerlo con
   el usuario presente) y un pedido de prueba para ver llegar el codigo de entrega.

NO se probo el camino prendido de punta a punta: gasta un SMS y el dev apunta a la base de
produccion.

### 2026-10-05 (tarde) — nota de Claude Code: Twilio ya es pagado, probado en local, falta Vercel

- Twilio por la API: `type: Full`, saldo 20.00 USD (el usuario pago hoy). Criterio de esta tarea cumplido.
- Prueba real en local con la variable prendida en el proceso del dev server: registro con el
  numero terminado en 4210 -> `POST /api/auth/register 200`, `POST /api/auth/register/verify 201`,
  SMS `delivered` en Twilio. SMS de codigo de entrega (notifyDeliveryCode) al mismo numero: `sent`.
- Con el visto bueno del usuario se hizo `git push origin main` (341d679..2bcbdb2).
- PENDIENTE DEL USUARIO: agregar `REGISTRO_VERIFICAR_TELEFONO=sms` en Vercel (Production) y
  redesplegar. El agente no pudo: el clasificador de permisos nego `vercel env add` y tambien
  consultar el estado del deploy, asi que el deploy del push NO esta verificado.
- Despues: probar un registro en cremeriadelrancho.com con un numero nuevo.
