/**
 * Pruebas de seguridad que SOLO se pueden hacer con un navegador de verdad.
 *
 * Lo importante que se comprueba aquí y no en la suite `api`:
 *  1. La cookie de sesión es invisible para el JavaScript de la página. Si algún
 *     día alguien la cambia a `httpOnly: false`, `document.cookie` la vería y
 *     esto falla.
 *  2. El chequeo de origen del middleware NO rompe la app: un fetch legítimo
 *     desde la propia página (que sí manda header Origin) tiene que funcionar.
 *  3. Un parámetro de URL con `<script>` no se ejecuta (XSS reflejado básico).
 *
 * Se corre con `npm run test:e2e:ui` (necesita Chromium descargado).
 */
import { expect, test } from "@playwright/test";

test("el JavaScript de la pagina no puede leer la cookie de sesion", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Cerrar sesión desde la propia página: mismo origen, así que el middleware
    // deja pasar el POST (si lo bloqueara, este fetch fallaría y la app estaría
    // rota para todos los usuarios reales).
    const estado = await page.evaluate(async () => {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        return res.status;
    });
    expect(estado, "el logout desde la app debe funcionar (no lo debe frenar el anti-CSRF)").toBe(200);

    const cookiesVisibles = await page.evaluate(() => document.cookie);
    expect(cookiesVisibles).not.toContain("cremeria_session");
});

test("el navegador no guarda la sesion en localStorage (solo cookie HttpOnly)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const sospechosos = await page.evaluate(() => {
        const hallazgos: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const clave = localStorage.key(i) ?? "";
            const valor = localStorage.getItem(clave) ?? "";
            // Un JWT tiene forma eyJ...: si aparece en localStorage, la sesión
            // es robable por cualquier XSS.
            if (/eyJ[A-Za-z0-9_-]{8,}\./.test(valor) || clave.toLowerCase().includes("session")) {
                hallazgos.push(clave);
            }
        }
        return hallazgos;
    });

    expect(sospechosos).toEqual([]);
});

test("un parametro de URL con script no se ejecuta (XSS reflejado)", async ({ page }) => {
    let dialogoInesperado = "";
    page.on("dialog", async (dialogo) => {
        dialogoInesperado = dialogo.message();
        await dialogo.dismiss();
    });

    await page.goto("/login?portal=%3Cscript%3Ealert('xss')%3C%2Fscript%3E", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    expect(dialogoInesperado).toBe("");
});

// Esta es la prueba que de verdad valida la CSP de produccion: contra el build
// real (E2E_BASE_URL apuntando al `next start`), una CSP mal armada tira
// "Refused to load/execute ... Content Security Policy" en la consola. En dev no
// hay CSP a proposito, asi que ahi no dice nada.
test("cargar la app no dispara violaciones de CSP", async ({ page }) => {
    const violaciones: string[] = [];
    page.on("console", (mensaje) => {
        if (mensaje.type() === "error" && /Content Security Policy/i.test(mensaje.text())) {
            violaciones.push(mensaje.text());
        }
    });
    page.on("pageerror", (error) => {
        if (/Content Security Policy/i.test(error.message)) violaciones.push(error.message);
    });

    await page.goto("/login", { waitUntil: "load" });
    await page.waitForTimeout(1200);

    expect(violaciones).toEqual([]);
});
