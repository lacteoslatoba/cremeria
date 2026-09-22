import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { sendWhatsAppCode, whatsappProviderConfigured } from "@/lib/notify";
import type { Prisma, User } from "@prisma/client";

// Serializa un usuario para responder, garantizando que NUNCA se expone el
// hash ni el id interno del cliente de Stripe.
function toSafeUser(user: User) {
    const { password, resetToken, resetTokenExpiry, stripeCustomerId, ...safe } = user;
    return safe;
}

export async function POST(request: Request) {
    try {
        cleanupRateLimitBuckets();
        const body = await request.json();
        const { name, phone, password, role } = body;
        // El registro público ya no pide usuario/correo/dirección por
        // separado -- el teléfono es el identificador de inicio de sesión
        // (login ya hace match contra username/email/phone, así que basta
        // con guardar el teléfono ahí también como "username" interno).
        // Se aceptan username/email/address si vienen (p. ej. un admin
        // creando una cuenta con más detalle desde otro flujo) pero ya no
        // son obligatorios para el registro público del cliente.
        // OJO: `address` solo se usa en el path de ADMIN (abajo, al crear
        // el User directo). En el path público con OTP se ignora en
        // silencio -- PendingRegistration no tiene columna `address` y las
        // cuentas creadas por ese flujo no piden dirección al registrarse.
        const username = body.username || phone;
        const email = body.email;
        const address = body.address;

        if (!phone || !password) {
            return NextResponse.json({ error: "El teléfono y contraseña son requeridos" }, { status: 400 });
        }

        // Registro público (sin sesión): SIEMPRE CUSTOMER. Solo un ADMIN ya
        // autenticado puede pedir un rol elevado (p. ej. el admin dando de
        // alta un repartidor desde /admin/deliveries) — así se cierra el
        // hueco de que cualquiera se cree una cuenta ADMIN/DELIVERY, sin
        // romper la función legítima de admin de crear repartidores.
        let safeRole = "CUSTOMER";
        let createdByAdmin = false;
        if (role === "DELIVERY" || role === "ADMIN") {
            const auth = await requireAuth(request, ["ADMIN"]);
            if (!auth.user) return auth.response;
            safeRole = role;
            createdByAdmin = true;
        }

        const cleanUser = username.trim().toLowerCase();
        const cleanEmail = email ? email.trim().toLowerCase() : null;

        // Check if user exists
        const orConditions: Prisma.UserWhereInput[] = [
            { username: cleanUser }
        ];

        if (cleanEmail) orConditions.push({ email: cleanEmail });
        if (phone) orConditions.push({ phone: phone });

        const existingUser = await prisma.user.findFirst({
            where: { OR: orConditions }
        });

        if (existingUser) {
            return NextResponse.json({ error: "El usuario, correo o teléfono ya están en uso" }, { status: 400 });
        }

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
        // código de 6 dígitos por SMS y solo se guarda la cuenta
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

        // Por WhatsApp, no SMS: el codigo de registro publico antes usaba
        // sendSms (Twilio SMS, cuenta trial -- solo entrega a numeros que tu
        // mismo verificaste a mano, error 21608 para cualquier cliente
        // nuevo real). sendWhatsAppCode ya elige el proveedor configurado
        // (WHATSAPP_PROVIDER: meta o twilio) y Meta no tiene esa limitante
        // de cuenta trial.
        const sent = await sendWhatsAppCode(phone, code);

        // Que falle el proveedor de mensajes NO puede tumbar el registro: ya
        // pasó dos veces (cupo diario de Twilio agotado, error 63038) y dejó a
        // TODOS los clientes sin poder crear cuenta. Por defecto se sigue
        // adelante y el código se devuelve para que la pantalla lo muestre.
        // Con OTP_ESTRICTO=true se conserva el 502 de antes, para quien prefiera
        // bloquear el registro antes que relajar la verificación.
        if (!sent && process.env.OTP_ESTRICTO === "true" && (whatsappProviderConfigured() || process.env.NODE_ENV === "production")) {
            return NextResponse.json(
                { error: "No pudimos enviar el código. Intenta de nuevo." },
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
            // entregado=false va explícito para que la pantalla avise y muestre
            // el código: sin eso el cliente se queda esperando un SMS que nunca
            // va a llegar y no puede terminar de registrarse.
            entregado: sent,
            _dev_code: sent ? undefined : code,
        });
    } catch (error) {
        // No se loguea el objeto de error completo -- un error de validación
        // de Prisma puede serializar los argumentos (p. ej. el hash de la
        // contraseña o el código de 6 dígitos del upsert/create) en el mensaje.
        console.error("Register error:", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Ocurrió un error al registrar. Intenta de nuevo." }, { status: 500 });
    }
}
