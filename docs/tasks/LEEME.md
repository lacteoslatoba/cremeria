# Cola de trabajo entre agentes

Cada tarea es un archivo `.md` en esta carpeta. Un Claude (Claude Code, otra sesión,
o tú) **asigna**; el agente que trabaja en el repo (Cline) **toma y cierra**.

No edites estos archivos a mano si puedes evitarlo: usa `npm run tasks`, que
mantiene la cabecera consistente. Este `LEEME.md` no cuenta como tarea (el CLI solo
lee archivos `T-NNNN-*.md`).

## Ciclo de vida

```
assign ──▶ pendiente ──claim──▶ en_proceso ──done──▶ hecho
                                     │
                                     └──block──▶ bloqueada
```

## Comandos

```powershell
# Quien asigna (Claude / tú)
npm.cmd run tasks -- assign "Arreglar checkout vacío" `
    --prioridad alta `
    --files "src/app/checkout/page.tsx,src/lib/create-order.ts" `
    --criterio "tsc --noEmit limpio + checkout no permite carrito vacío" `
    --contexto "ver docs/superpowers/plans/2026-09-16-post-payment-address.md" `
    --by claude-desktop --to cline

# Quien ejecuta (Cline)
npm.cmd run tasks -- list                    # ver la cola
npm.cmd run tasks -- list --estado pendiente # solo pendientes
npm.cmd run tasks -- next                    # la siguiente que le toca a cline
npm.cmd run tasks -- next --para usuario     # las asignadas a una persona
npm.cmd run tasks -- next --json             # para consumo automático
npm.cmd run tasks -- claim T-0002            # la tomo
npm.cmd run tasks -- done  T-0002 --notas "Qué hice, qué verifiqué, qué quedó pendiente"
npm.cmd run tasks -- block T-0002 --motivo "falta STRIPE_WEBHOOK_SECRET"
npm.cmd run tasks -- show  T-0002
```

**`next` filtra por `asignado-a`** (por defecto `cline`): nunca te devuelve una
tarea de otro responsable, solo las lista aparte. Si reclamas una ajena a
propósito, `claim` te avisa y sigue. Ver `PROMPT-PARA-CLAUDE.md` para cómo pedirle
a otro Claude que asigne trabajo.

## Formato del archivo

```markdown
---
id: T-0002
titulo: Arreglar checkout vacío
estado: pendiente            # pendiente | en_proceso | bloqueada | hecho
prioridad: alta              # alta | media | baja
asignado-por: claude-desktop
asignado-a: cline
creado: 2026-09-18 20:07:50
actualizado: 2026-09-18 20:07:50
archivos: src/app/checkout/page.tsx
criterio: tsc --noEmit limpio
contexto: ver docs/superpowers/plans/...
---

## Notas de ejecución

_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_
```

Las notas de cierre se **anexan** con fecha, nunca sobrescriben: así queda el
historial de decisiones sin tener que repetir contexto en cada turno.

## Cómo encaja con el resto del puente

- `npm run claude -- ...` → preguntar algo puntual a Claude (ver `docs/agent-bridge.md`).
- `npm run tasks -- ...` → repartir y dar seguimiento al trabajo (este archivo).
- `docs/inbox.md` → conversación libre/notas; la cola es para trabajo con estado.
