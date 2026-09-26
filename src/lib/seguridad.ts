/**
 * seguridad.ts — cabeceras de seguridad de la app en UN solo lugar.
 *
 * Por qué un módulo y no el arreglo escrito dentro de `next.config.ts`:
 *  1. Se puede probar (`tests/unit/seguridad.test.mts`) en vez de confiar en
 *     "yo vi el header una vez en el navegador".
 *  2. Todo el que necesite las cabeceras usa la MISMA lista: antes cualquier
 *     ajuste se hacía a mano en `headers()` y era fácil dejar una fuera.
 *  3. La diferencia entre desarrollo y producción queda decidida aquí, con el
 *     porqué escrito, en vez de repartida entre comentarios.
 *
 * Regla que no se rompe: en **desarrollo** no se manda CSP ni X-Frame-Options.
 * El simulador local (`tools/simu.html`) mete la app en un iframe y Turbopack
 * usa `eval`; con la política de producción el dev quedaría inservible. La
 * política de producción se verifica con un build local (`.next-build`), no
 * relajándola en dev.
 */

export type CabeceraSeguridad = { key: string; value: string };

// Orígenes externos que la app SÍ necesita (y por qué). Todo lo demás se niega.
const TILES_Y_GEOCODING = [
    "https://*.cartocdn.com", // tiles de los mapas (Leaflet)
    "https://*.tile.openstreetmap.org", // tiles de respaldo
    "https://nominatim.openstreetmap.org", // geocodificación inversa de direcciones
];

// Stripe es la ÚNICA pasarela que queda (Conekta y Mercado Pago se eliminaron).
const STRIPE = [
    "https://api.stripe.com",
    "https://js.stripe.com",
    "https://m.stripe.network",
    "https://q.stripe.com",
    "https://hooks.stripe.com",
];

// Reporte de errores desde el navegador (ya estaba permitido: no se relaja).
const ERREPRES = ["https://notify.bugsnag.com", "https://sessions.bugsnag.com"];

// Tipografía que Stripe hace fetch() por su cuenta (ver comentario original en
// el CSP: sin esto el iframe del Payment Element monta con la fuente default).
const FUENTES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

/**
 * Content-Security-Policy de producción.
 *
 * Diferencia clave contra la versión anterior: **no lleva `'unsafe-eval'`**.
 * Ese permiso solo lo pide el modo desarrollo (React Refresh / Turbopack) y en
 * un bundle de producción no hay nada que evalúe código en runtime — dejarlo
 * era regalar la mitad del beneficio de tener CSP. `'unsafe-inline'` sigue
 * porque Next inyecta los datos de RSC en `<script>` inline; quitarlo requiere
 * nonces por petición (tarea aparte, no se hace a ciegas).
 */
export function politicaDeContenido(): string {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://js.stripe.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https: http:",
        `connect-src 'self' ${[...TILES_Y_GEOCODING, ...STRIPE, ...FUENTES, ...ERREPRES].join(" ")}`,
        `frame-src 'self' ${STRIPE.join(" ")}`,
        // Nadie puede embeber la app (equivale a X-Frame-Options: DENY, pero
        // además cubre el caso de que el navegador ignore ese header).
        "frame-ancestors 'none'",
        // Sin plugins, sin <base> inyectado y sin evadir el CSP con navegación.
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
    ].join("; ");
}

/**
 * Cabeceras de seguridad para las respuestas HTML/estáticas.
 *
 * @param esProduccion true en build de producción; en dev se omite lo que
 *        rompería el simulador y el HMR (CSP y X-Frame-Options).
 */
export function cabecerasSeguridad(esProduccion: boolean): CabeceraSeguridad[] {
    // Estas tres no dependen del entorno y nunca estorbaron en dev.
    const siempre: CabeceraSeguridad[] = [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "geolocation=(self), microphone=(), camera=()" },
        // Evita que el navegador resuelva DNS de enlaces que el usuario aún no
        // pidió (fuga de "a dónde voy a entrar" a la red/proxy local).
        { key: "X-DNS-Prefetch-Control", value: "off" },
        // Sin acceso a window.opener desde pestañas de terceros; se permiten
        // popups porque 3-D Secure de Stripe los abre para autenticar la tarjeta.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        // Flash/PDF antiguos ya no pueden leer políticas cross-domain.
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ];

    if (!esProduccion) return siempre;

    return [
        ...siempre,
        // 2 años + subdominios: una vez que el navegador vio el sitio en HTTPS
        // no vuelve a intentar HTTP (evita el downgrade y el robo de cookie).
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: politicaDeContenido() },
    ];
}
