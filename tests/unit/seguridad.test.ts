/**
 * Cabeceras de seguridad: lo que se promete, probado.
 *
 * Existe porque "yo vi el header una vez en el navegador" no es verificación:
 * un refactor de `next.config.ts` puede tirar HSTS o volver a meter
 * `'unsafe-eval'` en la CSP sin que nadie se entere hasta que ya está en
 * producción.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cabecerasSeguridad, politicaDeContenido } from "../../src/lib/seguridad";

type Cabecera = { key: string; value: string };

function valor(cabeceras: Cabecera[], key: string): string | undefined {
    return cabeceras.find((c) => c.key === key)?.value;
}

test("dev: no manda CSP ni X-Frame-Options (romperian el simulador y el HMR)", () => {
    const cabeceras = cabecerasSeguridad(false);
    assert.equal(valor(cabeceras, "Content-Security-Policy"), undefined);
    assert.equal(valor(cabeceras, "X-Frame-Options"), undefined);
});

test("dev: sí manda lo que no estorba al desarrollo", () => {
    const cabeceras = cabecerasSeguridad(false);
    assert.equal(valor(cabeceras, "X-Content-Type-Options"), "nosniff");
    assert.equal(valor(cabeceras, "X-DNS-Prefetch-Control"), "off");
    assert.equal(valor(cabeceras, "Cross-Origin-Opener-Policy"), "same-origin-allow-popups");
    assert.match(valor(cabeceras, "Permissions-Policy") ?? "", /geolocation=\(self\)/);
});

test("produccion: HSTS fuerte, sin embebido y con CSP", () => {
    const cabeceras = cabecerasSeguridad(true);
    assert.match(valor(cabeceras, "Strict-Transport-Security") ?? "", /max-age=63072000/);
    assert.match(valor(cabeceras, "Strict-Transport-Security") ?? "", /includeSubDomains/);
    assert.equal(valor(cabeceras, "X-Frame-Options"), "DENY");
    assert.ok(valor(cabeceras, "Content-Security-Policy"));
});

test("produccion: la CSP cierra las puertas que no se usan", () => {
    const csp = politicaDeContenido();
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
});

test("produccion: la CSP NO permite eval (eso solo lo necesita el dev)", () => {
    assert.doesNotMatch(politicaDeContenido(), /unsafe-eval/);
});

test("produccion: la CSP deja pasar lo que la app sí usa (Stripe y mapas)", () => {
    const csp = politicaDeContenido();
    assert.match(csp, /script-src[^;]*https:\/\/js\.stripe\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/api\.stripe\.com/);
    assert.match(csp, /connect-src[^;]*nominatim\.openstreetmap\.org/);
    // El iframe del Payment Element y los popups de 3-D Secure.
    assert.match(csp, /frame-src[^;]*https:\/\/hooks\.stripe\.com/);
});
