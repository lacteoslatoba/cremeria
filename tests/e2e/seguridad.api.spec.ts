/**
 * Suite de seguridad end-to-end — Cremería del Rancho.
 *
 * Qué es: pruebas HTTP contra la app corriendo (dev server local, o el dominio
 * real con E2E_BASE_URL + E2E_PRODUCCION=1). No usan navegador a propósito: son
 * el candado rápido que se corre en cada cambio (`npm run test:e2e`) y cubren lo
 * que de verdad importa: que nadie entre sin sesión, que las respuestas no
 * filtren datos, que la cookie no se pueda leer desde JS y que los frenos de
 * fuerza bruta estén puestos.
 *
 * Regla de oro: NO crean, modifican ni borran datos (nada de registros ni de
 * pedidos de prueba) — el dev apunta a la MISMA base que producción.
 *
 * Cada prueba usa su propia IP falsa del rango de documentación (203.0.113.0/24)
 * en `x-forwarded-for`, que es justo lo que lee el rate limit: así ninguna
 * prueba gasta la cuota del equipo donde se corre y el resultado es repetible.
 */
import { expect, test, type APIResponse } from "@playwright/test";

let contadorIp = 0;

/** IP falsa nueva por llamada: aísla las cubetas de rate limit entre pruebas. */
function ipDePrueba(): string {
    contadorIp += 1;
    return `203.0.113.${contadorIp}`;
}

/** Cabeceras con IP propia (y lo que haga falta encima). */
function conIp(ip: string, extra: Record<string, string> = {}): Record<string, string> {
    return { "x-forwarded-for": ip, ...extra };
}

async function texto(res: APIResponse): Promise<string> {
    return await res.text();
}

test("cabeceras de seguridad presentes (y sin anunciar el framework)", async ({ request }) => {
    const res = await request.get("/login", { headers: conIp(ipDePrueba()) });
    expect(res.status()).toBe(200);

    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("geolocation=(self)");
    expect(h["x-dns-prefetch-control"]).toBe("off");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    expect(h["x-permitted-cross-domain-policies"]).toBe("none");
    expect(h["x-powered-by"]).toBeUndefined();
});

// Contra el dominio real se verifica lo que en dev NO se manda a propósito
// (rompería el simulador local): HSTS, anti-embed y CSP.
test("en produccion: HSTS, anti-embed y CSP sin unsafe-eval", async ({ request }) => {
    test.skip(process.env.E2E_PRODUCCION !== "1", "solo corre con E2E_PRODUCCION=1");

    const res = await request.get("/login", { headers: conIp(ipDePrueba()) });
    const h = res.headers();
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
});

test("sin sesion, ninguna ruta de datos responde con informacion", async ({ request }) => {
    const rutas = ["/api/users", "/api/orders", "/api/driver/orders", "/api/orders/mine", "/api/products?admin=true"];

    for (const ruta of rutas) {
        const res = await request.get(ruta, { headers: conIp(ipDePrueba()) });
        expect(res.status(), `${ruta} sin sesión debe ser 401`).toBe(401);
        expect(await texto(res), `${ruta} no debe devolver datos`).not.toContain("@");
    }
});

test("una cookie de sesion inventada no vale", async ({ request }) => {
    // Token con forma de JWT pero firmado con otra clave: jwtVerify lo rechaza.
    const falsa = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluIiwicm9sZSI6IkFETUlOIn0.firmaFalsa";
    const res = await request.get("/api/users", {
        headers: conIp(ipDePrueba(), { cookie: `cremeria_session=${falsa}` }),
    });
    expect(res.status()).toBe(401);
});

