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
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
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
            // Stripe Payment Element: js.stripe.com carga el SDK, los campos de
            // tarjeta viven en iframes propios (frame-src) y Stripe hace llamadas
            // ajax a api.stripe.com / m.stripe.network (connect-src).
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https: http:",
            "connect-src 'self' https://*.cartocdn.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.stripe.com https://m.stripe.network",
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
