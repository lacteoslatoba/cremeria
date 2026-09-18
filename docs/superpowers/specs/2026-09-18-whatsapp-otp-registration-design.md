# Verificación por código de WhatsApp al registrarse

## Contexto y objetivo

Hoy el registro (`POST /api/auth/register`) crea la cuenta e inicia sesión de inmediato con solo teléfono + contraseña, sin comprobar que el número de celular sea real. El objetivo es exigir que, antes de guardar la cuenta nueva, la persona reciba un código de 6 dígitos por WhatsApp y lo capture — así se valida que hay una persona real detrás de cada cuenta.

El registro sigue pidiendo lo mismo que hoy (nombre, teléfono, contraseña). El código por WhatsApp es un paso extra de validación, no un reemplazo de la contraseña.

## Diseño

### 1. Registro pendiente (no se guarda en `User` hasta verificar)

Se agrega un modelo nuevo a `prisma/schema.prisma`:

```prisma
model PendingRegistration {
  id         String   @id @default(cuid())
  phone      String   @unique
  name       String?
  username   String?
  email      String?
  password   String   // ya encriptada con bcrypt, igual que hoy
  code       String
  codeExpiry DateTime
  attempts   Int      @default(0)
  createdAt  DateTime @default(now())
}
```

La cuenta real (`User`) solo se crea cuando el código se valida correctamente. Esto evita:
- Cuentas "fantasma" nunca verificadas acumulándose en `User`.
- Que alguien bloquee un número de teléfono para siempre sin confirmar nunca (como `phone` en `User` no es `@unique` a nivel de esquema hoy, pero si lo fuera en el futuro, este diseño ya lo respeta).

Si alguien vuelve a registrarse con el mismo teléfono antes de verificar, el `PendingRegistration` existente se reemplaza (`upsert`) con un código nuevo — esto es, de hecho, el mecanismo de "reenviar código".

### 2. Flujo end-to-end

1. **`POST /api/auth/register`** (mismos campos que hoy: nombre, teléfono, contraseña, email/dirección opcionales):
   - Valida que el teléfono no pertenezca ya a un `User` real (mismo chequeo de duplicados que existe hoy).
   - Genera código de 6 dígitos (`Math.floor(100000 + Math.random() * 900000)`, igual que el flujo de "olvidé mi contraseña").
   - Hashea la contraseña (igual que hoy).
   - `upsert` en `PendingRegistration` por `phone`, con `codeExpiry = now + 10 min` y `attempts = 0`.
   - Envía el código por WhatsApp (ver sección 3).
   - Responde `{ ok: true, phone }` — **sin** crear sesión ni cookie todavía.

2. **Pantalla nueva de captura de código** (en el flujo de registro del frontend, después de enviar el formulario).

3. **`POST /api/auth/register/verify`** con `{ phone, code }`:
   - Busca `PendingRegistration` por `phone`.
   - Si no existe, expiró, o `attempts` ya alcanzó el máximo (5) → error genérico "Código incorrecto o expiró".
   - Si el código no coincide → incrementa `attempts` y devuelve el mismo error genérico.
   - Si coincide y no expiró → crea el `User` real con los datos guardados en `PendingRegistration` (mismo `role: CUSTOMER` forzado que hoy), borra el `PendingRegistration`, firma la sesión JWT y pone la cookie `cremeria_session` — igual que el registro exitoso de hoy. Responde con el usuario (mismo `toSafeUser()`).

### 3. Envío por WhatsApp

Nueva función `sendWhatsAppCode(phone: string, code: string)` en `src/lib/notify.ts`, junto a `sendSms()` existente:
- Reutiliza el cliente de Twilio y `formatMxPhone()` ya existentes.
- Usa `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (ya configuradas en producción) + una variable nueva `TWILIO_WHATSAPP_NUMBER` (remitente de WhatsApp, formato `whatsapp:+1415...`).
- `to` se manda como `` `whatsapp:${formatMxPhone(phone)}` ``.
- Si faltan las variables de entorno (dev local, o mientras se aprueba el número de WhatsApp Business en producción), cae al mismo patrón que el resto de la app: `console.log("[SIMULATED WHATSAPP] ...")` y devuelve `false`.
- Mientras Twilio aprueba el número de WhatsApp Business para producción, se puede usar el **sandbox de Twilio** (gratis, requiere unirse una vez desde el WhatsApp real con un código que da Twilio) para probar el flujo completo de inmediato.
- Fuera de producción, si no se pudo enviar de verdad, la respuesta de `/api/auth/register` incluye `_dev_code` con el código real (igual que ya hace `forgot-password/request`), para poder probar sin depender de WhatsApp.

### 4. Rate limiting y errores

Reutiliza `rateLimit()` de `src/lib/rate-limit.ts`, mismo patrón que "olvidé mi contraseña":
- `POST /api/auth/register`: límite por IP (8/15min) y por teléfono (3/15min) — evita mandar spam de WhatsApp.
- `POST /api/auth/register/verify`: límite por teléfono (8/15min) y por IP (20/15min), más el contador `attempts` (máx 5) guardado en el propio `PendingRegistration` — doble freno contra fuerza bruta sobre el código de 6 dígitos.
- Mensajes de error genéricos ("Código incorrecto o expiró") sin distinguir causa, para no dar pistas.
- Si falla el envío real de WhatsApp en producción (Twilio responde error) → no se guarda el `PendingRegistration`, se responde error pidiendo reintentar.
- Teléfono ya usado por una cuenta real → mismo mensaje de duplicado que ya existe hoy.

### 5. Pruebas

Sin framework de pruebas automatizadas en el repo. Se prueba igual que el resto de los cambios de esta sesión: `npx tsc --noEmit`, deploy a producción, y verificación en vivo en el celular real del usuario (recibir el WhatsApp de verdad, capturar el código, confirmar que la cuenta se crea).

## Fuera de alcance

- No se toca el login existente (usuario/teléfono + contraseña) — sigue igual.
- No se agrega verificación de WhatsApp a cuentas ya existentes.
- No se implementa reenvío de código como botón aparte en esta primera versión — volver a enviar el formulario de registro ya genera un código nuevo (vía el `upsert`).
