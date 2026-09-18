# Verificación por código de WhatsApp al registrarse — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al registrarse, la cuenta nueva no se guarda hasta que la persona ingresa un código de 6 dígitos enviado por WhatsApp a su teléfono.

**Architecture:** El registro público pasa a un flujo de dos pasos: `POST /api/auth/register` ya no crea el `User` directamente — genera un código, lo guarda en una tabla temporal nueva (`PendingRegistration`) y lo manda por WhatsApp vía Twilio. Un nuevo endpoint `POST /api/auth/register/verify` valida el código y, solo entonces, crea el `User` real e inicia sesión. El registro de cuentas ADMIN/DELIVERY hecho por un admin ya autenticado (p. ej. dar de alta un repartidor) NO pasa por este flujo — sigue creando la cuenta al instante, porque quien la crea no es el dueño del teléfono.

**Tech Stack:** Next.js (App Router) API routes, Prisma/Postgres, Twilio SDK (WhatsApp), bcryptjs, jose (JWT de sesión). Sin framework de pruebas automatizadas en el repo — verificación manual (typecheck + pruebas contra el servidor local + prueba en vivo con WhatsApp real).

**Spec:** `docs/superpowers/specs/2026-09-18-whatsapp-otp-registration-design.md`

## Global Constraints

- El registro sigue pidiendo los mismos campos que hoy: nombre, teléfono, contraseña (email/dirección opcionales). No se quita la contraseña.
- El código es de 6 dígitos, expira en 10 minutos, máximo 5 intentos.
- Rate limiting con `rateLimit()` de `src/lib/rate-limit.ts` (mismo patrón que `forgot-password`): por IP y por teléfono, en ambos endpoints.
- Mensajes de error genéricos ("Código incorrecto o expiró") sin distinguir causa.
- El flujo de admin creando cuentas DELIVERY/ADMIN no cambia — sigue creando el `User` de inmediato, sin OTP.
- Sin framework de pruebas: cada tarea se verifica con `npx tsc --noEmit` y, cuando aplica, una prueba manual contra el servidor local (`npm run dev`) con `curl` o un script temporal — igual que el resto de los cambios de esta sesión.

---

## Task 1: Modelo `PendingRegistration` en Prisma

**Files:**
- Modify: `prisma/schema.prisma:41` (justo después de cerrar el modelo `User`)

**Interfaces:**
- Produces: modelo Prisma `PendingRegistration` con campos `id, phone (unique), name, username, email, password, code, codeExpiry, attempts, createdAt` — usado por las Tasks 3 y 4 vía `prisma.pendingRegistration`.

- [ ] **Step 1: Agregar el modelo al schema**

Insertar después de la línea 41 (cierre de `model User`):

```prisma
// Registro pendiente de verificación por WhatsApp: se crea al llenar el
// formulario de registro y se borra al verificar el código (o queda
// huérfano y expira solo -- no se crea el User real hasta verificar).
model PendingRegistration {
  id         String   @id @default(cuid())
  phone      String   @unique
  name       String?
  username   String?
  email      String?
  password   String
  code       String
  codeExpiry DateTime
  attempts   Int      @default(0)
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 2: Aplicar el cambio a la base de datos**

Run: `npm run db:push`
Expected: confirma que agregó la tabla `PendingRegistration` sin advertencias de pérdida de datos.

- [ ] **Step 3: Verificar que el cliente de Prisma reconoce el modelo nuevo**

Run: `npx tsc --noEmit`
Expected: sin errores (confirma que `prisma generate` corrió como parte de `db:push` y los tipos están disponibles).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: agrega modelo PendingRegistration para OTP de registro por WhatsApp"
```

---

## Task 2: Envío de código por WhatsApp en `notify.ts`

**Files:**
- Modify: `src/lib/notify.ts` (agregar función nueva después de `sendSms`, línea 34)

