// upstash.ts — Rate limiter distribuido con Upstash Redis (Sliding Window).
//
// POR QUE: el rate-limit.ts actual usa un Map en RAM, local a cada instancia
// serverless. Con Vercel desplegando multiples instancias en paralelo, cada
// una tiene su propio contador — un bot puede bypassear el limite simplemente
// alcanzando otra instancia. Upstash Redis es compartido por TODAS las
// instancias simultaneamente: el limite es global y real.
//
// SETUP (una sola vez en https://console.upstash.com):
//   1. Crear una base de datos Redis (Free tier = 10,000 req/dia gratis).
//   2. Copiar las credenciales REST a .env.local:
//      UPSTASH_REDIS_REST_URL=https://...upstash.io
//      UPSTASH_REDIS_REST_TOKEN=AX...
//
// SIN CREDENCIALES (desarrollo local): el modulo devuelve un limitador noop
// que siempre permite, sin lanzar errores, para no bloquear el dev local.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RatelimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<unknown>;
};

// Tipo mínimo que expone el limitador: lo que usa el middleware. Se exporta para
// que el middleware y los tests no tengan que conocer los tipos internos de
// @upstash/ratelimit (y para poder sustituirlo por un doble en pruebas).
export type MinimalRatelimit = {
    limit: (key: string) => Promise<RatelimitResult>;
};

function makeRatelimit(maxRequests: number, windowSeconds: number): MinimalRatelimit {
    // La integracion nativa de Vercel para Upstash (Marketplace: "Upstash for
    // Redis") carga las credenciales como KV_REST_API_URL/KV_REST_API_TOKEN
    // (prefijo heredado de Vercel KV), no como UPSTASH_REDIS_REST_URL/TOKEN
    // (el nombre que usa el SDK de Upstash y el resto de su documentacion).
    // Se aceptan ambos pares para no depender de como se haya provisionado.
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    // En dev sin credenciales: noop (siempre permite).
    if (!url || !token) {
        if (process.env.NODE_ENV === "production") {
            console.warn("[upstash] Faltan credenciales de Redis (UPSTASH_REDIS_REST_URL/TOKEN o KV_REST_API_URL/TOKEN) en produccion.");
        }
        return {
            limit: async (_key: string): Promise<RatelimitResult> => ({
                success: true,
                limit: maxRequests,
                remaining: maxRequests,
                reset: 0,
                pending: Promise.resolve(),
            }),
        };
    }

    return new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
        analytics: true,
        prefix: "cremeria_rl",
    });
}

/** Auth (login/register): 10 intentos por minuto por IP. */
export const authRatelimit = makeRatelimit(10, 60);

/**
 * Escrituras de autenticación (login, registro, recuperar contraseña): 5 por
 * minuto por IP.
 *
 * Por qué una cubeta más apretada que `authRatelimit`: estas rutas son las
 * únicas donde un atacante gana algo probando muchas veces (adivinar la
 * contraseña o el código de 6 dígitos). 10/min todavía deja ~14 mil intentos
 * al día por instancia; 5/min deja la fuerza bruta en un ruido inútil. Las
 * LECTURAS de sesión (`/api/auth/me`) NO usan esta cubeta: se piden en cada
 * carga de página y bloquearlas rompía la app (ver middleware.ts).
 */
export const authStrictRatelimit = makeRatelimit(5, 60);

/** Creacion de ordenes: 5 por minuto por IP (anti-spam de pedidos). */
export const ordersRatelimit = makeRatelimit(5, 60);

/** API generica: 120 requests por minuto por IP. */
export const apiRatelimit = makeRatelimit(120, 60);
