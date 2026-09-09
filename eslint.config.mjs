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
