# Bandeja de entrada entre agentes

Canal de comunicación basado en archivos entre Cline (VS Code), Claude Code y tú.
Ver el protocolo completo en [`agent-bridge.md`](./agent-bridge.md).

**Reglas:**
1. Cada petición es un `## [ ]` con fecha, título y contexto.
2. El agente que responde **escribe debajo de `Respuesta:`** y cambia `[ ]` por `[x]`.
3. No borres entradas: así queda historial de decisiones sin gastar tokens repitiendo contexto.

---

## [x] 2026-09-18 · ¿Existe forma de comunicarse con Claude?

Duda: ¿Se puede crear un canal real entre Cline y otro Claude en esta máquina?

Hallazgos verificados:
- No hay Claude Code CLI instalado (`claude` no está en el PATH).
- Única extensión de IA en VS Code: `saoudrizwan.claude-dev` 4.1.16 (Cline).
- `.claude/` y `.agents/` solo contienen skills de Upstash (declaradas en `skills-lock.json`).
- No hay `ANTHROPIC_API_KEY` ni `ANTHROPIC_MODEL` en `.env.local`.

Respuesta: el canal ya existe (el chat de Cline, que *es* Claude) y ahora además
existe `npm run claude` (`scripts/claude-bridge.mts`) + este archivo como canal
compartido en disco.

---

## [ ] 2026-09-18 · Activar el puente

Falta del lado humano, elige una:

- **A)** `ANTHROPIC_API_KEY=sk-ant-...` en `.env.local` → habilita el backend de API
  (consume crédito de tu cuenta).
- **B)** `npm install -g @anthropic-ai/claude-code` + `claude` una vez para iniciar
  sesión → habilita el backend de CLI.

Nota de entorno: en esta máquina PowerShell bloquea `npm.ps1` por política de
ejecución, así que los comandos hay que correrlos como `npm.cmd run claude -- "..."`.

Respuesta: _(pendiente)_

---

## [x] 2026-09-18 13:45 · Verificacion de la Task 3 del plan OTP (commit 647427d) — PASA

**Quien:** Cline, en rol de verificador mientras Claude Code trabajaba.

**Resultado: los 4 pasos del plan, verificados con evidencia.**

- **Step 1 (implementacion):** auditada linea por linea contra el plan — imports (5-6),
  `cleanupRateLimitBuckets()` (18), `user.create` solo bajo `if (createdByAdmin)` (74-87),
  rate limits 8/15min IP + 3/15min telefono (92-98), codigo de 6 digitos + expiry 10 min
  (100-101), `sendWhatsAppCode` (103), 502 si Twilio configurado y falla (111-116),
  `upsert` por phone (118-122), respuesta `{ok, phone, _dev_code}` sin cookie (124-130).
  El flujo de admin quedo intacto. Correcto.
- **Step 2:** `npx tsc --noEmit` → exit 0, sin salida.
- **Step 3 (prueba manual):** con dev server reiniciado,
  `POST /api/auth/register {"name":"Prueba Uno","phone":"555-000-0001","password":"clave1234"}`
  → `{"ok":true,"phone":"555-000-0001","_dev_code":"303422"}` **HTTP 200**.
  Log: `[SIMULATED WHATSAPP] to 555-000-0001: ... codigo ... 303422` y
  `INSERT INTO "public"."PendingRegistration" ... ON CONFLICT ("phone") DO UPDATE SET ...`.
  O sea: el upsert funciona y **la tabla ya existe en la BD de produccion**. Los pasos
  manuales del plan **no** se habian comprobado de verdad hasta ahora.
- **Step 4:** commit `647427d`, mensaje exacto del plan.

**Hallazgo 1 (resuelto, queda como leccion de entorno):** el dev server viejo (PID 17752,
arrancado el 17/09 07:39 -- antes de que existiera el export) devolvia **500
`sendWhatsAppCode is not a function`** por hot-reload de Turbopack: los exports nuevos
no se recablean en modulos ya compilados. Reiniciar el server lo arregla; el codigo
estaba bien. **Moraleja: al agregar exports nuevos en `src/lib/`, reiniciar el dev server
antes de probar.**

**Hallazgo 2 (pendiente):** quedaron sin usar los imports `signSession` y
`setSessionCookie` en `src/app/api/auth/register/route.ts:4` (el registro publico ya no
firma sesion). No viola el plan -- que solo exige `tsc` limpio -- pero es un warning
nuevo de eslint. Seguimiento en **T-0004**.

**Entorno:** se levanto un dev server de verificacion (PID 21140, log en
`%TEMP%\dev-verify.log`), en `http://localhost:3000` y `http://192.168.1.160:3000`.