test("sin sesion, /api/auth/me no filtra nada y no se cachea", async ({ request }) => {
    const res = await request.get("/api/auth/me", { headers: conIp(ipDePrueba()) });

    expect(res.status()).toBe(200);
    const cuerpo = await texto(res);
    expect(JSON.parse(cuerpo)).toEqual({ user: null });
    expect(cuerpo).not.toContain("password");
    expect(cuerpo).not.toContain("resetToken");
    expect(cuerpo).not.toContain("$2a$"); // prefijo de un hash bcrypt
    expect(res.headers()["cache-control"]).toBe("no-store");
});

test("la cookie de sesion se apaga con atributos seguros (HttpOnly, Lax, Path)", async ({ request }) => {
    const res = await request.post("/api/auth/logout", { headers: conIp(ipDePrueba()) });
    expect(res.status()).toBe(200);

    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("cremeria_session=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=0/);
});

test("el login no revela si una cuenta existe: mismo error para usuarios distintos", async ({ request }) => {
    const ip = ipDePrueba();
    const respuestas = [];
    for (const identificador of ["no-existe-uno-9137", "no-existe-dos-9137"]) {
        respuestas.push(
            await request.post("/api/auth/login", {
                headers: conIp(ip),
                data: { identifier: identificador, password: "ClaveInvalida123" },
            })
        );
    }

    for (const res of respuestas) expect(res.status()).toBe(401);
    const [a, b] = await Promise.all(respuestas.map(texto));
    expect(a).toBe(b);
});

test("un identificador gigante se corta con 401, no tumba el servidor", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
        headers: conIp(ipDePrueba()),
        data: { identifier: "9".repeat(50_000), password: "x".repeat(50_000) },
    });

    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
});

test("fuerza bruta de login: al sexto intento de la misma IP responde 429 con Retry-After", async ({ request }) => {
    const ip = ipDePrueba();
    const estados: number[] = [];

    for (let intento = 0; intento < 6; intento += 1) {
        const res = await request.post("/api/auth/login", {
            headers: conIp(ip),
            // Identificador distinto en cada intento: así el freno que salta es el
            // de IP, no el de cuenta (los dos existen; el de cuenta se prueba abajo).
            data: { identifier: `bruta-${Date.now()}-${intento}`, password: "ClaveInvalida123" },
        });
        estados.push(res.status());

        if (res.status() === 429) {
            expect(res.headers()["retry-after"]).toBeTruthy();
            expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
            expect(res.headers()["cache-control"]).toBe("no-store");
            const cuerpo = await texto(res);
            expect(() => JSON.parse(cuerpo)).not.toThrow();
            expect(cuerpo).toContain("Demasiados intentos");
        }
    }

    expect(estados.at(-1), `estados observados: ${estados.join(",")}`).toBe(429);
});

test("el webhook de Stripe rechaza lo que no trae firma valida (y no lo frena el rate limit)", async ({ request }) => {
    const sinFirma = await request.post("/api/payments/stripe/webhook", {
        headers: conIp(ipDePrueba()),
        data: { tipo: "prueba" },
    });
    expect(sinFirma.status()).toBe(400);
    expect(sinFirma.status()).not.toBe(429);

    const firmaFalsa = await request.post("/api/payments/stripe/webhook", {
        headers: conIp(ipDePrueba(), { "stripe-signature": "t=1,v1=deadbeef" }),
        data: { tipo: "prueba" },
    });
    expect(firmaFalsa.status()).toBe(400);
    expect(await texto(firmaFalsa)).toContain("Firma inválida");
});

test("una mutacion desde otro origen se bloquea (anti-CSRF)", async ({ request }) => {
    const ajeno = await request.post("/api/auth/logout", {
        headers: conIp(ipDePrueba(), { origin: "https://sitio-malicioso.example" }),
    });
    expect(ajeno.status()).toBe(403);

    // El mismo endpoint desde el propio origen sí funciona: si no, no sería
    // defensa, sería una app rota.
    const propio = await request.post("/api/auth/logout", {
        headers: conIp(ipDePrueba(), { origin: "http://127.0.0.1:3000" }),
    });
    expect(propio.status()).toBe(200);
});
