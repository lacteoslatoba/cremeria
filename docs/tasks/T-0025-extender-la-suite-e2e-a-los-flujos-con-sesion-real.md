---
id: T-0025
titulo: Extender la suite e2e a los flujos con sesion real (IDOR de pedidos y panel admin)
estado: pendiente
prioridad: media
asignado-por: cline
asignado-a: usuario
creado: 2026-09-26 01:39:05
actualizado: 2026-09-26 01:39:05
archivos: tests/e2e/seguridad.api.spec.ts
criterio: Pruebas nuevas en verde contra el dev server: un usuario no puede leer ni modificar el pedido de otro y un CUSTOMER recibe 403 en rutas de admin
contexto: docs/seguridad.md seccion 4.3: hacen falta cuentas de prueba; hoy la suite no crea datos a proposito porque el dev apunta a la base de produccion
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
