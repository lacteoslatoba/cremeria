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

## Comandos del proyecto

- **Tipos:** `npx tsc --noEmit -p tsconfig.json` (debe salir sin nada)
- **Schema:** `npm run prisma -- validate`
- **Lint:** `npx eslint .` (0 errores; los warnings preexistentes se ignoran)
- **Build:** `next build --webpack`. **Ojo:** `npm run build` completo falla con
  `EPERM` si el dev server está corriendo (le bloquea el DLL de Prisma al
  `prisma generate`); hay que pararlo primero.
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

- `docs/agent-bridge.md` — cómo se comunican los agentes (los 5 canales)
- `docs/tasks/LEEME.md` — formato de la cola y ciclo de vida
- `docs/tasks/PROMPT-PARA-CLAUDE.md` — recetas listas para pedir tareas
- `docs/superpowers/specs/` y `docs/superpowers/plans/` — diseños y planes
- `docs/inbox.md` — bandeja de conversación libre
