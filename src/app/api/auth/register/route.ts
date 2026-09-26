import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth, signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import type { Prisma, User } from "@prisma/client";
import {
    MAX_DIRECCION,
    MAX_EMAIL,
    MAX_IDENTIFICADOR,
    MAX_NOMBRE,
    MAX_PASSWORD,
    MAX_TELEFONO,
    MIN_PASSWORD,
    dentroDeLimite,
} from "@/lib/validators";

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
        // el User directo) -- el registro público no la pide.
        // El teléfono puede llegar como número desde un formulario interno: se
        // normaliza a texto aquí para que el resto del handler no reviente en un
        // .trim() (era un 500 feo en vez del error de validación que corresponde).
        const phoneTexto = typeof phone === "string" ? phone.trim() : String(phone).trim();
        const username = String(body.username || phoneTexto).trim().toLowerCase();
        const email = body.email;
        const address = body.address;

        if (!phone || !password || typeof password !== "string") {
            return NextResponse.json({ error: "El teléfono y contraseña son requeridos" }, { status: 400 });
        }

        // Techos de longitud y piso de contraseña ANTES de bcrypt y de la base.
        // Sin esto, una "contraseña" de 10 MB se hasheaba completa (DoS por CPU
        // regalado) y un nombre/dirección gigante entraba a Postgres tal cual.
        // El mínimo de 6 es el mismo que ya pedía el restablecimiento.
        if (
            !dentroDeLimite(phoneTexto, MAX_TELEFONO) ||
            !dentroDeLimite(password, MAX_PASSWORD) ||
            !dentroDeLimite(name, MAX_NOMBRE) ||
            !dentroDeLimite(email, MAX_EMAIL) ||
            !dentroDeLimite(address, MAX_DIRECCION) ||
            !dentroDeLimite(username, MAX_IDENTIFICADOR)
        ) {
            return NextResponse.json({ error: "Alguno de los datos excede la longitud permitida" }, { status: 400 });
        }
        if (password.length < MIN_PASSWORD) {
            return NextResponse.json(
                { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` },
                { status: 400 }
            );
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
        if (phoneTexto) orConditions.push({ phone: phoneTexto });

        const existingUser = await prisma.user.findFirst({
            where: { OR: orConditions }
        });

        if (existingUser) {
            return NextResponse.json({ error: "El usuario, correo o teléfono ya están en uso" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Un ADMIN creando una cuenta para alguien más (p. ej. un
        // repartidor) no inicia sesión con esa cuenta -- solo la crea.
        if (createdByAdmin) {
            const newUser = await prisma.user.create({
                data: {
                    name,
                    username: cleanUser,
                    phone: phoneTexto || null,
                    email: cleanEmail || null,
                    address: address || null,
                    password: hashedPassword,
                    role: safeRole
                }
            });
            return NextResponse.json(toSafeUser(newUser), { status: 201 });
        }

        // Registro público: se crea la cuenta directo, sin verificación de
        // telefono por codigo/WhatsApp -- se quito (ver PendingRegistration
        // en el schema, que se quedo sin usar) porque en la practica
        // dependia de cuentas trial de Twilio/Meta con restricciones que
        // bloqueaban a clientes reales nuevos. El telefono se sigue usando
        // como identificador de login; la confirmacion de que es real pasa
        // en la primera entrega, cuando el repartidor lo contacta de verdad.
        const ip = clientIp(request);
        const throttledIp = rateLimit(`register-req-ip:${ip}`, 8, 15 * 60 * 1000);
        const throttledPhone = rateLimit(`register-req-phone:${phoneTexto}`, 3, 15 * 60 * 1000);
        if (!throttledIp.allowed || !throttledPhone.allowed) {
            const retry = Math.max(throttledIp.retryAfterSeconds || 0, throttledPhone.retryAfterSeconds || 0);
            return NextResponse.json({ error: `Demasiados intentos. Intenta en ${retry}s.` }, { status: 429 });
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                username: cleanUser,
                phone: phoneTexto,
                email: cleanEmail,
                password: hashedPassword,
                role: safeRole,
            },
        });

        const token = await signSession({ id: newUser.id, role: newUser.role });
        const response = NextResponse.json(toSafeUser(newUser), { status: 201 });
        setSessionCookie(response, token);
        return response;
    } catch (error) {
        // No se loguea el objeto de error completo -- un error de validación
        // de Prisma puede serializar los argumentos (p. ej. el hash de la
        // contraseña o el código de 6 dígitos del upsert/create) en el mensaje.
        console.error("Register error:", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Ocurrió un error al registrar. Intenta de nuevo." }, { status: 500 });
    }
}
