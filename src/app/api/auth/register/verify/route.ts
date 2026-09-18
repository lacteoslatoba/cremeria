import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
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

        // Crear el User y borrar el PendingRegistration en una sola
        // transacción -- si algo falla a medias (p. ej. un choque de
        // unique constraint porque el usuario/correo/teléfono ya se creó
        // en otro lado durante la ventana entre /register y /verify) no
        // queda un PendingRegistration huérfano ni un estado a medias.
        let newUser: User;
        try {
            newUser = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        name: pending.name,
                        username: pending.username,
                        phone: pending.phone,
                        email: pending.email,
                        password: pending.password,
                        role: "CUSTOMER",
                    },
                });
                await tx.pendingRegistration.delete({ where: { phone } });
                return created;
            });
        } catch (txError) {
            // Choque de unique constraint (username/email/phone) -- mismo
            // mensaje que ya usa /api/auth/register para el mismo caso.
            if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === "P2002") {
                return NextResponse.json({ error: "El usuario, correo o teléfono ya están en uso" }, { status: 400 });
            }
            throw txError;
        }

        const response = NextResponse.json(toSafeUser(newUser), { status: 201 });
        const token = await signSession({ id: newUser.id, role: newUser.role });
        setSessionCookie(response, token);
        return response;
    } catch (error) {
        // No se loguea el objeto de error completo -- podría incluir el
        // hash de la contraseña o el código de la PendingRegistration.
        console.error("Register verify error:", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Ocurrió un error al verificar el código." }, { status: 500 });
    }
}
