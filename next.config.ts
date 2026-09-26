import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { cabecerasSeguridad } from "./src/lib/seguridad";

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
  // No anunciar el framework ni su versión en cada respuesta (X-Powered-By:
  // Next.js). Es información gratis para quien busca versiones con fallas
  // conocidas; no aporta nada a los usuarios reales.
  poweredByHeader: false,
  // El botón/indicador "N" de Next.js dev (esquina inferior) es solo del
  // modo desarrollo -- no existe en build de producción -- pero estorbaba
  // en el simulador de telefono (simu.html) tapando la UI real.
  devIndicators: false,
  // Escotilla para verificar el build de produccion SIN detener el dev server:
  //   $env:NEXT_DIST_DIR=".next-build"; npx next build --webpack
  // Sin esto el build y el dev comparten .next y se pisan (y el `prisma generate`
  // del script completo falla con EPERM porque el server le bloquea el DLL).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    // /main -- URL fija para el acceso directo de la app instalada en la PC
    // (selector de los 3 portales). Antes era un redirect y la barra de
    // direcciones saltaba a /login; ahora es un rewrite: la URL se queda en
    // /main pero sirve el mismo contenido de /login por dentro.
    return [
      {
        source: "/main",
        destination: "/login",
      },
    ];
  },
  async headers() {
    // Las cabeceras de seguridad viven en src/lib/seguridad.ts (una sola lista,
    // con tests). Ahí se decide qué NO se manda en desarrollo para no romper el
    // simulador local (file:// → http://127.0.0.1 en iframe) ni el HMR.
    return [
      {
        source: "/(.*)",
        headers: cabecerasSeguridad(process.env.NODE_ENV === "production"),
      },
    ];
  },
};

export default withPWA(nextConfig);
