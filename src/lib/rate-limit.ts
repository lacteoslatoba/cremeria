// Rate-limit simple en memoria por clave (IP): N intentos por ventana de tiempo.
// Nota: en despliegues serverless multi-instancia este estado es por-instancia;
// sirve como primera línea de defensa local. Para escalar a producción robusta
// se recomienda usar un store externo (Redis/Upstash).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
    key: string,
    limit: number,
    windowMs: number
): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const entry = buckets.get(key);

    // Ventana expirada: reiniciar contador.
    if (!entry || entry.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    if (entry.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count += 1;
    return { allowed: true };
}

// Evita que el Map crezca sin límite: barre entradas expiradas ocasionalmente.
export function cleanupRateLimitBuckets(): void {
    const now = Date.now();
    for (const [key, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(key);
    }
}
