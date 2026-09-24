---
id: T-0018
titulo: Crear la plantilla de autenticacion con boton Copiar codigo en Meta y comprobar el envio real del codigo
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-23 03:18:59
actualizado: 2026-09-23 03:42:10
archivos: scripts/whatsapp-plantilla.mts,scripts/whatsapp-prueba.mts,src/lib/notify.ts
criterio: npm run whatsapp:plantilla deja la plantilla APPROVED y npm run whatsapp:prueba -- <telefono> imprime entregado: true y el telefono recibe el WhatsApp con el boton Copiar codigo
contexto: Se probo que el token de META_WHATSAPP_TOKEN del .env.local esta EXPIRADO (error 190: session expired 22-Sep-26 18:00 PDT), falta META_WABA_ID y falta crear la plantilla. Con META_WHATSAPP_TEMPLATE sin definir la app solo puede mandar texto libre, que Meta rechaza fuera de la ventana de 24 h. La app YA manda el payload correcto (body {{1}} + boton index 0 con el codigo), verificado con --seco. Falta un numero de produccion con metodo de pago: eso sigue en T-0016
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-23 03:42:10 — nota de cline

Pasos para desbloquearlo (verificado hoy 22/09 20:40: el token del .env.local sigue vencido, error 190 subcode 463, y el archivo no se ha tocado). PASO 1: developers.facebook.com/apps/1791608565393423/whatsapp-business/wa-dev-console -> anotar el 'WhatsApp Business Account ID' (eso es META_WABA_ID) y comprobar el numero. PASO 2: business.facebook.com/settings/system-users -> crear usuario de sistema, asignarle la app y la WABA, y generar token con whatsapp_business_messaging + whatsapp_business_management (el de la consola dura 24 h: por eso vencio). PASO 3: pegar en .env.local META_WHATSAPP_TOKEN y META_WABA_ID y correr: npx.cmd dotenv -e .env.local -- npx.cmd tsx scripts/_tmp-verificar-meta.mts (dice numero, WABA y si la plantilla existe). PASO 4: npm.cmd run whatsapp:plantilla (crea/revisa la plantilla en la WABA ya configurada). PASO 5: agregar META_WHATSAPP_TEMPLATE=codigo_verificacion_cremeria a .env.local y correr npm.cmd run whatsapp:prueba -- 6131414210 (ahi debe llegar el WhatsApp con el boton Copiar codigo). Herramienta nueva de diagnostico: scripts/_tmp-verificar-meta.mts (desechable).

### 2026-09-23 21:40 — nota de Claude Code: bloqueado, no es tema de clics

El token ya no esta vencido (funciona, lo confirme contra la Graph API) y llegue hasta la
pantalla de "Create template" -> Authentication -> One-time Passcode -> Copy code ->
Spanish (MEX) -> Submit, tanto en la WABA "Cremeria del Rancho" (1994419171271540) como en la
"Test WhatsApp Business Account" (2110963232841425). **Las dos** devuelven el mismo error, ya
sea por la UI o por la API directo (`POST /message_templates`):

```
code 10 / error_subcode 2388185
"This WhatsApp business account does not have permission to create message template"
```

Esto no se arregla con otro clic ni cambiando de WABA: es el "Step 3. Business verification" de
developers.facebook.com/apps/1791608565393423/use_cases/customize/business-verification/, que
esta SIN EMPEZAR (dice "Optional but recommended" pero en la practica bloquea crear plantillas
custom). Pide: ubicacion del negocio + UNO de estos documentos (Acta constitutiva, Licencia de
negocio, Constancia de situacion fiscal/RFC, Estado de cuenta bancario, Recibo de servicios,
o Reporte de credito) y "Only an admin user can complete business verification". Revision de
Meta: 2-10 dias habiles.

Esto es lo mismo que ya bloqueaba T-0016 (numero de produccion) -- se junta con esa tarea. No
hay nada mas que un agente pueda intentar aqui sin los documentos reales del negocio: se lo
reporte al usuario, el decide cuando lo hace.
