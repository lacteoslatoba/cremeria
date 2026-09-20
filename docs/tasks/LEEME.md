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
npm.cmd run tasks -- take                    # claim + expediente en un solo paso (la que toque por prioridad)
npm.cmd run tasks -- take T-0002             # igual, pero de una tarea concreta
npm.cmd run tasks -- claim T-0002            # la tomo (solo cambia el estado, sin expediente)
npm.cmd run tasks -- note  T-0002 --notas "hallazgo parcial, sigue pendiente"
npm.cmd run tasks -- done  T-0002 --notas "Qué hice, qué verifiqué, qué quedó pendiente"
npm.cmd run tasks -- block T-0002 --motivo "falta STRIPE_WEBHOOK_SECRET"
npm.cmd run tasks -- reopen T-0002 --motivo "se cortó a medias, vuelve a pendiente"
npm.cmd run tasks -- show  T-0002
```

**`next` filtra por `asignado-a`** (por defecto `cline`): nunca te devuelve una
tarea de otro responsable, solo las lista aparte. Si reclamas una ajena a
propósito, `claim` te avisa y sigue. Ver `PROMPT-PARA-CLAUDE.md` para cómo pedirle
a otro Claude que asigne trabajo.

- **`take`** = `claim` + `show` en un solo paso: reclama la tarea (la tuya por
  prioridad, o el id que le pases) y de una vez imprime el expediente completo,
  así el worker no gasta tres comandos (`next`, `show`, `claim`) en tres turnos.
- **`note`** dejar un hallazgo en el expediente **sin** cerrar la tarea ni cambiar
  su estado: es el canal barato para avisarle al otro agente (o al usuario) algo
  a medio camino, sin bloquear ni marcar hecho.
- **`reopen`** devuelve una tarea a `pendiente` con un motivo anexado al
  expediente. Existe porque una corrida del carril rápido (`queue:auto`) puede
  cortarse a medias, o alguien puede reclamar por error, y sin esto la tarea
  quedaba atorada en `en_proceso` sin que nadie la pudiera volver a tomar.

## Verificación de un cambio: `npm run check`

```powershell
npm.cmd run check              # valida lo que cambió vs HEAD (incluye lo sin commitear)
npm.cmd run check -- --todo    # valida todo el repo aunque no haya cambios
npm.cmd run check -- --rapido  # sin tsc, para iterar rápido sobre lint
```

Corre en un solo comando lo que antes eran tres llamadas sueltas (`tsc --noEmit`,
`prisma validate` si tocaste `prisma/`, y `eslint` sobre los archivos tocados) e
imprime un único veredicto: **PASA** o **FALLA**, con lo mínimo para arreglarlo.
Sale con código 1 si algo falla, así que sirve de candado antes de commitear.
Úsalo en vez de correr `tsc`/`eslint`/`prisma validate` por separado.

## Carril rápido: `npm run queue:auto`

```powershell
npm.cmd run queue:auto                        # muestra el plan, no toca nada (dry-run)
npm.cmd run queue:auto -- --yes               # ejecuta de verdad
npm.cmd run queue:auto -- --yes --limite 2    # máximo 2 tareas (por defecto 1)
npm.cmd run queue:auto -- --yes --para claude-code
npm.cmd run queue:auto -- --yes --seguir      # no se detiene en el primer fallo
```

Deja que la máquina avance la cola sin turno de chat en medio: reclama la
siguiente tarea pendiente de `--para` (por defecto `cline`), invoca a Claude Code
headless para implementarla, corre `npm run check` y **solo si el check PASA**
commitea (solo los archivos que la tarea ensució) y cierra la tarea con la
evidencia. Si el check falla, o la tarea no tocó ningún archivo, o el commit no
se pudo hacer, la tarea **no** se marca hecha: queda `en_proceso` con una nota
explicando por qué, para que alguien la revise.

Reglas de seguridad a propósito: nunca hace `push` ni despliega (eso sigue
siendo decisión del usuario), y si otro agente ya tomó la tarea (dos sesiones en
el mismo repo pueden chocar) la salta en vez de atropellarla.

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
