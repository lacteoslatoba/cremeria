import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie, requireAuth } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { sendWhatsAppCode } from "@/lib/notify";
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
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "Ocurrió un error al registrar. Intenta de nuevo." }, { status: 500 });
    }
}
