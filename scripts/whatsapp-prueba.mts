/**
 * Prueba de envio real del codigo de verificacion por WhatsApp — Cremería del Rancho.
 *
 * Existe porque la unica forma de saber si el OTP va a llegar es mandarlo: el
 * mismo codigo puede fallar por la plantilla (no aprobada), por el formato del
 * numero (Meta y Twilio lo quieren distinto) o porque el destinatario no esta en
 * la lista de numeros permitidos de una cuenta de prueba de Meta. Aqui se usa la
 * MISMA funcion que la app (`enviarCodigoWhatsApp`) y se imprime la respuesta
 * cruda del proveedor, que es lo unico que dice cual de las tres cosas es.
 *
 * Uso:
 *   npm.cmd run whatsapp:prueba -- 6131414210
 *   npm.cmd run whatsapp:prueba -- +526131414210 --codigo 123456
 *   npm.cmd run whatsapp:prueba -- 6131414210 --seco   # imprime el plan y no manda nada
 *
 * Sale con codigo 1 si el mensaje no quedo entregado: sirve como criterio de
 * aceptacion ("el telefono recibe de verdad el WhatsApp con el codigo").
 */
import { createRequire } from "node:module";

// Se carga notify.ts con require (y no con `import`) a proposito: el script es
// ESM (.mts) y notify.ts es un modulo CJS para Node, y con un import ESM sus
// exports nombrados no se detectan. Con require se usa la MISMA funcion que la
// app -- que es el punto de este script.
const require = createRequire(import.meta.url);
const { enviarCodigoWhatsApp, formatMxPhoneWhatsApp, planesCodigoMeta, textoCodigoWhatsApp } =
    require("../src/lib/notify") as typeof import("../src/lib/notify");

const argv = process.argv.slice(2);
const SECO = argv.includes("--seco");

function arg(nombre: string): string | undefined {
    const i = argv.indexOf(`--${nombre}`);
    const valor = i >= 0 ? argv[i + 1] : undefined;
    return valor && !valor.startsWith("--") ? valor : undefined;
}

const telefono = arg("telefono") || argv.find((a) => /^[+\d][\d\s()-]{7,}$/.test(a));
const codigo = arg("codigo") || String(Math.floor(100000 + Math.random() * 900000));

async function main(): Promise<number> {
    console.log("=== Prueba de codigo de verificacion por WhatsApp ===");
    console.log(`Proveedor (WHATSAPP_PROVIDER): ${process.env.WHATSAPP_PROVIDER || "(sin definir, se elige por credenciales)"}`);
    console.log(`Plantilla (META_WHATSAPP_TEMPLATE): ${process.env.META_WHATSAPP_TEMPLATE || "(sin definir: solo se intentara texto libre)"}`);
    console.log(`Idioma:    ${process.env.META_WHATSAPP_TEMPLATE_LANG || "es_MX"}`);
    console.log(`Boton:     ${(process.env.META_WHATSAPP_TEMPLATE_BOTON || "copiar") === "ninguno" ? "sin boton" : "Copiar codigo (index 0)"}`);
    console.log(`Codigo de prueba: ${codigo}`);

    if (!telefono) {
        console.error("\nFalta el telefono. Ejemplo:  npm.cmd run whatsapp:prueba -- 6131414210");
        return 1;
    }

    // Los dos formatos se imprimen juntos a proposito: confundirlos ya costo un
    // rato perdido (Meta quiere 52+10 digitos; Twilio quiere +521+10).
    console.log(`Telefono:  ${telefono}`);
    console.log(`  como lo manda Meta (Graph):    ${telefono.replace(/[^\d]/g, "").slice(-10).length === 10 ? `52${telefono.replace(/[^\d]/g, "").slice(-10)}` : "(revisar: no son 10 digitos nacionales)"}`);
    console.log(`  como lo manda Twilio (WhatsApp): ${formatMxPhoneWhatsApp(telefono)}`);

    if (SECO) {
        console.log("\n--seco: no se manda nada. Lo que se intentaria, en orden:");
        for (const plan of planesCodigoMeta(telefono, codigo, textoCodigoWhatsApp(codigo))) {
            console.log(`\n# ${plan.etiqueta}`);
            console.log(JSON.stringify(plan.cuerpo, null, 2));
        }
        return 0;
    }

    console.log("\nEnviando...");
    const resultado = await enviarCodigoWhatsApp(telefono, codigo);
    console.log(`entregado: ${resultado.entregado}   (proveedor: ${resultado.proveedor})`);
    console.log(`detalle:   ${resultado.detalle}`);

    if (!resultado.entregado) {
        console.log("\nPistas por codigo de Meta (el detalle de arriba trae el codigo real):");
        console.log("  131030  el numero no esta en la lista de permitidos (cuenta de prueba: agregalo en la consola de Meta)");
        console.log("  132000  los parametros no coinciden con la plantilla (revisar si lleva boton: META_WHATSAPP_TEMPLATE_BOTON=ninguno)");
        console.log("  131047  fuera de la ventana de 24 h sin plantilla aprobada (crear la plantilla: npm.cmd run whatsapp:plantilla)");
        return 1;
    }

    console.log("\nListo: el telefono debe mostrar el mensaje con el boton Copiar codigo.");
    return 0;
}

main()
    .then((codigoSalida) => process.exit(codigoSalida))
    .catch((err) => {
        console.error("Fallo la prueba:", err instanceof Error ? err.message : err);
        process.exit(1);
    });
