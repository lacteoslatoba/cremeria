# Pruebas — qué herramientas hay y cómo se corren

Este proyecto **no tenía framework de pruebas**: se verificaba con `tsc`, `prisma validate`
y prueba manual en el navegador. Eso alcanzaba para desarrollo, pero dejaba la seguridad
sin candado: nadie se entera si un refactor tira HSTS o si alguien entra sin sesión.

Ahora hay dos niveles, más una auditoría de dependencias. Todo corre en Windows con
`npm.cmd`.

## 1. Unitarias — `npm run test:unit`

| | |
|---|---|
| Herramienta | `node:test` (viene con Node, no es dependencia nueva) ejecutado con `tsx` |
| Archivos | `tests/unit/*.test.ts` |
| Runner | `scripts/test-unit.mts` — los lista y los pasa a `tsx --test` |
| Velocidad | < 1 segundo |

Por qué hay un runner en vez de un glob en `package.json`: el descubrimiento de archivos
de `node --test` solo reconoce `.js/.mjs/.cjs`. Con `tests/unit/*.test.ts` responde
"0 tests" (comprobado). El runner los lista explícitamente, y así agregar una prueba nueva
es solo crear el archivo.

Qué cubren: cabeceras de seguridad (`src/lib/seguridad.ts`), rate limit en memoria,
variantes del teléfono y validadores de entrada.

**Importante:** los archivos de prueba son `.ts`, **no** `.mts`. Los `.mts` los carga el
soporte nativo de tipos de Node y la interop con los módulos del proyecto truena con
`does not provide an export named ...`. Ya nos pasó; no lo repitas.

## 2. Seguridad por HTTP — `npm run test:e2e`

| | |
|---|---|
| Herramienta | `@playwright/test`, proyecto `api` (fixture `request`, **sin navegador**) |
| Archivo | `tests/e2e/seguridad.api.spec.ts` |
| Velocidad | ~8 segundos |

Corre contra la app corriendo. Por defecto `http://127.0.0.1:3000` (reusa el `npm run dev`
que ya estés usando); para pegarle a producción:

```powershell
$env:E2E_BASE_URL="https://tu-dominio.vercel.app"; $env:E2E_PRODUCCION="1"; npm.cmd run test:e2e
```

Con `E2E_PRODUCCION=1` además se comprueban las cabeceras que en dev no se mandan a
propósito (HSTS, `X-Frame-Options: DENY`, CSP sin `unsafe-eval`).

Qué verifica: 401 sin sesión en todas las rutas de datos, cookie falsificada, cookie de
sesión con `HttpOnly/SameSite/Path`, `no-store` en `/api/auth/*`, que el login no revele
si una cuenta existe, 429 al sexto intento por IP, webhook de Stripe sin firma → 400, y
que una mutación desde otro origen se bloquee con 403.

**Nunca crean ni borran datos**: el dev apunta a la misma base que producción. Cada prueba
usa su propia IP falsa del rango de documentación (`203.0.113.x`) en `x-forwarded-for`, que
es lo que lee el rate limit — así no gastas tu propia cuota ni bloqueas tu sesión.

## 3. Navegador — `npm run test:e2e:ui`

| | |
|---|---|
| Herramienta | `@playwright/test`, proyecto `ui` (Chromium) |
| Archivo | `tests/e2e/seguridad.ui.spec.ts` |
| Requisito | Chromium ya está descargado (`npx playwright install chromium` si no) |

Comprueba lo que solo se ve con un navegador: que `document.cookie` **no** vea la cookie
de sesión, que la sesión no esté guardada en `localStorage` (nada de JWT robable por XSS),
que el logout desde la página no lo frene el anti-CSRF, y que un `<script>` en la URL no se
ejecute.

## 4. Todo junto — `npm run test`

`test:unit` + `test:e2e`. Es el candado completo antes de commitear (junto con
`npm run check`, que valida tipos/lint/schema).

## 5. Dependencias — `npm run seguridad:deps`

`npm audit --audit-level=high`. Falla (código 1) si hay avisos altos o críticos, para que
no se queden "para después". El estado actual y lo que falta está en
[`../docs/seguridad.md`](../docs/seguridad.md).

Opcional, para barrer el paquete como lo haría un atacante externo: **OWASP ZAP**
(`zaproxy` / Docker `ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t <url>`) contra el
dominio desplegado. No está instalado; es una tarea aparte porque necesita el sitio arriba.

## Por qué estas herramientas y no otras

- **Playwright ya estaba en el repo** (`devDependencies`, versión 1.62.1) pero sin usar: era
  la herramienta obvia. Lo único que faltaba era el runner (`@playwright/test`), que es
  dependencia de desarrollo y no viaja al bundle.
- **`node:test` en vez de Jest/Vitest**: cero dependencias nuevas para las unitarias y ya
  viene con Node 22. No hay framework de UI que probar, así que el costo de Jest no se paga.
- **Pruebas de seguridad por HTTP antes que de UI**: son las que atrapan de verdad los
  errores peligrosos (permisos, filtraciones, frenos) y corren en segundos sin navegador.
