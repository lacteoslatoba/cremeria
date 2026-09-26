# Seguridad — estado real, qué se endureció y qué falta

Última revisión: **2026-09-25** (Cline, a petición directa del usuario: "busca las
herramientas para testing de la app y ponla muy fuerte en seguridad").

Todo lo que dice este documento se comprobó corriendo algo, no leyendo código y suponiendo.
Los comandos están abajo para repetirlo.

---

## 1. Herramientas de prueba elegidas

Detalle y comandos en [`tests/LEEME.md`](../tests/LEEME.md). Resumen:

| Nivel | Herramienta | Comando | Qué atrapa |
|---|---|---|---|
| Unitarias | `node:test` + `tsx` (0 deps nuevas) | `npm run test:unit` | cabeceras, rate limit, validadores, teléfono |
| Seguridad por HTTP | Playwright (`@playwright/test`), **sin navegador** | `npm run test:e2e` | 401/403, cookies, `no-store`, 429, webhook, CSRF |
| Navegador | Playwright Chromium | `npm run test:e2e:ui` | cookie invisible al JS, nada de JWT en `localStorage`, XSS reflejado |
| Dependencias | `npm audit` | `npm run seguridad:deps` | avisos altos/críticos en lo que corre |
| Paquete desplegado (opcional) | OWASP ZAP baseline | `zap-baseline.py -t <url>` | lo mismo que ve un atacante desde afuera |

Playwright **ya estaba** en el repo sin usarse; solo faltaba el runner. No se agregó
Jest/Vitest: `node:test` ya viene con Node 22 y no hay UI compleja que probar.

## 2. Lo que ya estaba bien (verificado antes de tocar nada)

- Contraseñas con **bcrypt (costo 10)**; nunca se devuelve el hash ni el `resetToken`
  (los `toSafeUser` de login/registro y los `select` de Prisma).
- Sesiones con **JWT HS256 (`jose`)** firmado con `JWT_SECRET`; en producción el módulo
  **falla** si falta el secreto (no hay fallback inseguro).
- Cookie `cremeria_session` **HttpOnly + Secure (prod) + SameSite=Lax**, y el rol se lee
  **de la base** en cada autorización (`loadAuthUser`), no del token: un token manipulado
  no escala privilegios.
- Roles por ruta con `requireAuth([...])`: `/api/users`, pedidos, repartidor y subida de
  imágenes exigen ADMIN/DELIVERY. El registro público **siempre** crea CUSTOMER.
- Webhook de Stripe con **verificación de firma**; la confirmación del pago se revalida
  contra la API de Stripe (no se cree lo que dice el cliente).
- Subida de imágenes: tipo MIME permitido, máximo 5 MB y rate limit.
- Recuperación de contraseña: mensaje neutro (no revela si la cuenta existe) y nunca
  devuelve el código en producción.
- Rate limit distribuido con **Upstash** en el middleware (Edge) para `/api/auth/*` y
  `/api/orders`.
- `.env*.local` está en `.gitignore` (nada de credenciales en el repo).

## 3. Lo que se endureció en esta sesión

| # | Hallazgo | Cambio | Cómo se verificó |
|---|---|---|---|
| 1 | La CSP de producción incluía `'unsafe-eval'` (la mitad del valor de una CSP) | Fuera `unsafe-eval`; se agregó `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y `frame-ancestors 'none'` | `test:unit` + build de producción + `test:e2e` con `E2E_PRODUCCION=1` |
| 2 | Faltaban HSTS, COOP, `X-DNS-Prefetch-Control`, `X-Permitted-Cross-Domain-Policies` | Se agregaron en `src/lib/seguridad.ts` (una sola lista, con pruebas) | `test:unit/seguridad.test.ts` y `test:e2e` |
| 3 | La app anunciaba `X-Powered-By: Next.js` (versión al aire para quien busca fallas conocidas) | `poweredByHeader: false` | `test:e2e` (cabecera ausente) |
| 4 | El rate limit solo cubría `/api/auth/*` y `/api/orders/*`: `/api/users`, `/api/products`, `/api/business`, `/api/driver/*` se podían martillar sin freno | Cubeta base `apiRatelimit` (120/min) para **toda** `/api/*` | `test:e2e` (ninguna ruta cambió de comportamiento) |

---

## 4. Lo que queda pendiente (y de quién es)

### Necesita el navegador / el despliegue (usuario)

1. **Verificar el dominio de producción con la suite ya escrita.** El build de producción
   **local ya se verificó**: 11/11 en la suite api con `E2E_PRODUCCION=1`, 4/4 de navegador,
   cero violaciones de CSP y las cabeceras correctas (HSTS, `X-Frame-Options: DENY`, CSP sin
   `unsafe-eval`). Falta el dominio desplegado, que es lo único que no se puede hacer sin
   desplegar:

   ```powershell
   $env:E2E_BASE_URL="https://TU-DOMINIO.vercel.app"; $env:E2E_PRODUCCION="1"; npm.cmd run test:e2e
   $env:E2E_BASE_URL="https://TU-DOMINIO.vercel.app"; npm.cmd run test:e2e:ui
   ```
2. **Probar el pago real con Stripe** después del cambio de CSP (`unsafe-eval` fuera): el
   build local carga sin violaciones, pero el Payment Element contra Stripe de verdad
   necesita tarjeta y dominio real. Si algo truena, se vuelve a agregar `'unsafe-eval'` en
   `politicaDeContenido()` y se documenta: el resto del endurecimiento no depende de eso.
3. **Cuentas de prueba** para extender la suite a los flujos con sesión (que un usuario no
   pueda leer ni modificar el pedido de otro, IDOR de `/api/orders/[orderId]`, 403 de un
   CUSTOMER en rutas de admin). Hoy no se toca porque el dev apunta a la misma base que
   producción y **la suite no crea datos a propósito**.
4. **Escanear el sitio con OWASP ZAP** (baseline):
   `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://TU-DOMINIO`.

### Decisiones que cambian el comportamiento (por eso no se hicieron solas)

5. **Prefijo `__Host-` en la cookie de sesión** (`__Host-cremeria_session`): bloquea que un
   subdominio comprometido escriba la cookie. Endurecimiento real, pero **invalida las
   sesiones abiertas de todos** (una vez) y toca `src/lib/auth.ts`, login, logout y cada
   `readSession`. Es decisión del usuario, no del agente.
6. **Duración de la sesión (7 días) y logout sin revocación**: el JWT vale hasta que expira;
   cerrar sesión solo borra la cookie del navegador, así que un token robado sigue sirviendo.
   Opciones: bajar a 24 h (fácil) o agregar `tokenVersion`/tabla de sesiones para revocar de
   verdad (toca el schema).
7. **`'unsafe-inline'` en la CSP de scripts**: quitarlo requiere nonces por petición (Next
   inyecta el payload de RSC inline). Es el endurecimiento que falta para que la CSP proteja
   también contra XSS inline.
8. **`@ducanh2912/next-pwa` 10.2.6** (mayor) para cerrar `serialize-javascript`: cambia el
   plugin de PWA y con él la generación del service worker. El resto de los avisos de
   `npm audit` es cadena de herramientas de desarrollo.

### Riesgos conocidos que conviene tener escritos

9. **Se confía en `x-forwarded-for`** para el rate limit (así funciona detrás de Vercel, que
   la reescribe). Si algún día la app se sirve detrás de otro proxy o directo, cualquiera
   podría falsificar la IP y saltarse los frenos por IP. El límite **por cuenta** del login
   sí aguanta ese caso.
10. **`bcrypt` costo 10**: correcto, pero 12 daría más margen si algún día se filtran hashes.
    Se paga con login más lento (~200 ms extra).
11. **No hay WAF delante**: el freno ante un ataque volumétrico real es la plataforma
    (Vercel) + Upstash, no la app. Los topes de longitud y los frenos por IP/cuenta cubren lo
    que la app puede cubrir sola.

| 5 | Login/registro/recuperación compartían la cubeta de 10/min | Cubeta estricta de **5/min** en las escrituras de autenticación | `test:e2e` (429 al sexto intento) |
| 6 | El límite era solo **por IP**: fuerza bruta distribuida (muchas IPs, una cuenta) pasaba libre | Límite adicional **por cuenta** (10/15 min) en el login | `test:unit` (rate-limit) + `test:e2e` |
| 7 | No había ninguna defensa CSRF explícita (solo el `SameSite=Lax` de la cookie) | Chequeo de `Origin` en POST/PUT/PATCH/DELETE: origen ajeno → **403** | `test:e2e` ("una mutacion desde otro origen se bloquea") |
| 8 | Las respuestas de `/api/auth/*` podían quedar en caché intermedia | `Cache-Control: no-store` en `/api/auth/*` | `test:e2e` |
| 9 | Respuestas de API sin `Vary` (riesgo de que un CDN sirva la respuesta de un rol a otro) | `Vary: Origin, Cookie` en producción | revisión + `test:e2e` |
| 10 | El código de recuperación se generaba con **`Math.random()`** (xorshift128+, predecible) — con dos códigos observados se podía calcular el tercero y **restablecer la contraseña de cualquiera** | `crypto.randomInt()` (CSPRNG del sistema), sin sesgo | revisión + `test:e2e` del flujo (sin crear datos) |
| 11 | En producción, si no había SMS configurado, el código de recuperación se escribía en el **log del servidor**; y los teléfonos salían completos | El código solo se registra en desarrollo; el teléfono se enmascara (`******01`) | revisión de código + `tsc` |
| 12 | Sin techos de longitud: una contraseña de megabytes se pasaba **completa a bcrypt** (DoS por CPU regalado) y textos enormes entraban a Postgres | Techos en `src/lib/validators.ts` (identificador 200, contraseña 200, nombre 120, dirección 300…) y mínimo de 6 caracteres unificado | `test:unit/validators.test.ts` + `test:e2e` (50 000 caracteres → 401, no 500) |
| 13 | El webhook de Stripe sin firma devolvía **500** (error del servidor) | Sin firma → **400**; solo la falta de configuración es 500 | `test:e2e` |
| 14 | `next@16.1.6` con aviso **CRÍTICO** (request smuggling en `rewrites()` — y esta app usa `rewrites()` para `/main`) | Subido a la versión parcheada de la misma línea | `tsc`, `eslint`, `prisma validate`, unitarias, e2e y build de producción |

---

## 5. Cómo reproducir todo (evidencia de esta sesión)

```powershell
npm.cmd run test:unit        # 22/22 PASA
npm.cmd run test:e2e         # 10 PASA + 1 omitida (la de producción) contra el dev server
npm.cmd run test:e2e:ui      # 4 PASA (Chromium)
npm.cmd run check -- --todo  # tsc + prisma validate + eslint: 0 errores
npm.cmd run seguridad:deps   # npm audit: 0 críticos, 11 altos (solo cadenas de desarrollo)
```

**Y contra el build de producción de verdad** (la verificación que más importa para la CSP,
porque en dev no se manda a propósito):

```powershell
# 1) compilar a otra carpeta para no pisar el dev server (escotilla que ya documentaba el repo)
$env:NEXT_DIST_DIR=".next-build"; npx.cmd next build --webpack   # OK, 44/44 páginas

# 2) servir ese build
$env:NEXT_DIST_DIR=".next-build"; npx.cmd next start -p 3100

# 3) correr las suites contra el build real
$env:E2E_BASE_URL="http://127.0.0.1:3100"; $env:E2E_PRODUCCION="1"; npm.cmd run test:e2e  # 11/11
$env:E2E_BASE_URL="http://127.0.0.1:3100"; npm.cmd run test:e2e:ui                      # 4/4, 0 violaciones de CSP
```

Cabeceras observadas en ese build de producción (`/login`):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; ...
  frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

## 6. Nota de dependencias: `next` 16.1.6 → 16.3.6

`npm audit` marcaba un aviso **crítico** en `next@16.1.6`: *HTTP request smuggling in
rewrites*. Esta app usa `rewrites()` (la ruta `/main` del acceso directo de la PWA), o sea
que el aviso aplicaba de verdad. Se subió a `16.3.6` (misma línea, no es salto mayor) y se
verificó: `tsc`, `eslint .`, `prisma validate`, 22 unitarias, las dos suites e2e y **build de
producción completo**.

El pin quedó **exacto** (`"next": "16.3.6"`), como estaba antes: sin `^`, para que un
`npm install` no meta una versión distinta sin que nadie lo revise.

De paso, Next 16.3 avisaba que `middleware.ts` está deprecado en favor de `proxy.ts`. Como
el endurecimiento toca justo ese archivo y las pruebas lo ejercitan (429 del rate limit, 403
del chequeo de origen, `no-store`), se migró a `src/proxy.ts` con `export async function
proxy(...)`. Verificado con la suite completa, no a ojo.

Nota de método: el primer build de producción **falló** con un error de `next/font` y no era
del código — `npm audit fix` estaba reescribiendo `node_modules` mientras compilaba. Al
repetirlo con el árbol de dependencias quieto, compiló sin problema. Si el build falla en
`next/font`, revisa primero que no haya otro `npm` corriendo.

| 15 | No existía ninguna prueba automatizada de seguridad | 22 unitarias + 13 end-to-end | `npm run test` |
