// proxy.ts — Proxy de Next.js 16 (antes "middleware") para rate limiting
// distribuido y frenos anti-CSRF.
//
// OJO con el nombre: en Next 16 `middleware.ts` esta deprecado y el archivo se
// llama `proxy.ts`, con la funcion exportada como `proxy` (o default). El
// comportamiento NO cambio -- solo el nombre -- y se migro acompañado de las
// pruebas e2e que ejercitan justo este archivo (429 del rate limit, 403 del
// chequeo de origen, `no-store`), para no cambiarlo "a ciegas".
//
// Se ejecuta en el Edge Runtime (ANTES del Route Handler), lo que significa
// que las peticiones bloqueadas no llegan ni a la funcion serverless ni a la
// base de datos — ahorrando conexiones, compute y tiempo de respuesta.
//
// Qué aplica:
//   1. Rate limit por IP (Upstash, ver src/lib/upstash.ts):
//      POST /api/auth/login|register|forgot-password/*  → authStrictRatelimit (5 req/min)
//      resto de /api/auth/*  (menos /api/auth/me)       → authRatelimit        (10 req/min)
//      POST /api/orders                                 → ordersRatelimit      (5 req/min)
//      TODA otra /api/* (products, users, driver, business, payments...)
//                                                       → apiRatelimit         (120 req/min)
//      El webhook de Stripe se salta el limite: lo llaman sus servidores y ya
//      va firmado; limitarlo por IP solo arriesga perder un pago real.
//   2. Chequeo de origen en mutaciones (POST/PUT/PATCH/DELETE): si el navegador
//      manda un `Origin` que no es el de la app, se responde 403. Defensa en
//      profundidad contra CSRF (la cookie ya es SameSite=Lax; esto cubre
//      navegadores viejos o proxys que reescriban cookies).
//   3. `Cache-Control: no-store` en /api/auth/*: una respuesta con datos de
//      sesión NUNCA debe quedar en caché intermedia.
//
// El bloqueo devuelve 429 con header Retry-After para que el cliente sepa
// cuantos segundos esperar antes de reintentar.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRatelimit, authRatelimit, authStrictRatelimit, ordersRatelimit, type MinimalRatelimit } from "@/lib/upstash";

// Rutas que se saltan los frenos de IP y de origen. El webhook de Stripe las
// necesita: viene servidor-a-servidor (sin Origin de navegador) y una rafaga de
// reintentos de Stripe no debe terminar en 429, porque eso seria un pago sin
// reconciliar. Su autenticidad ya se valida con la firma del webhook.
const RUTAS_EXENTAS = ["/api/payments/stripe/webhook"];

// Escrituras de autenticacion: aqui SI conviene apretar (ver authStrictRatelimit).
const AUTH_ESTRICTAS = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password/request",
    "/api/auth/forgot-password/verify",
    "/api/auth/forgot-password/reset",
]);

const METODOS_QUE_CAMBIAN = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// En desarrollo la app se sirve a la vez como localhost y como 127.0.0.1 (el
// simulador y los scripts de prueba alternan), asi que esos se consideran el
// mismo origen. En produccion solo cuenta el host real.
const EQUIVALENTES_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Host de la peticion, sin puerto. `x-forwarded-host` manda detras de Vercel. */
function hostPropio(request: NextRequest): string {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
    return host.split(":")[0].trim().toLowerCase();
}

/**
 * true si la peticion viene del propio sitio.
 *
 * Sin header `Origin` se permite: los clientes que no son navegador (curl,
 * scripts, servidor a servidor, la app nativa instalada) no lo mandan, y
 * bloquearlos no aporta seguridad — para esos casos la proteccion real es la
 * cookie HttpOnly + la firma del webhook.
 */
function mismoOrigen(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return true;

    let hostOrigen: string;
    try {
        hostOrigen = new URL(origin).hostname.trim().toLowerCase();
    } catch {
        return false; // Origin ilegible = no es un navegador legitimo
    }

    const hostActual = hostPropio(request);
    if (hostOrigen === hostActual) return true;

    if (process.env.NODE_ENV === "production") return false;
    return EQUIVALENTES_LOCALES.has(hostOrigen) && EQUIVALENTES_LOCALES.has(hostActual);
}

