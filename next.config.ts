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
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // https://www.mercadopago.com/v2/security.js genera el Device ID
              // que evita rechazos cc_rejected_high_risk (ver src/app/checkout/page.tsx).
              // Ese script a su vez llama a mercadolibre.com — sin ambos dominios
              // aquí, el navegador lo bloquea silenciosamente y el fix se rompe.
              // Clip: solo Checkout Redireccionado (el cliente navega a
              // pago.clip.mx y regresa) — no requiere frame-src/script-src propios.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https: http:",
              // Stripe Payment Element: js.stripe.com carga el SDK, sus campos
              // de tarjeta viven en iframes de js.stripe.com (frame-src), y
              // hace llamadas propias a api.stripe.com (connect-src).
              "connect-src 'self' https://sdk.mercadopago.com https://api.mercadopago.com https://www.mercadopago.com https://www.mercadolibre.com https://*.cartocdn.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.stripe.com",
              "frame-src 'self' https://sdk.mercadopago.com https://*.mercadopago.com https://www.mercadolibre.com https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(), camera=()",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
