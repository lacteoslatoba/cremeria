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
        // Ninguna pasarela de pago debe pasar por la lógica de caché genérica
        // del Service Worker. (Mercado Pago y Conekta se quitaron del todo --
        // solo Stripe sigue.)
        urlPattern: ({ url }: { url: URL }) => url.hostname.endsWith(".stripe.com"),
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
            // Stripe (única pasarela de tarjeta). Los dominios de Conekta y
            // Mercado Pago ya no se cargan (código eliminado).
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https: http:",
            // fonts.googleapis.com: el Payment Element de Stripe hace un fetch()
            // propio a la tipografia que le pasamos en appearance.fonts (Plus
            // Jakarta Sans, para que combine con el resto de la app) -- sin
            // esto tira un error de CSP en consola (el iframe monta igual,
            // pero con la tipografia default de Stripe en vez de la nuestra).
            "connect-src 'self' https://*.cartocdn.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.stripe.com https://m.stripe.network https://fonts.googleapis.com https://notify.bugsnag.com https://sessions.bugsnag.com",
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
