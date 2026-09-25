---
id: T-0021
titulo: Que la app no muestre la pantalla de error cuando la BD no responde (reintento o aviso amable)
estado: pendiente
prioridad: baja
asignado-por: cline
asignado-a: cline
creado: 2026-09-25 06:47:58
actualizado: 2026-09-25 06:47:58
archivos: src/app/error.tsx,src/lib/prisma.ts
criterio: Con la BD inalcanzable, una carga de pagina muestra un aviso claro y reintenta, en vez de la pantalla 'Algo salio mal' con el error de Prisma
contexto: docs/inbox.md entrada del 2026-09-25 (smoke test): el pooler de Supabase rechaza conexiones a ratos con P1001
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
