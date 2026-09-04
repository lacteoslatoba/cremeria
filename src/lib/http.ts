import { NextResponse } from "next/server";

// ── Helpers HTTP compartidos para Route Handlers ──
// Centralizan los patrones que se repetían en cada endpoint (parseo de body,
// armado de errores) para lecturas más cortas y respuestas homogéneas y sin
// filtrar trazas.

/** Respuesta JSON estándar de error que NO filtra stack traces internos. */
export function error(message: string, status = 500): NextResponse {
    return NextResponse.json({ error: message }, { status });
}

/**
 * Extrae y valida que el body sea un objeto JSON, lanzando 400 limpio si el
 * cliente mandó algo malformado, en vez de dejar que `request.json()` reviente
 * en un 500 genérico.
 */
export async function parseJsonBody<T extends Record<string, unknown>>(
    request: Request
): Promise<T> {
    const raw = await request.text(); // text() falla igual si el stream ya se leyó, pero es la vía segura para vacíos
    if (!raw || !raw.trim()) {
        throw new HttpError("Cuerpo de petición vacío", 400);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new HttpError("JSON inválido en el cuerpo de la petición", 400);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new HttpError("El cuerpo debe ser un objeto JSON", 400);
    }
    return parsed as T;
}

/** Error con código de estado HTTP; los handlers lo traducen a respuesta. */
export class HttpError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

/**
 * Envuelve el cuerpo de un handler y convierte cooperaciones/fallos en
 * respuestas. Acá se decide qué se loguea (error real, sin trazas completas a
 * cliente) y se devuelve siempre una forma de error consistente.
 */
export async function handleRoute<T>(
    fn: () => Promise<T>,
    logContext = "api"
): Promise<NextResponse> {
    try {
        const result = await fn();
        if (result instanceof NextResponse) return result;
        return NextResponse.json(result as T);
    } catch (err) {
        if (err instanceof HttpError) {
            return error(err.message, err.status);
        }
        if (err instanceof Error && /JSON/i.test(err.message) === false) {
            // Error inesperado: se loguea la causa real en servidor (no al cliente)
            console.error(`[${logContext}]`, err && err.message ? err.message : err);
        } else {
            console.error(`[${logContext}]`, err);
        }
        return error("Error interno del servidor", 500);
    }
}
