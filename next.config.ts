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
};

export default withPWA(nextConfig);
