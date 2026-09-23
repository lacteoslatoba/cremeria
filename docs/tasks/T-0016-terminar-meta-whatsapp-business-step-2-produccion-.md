---
id: T-0016
titulo: Terminar Meta WhatsApp Business: Step 2 produccion (numero real) y pago para mensajes de negocio
estado: pendiente
prioridad: media
asignado-por: claude-code
asignado-a: usuario
creado: 2026-09-22 23:28:04
actualizado: 2026-09-23 03:18:59
archivos: src/lib/notify.ts
criterio: un registro con un numero de telefono NUEVO (no agregado a mano en Meta) recibe el WhatsApp real, entregado:true
contexto: App de Meta ya creada (ID 1791608565393423), WABA con numero de prueba funcionando y probado end-to-end. El numero 613-141-4210 no se pudo usar como numero real (ya estaba en otro WABA ajeno, WABA 4327524240844151, sin acceso). El usuario se canso del tramite de Meta por hoy -- retomar cuando el quiera, no es bloqueante: el registro ya funciona con WhatsApp real usando el numero de prueba + destinatarios agregados a mano en la consola de Meta.
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-23 03:18:59 — nota de cline

Hallazgo de hoy: el token de Meta del entorno esta expirado (error 190, session expired 22-Sep-26 18:00 PDT) y no hay META_WABA_ID, asi que la plantilla de autenticacion todavia no se puede crear. Ya quedo listo el payload exacto y las dos herramientas para hacerlo en un comando: npm run whatsapp:plantilla (crea/revisa la plantilla authentication con boton Copiar codigo, idempotente, --seco no llama a Meta) y npm run whatsapp:prueba -- <telefono> (manda el codigo por la MISMA funcion que la app e imprime la respuesta cruda de Meta, exit 1 si no se entrego). Tarea nueva asignada al usuario con ese paso concreto; esta sigue siendo para el numero de produccion real y el metodo de pago.
