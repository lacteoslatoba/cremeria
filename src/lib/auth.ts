import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "cremeria_session";
const INSECURE_FALLBACK = "dev-insecure-secret-change-me";

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (secret) return new TextEncoder().encode(secret);
    // En producción jamás usamos un fallback inseguro: fallar explícito.
    if (process.env.NODE_ENV === "production") {
        throw new Error("Falta configurar JWT_SECRET (clave de firma de sesiones).");
    }
    return new TextEncoder().encode(INSECURE_FALLBACK);
}

export type SessionUser = {
    id: string;
    role: string;
};

// Firma un JWT de sesión con el payload del usuario.
export async function signSession(user: SessionUser): Promise<string> {
    return new SignJWT({ id: user.id, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(getSecret());
}

// Cookie config: HttpOnly + Secure (en prod) + SameSite=Lax.
// El tipo de retorno restringe a claves/tipos aceptados por response.cookies.set.
export function sessionCookieOptions(maxAgeSeconds: number): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
} {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSeconds,
    };
}

export function setSessionCookie(response: NextResponse, token: string): void {
    response.cookies.set(
        COOKIE_NAME,
        token,
        sessionCookieOptions(7 * 24 * 60 * 60)
    );
}

export function clearSessionCookie(response: NextResponse): void {
    response.cookies.set(COOKIE_NAME, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

// Lee y verifica el token de sesión desde la cookie de la request.
// Devuelve el payload ({ id, role }) o null si no hay/ es inválido.
export async function readSession(request: Request): Promise<SessionUser | null> {
    const cookie = request.headers.get("cookie");
    if (!cookie) return null;
    const match = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    const token = match.slice(COOKIE_NAME.length + 1);
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, getSecret());
        if (!payload.id || typeof payload.id !== "string") return null;
        return { id: payload.id, role: typeof payload.role === "string" ? payload.role : "CUSTOMER" };
    } catch {
        return null;
    }
}

// Carga el usuario completo (con rol) desde la BD para autorizaciones.
// Verifica que el rol en el token no haya sido escalado por el cliente.
export async function loadAuthUser(session: SessionUser | null) {
    if (!session) return null;
    try {
        const user = await prisma.user.findUnique({
            where: { id: session.id },
            select: { id: true, role: true },
        });
        if (!user) return null;
        // Confiamos en el rol de la BD, no en el token, para no permitir escalaciones.
        return { id: user.id, role: user.role };
    } catch {
        return null;
    }
}

// Helper para Route Handlers: exige sesión válida y opcionalmente un rol.
// Si falla, devuelve { user: null, response } para retornar directamente.
// Si pasa, devuelve { user } con el usuario verificado desde BD.
export async function requireAuth(
    request: Request,
    allowedRoles?: string[]
): Promise<{ user: { id: string; role: string } } | { user: null; response: NextResponse }> {
    const session = await readSession(request);
    const user = await loadAuthUser(session);

    if (!user) {
        return { user: null, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return {
            user: null,
            response: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
        };
    }

    return { user };
}

// Devuelve el nombre de la cookie (para tests/uso externo).
export function getCookieName(): string {
    return COOKIE_NAME;
}
