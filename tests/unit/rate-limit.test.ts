/**
 * Rate limit en memoria y lectura de IP: las dos piezas que sostienen los
 * frenos de fuerza bruta antes de llegar a Redis.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, cleanupRateLimitBuckets, rateLimit } from "../../src/lib/rate-limit";

test("permite hasta el limite y luego bloquea con segundos de espera", () => {
    const llave = `prueba-${Date.now()}`;
    for (let i = 0; i < 3; i += 1) {
        assert.equal(rateLimit(llave, 3, 60_000).allowed, true, `intento ${i + 1} deberia pasar`);
    }
    const bloqueado = rateLimit(llave, 3, 60_000);
    assert.equal(bloqueado.allowed, false);
    assert.ok((bloqueado.retryAfterSeconds ?? 0) > 0);
});

test("la ventana expira y vuelve a permitir", async () => {
    const llave = `prueba-ventana-${Date.now()}`;
    assert.equal(rateLimit(llave, 1, 25).allowed, true);
    assert.equal(rateLimit(llave, 1, 25).allowed, false);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(rateLimit(llave, 1, 25).allowed, true);
});

test("llaves distintas no se contaminan entre si", () => {
    const a = `prueba-a-${Date.now()}`;
    const b = `prueba-b-${Date.now()}`;
    assert.equal(rateLimit(a, 1, 60_000).allowed, true);
    assert.equal(rateLimit(a, 1, 60_000).allowed, false);
    assert.equal(rateLimit(b, 1, 60_000).allowed, true, "otra llave empieza de cero");
});

test("cleanupRateLimitBuckets no se lleva por delante lo que sigue vigente", () => {
    const llave = `prueba-limpieza-${Date.now()}`;
    rateLimit(llave, 2, 60_000);
    cleanupRateLimitBuckets();
    assert.equal(rateLimit(llave, 2, 60_000).allowed, true);
});

test("clientIp usa la primera IP de x-forwarded-for (Vercel agrega la cadena)", () => {
    const request = new Request("https://ejemplo.com/api/x", {
        headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" },
    });
    assert.equal(clientIp(request), "203.0.113.9");
});

test("clientIp cae a x-real-ip y luego a 'unknown'", () => {
    const conRealIp = new Request("https://ejemplo.com/api/x", { headers: { "x-real-ip": "198.51.100.4" } });
    assert.equal(clientIp(conRealIp), "198.51.100.4");
    const sinNada = new Request("https://ejemplo.com/api/x");
    assert.equal(clientIp(sinNada), "unknown");
});
