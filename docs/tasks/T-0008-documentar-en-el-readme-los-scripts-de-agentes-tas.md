---
id: T-0008
titulo: Documentar en el README los scripts de agentes (tasks, claude, check, queue:auto)
estado: hecho
prioridad: baja
asignado-por: cline
asignado-a: cline
creado: 2026-09-20 21:19:53
actualizado: 2026-09-20 21:23:58
archivos: README.md
criterio: npm run check PASA y la tabla Scripts del README lista npm run check y npm run queue:auto
contexto: El README documenta dev/build/lint/stripe:setup pero no los scripts de agentes; el carril rapido (check y queue:auto) es nuevo y no aparece
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_

### 2026-09-20 21:20:59 — reabierta

la corrida de queue:auto se corto a los 30 s por el limite de la herramienta de comandos

### 2026-09-20 21:21:47 — cerrada por claude-code

README actualizado: tabla Scripts ahora lista tasks, claude, check y queue:auto, mas seccion de ejemplos de agentes. npm run check PASA (tsc + eslint sobre lo tocado).

### 2026-09-20 21:23:58 — nota de cline

El README quedo staged por el carril rapido y su commit automatico fallo por un bug de comillas en queue-auto, ya corregido. Este commit lo cierra a mano. Ademas: la sesion del IDE y queue:auto tomaron la misma tarea a la vez; ahora take/claim avisan si otro agente la tiene en_proceso y queue:auto la salta si ya no esta pendiente.
