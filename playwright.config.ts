/**
 * Configuración de Playwright — Cremería del Rancho.
 *
 * Dos proyectos, a propósito:
 *   - `api`: pruebas de seguridad por HTTP puro. NO necesitan navegador (usan
 *     el fixture `request`), así que corren en segundos y en cualquier máquina
 *     sin descargar Chromium. Es la suite de candado: si algo afloja la
 *     seguridad (cabeceras, 401/403, cookies, rate limit), esto lo dice.
 *   - `ui`: pruebas de navegador (Chromium ya descargado). Se corren aparte con
 *     `npm run test:e2e:ui` porque son más lentas y dependen del dev server.
 *
 * El `webServer` reusa el `npm run dev` que ya esté corriendo (`reuseExistingServer`),
 * así nadie tiene que levantar un segundo servidor ni pelear por el puerto.
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
    testDir: "./tests/e2e",
    // Las pruebas de rate limit comparten cubetas por IP: en serie el resultado
    // es el mismo siempre. Con workers en paralelo se volverían intermitentes.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    timeout: 30_000,
    reporter: [["list"]],
    use: {
        baseURL: BASE_URL,
        // Nada de trazas ni video: esto no es un visor de UI, es un candado.
        trace: "off",
        video: "off",
        screenshot: "off",
    },
    projects: [
        {
            name: "api",
            testMatch: /.*\.api\.spec\.ts/,
        },
        {
            name: "ui",
            testMatch: /.*\.ui\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npm.cmd run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
    },
});
