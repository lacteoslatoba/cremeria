# Claude Code — lee esto antes de actuar

Las instrucciones completas de este proyecto están en **`AGENTS.md`**, en la raíz.
**Léelo ahora** antes de proponer o hacer cambios.

Resumen de una línea: este repo lo trabajan dos agentes. Tú (**Claude Code**) exploras,
decides y ejecutas lo que puedas verificar; **Cline** ejecuta el resto por la cola de
`docs/tasks/`:

```powershell
npm.cmd run tasks -- assign "Titulo" --prioridad alta --files "ruta/real.ts" --criterio "comprobable con un comando" --contexto "de donde sale" --by claude-code --to cline
```

Usa `npm.cmd` (no `npm`): PowerShell tiene bloqueado `npm.ps1` en este equipo.

---

## Regla 0 — Resuelve, no preguntes

**Preguntar es el último recurso, no la primera respuesta.** Un turno que termina en
"¿quieres que lo haga?" o "¿procedo?" es un turno perdido: el trabajo se hace, se
verifica y se reporta **con evidencia**. El usuario ya dijo lo que quiere; repetirlo
en forma de pregunta solo cuesta tiempo.

Antes de escribir cualquier pregunta, agota estos cuatro pasos **en orden**:

1. **Búscalo en el repo.** `grep`/glob sobre `src/`, `prisma/`, `docs/`. Casi siempre la
   respuesta está en el código, en `docs/superpowers/specs/` o en `docs/superpowers/plans/`.
2. **Corre el comando y mira el error real.** `npx tsc --noEmit`,
   `npm.cmd run prisma -- validate`, `npx eslint .`, un `curl` contra el dev server.
   Un dato real vale más que una suposición; y si la hipótesis falla, cambia de hipótesis.
3. **Toma el default seguro y déjalo escrito.** Si hay dos caminos razonables, elige el
   que **no** borra datos, no gasta dinero y es reversible; explica en el commit y en tu
   respuesta por qué lo elegiste.
4. **Si es trabajo verificable que no te toca, asígnalo** a Cline
   (`npm.cmd run tasks -- assign ...`) en vez de pedir permiso. El canal entre agentes es
   `docs/tasks/`, no el chat.

## Prohibido preguntar esto

- "¿Quieres que lo haga?", "¿Procedo?", "¿Te parece si…" → hazlo y repórtalo con evidencia.
- "¿Puedo leer / editar / correr X?" → los permisos de este repo ya están preaprobados en
  `.claude/settings.json` (lecturas, ediciones, `tsc`, `eslint`, `prisma validate`,
  `npm.cmd run tasks|claude|dev`, `git add|commit|diff|log`, dev server). Ver "Vía 6" en
  `docs/agent-bridge.md`.
- "¿Te muestro el plan antes de tocar código?" → no: haz el cambio y muestra el **diff**.
- Aclaraciones que puedas deducir del código, del schema o de un spec (nombres de campos,
  forma de la respuesta de una API, rutas, estilos de UI, acentos de los commits). Deducir,
  decidir y documentar **es** tu trabajo.
- "¿Hago el commit?" → sí: commit local, mensaje en español **sin acentos**. Lo que sí
  necesita decisión humana es publicar (`git push` a `main`, `vercel`, deploy).

## Lo único que sí se pregunta (lista cerrada)

1. **Credenciales o cuentas** (Twilio, Stripe, Meta, Vercel): falta un dato que solo el
   humano tiene.
2. **Gastar dinero o cupo** (subir el plan de Twilio, mandar mensajes de prueba reales).
3. **Borrar o migrar datos de forma destructiva** (`db push`, `migrate reset`, `drop`).
4. **Publicar en producción** (`git push` a `main`, `vercel deploy`).
5. **Cambiar lo que ve el cliente** cuando no hay spec que lo respalde.

Y cuando sea inevitable, va **una sola vez**, con esta forma (nunca un interrogatorio):

```
[BLOQUEADO POR: <motivo en 5 palabras>]
Pregunta: <una línea, concreta>
Opciones: A) … (recomendada)  B) …
Default: si no respondes, sigo con A y lo dejo anotado en docs/inbox.md.
```

## Cómo se cierra un turno

Sin preguntas al final. El reporte es siempre el mismo formato:

```
Hice: <qué cambió, archivo por archivo>
Evidencia: <comandos que corriste y qué devolvieron>
Abierto: <nada | tarea T-NNNN en la cola | nota en docs/inbox.md>
```

Si algo queda abierto, conviértelo en tarea (`tasks -- assign`) o apúntalo en
`docs/inbox.md`; no lo dejes como pregunta suelta.

