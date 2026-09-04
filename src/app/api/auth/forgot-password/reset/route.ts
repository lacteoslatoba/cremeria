import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        cleanupRateLimitBuckets();
        const { identifier, code, newPassword } = await req.json();

        if (!identifier || !code || !newPassword) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }
        if (typeof newPassword !== "string" || newPassword.length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
        }

        // Misma protección que /verify -- este endpoint es el que de verdad
        // cambia la contraseña, así que igual de crítico frenar fuerza bruta
        // del código de 6 dígitos aquí.
        const ip = clientIp(req);
        const cleanId = String(identifier).trim().toLowerCase();
        const throttledId = rateLimit(`forgot-pw-reset-id:${cleanId}`, 8, 15 * 60 * 1000);
        const throttledIp = rateLimit(`forgot-pw-reset-ip:${ip}`, 20, 15 * 60 * 1000);
        if (!throttledId.allowed || !throttledIp.allowed) {
            const retry = Math.max(throttledId.retryAfterSeconds || 0, throttledIp.retryAfterSeconds || 0);
            return NextResponse.json({ error: `Demasiados intentos. Intenta en ${retry}s.` }, { status: 429 });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier },
                    { username: identifier }
                ],
                resetToken: code
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Código inválido o sesión expirada." }, { status: 400 });
        }

        if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
            return NextResponse.json({ error: "El código ha expirado." }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user, clear the token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return NextResponse.json({ success: true, message: "Contraseña actualizada exitosamente." });

    } catch (error) {
        console.error("Forgot password reset error", error);
        return NextResponse.json({ error: "Ocurrió un error al restablecer la contraseña." }, { status: 500 });
    }
}
