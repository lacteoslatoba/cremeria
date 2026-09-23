---
id: T-0018
titulo: Crear la plantilla de autenticacion con boton Copiar codigo en Meta y comprobar el envio real del codigo
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-23 03:18:59
actualizado: 2026-09-23 03:18:59
archivos: scripts/whatsapp-plantilla.mts,scripts/whatsapp-prueba.mts,src/lib/notify.ts
criterio: npm run whatsapp:plantilla deja la plantilla APPROVED y npm run whatsapp:prueba -- <telefono> imprime entregado: true y el telefono recibe el WhatsApp con el boton Copiar codigo
contexto: Se probo que el token de META_WHATSAPP_TOKEN del .env.local esta EXPIRADO (error 190: session expired 22-Sep-26 18:00 PDT), falta META_WABA_ID y falta crear la plantilla. Con META_WHATSAPP_TEMPLATE sin definir la app solo puede mandar texto libre, que Meta rechaza fuera de la ventana de 24 h. La app YA manda el payload correcto (body {{1}} + boton index 0 con el codigo), verificado con --seco. Falta un numero de produccion con metodo de pago: eso sigue en T-0016
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
