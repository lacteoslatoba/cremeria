import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Carpeta de build de produccion (NEXT_DIST_DIR=.next-build, ver
    // next.config.ts): es codigo compilado, no del repo.
    ".next-build/**",
    // Resto de un build de verificacion anterior (mismo caso; lintaba ~500 archivos
    // compilados y volvia `npm run check -- --todo` lentisimo).
    ".next-build-check/**",
    // Herramientas de consola (Node en la raíz / carpeta scripts): son
    // utilidades operativas, no código de la app ni del bundle.
    "fetch.js",
    "seed.js",
    "scripts/**",
    "write-upstash.cjs",
    // PWA assets generados por next-pwa (minified, no se escriben a mano).
    "public/sw.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