**Interfaces:**
- Consumes: `formatMxPhone()` (ya existe en el mismo archivo, línea 5).
- Produces: `sendWhatsAppCode(phone: string, code: string): Promise<boolean>` — usado por la Task 3.

- [ ] **Step 1: Agregar `sendWhatsAppCode`**

Insertar después de la línea 34 (cierre de `sendSms`):

```ts
// Mismo patrón que sendSms pero por WhatsApp -- usa las credenciales de
// Twilio ya configuradas más un remitente de WhatsApp aparte
// (TWILIO_WHATSAPP_NUMBER, sin el prefijo "whatsapp:", p. ej. el número
// del sandbox de Twilio mientras se aprueba el número de WhatsApp
// Business para producción).
export async function sendWhatsAppCode(phone: string, code: string): Promise<boolean> {
    if (!phone) return false;
    const body = `Cremeria del Rancho: tu codigo de verificacion es ${code}. Expira en 10 minutos.`;

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio");
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${formatMxPhone(phone)}`,
            });
            return true;
        } catch (err) {
            console.error("[WHATSAPP ERROR]", err);
            return false;
        }
    }

    console.log(`[SIMULATED WHATSAPP] to ${phone}: ${body}`);
    return false;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notify.ts
git commit -m "feat: agrega sendWhatsAppCode para enviar codigos de verificacion por WhatsApp"
```

---

## Task 3: `POST /api/auth/register` genera el código en vez de crear la cuenta

**Files:**
- Modify: `src/app/api/auth/register/route.ts` (reemplaza el bloque desde la línea 33 `let safeRole` hasta el final del `try`, línea 91)

**Interfaces:**
- Consumes: `sendWhatsAppCode(phone, code)` de `src/lib/notify.ts` (Task 2); `rateLimit, cleanupRateLimitBuckets, clientIp` de `src/lib/rate-limit.ts`; `prisma.pendingRegistration`.
- Produces: respuesta `{ ok: true, phone: string, _dev_code?: string }` (200) para el registro público en vez de `toSafeUser(newUser)` con cookie — usado por la Task 5 (frontend). El registro hecho por un ADMIN (`createdByAdmin`) sigue devolviendo `toSafeUser(newUser)` (201) igual que hoy, sin cambios de contrato.

- [ ] **Step 1: Reemplazar el bloque de creación de cuenta**

Reemplazar desde `const hashedPassword = await bcrypt.hash(password, 10);` (línea 66) hasta el `return response;` (línea 91) por:

```ts
        const hashedPassword = await bcrypt.hash(password, 10);

        // Un ADMIN creando una cuenta para alguien más (p. ej. un
        // repartidor) no pasa por verificación de WhatsApp -- el admin es
        // quien da de alta la cuenta, no el dueño del teléfono.
        if (createdByAdmin) {
            const newUser = await prisma.user.create({
                data: {
                    name,
                    username: cleanUser,
                    phone: phone || null,
                    email: cleanEmail || null,
                    address: address || null,
                    password: hashedPassword,
                    role: safeRole
                }
            });
            return NextResponse.json(toSafeUser(newUser), { status: 201 });
        }

        // Registro público: todavía no se crea el User -- se manda un
        // código de 6 dígitos por WhatsApp y solo se guarda la cuenta
        // cuando se verifica (ver /api/auth/register/verify/route.ts).
        const ip = clientIp(request);
        const throttledIp = rateLimit(`register-req-ip:${ip}`, 8, 15 * 60 * 1000);
        const throttledPhone = rateLimit(`register-req-phone:${phone}`, 3, 15 * 60 * 1000);
        if (!throttledIp.allowed || !throttledPhone.allowed) {
            const retry = Math.max(throttledIp.retryAfterSeconds || 0, throttledPhone.retryAfterSeconds || 0);
            return NextResponse.json({ error: `Demasiados intentos. Intenta en ${retry}s.` }, { status: 429 });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpiry = new Date(Date.now() + 10 * 60 * 1000);

        const sent = await sendWhatsAppCode(phone, code);
        const twilioWhatsAppConfigured = !!(
            process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER
        );

        // Si Twilio SÍ está configurado pero el envío real falló, no se
        // guarda el registro pendiente -- se le pide reintentar en vez de
        // dejarlo esperando un código que nunca va a llegar.
        if (twilioWhatsAppConfigured && !sent) {
            return NextResponse.json(
                { error: "No pudimos enviar el código por WhatsApp. Intenta de nuevo." },
                { status: 502 }
            );
        }

        await prisma.pendingRegistration.upsert({
            where: { phone },
            create: { phone, name, username: cleanUser, email: cleanEmail, password: hashedPassword, code, codeExpiry, attempts: 0 },
            update: { name, username: cleanUser, email: cleanEmail, password: hashedPassword, code, codeExpiry, attempts: 0 },
        });

        return NextResponse.json({
            ok: true,
            phone,
            // Solo fuera de producción, y solo si de verdad no se pudo
            // enviar por WhatsApp (p. ej. Twilio sin configurar en local).
            _dev_code: process.env.NODE_ENV === "production" ? undefined : (sent ? undefined : code),
        });
```

Agregar los imports nuevos al inicio del archivo (junto a los existentes, línea 1-5):

```ts
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { sendWhatsAppCode } from "@/lib/notify";
```

Y agregar `cleanupRateLimitBuckets();` como primera línea dentro del `try` (después de la línea 15), igual que en `forgot-password/request/route.ts`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Prueba manual contra el servidor local**

Run: `npm run dev` (en una terminal aparte), luego:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Prueba Uno","phone":"555-000-0001","password":"clave1234"}'
```

Expected: JSON `{"ok":true,"phone":"555-000-0001","_dev_code":"123456"}` (6 dígitos reales, ya que sin `TWILIO_WHATSAPP_NUMBER` en `.env.local` cae al modo simulado). En la terminal del `npm run dev` debe aparecer la línea `[SIMULATED WHATSAPP] to 555-000-0001: ...`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: el registro publico manda codigo por WhatsApp en vez de crear la cuenta directo"
```

---

## Task 4: `POST /api/auth/register/verify` crea la cuenta al validar el código

**Files:**
- Create: `src/app/api/auth/register/verify/route.ts`

**Interfaces:**
- Consumes: `prisma.pendingRegistration`, `prisma.user.create`, `signSession`/`setSessionCookie` de `src/lib/auth.ts`, `rateLimit`/`cleanupRateLimitBuckets`/`clientIp` de `src/lib/rate-limit.ts`.
- Produces: `POST /api/auth/register/verify` con body `{ phone: string, code: string }` → `toSafeUser(newUser)` (201) + cookie de sesión en éxito, o `{ error: string }` (400/429/500) en fallo — usado por la Task 5 (frontend).

- [ ] **Step 1: Crear el archivo**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import type { User } from "@prisma/client";

function toSafeUser(user: User) {
    const { password, resetToken, resetTokenExpiry, stripeCustomerId, ...safe } = user;
    return safe;
}

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
    try {
        cleanupRateLimitBuckets();
        const { phone, code } = await request.json();

        if (!phone || !code) {
            return NextResponse.json({ error: "Teléfono y código son requeridos" }, { status: 400 });
        }

        // El código es de solo 6 dígitos -- se limita por teléfono (lo que
        // de verdad protege) y por IP como segunda capa, igual que el
        // flujo de "olvidé mi contraseña".
        const ip = clientIp(request);
        const throttledPhone = rateLimit(`register-verify-phone:${phone}`, 8, 15 * 60 * 1000);
        const throttledIp = rateLimit(`register-verify-ip:${ip}`, 20, 15 * 60 * 1000);
        if (!throttledPhone.allowed || !throttledIp.allowed) {
            const retry = Math.max(throttledPhone.retryAfterSeconds || 0, throttledIp.retryAfterSeconds || 0);
            return NextResponse.json({ error: `Demasiados intentos. Intenta en ${retry}s.` }, { status: 429 });
        }

        const pending = await prisma.pendingRegistration.findUnique({ where: { phone } });

        if (!pending || pending.attempts >= MAX_ATTEMPTS || pending.codeExpiry < new Date()) {
            return NextResponse.json({ error: "Código incorrecto o expiró" }, { status: 400 });
        }

        if (pending.code !== code) {
            await prisma.pendingRegistration.update({
                where: { phone },
                data: { attempts: { increment: 1 } },
            });
            return NextResponse.json({ error: "Código incorrecto o expiró" }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: {
                name: pending.name,
                username: pending.username,
                phone: pending.phone,
                email: pending.email,
                password: pending.password,
                role: "CUSTOMER",
            },
        });

        await prisma.pendingRegistration.delete({ where: { phone } });

        const response = NextResponse.json(toSafeUser(newUser), { status: 201 });
        const token = await signSession({ id: newUser.id, role: newUser.role });
        setSessionCookie(response, token);
        return response;
    } catch (error) {
        console.error("Register verify error:", error);
        return NextResponse.json({ error: "Ocurrió un error al verificar el código." }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Prueba manual contra el servidor local (con `npm run dev` corriendo)**

Usando el `_dev_code` que devolvió la Task 3 Step 3 (mismo teléfono `555-000-0001`):

```bash
curl -X POST http://localhost:3000/api/auth/register/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"555-000-0001","code":"123456"}'
```

Expected: JSON con los datos del usuario (`id`, `name`, `phone`, `role: "CUSTOMER"`, etc., sin `password`) y status 201. Probar también con un código incorrecto (`"code":"000000"`) → debe responder 400 `{"error":"Código incorrecto o expiró"}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/register/verify/route.ts
git commit -m "feat: nuevo endpoint para verificar el codigo de WhatsApp y crear la cuenta"
```

---

## Task 5: Frontend — paso de captura del código en el registro

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/register` (ya no crea sesión, responde `{ok, phone}`), `POST /api/auth/register/verify` (Task 4, crea sesión y responde el usuario) — llamado por el nuevo `handleVerifyCode`.

- [ ] **Step 1: Agregar estado nuevo**

Junto a las demás variables de registro (después de la línea 25, `const [showRegConfirmPassword...`):

```ts
    const [regStep, setRegStep] = useState<"form" | "code">("form");
    const [regCode, setRegCode] = useState("");
```

- [ ] **Step 2: Cambiar `handleRegister` para pasar al paso de código en vez de iniciar sesión**

Reemplazar el bloque desde `const data = await res.json();` (línea 103) hasta `setUser(data); router.push("/");` (líneas 111-112) por:

```ts
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al registrarse");
                return;
            }

            // La cuenta todavía no se guardó -- falta capturar el código
            // que se mandó por WhatsApp.
            setRegStep("code");
```

- [ ] **Step 3: Agregar `handleVerifyCode`**

Justo después del cierre de `handleRegister` (después de la línea 118, `};`):

```ts
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: regPhone, code: regCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al verificar el código");
                return;
            }

            setUser(data);
            router.push("/");
        } catch (err) {
            setError("Ocurrió un error inesperado al conectar.");
        } finally {
            setLoading(false);
        }
    };
```

- [ ] **Step 4: Renderizar el paso de código**

Envolver el `<form onSubmit={handleRegister}>` existente (línea 227) para que solo se muestre cuando `regStep === "form"`, y agregar un nuevo bloque para `regStep === "code"` justo después de su cierre (`</form>` que cierra el registro, línea 320 aproximadamente, antes del cierre del bloque `) : (` del ternario `isRegistering`):

```tsx
                        ) : regStep === "form" ? (
                            <form onSubmit={handleRegister} className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                                {/* ...contenido existente del formulario de registro sin cambios... */}
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <h2 className="text-xl font-bold text-[#2d2a28] mb-2 text-center">Verifica tu WhatsApp</h2>
                                <p className="text-sm text-gray-500 text-center -mt-2">
                                    Te enviamos un código al {regPhone} por WhatsApp
                                </p>

                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-[#2d2a28] pl-1 uppercase tracking-wider">Código de 6 dígitos</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        maxLength={6}
                                        placeholder="123456"
                                        value={regCode}
                                        onChange={(e) => setRegCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-[#2d2a28] placeholder:text-gray-400 font-medium text-center text-2xl tracking-[0.5em]"
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 font-medium text-sm p-3 rounded-lg text-center border border-red-200 backdrop-blur-md">
                                        {error}
                                    </div>
                                )}

                                <button type="submit" disabled={loading} className="relative group w-full cursor-pointer items-center justify-center rounded-xl h-14 px-8 flex bg-primary text-white text-base font-bold leading-normal tracking-wide shadow-xl shadow-primary/30 transition-all active:scale-[0.98] mt-2">
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : "VERIFICAR"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setRegStep("form"); setRegCode(""); setError(""); }}
                                    className="text-sm text-primary hover:text-primary-hover font-bold transition-colors underline decoration-2 underline-offset-4 text-center"
                                >
                                    Volver
                                </button>
                            </form>
                        )}
```

Nota para quien ejecute esta tarea: la estructura exacta del ternario que envuelve login/registro depende de cómo esté escrito el JSX en el momento de implementar (puede haber cambiado por trabajo concurrente de otra sesión sobre este mismo archivo) — leer `src/app/login/page.tsx` completo antes de este Step para ubicar el `isRegistering ? (...) : (...)` real y anidar el nuevo caso `regStep === "code"` dentro de la rama de registro, sin tocar la rama de login.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: agrega paso de verificacion por codigo de WhatsApp al registrarse"
```

---

## Task 6: Configurar Twilio WhatsApp y verificar en el celular real

**Files:** ninguno (configuración externa + verificación en vivo, mismo patrón usado en el resto de esta sesión)

- [ ] **Step 1: Activar el sandbox de WhatsApp de Twilio**

En la consola de Twilio (twilio.com/console) → Messaging → Try it out → Send a WhatsApp message. Copiar el número del sandbox (formato `+14155238886`) y el código de unión (`join <palabra-clave>`). Desde el WhatsApp real del celular, mandar ese código de unión al número del sandbox — sin esto Twilio no entrega mensajes a ese número.

- [ ] **Step 2: Agregar la variable de entorno en Vercel**

En el dashboard de Vercel del proyecto → Settings → Environment Variables → agregar `TWILIO_WHATSAPP_NUMBER` con el número del sandbox (sin el prefijo `whatsapp:`, solo `+14155238886`). Aplicar a Production (y Preview si se usa).

- [ ] **Step 3: Deploy**

```bash
git push origin main
```

Esperar a que Vercel termine el deploy (`vercel ls --yes` / `vercel inspect <url>` hasta `● Ready`).

- [ ] **Step 4: Prueba en vivo en el celular real**

Abrir la app instalada en el celular, ir a "crea tu cuenta", registrar con el número de teléfono que se unió al sandbox en el Step 1. Confirmar que llega el mensaje de WhatsApp con el código, capturarlo en la pantalla nueva, confirmar que la cuenta se crea y queda con la sesión iniciada (redirige a la pantalla principal). Tomar captura de pantalla para verificar visualmente, igual que el resto de los cambios de esta sesión.

- [ ] **Step 5: Confirmar con el usuario**

Reportar el resultado de la prueba en vivo y preguntar si el sandbox es suficiente por ahora o si se debe iniciar el trámite de aprobación del número de WhatsApp Business de producción con Twilio (puede tardar varios días, lo gestiona el propio Twilio con Meta).
