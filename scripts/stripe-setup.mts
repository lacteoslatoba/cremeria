/**
 * Configura y verifica el webhook de Stripe para la Cremería del Rancho.
 *
 * Uso:
 *   npm run stripe:setup                      # modo diagnóstico (solo lee lo que hay)
 *   npm run stripe:setup -- --url https://TU-DOMINIO.vercel.app/api/payments/stripe/webhook
 *
 * Con --url: busca un endpoint con esa URL. Si existe lo valida; si no, lo crea
 * con los eventos que necesita la app e imprime el secreto whsec_... para que se
 * pegue en STRIPE_WEBHOOK_SECRET (Vercel y .env.local).
 *
 * Requiere STRIPE_SECRET_KEY en .env.local (o variable de entorno).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

// ── Cargar .env.local manualmente (evita meter dotenv de extra) ──
function loadEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const rawVal = line.slice(eq + 1).trim();
        // Quitar comillas simples o dobles
        let val = rawVal;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
    }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(ROOT, ".env.local"));

const args = process.argv.slice(2);
function flagValue(name: string): string | undefined {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
}
const targetUrl = flagValue("--url");
const recreate = args.includes("--recreate");

// Eventos que la app escucha en el webhook
const REQUIRED_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
];

function printSecret(secret: string | undefined) {
    if (!secret) return;
    console.log("\n  ════════════════════════════════════════════════════════");
    console.log("  🧾 SECRETO DE FIRMA — copia este valor:");
    console.log(`  ${secret}`);
    console.log("  Pégalo en: STRIPE_WEBHOOK_SECRET (Vercel y .env.local)");
    console.log("  ════════════════════════════════════════════════════════");
}

async function main() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishable = process.env.STRIPE_PUBLISHABLE_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log("════════════════════════════════════════════════════════");
    console.log("  Configuración de Stripe — Cremería del Rancho");
    console.log("════════════════════════════════════════════════════════\n");

    // ── 1) Diagnóstico de claves ──
    const mode = secretKey?.startsWith("sk_live_") ? "LIVE (producción)" : secretKey?.startsWith("sk_test_") ? "TEST (pruebas)" : "NO DETECTADO";
    console.log("▸ Clave secreta (STRIPE_SECRET_KEY):", secretKey ? `✓ presente · modo ${mode}` : "✗ FALTA");
    console.log("▸ Clave publicable (STRIPE_PUBLISHABLE_KEY):", publishable ? "✓ presente" : "✗ FALTA");
    console.log("▸ Secreto de webhook (STRIPE_WEBHOOK_SECRET):", webhookSecret ? "✓ presente" : "✗ FALTA (hay que configurarlo)");

    if (!secretKey) {
        console.error("\n⚠ No encontré STRIPE_SECRET_KEY. Agrégala en .env.local y vuelve a intentar.");
        process.exit(1);
    }

    if (!secretKey.startsWith("sk_live_")) {
        console.warn("\nℹ La clave actual NO es de producción (sk_live_). Recuerda: para cobrar de verdad necesitas una clave LIVE en Vercel.");
    }

    const stripe = new Stripe(secretKey);

    // ── 2) Webhook ──
    console.log("\n─── Webhooks existentes ───");
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    if (endpoints.data.length === 0) console.log("  (No hay endpoints de webhook creados)");

    for (const ep of endpoints.data) {
        const hasRequired = ep.enabled_events.some((e) => REQUIRED_EVENTS.includes(e as any));
        console.log("  •", ep.id, "·", ep.url, "· estado:", ep.status);
        console.log("      eventos requeridos:", hasRequired ? "✓ presentes" : "✗ faltan");
    }

    if (!webhookSecret && endpoints.data.length > 0) {
        console.log("\n  ⚠ Falta STRIPE_WEBHOOK_SECRET. Con el endpoint ya creado, obtén el")
        console.log("    secreto de firma en el Dashboard y pégalo en STRIPE_WEBHOOK_SECRET:");
        console.log("    https://dashboard.stripe.com/webhooks → “Reveal signing secret”");
    }

    if (!targetUrl) {
        console.log("\n─── Diagnóstico completado ───");
        console.log("Para crear/validar el webhook pasa --url, p. ej.:");
        console.log("  npm run stripe:setup -- --url https://TU-DOMINIO.vercel.app/api/payments/stripe/webhook");
        return;
    }

    console.log(`\n─── Preparando webhook para: ${targetUrl} ───`);
    const existing = endpoints.data.find((ep) => ep.url === targetUrl);

    // Si se pide recrear, elimina el endpoint existente para capturar el secreto
    // de firma (que Stripe solo devuelve al momento de CREAR un endpoint).
    if (recreate && existing) {
        console.log(`  ▶ --recreate: eliminando el endpoint ${existing.id} para recrearlo y capturar el secreto…`);
        await stripe.webhookEndpoints.del(existing.id);
        const reCreated = await stripe.webhookEndpoints.create({
            url: targetUrl,
            enabled_events: REQUIRED_EVENTS,
            description: "Cremería del Rancho — confirmación de pagos",
        });
        console.log(`  ✓ Recreado: ${reCreated.id}`);
        const reSecret = (reCreated as any).secret;
        if (reSecret) {
            printSecret(reSecret as string);
        } else {
            console.log("  ⚠ Stripe no devolvió el secreto. Revísalo en el Dashboard → Reveal signing secret.");
        }
        return;
    }

    if (existing) {
        console.log(`  ✓ Ya existe un endpoint con esa URL (${existing.id}).`);
        const missing: Stripe.WebhookEndpointUpdateParams.EnabledEvent[] = REQUIRED_EVENTS.filter(
            (e) => !existing.enabled_events.includes(e as Stripe.WebhookEndpointUpdateParams.EnabledEvent)
        );
        if (missing.length > 0) {
            console.log(`  ▶ Le faltan eventos. Actualizando: ${missing.join(", ")}`);
            const updatedEvents: Stripe.WebhookEndpointUpdateParams.EnabledEvent[] = [
                ...(existing.enabled_events as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]),
                ...missing,
            ];
            await stripe.webhookEndpoints.update(existing.id, {
                enabled_events: updatedEvents,
            });
            console.log("  ✓ Webhook actualizado con los eventos.");
        } else {
            console.log("  ✓ El webhook ya tiene los eventos correctos.");
        }
        console.log("\n  ⚠ El secreto de firma de un endpoint existente NO lo devuelve la API.");
        console.log("    Para obtener el whsec_... actual: Stripe Dashboard → Developers → Webhooks,");
        console.log("    abre el endpoint y clic en “Reveal signing secret”. Pégalo en STRIPE_WEBHOOK_SECRET.");
    } else {
        console.log("  ▶ No existe. Creándolo con los eventos de la app…");
        const created = await stripe.webhookEndpoints.create({
            url: targetUrl,
            enabled_events: REQUIRED_EVENTS,
            description: "Cremería del Rancho — confirmación de pagos",
        });
        console.log(`  ✓ Creado: ${created.id}`);
        const secret = (created as any).secret as string | undefined;
        if (secret) {
            printSecret(secret);
        } else {
            console.log("\n  ⚠ Configure el secreto desde el Dashboard si no se mostró arriba.");
        }
    }

    console.log("\n✅ Listo.");
}

main().catch((err) => {
    console.error("\nError:", err?.message || err);
    if (String(err?.message || "").includes("Incorrect API key")) {
        console.error("  El STRIPE_SECRET_KEY no es válido o fue revocado (por eso conviene rotarlo).");
    }
    process.exit(1);
});