function jsonError(mensaje: string, status: number, extraHeaders: Record<string, string> = {}): NextResponse {
    return NextResponse.json({ error: mensaje }, { status, headers: extraHeaders });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    const esProduccion = process.env.NODE_ENV === "production";

    // ── 2. Anti-CSRF por origen (primero: no gasta cuota de Redis) ──
    if (METODOS_QUE_CAMBIAN.has(request.method) && !RUTAS_EXENTAS.includes(pathname) && !mismoOrigen(request)) {
        return jsonError("Origen no permitido", 403);
    }

    // IP real: Vercel la envia en x-forwarded-for; fallback para dev local.
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "127.0.0.1";

    // ── 1. Selecciona el limitador segun la ruta Y el metodo ──
    //
    // /api/auth/me es una LECTURA de la sesion que el AuthGuard hace en CADA
    // carga de pagina. Metido en el cubo estricto de /api/auth (10/min por IP)
    // un usuario normal -- o cualquiera probando la app y navegando rapido --
    // llegaba al 429 en la pagina 11 y a partir de ahi las pantallas fallaban
    // ("Algo salio mal" en /login, nav sin sesion) sin ninguna razon real.
    // Medido el 23/09/2026 con 14 GET seguidos: 200 hasta el 10, 429 desde el
    // 11. Su propio cubo (`me:<ip>`) la saca del limite de fuerza bruta sin
    // dejarla sin freno.
    const esLecturaDeSesion = pathname === "/api/auth/me";
    const esAuth = pathname.startsWith("/api/auth");

    let limiter: MinimalRatelimit | null = null;

    if (RUTAS_EXENTAS.includes(pathname)) {
        limiter = null;
    } else if (esAuth && !esLecturaDeSesion && METODOS_QUE_CAMBIAN.has(request.method) && AUTH_ESTRICTAS.has(pathname)) {
        // Fuerza bruta de contrasena / codigo de 6 digitos: 5/min por IP.
        limiter = authStrictRatelimit;
    } else if (esAuth && !esLecturaDeSesion) {
        limiter = authRatelimit;
    } else if (pathname === "/api/orders" && request.method === "POST") {
        // El limite estricto de /api/orders es solo para CREAR pedidos (anti-spam).
        // Antes aplicaba a TODO /api/orders/*, incluidas las lecturas: /tracking
        // hace polling cada 3s (20 req/min) contra GET /api/orders/[orderId], asi
        // que la cubeta de 5 req/min se agotaba en ~15s -- el mapa se congelaba en
        // silencio (el fetch ignora los no-ok) y, si el primer fetch ya llegaba
        // rate-limited, el cliente veia "Orden no encontrada". Ademas esa misma
        // cubeta la compartian las escrituras (crear pedido, cambiar estado,
        // asignar repartidor, borrar), asi que un cliente con el seguimiento
        // abierto podia quedar bloqueado para crear otro pedido.
        limiter = ordersRatelimit;
    } else {
        // Base para TODA /api/*: antes solo /api/auth/* y /api/orders/* tenian
        // freno, y rutas como /api/users, /api/products, /api/business o
        // /api/driver/* se podian martillar sin limite (fuerza bruta de ids,
        // costo de DB/Blob).
        limiter = apiRatelimit;
    }

    if (limiter) {
        const { success, reset } = await limiter.limit(esLecturaDeSesion ? `me:${ip}` : ip);

        if (!success) {
            const retryAfter = Math.ceil((reset - Date.now()) / 1000);
            // El cuerpo tiene que ser JSON -- todo el codigo cliente que llama
            // a /api/* hace `await res.json()` sin condicion (login, registro,
            // etc.). Con texto plano ese .json() truena y el catch generico
            // muestra "error inesperado al conectar", escondiendo que en
            // realidad fueron demasiados intentos.
            return jsonError(
                `Demasiados intentos. Espera ${Math.max(retryAfter, 1)}s e intenta de nuevo.`,
                429,
                {
                    "Retry-After": String(Math.max(retryAfter, 1)),
                    "X-RateLimit-Reset": String(reset),
                    // Un 429 tambien lleva datos de la sesion en el caso de
                    // /api/auth/me: no se guarda en cache.
                    "Cache-Control": "no-store",
                }
            );
        }
    }

    const response = NextResponse.next();

    // Las respuestas de autenticacion (sesion, login, registro, recuperar
    // contrasena) jamas se guardan en cache: ni el navegador ni un proxy
    // intermedio deben quedarse con el token o el usuario.
    if (esAuth) response.headers.set("Cache-Control", "no-store");

    // El contenido de /api/* cambia segun quien pregunta (rol en la cookie).
    // Decirselo a los caches compartidos (Vercel/CDN) evita que la respuesta de
    // un admin quede servida a un cliente por error de una capa intermedia.
    if (esProduccion) response.headers.set("Vary", "Origin, Cookie");

    return response;
}

// Solo activar el proxy en rutas de API (no en paginas ni assets).
export const config = {
    matcher: ["/api/:path*"],
};
 
