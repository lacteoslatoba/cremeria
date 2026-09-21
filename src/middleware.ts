// middleware.ts — Edge Middleware de Next.js para rate limiting distribuido.
//
// Se ejecuta en el Edge Runtime (ANTES del Route Handler), lo que significa
// que las peticiones bloqueadas no llegan ni a la funcion serverless ni a la
// base de datos — ahorrando conexiones, compute y tiempo de respuesta.
//
// Rutas protegidas:
//   /api/auth/*            → authRatelimit   (10 req/min/IP)
//   POST /api/orders       → ordersRatelimit (5  req/min/IP, anti-spam de pedidos)
//   resto de /api/orders/* → apiRatelimit    (120 req/min/IP -- lecturas y
//                            cambios: incluye el polling del seguimiento)
//
// El bloqueo devuelve 429 con header Retry-After para que el cliente sepa
// cuantos segundos esperar antes de reintentar.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRatelimit, authRatelimit, ordersRatelimit } from "@/lib/upstash";

export async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // IP real: Vercel la envia en x-forwarded-for; fallback para dev local.
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "127.0.0.1";

    // Selecciona el limitador segun la ruta Y el metodo.
    //
    // El limite estricto de /api/orders es solo para CREAR pedidos (anti-spam).
    // Antes aplicaba a TODO /api/orders/*, incluidas las lecturas: /tracking
    // hace polling cada 3s (20 req/min) contra GET /api/orders/[orderId], asi
    // que la cubeta de 5 req/min se agotaba en ~15s -- el mapa se congelaba en
    // silencio (el fetch ignora los no-ok) y, si el primer fetch ya llegaba
    // rate-limited, el cliente veia "Orden no encontrada". Ademas esa misma
    // cubeta la compartian las escrituras (crear pedido, cambiar estado,
    // asignar repartidor, borrar), asi que un cliente con el seguimiento
    // abierto podia quedar bloqueado para crear otro pedido.
    let limiter: typeof authRatelimit | null = null;

    if (pathname.startsWith("/api/auth")) {
        limiter = authRatelimit;
    } else if (pathname === "/api/orders" && request.method === "POST") {
        limiter = ordersRatelimit;
    } else if (pathname.startsWith("/api/orders")) {
        limiter = apiRatelimit;
    }

    if (limiter) {
        const { success, reset } = await limiter.limit(ip);

        if (!success) {
            const retryAfter = Math.ceil((reset - Date.now()) / 1000);
            // El cuerpo tiene que ser JSON -- todo el codigo cliente que llama
            // a /api/* hace `await res.json()` sin condicion (login, registro,
            // etc.). Con texto plano ese .json() truena y el catch generico
            // muestra "error inesperado al conectar", escondiendo que en
            // realidad fueron demasiados intentos.
            return NextResponse.json(
                { error: `Demasiados intentos. Espera ${Math.max(retryAfter, 1)}s e intenta de nuevo.` },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(Math.max(retryAfter, 1)),
                        "X-RateLimit-Reset": String(reset),
                    },
                }
            );
        }
    }

    return NextResponse.next();
}

// Solo activar este middleware en rutas de API (no en paginas ni assets).
export const config = {
    matcher: ["/api/:path*"],
};
 
