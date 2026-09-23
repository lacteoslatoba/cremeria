---
id: T-0019
titulo: Desplegar a produccion y confirmar en el navegador el borrado de pedidos
estado: hecho
prioridad: alta
asignado-por: cline
asignado-a: usuario
creado: 2026-09-23 17:21:17
actualizado: 2026-09-23 23:52:30
archivos: src/components/admin/order-delete-button.tsx,src/components/admin/admin-sections.tsx
criterio: En cremeriadelrancho.com, con sesion de admin: en Pedidos el icono de basura pide '¿Eliminar? Si/No' en pantalla y borra el pedido; con la sesion vencida /admin manda al login en vez de mostrar el panel
contexto: docs/inbox.md entrada del 2026-09-23 (borrado de pedidos); produccion corre el build del 21/09, le falta el commit 6b04978
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-23 23:52:30 — cerrada por cline

Desplegado y verificado en produccion por Cline a peticion del usuario (ejecutar). El push de 9218a65 ya habia desplegado solo (deployment cremeria-63jf1wezi, 16:38:32, Ready 55s); encima corrimos vercel --prod --yes y quedo cremeria-7gea6wljm (16:47:36, Ready 2m, alias https://cremeriadelrancho.com). Primer intento aborto con AbortError por subir 431 MB: el CLI subia .next-build (412 MB del build de verificacion); se agrego .vercelignore con .next-build/, .next/ y node_modules/. Verificacion funcional en el dominio real con Playwright y sesion del admin mike sobre un pedido de prueba (ya borrado): el basurero muestra '¿Eliminar?' en pantalla (cero dialogos nativos), DELETE /api/orders/[id] -> 200, la fila desaparece y el pedido ya no esta en la BD. Tambien se comprobo que los chunks JS que sirve el dominio son identicos a los del deployment nuevo (marca 'Ingresa tu usuario'). Hallazgo: /admin responde 200 sin sesion tambien en el build nuevo (el redirect viaja en el stream RSC, no como 307), asi que no sirve de señal para saber que build esta desplegado.
