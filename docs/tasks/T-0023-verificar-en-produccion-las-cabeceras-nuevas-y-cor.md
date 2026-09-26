---
id: T-0023
titulo: Verificar en produccion las cabeceras nuevas y correr la suite e2e contra el dominio
estado: pendiente
prioridad: alta
asignado-por: cline
asignado-a: usuario
creado: 2026-09-26 01:38:58
actualizado: 2026-09-26 01:38:58
archivos: docs/seguridad.md,tests/e2e/seguridad.api.spec.ts,tests/e2e/seguridad.ui.spec.ts
criterio: Con E2E_PRODUCCION=1 y E2E_BASE_URL apuntando al dominio desplegado, npm run test:e2e y npm run test:e2e:ui pasan (HSTS, X-Frame-Options DENY, CSP sin unsafe-eval, cero violaciones de CSP en consola)
contexto: docs/seguridad.md seccion 4.1: es lo unico del endurecimiento que no se pudo verificar local sin desplegar
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
