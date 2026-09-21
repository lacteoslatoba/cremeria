# Instrucciones para agentes — Cremería del Rancho

Este repo lo trabajan **dos agentes en el mismo proyecto**:

| Agente | Rol |
|---|---|
| **Claude Code** (extensión del IDE Antigravity) | explora, decide qué falta, asigna y revisa |
| **Cline** (extensión del IDE) | ejecuta los cambios, valida y cierra |

El canal entre los dos es **la cola de trabajo en disco** (`docs/tasks/`), no el chat:
cada agente tiene su propia sesión y no se ven las conversaciones. El disco sí se ve.

## Si eres Claude Code y necesitas que se implemente algo

No lo implementes tú primero: **asígnalo**.

```powershell
npm.cmd run tasks -- assign "Titulo concreto" --prioridad alta --files "ruta/real.ts" --criterio "algo comprobable sin criterio humano" --contexto "spec o plan de donde sale" --by claude-code --to cline
```

Reglas:
- **Una tarea = un objetivo verificable.** No metas tres cambios en una tarea.
- `--criterio` debe poder comprobarse con un comando (ej: `tsc --noEmit` limpio,
  `prisma validate` OK, un HTTP 400, una ruta que aparece en el build).
- `--files` con rutas que existan de verdad: compruébalas antes de escribirlas.
- No marques tareas como `done`: eso lo hace quien ejecuta.

## Si eres Cline

Al empezar a trabajar, mira la cola: `npm.cmd run tasks -- list`. Toma solo lo tuyo
(`next` ya filtra por `asignado-a`), reclama con `claim`, valida y cierra con
`done --notas "qué hice y cómo lo verifiqué"`. Lo que necesite navegador, credenciales
o desplegar → asigna a `usuario`.

## Regla para los dos: resolver sin preguntar

Aplica a Claude Code y a Cline. Preguntarle al usuario es el **último** recurso:

1. **Búscalo en el repo** (código, specs en `docs/superpowers/`, plan en `docs/plans`).
2. **Corre el comando y mira el error real** (`tsc`, `prisma validate`, `eslint`, un `curl`).
3. **Toma el default seguro** (sin borrar datos, sin gastar, reversible) y déjalo escrito.
4. **Convierte la duda en trabajo**: tarea en la cola (`tasks -- assign`) o nota en
   `docs/inbox.md`. El chat no es un canal entre agentes.

Solo se pregunta: credenciales/cuentas, gastar dinero o cupo, borrar o migrar datos de
forma destructiva, publicar en producción, y cambios visibles al cliente sin spec que los
respalde. Y se pregunta **una vez**, con opciones y un default propuesto — nunca un
interrogatorio. Detalle y formato: `CLAUDE.md`, sección "Regla 0".

Los comandos de este repo ya están preaprobados para Claude Code en
`.claude/settings.json` (versionado), así que ni él ni el usuario tienen que aprobar
`tsc`, `eslint`, `prisma`, `tasks`, `git add|commit` ni las ediciones de archivos.

## Carril rápido (para que los cambios no esperen un turno de chat)

El ida y vuelta "Claude asigna → Cline reclama → Cline valida → Cline cierra" costaba
minutos de espera en cada cambio. Para eso están estos dos comandos:

- **`npm.cmd run check`** — valida el cambio en UN comando: `tsc`, `prisma validate` si
  tocó `prisma/`, y eslint solo de los archivos tocados. Imprime PASA/FALLA y sale con
  código 1 si falla, así sirve de candado antes de commitear. Los dos agentes corren esto
  en vez de tres comandos sueltos (tarda ~6 s).
- **`npm.cmd run queue:auto -- --yes`** — el carril rápido de la cola: reclama la
  siguiente tarea de Cline, la implementa con Claude Code headless, corre `npm run check`
  y **solo si PASA** commitea y cierra la tarea con la evidencia. Nunca hace push ni
  despliega. Si el check falla, o si no hubo cambios, deja la nota en el expediente y la
  tarea queda `en_proceso`. Sin `--yes` es dry-run.

Y en la cola, para no gastar comandos ni turnos: `tasks take` (reclama y muestra el
expediente de una vez), `tasks note` (deja un hallazgo sin cerrar la tarea) y
`tasks reopen` (devuelve a `pendiente` lo que se cortó a medias).

**Una tarea a la vez por agente:** `take`/`claim` se niegan a reclamar una tarea que otro
agente tiene `en_proceso` (se salta con `--forzar`), y `queue:auto` verifica que siga
`pendiente` antes de empezar. Pasó de verdad el 20/09/2026: T-0008 la trabajaron a la vez
la sesión del IDE y el carril rápido, y no volvió a pasar.

## Comandos del proyecto

- **Tipos:** `npx tsc --noEmit -p tsconfig.json` (debe salir sin nada)
- **Schema:** `npm run prisma -- validate`
- **Lint:** `npx eslint .` (0 errores; los warnings preexistentes se ignoran)
- **Build:** `next build --webpack`. **Ojo:** `npm run build` completo falla con
  `EPERM` si el dev server está corriendo (le bloquea el DLL de Prisma al
  `prisma generate`).
- **Verificar el build sin parar el dev server** (lo que hace falta antes de confiar en
  un deploy): `$env:NEXT_DIST_DIR=".next-build"; npx.cmd next build --webpack`. Compila
  a otra carpeta, así el build y el dev no se pisan, y se salta el `prisma generate` que
  causaba el EPERM. Verificado el 20/09/2026: build completo OK y el dev server siguió
  respondiendo 200 (`.next-build/` está en `.gitignore`).
- **Preguntarle algo a Claude Code:** `npm run claude -- "pregunta" [--file ruta]`

**Windows:** `npm` está bloqueado por la política de ejecución de PowerShell
(`npm.ps1`). Usa siempre **`npm.cmd`**.

## Estilo del repo

- **No hay framework de tests.** Se verifica con `tsc`, `prisma validate` y prueba manual.
- UI: Tailwind, rojo primario `#ee2b34` (`bg-primary`), tarjetas `rounded-2xl`, grises `text-gray-*`.
- Sin `any` en código nuevo.
- Comentarios en español explicando el **por qué**, no el qué.
- Mensajes de commit en español **sin acentos** (así están todos los del repo).
- No despliegues ni borres datos sin permiso explícito del usuario.

## Mapa de la documentación

- `CLAUDE.md` — lo que Claude Code lee al abrir el proyecto (Regla 0: resolver sin preguntar)
- `.claude/settings.json` — permisos preaprobados de Claude Code en este repo
- `docs/agent-bridge.md` — cómo se comunican los agentes (los 6 canales)
- `docs/tasks/LEEME.md` — formato de la cola y ciclo de vida
- `docs/tasks/PROMPT-PARA-CLAUDE.md` — recetas listas para pedir tareas
- `docs/superpowers/specs/` y `docs/superpowers/plans/` — diseños y planes
- `docs/inbox.md` — bandeja de conversación libre
