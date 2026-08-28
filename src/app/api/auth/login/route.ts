import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";

// Serializa un usuario para responder, garantizando que NUNCA se expone el hash.
function toSafeUser(user: {
    password?: string | null;
    resetToken?: string | null;
    resetTokenExpiry?: Date | null;
    mpCustomerId?: string | null;
    [key: string]: unknown;
}) {
    const { password, resetToken, resetTokenExpiry, mpCustomerId, ...safe } = user;
    return safe;
}

function clientIp(request: Request): string {
    const fwd = request.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
    try {
        // Limpieza ocasional + rate-limit por IP (anti fuerza bruta).
        cleanupRateLimitBuckets();
        const ip = clientIp(request);
        const throttled = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000); // 5 intentos / 15 min
        if (!throttled.allowed) {
            return NextResponse.json(
                { error: `Demasiados intentos. Intenta en ${throttled.retryAfterSeconds}s.` },
                { status: 429 }
            );
        }

        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return NextResponse.json({ error: "El usuario y contraseña son requeridos" }, { status: 400 });
        }

        const cleanId = identifier.trim().toLowerCase();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: cleanId },
                    { email: cleanId },
                    { phone: cleanId }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        if (!user.password) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
        }

        // Firmar sesión y emitir una cookie HttpOnly.
        const token = await signSession({ id: user.id, role: user.role });
        const response = NextResponse.json(toSafeUser(user), { status: 200 });
        setSessionCookie(response, token);

        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Ocurrió un error al iniciar sesión" }, { status: 500 });
    }
}
