import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        cleanupRateLimitBuckets();
        const { identifier, code } = await req.json();

        if (!identifier || !code) {
            return NextResponse.json({ error: "Identificador y código son requeridos" }, { status: 400 });
        }

        // El código es de solo 6 dígitos (1 millón de combinaciones) y sin
        // límite de intentos se podía adivinar por fuerza bruta dentro de
        // los 15 minutos que dura vigente. Se limita por identificador (el
        // dato que de verdad protege) y por IP como segunda capa.
        const ip = clientIp(req);
        const cleanId = String(identifier).trim().toLowerCase();
        const throttledId = rateLimit(`forgot-pw-verify-id:${cleanId}`, 8, 15 * 60 * 1000);
        const throttledIp = rateLimit(`forgot-pw-verify-ip:${ip}`, 20, 15 * 60 * 1000);
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
            return NextResponse.json({ error: "Código inválido o usuario no encontrado." }, { status: 400 });
        }

        if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
            return NextResponse.json({ error: "El código ha expirado. Solicita uno nuevo." }, { status: 400 });
        }

        // Code is valid
        return NextResponse.json({ success: true, message: "Código verificado." });

    } catch (error) {
        console.error("Forgot password verify error", error);
        return NextResponse.json({ error: "Ocurrió un error al verificar el código." }, { status: 500 });
    }
}
