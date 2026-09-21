import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { variantesIdentificador } from "@/lib/telefono";

// Serializa un usuario para responder, garantizando que NUNCA se expone el hash
// ni los ids internos de la pasarela de pagos (no son secretos, pero tampoco
// hace falta que el cliente los vea).
function toSafeUser(user: {
    password?: string | null;
    resetToken?: string | null;
    resetTokenExpiry?: Date | null;
    stripeCustomerId?: string | null;
    [key: string]: unknown;
}) {
    const { password, resetToken, resetTokenExpiry, stripeCustomerId, ...safe } = user;
    return safe;
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

        const variantes = variantesIdentificador(identifier);

        // El teléfono se guarda como cada quien lo escribió, así que se buscan todas las
        // formas equivalentes. Y no se asume una sola cuenta: puede haber varias para el
        // mismo número con distinto formato (pasó de verdad: "6131114801" y
        // "613-111-4801"), por eso se traen los candidatos y la contraseña decide cuál es.
        const candidatos = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { in: variantes } },
                    { email: { in: variantes } },
                    { phone: { in: variantes } }
                ]
            }
        });

        let user: (typeof candidatos)[number] | null = null;
        for (const candidato of candidatos) {
            if (!candidato.password) continue;
            if (await bcrypt.compare(password, candidato.password)) {
                user = candidato;
                break;
            }
        }

        // Un solo mensaje para "no existe", "sin contraseña" y "contraseña mal": no se
        // filtra al exterior cuáles cuentas existen (antes ya era así).
        if (!user) {
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
