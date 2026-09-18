# Cómo pedirle a Claude que le asigne trabajo a Cline

Hay **tres formas reales**, según qué Claude tengas a mano. En las tres, el
resultado es el mismo: un archivo `docs/tasks/T-NNNN-*.md` con estado `pendiente`.
Ver `LEEME.md` para el formato y `../agent-bridge.md` para el panorama completo.

---

## Opción A — Claude Code (la automática) — ✅ YA FUNCIONA EN ESTE EQUIPO

**Requisito: ninguno.** Claude Code **2.1.274** está instalado como extensión del IDE
**Antigravity**, con la sesión iniciada (`~/.claude/.credentials.json`). El binario no
está en el PATH, pero vive aquí y el puente lo encuentra solo:

```
~/.../anthropic.claude-code-2.1.274-win32-x64/resources/native-binary/claude.exe
```

### A.1 — Desde el chat de Claude Code en Antigravity (interactivo)

**Ya no hace falta pegar nada.** `CLAUDE.md` (raíz) apunta a `AGENTS.md`, y Claude Code
los lee **automáticamente** al abrir el proyecto: ya sabe que debe asignar las tareas en
vez de implementarlas él. Verificado con una pregunta directa:

```
$ claude -p "responde en 2 lineas: que canal usas para pedir un cambio y quien lo ejecuta"
1) La cola de tareas en docs/tasks/ via npm.cmd run tasks -- assign ...
2) Lo ejecuta Cline; tu (Claude Code) solo exploras, decides y asignas.
```

Si algún día quieres forzarlo o darle contexto extra, este es el prompt:

```
Antes de nada, lee docs/tasks/LEEME.md para conocer la cola de trabajo.

Asigna UNA tarea a Cline con: npm run tasks -- assign ...
Reglas que debes respetar:
- Un solo objetivo por tarea, verificable.
- --criterio debe ser algo que se pueda comprobar sin criterio humano: "tsc sin
  errores", "el endpoint devuelve 400 con estos datos", "la ruta X aparece en
  npm run build".
- --files con rutas REALES del repo (compruébalas antes con ls/glob, no las inventes).
- --contexto con el archivo del plan o el issue del que sale.
- --by claude-code --to cline
- No marques nada como hecho: eso lo hace quien ejecuta.

La tarea es: <describe aquí lo que quieres>
```

### A.2 — Desde mi terminal, sin abrir nada (receta VERIFICADA)

Yo puedo invocarlo en modo headless (`-p` lee el prompt de stdin) y pedirle que emita
el comando de asignación. Esto es literalmente lo que produjo la **T-0003**:

```powershell
# 1. Escribe el encargo en un archivo temporal
$p = "$env:TEMP\cc-prompt.txt"
@"
Lee docs/tasks/LEEME.md de este repo y emite SOLO el comando de una linea
npm.cmd run tasks -- assign "..." para asignar a cline UNA tarea pequena y
verificable de este repo. Usa npm.cmd, rutas reales, criterio comprobable,
--by claude-code --to cline. No modifiques ningun archivo.
"@ | Set-Content $p

# 2. Invoca a Claude Code headless (el pipe es lo que evita el modo interactivo)
$c = "$env:USERPROFILE\.antigravity-ide\extensions\anthropic.claude-code-2.1.274-win32-x64\resources\native-binary\claude.exe"
Get-Content $p | & $c -p
```

Para una pregunta suelta no necesitas nada de eso, ya está envuelto:

```powershell
npm.cmd run claude -- "¿Qué falta del spec de WhatsApp OTP?" --file docs/superpowers/specs/2026-09-18-whatsapp-otp-registration-design.md
```

Cuando Cline termine, se lo puedes devolver:

```
Revisa las tareas cerradas: npm run tasks -- list --estado hecho
Lee el expediente de la última, verifica que de verdad cumple el --criterio, y si
algo no cuadra asigna una tarea nueva de corrección.
```

---

## Opción B — Claude en la web (claude.ai), sin acceso al repo

Claude en la web **no puede escribir archivos en tu disco**, así que en vez de una
tarea te devuelve **el comando exacto** para que tú lo pegues en la terminal.

Pega esto en claude.ai:

```
Trabajo en el repo C:\Users\Administrador\Documents\APPS\Cremeria (Next.js 16 +
Prisma + Stripe, sin test runner). Tienes que darme el comando EXACTO de una línea
para asignarle una tarea a Cline con esta CLI:

npm run tasks -- assign "TITULO" --prioridad alta|media|baja --files "a.ts,b.tsx"
  --criterio "algo comprobable sin criterio humano" --contexto "de dónde sale"
  --by claude-web --to cline

Devuélveme SOLO el comando, en una línea, sin explicaciones, usando este contexto:
<pega aquí tu duda, el error o el fragmento de código>
```

Te devolverá algo como:

```powershell
npm.cmd run tasks -- assign "El checkout acepta carrito vacio" --prioridad alta --files "src/app/checkout/page.tsx" --criterio "con carrito vacio el boton de pagar queda deshabilitado y no se crea ninguna orden" --contexto "detectado probando el flujo de pago en produccion" --by claude-web --to cline
```

Lo pegas, y luego me dices a mí: *"trabaja la siguiente"*.

> **Ojo:** en esta máquina PowerShell bloquea `npm.ps1`, así que usa **`npm.cmd`**.

---

## Opción C — Tú mismo, sin ningún otro Claude

Es la vía más rápida y no depende de nadie. Tú escribes la tarea y yo la ejecuto:

```powershell
npm.cmd run tasks -- assign "Arreglar el checkout con carrito vacio" --prioridad alta --files "src/app/checkout/page.tsx" --criterio "no se crea orden y el boton queda deshabilitado" --contexto "visto probando en produccion" --by usuario --to cline
```

Luego en este chat: **"trabaja la siguiente"** (yo corro `next`, `claim`, ejecuto,
valido y cierro con `done`).

---

## Cómo sabe cada uno qué le toca

Cada tarea tiene `asignado-a`. Ese campo manda:

```powershell
npm.cmd run tasks -- next                 # solo las de cline (por defecto)
npm.cmd run tasks -- next --para usuario  # las tuyas, para lo que requiere humano
npm.cmd run tasks -- next --para claude-code
```

`next` **nunca** te devuelve una tarea asignada a otro: las lista aparte y no las
reclama. Y si reclamas una ajena a propósito, `claim` te avisa antes de seguir.

## La división natural del trabajo

| Quién | Sirve para |
|---|---|
| `claude-code` | explorar el repo, correr comandos, refactors largos desatendidos |
| `claude-web` | pensar/redactar sin repo; devuelve comandos para pegar |
| `cline` (yo) | ejecutar en este repo con tu supervisión: editar, validar, cerrar |
| `usuario` (tú) | lo que necesita navegador, credenciales o decisión de desplegar |
