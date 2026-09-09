// logger.ts — Logger estructurado para producción.
// En desarrollo: salida legible en consola.
// En producción: JSON estructurado compatible con Vercel Log Drains / Axiom /
// cualquier agregador de logs. Para agregar Sentry, descomentar las líneas
// de Sentry.captureException e instalar @sentry/nextjs.

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    context: string;
    message: string;
    ts: number;
    [key: string]: unknown;
}

function emit(entry: LogEntry): void {
    if (process.env.NODE_ENV === "production") {
        // JSON en una sola línea — fácil de parsear por cualquier agregador.
        console.error(JSON.stringify(entry));
    } else {
        const prefix = entry.level === "error" ? "X" : entry.level === "warn" ? "!" : "i";
        console[entry.level](`${prefix} [${entry.context}] ${entry.message}`);
    }
}

/** Registra un error con contexto. Apto para API Route Handlers. */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
    const message = error instanceof Error ? error.message : String(error);
    emit({ level: "error", context, message, ts: Date.now(), ...extra });
    // Para integrar Sentry (descomentar cuando @sentry/nextjs este instalado):
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.captureException(error, { tags: { context }, extra });
}

/** Registra una advertencia no critica. */
export function logWarn(context: string, message: string, extra?: Record<string, unknown>): void {
    emit({ level: "warn", context, message, ts: Date.now(), ...extra });
}

/** Registra un evento de informacion relevante (ej. orden creada, pago aprobado). */
export function logInfo(context: string, message: string, extra?: Record<string, unknown>): void {
    emit({ level: "info", context, message, ts: Date.now(), ...extra });
}
