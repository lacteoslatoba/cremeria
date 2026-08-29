import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// @ducanh2912/next-pwa genera el service worker via un plugin de WEBPACK.
// Next.js 16 usa Turbopack por defecto, con el que este plugin nunca se
// ejecuta (no genera public/sw.js ni falla: simplemente no hace nada).
// Por eso el script "build" en package.json fuerza `next build --webpack`.
// El bundler de "dev" puede seguir siendo Turbopack sin problema porque
// el PWA ya está deshabilitado en desarrollo (ver `disable` abajo).
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // El Service Worker solo empieza a interceptar peticiones a partir de la
  // SEGUNDA carga (clientsClaim recién le da control después de la primera
  // visita) -- por eso el pago con tarjeta cargaba perfecto la primera vez
  // y fallaba al recargar: la regla genérica de "cross-origin" que trae
  // next-pwa por default le ponía un timeout de 10s a la petición de
  // js.stripe.com y la trataba como cacheable, lo cual rompe la carga del
  // script real. La regla de abajo va ANTES que esa (extendDefaultRuntimeCaching
  // la antepone) y saca a todo *.stripe.com de esa lógica -- pasa derecho a
  // la red, tal como en la primera carga sin Service Worker.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Aplica a Stripe (en pausa) y Conekta (proveedor activo) por igual --
        // ninguna pasarela de pago debe pasar por la lógica de caché genérica.
        urlPattern: ({ url }: { url: URL }) =>
          url.hostname.endsWith(".stripe.com") || url.hostname.endsWith(".conekta.io"),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    // Los headers de seguridad de embebido (X-Frame-Options / frame-ancestors)
    // solo aplican en producción para no romper el simulador local (file:// →
    // http://127.0.0.1) que muestra la app en un iframe durante desarrollo.
    const isProd = process.env.NODE_ENV === "production";
    const headers = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "geolocation=(self), microphone=(), camera=()",
      },
    ];

    if (isProd) {
      headers.push(
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Stripe (en pausa, se deja permitido por si se reactiva) + Conekta
            // (activo, tokenizer directo -- se probó primero su "Checkout
            // Component" con iframe pero tiene un bug real confirmado que lo
            // deja en 0px de alto). cdn.conekta.io carga el tokenizer, que
            // tokeniza la tarjeta en el navegador y llama directo a la API
            // de Conekta (connect-src) -- los campos de tarjeta viven en
            // nuestra propia página, no en un iframe.
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.conekta.io https://d3fxnri0mz3rya.cloudfront.net https://unpkg.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https: http:",
            "connect-src 'self' https://*.cartocdn.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.stripe.com https://m.stripe.network https://*.conekta.io https://notify.bugsnag.com https://sessions.bugsnag.com",
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://q.stripe.com",
            "worker-src 'self' blob:",
            "manifest-src 'self'",
          ].join("; "),
        }
      );
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default withPWA(nextConfig);
