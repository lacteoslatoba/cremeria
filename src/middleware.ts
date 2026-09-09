// middleware.ts — Edge Middleware de Next.js para rate limiting distribuido.
//
// Se ejecuta en el Edge Runtime (ANTES del Route Handler), lo que significa
// que las peticiones bloqueadas no llegan ni a la funcion serverless ni a la
// base de datos — ahorrando conexiones, compute y tiempo de respuesta.
//
// Rutas protegidas:
//   /api/auth/*   → authRatelimit   (10 req/min/IP)
//   /api/orders/* → ordersRatelimit (5  req/min/IP)
//
// El bloqueo devuelve 429 con header Retry-After para que el cliente sepa
// cuantos segundos esperar antes de reintentar.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authRatelimit, ordersRatelimit } from "@/lib/upstash";

export async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // IP real: Vercel la envia en x-forwarded-for; fallback para dev local.
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "127.0.0.1";

    // Selecciona el limitador segun la ruta.
    let limiter: typeof authRatelimit | null = null;

    if (pathname.startsWith("/api/auth")) {
        limiter = authRatelimit;
    } else if (pathname.startsWith("/api/orders")) {
        limiter = ordersRatelimit;
    }

    if (limiter) {
        const { success, reset } = await limiter.limit(ip);

        if (!success) {
            const retryAfter = Math.ceil((reset - Date.now()) / 1000);
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    "Content-Type": "text/plain",
                    "Retry-After": String(Math.max(retryAfter, 1)),
                    "X-RateLimit-Reset": String(reset),
                },
            });
        }
    }

    return NextResponse.next();
}

// Solo activar este middleware en rutas de API (no en paginas ni assets).
export const config = {
    matcher: ["/api/:path*"],
};
 
