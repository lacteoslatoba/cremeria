/**
 * Puente de comunicación con Claude desde la línea de comandos.
 *
 * Sirve para que OTRO agente (o tú) le mande un mensaje a Claude y reciba la
 * respuesta en stdout, sin abrir un chat. Usa dos backends, en este orden:
 *
 *   1) API de Anthropic  → si hay ANTHROPIC_API_KEY. Usa fetch nativo (cero deps).
 *   2) Claude Code CLI   → si el binario `claude` está en el PATH (`claude -p`).
 *
 * Uso:
 *   npm run claude -- "Explícame src/lib/create-order.ts en 5 líneas"
 *   npm run claude -- --file docs/agent-bridge.md "Resume esto"
 *   npm run claude -- --dry-run "¿qué me mandarías?"   # no gasta tokens
 *   npm run claude -- --out docs/respuesta.md "Pregunta"
 *
 * Variables de entorno (en .env.local o del sistema):
 *   ANTHROPIC_API_KEY  → activa el backend de API
 *   ANTHROPIC_MODEL    → modelo por defecto (override con --model)
 *
 * Requiere acceso a la API o al CLI. Sin ninguno de los dos el script explica
 * cómo configurarlo y sale con código 1.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ── Cargar .env.local manualmente (mismo patrón que stripe-setup.mts) ──
function loadEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) return;
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const rawVal = line.slice(eq + 1).trim();
        let val = rawVal;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
    }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(ROOT, ".env.local"));

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 2048;

// ── Argumentos ──
const argv = process.argv.slice(2);
function flagValue(name: string): string | undefined {
    const i = argv.indexOf(name);
    return i !== -1 ? argv[i + 1] : undefined;
}
function flagPresent(name: string): boolean {
    return argv.includes(name);
}
/** Todo lo que no sea bandera ni valor de bandera se toma como el prompt. */
function positionalPrompt(): string {
    const withValue = new Set(["--file", "--model", "--system", "--max-tokens", "--out"]);
    const out: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (withValue.has(a)) {
            i++; // saltar el valor
            continue;
        }
        if (a.startsWith("--")) continue;
        out.push(a);
    }
    return out.join(" ").trim();
}

const filePath = flagValue("--file");
const model = flagValue("--model") ?? DEFAULT_MODEL;
const systemPrompt = flagValue("--system");
const maxTokens = Number(flagValue("--max-tokens") ?? DEFAULT_MAX_TOKENS);
const outPath = flagValue("--out");
const dryRun = flagPresent("--dry-run");
const asJson = flagPresent("--json");

let prompt = positionalPrompt();
if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    if (!fs.existsSync(abs)) {
        console.error(`\n⚠ No existe el archivo: ${abs}`);
        process.exit(1);
    }
    const contenido = fs.readFileSync(abs, "utf8");
    prompt = `${prompt || "Analiza este archivo."}\n\n--- CONTEXTO: ${filePath} ---\n${contenido}`;
}

if (!prompt) {
    console.error("\n⚠ Falta el mensaje. Ejemplos:");
    console.error('  npm run claude -- "hola"');
    console.error('  npm run claude -- --file docs/agent-bridge.md "resume esto"');
    process.exit(1);
}


// ── Detección de backend ──
/**
 * Ruta al binario del CLI de Claude Code, o null si no está en ninguna parte.
 * Primero lo busca en el PATH (instalación por npm o por instalador nativo);
 * si no aparece, revisa las carpetas de extensiones de los IDEs, porque la
 * extensión oficial trae el binario dentro y NO lo pone en el PATH -- en este
 * equipo Claude Code vive en .antigravity-ide\extensions y `where claude`
 * falla aunque el ejecutable exista y funcione.
 */
function encontrarCli(): string | null {
    const probe = process.platform === "win32"
        ? spawnSync("where", ["claude"], { shell: true, encoding: "utf8" })
        : spawnSync("which", ["claude"], { encoding: "utf8" });
    const enPath = String(probe.stdout || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)[0];
    if (probe.status === 0 && enPath) return enPath;

    const home = os.homedir();
    const dirsExtensiones = [
        path.join(home, ".antigravity-ide", "extensions"),
        path.join(home, ".vscode", "extensions"),
        path.join(home, ".vscode-insiders", "extensions"),
        path.join(home, ".cursor", "extensions"),
    ];
    const nombres = ["claude.exe", "claude"];
    for (const dir of dirsExtensiones) {
        if (!fs.existsSync(dir)) continue;
        const versiones = fs.readdirSync(dir)
            .filter((d) => d.startsWith("anthropic.claude-code-"))
            .sort()
            .reverse(); // la extensión más nueva primero
        for (const v of versiones) {
            for (const nombre of nombres) {
                const candidato = path.join(dir, v, "resources", "native-binary", nombre);
                if (fs.existsSync(candidato)) return candidato;
            }
        }
    }
    return null;
}

const CLI_PATH = encontrarCli();

type Backend = "api" | "cli" | "ninguno";
function detectarBackend(): Backend {
    if (process.env.ANTHROPIC_API_KEY) return "api";
    if (CLI_PATH) return "cli";
    return "ninguno";
}

const backend = detectarBackend();

// ── Encabezado ──
console.log("════════════════════════════════════════════════════════");
console.log("  Puente a Claude — Cremería del Rancho");
console.log("════════════════════════════════════════════════════════");
console.log(`▸ Backend: ${backend === "api" ? "API de Anthropic (ANTHROPIC_API_KEY)" : backend === "cli" ? "Claude Code CLI" : "✗ NINGUNO"}`);
if (backend === "cli") console.log(`▸ CLI:     ${CLI_PATH}`);
console.log(`▸ Modelo:  ${model}${flagValue("--model") ? " (--model)" : " (por defecto)"}`);
console.log(`▸ Prompt:  ${prompt.length} caracteres`);
if (filePath) console.log(`▸ Archivo: ${filePath}`);
console.log("");

if (dryRun) {
    console.log("── MODO --dry-run: no se envía nada ni se gastan tokens ──\n");
    console.log(prompt.length > 1200 ? `${prompt.slice(0, 1200)}\n… [${prompt.length - 1200} caracteres más]` : prompt);
    console.log("\n✅ Dry-run completado.");
    process.exit(0);
}

if (backend === "ninguno") {
    console.error("✗ No hay forma de contactar a Claude en esta máquina.\n");
    console.error("Elige UNA de estas dos opciones:\n");
    console.error("  A) API de Anthropic (recomendada para scripts):");
    console.error("     1. Crea una API key en https://console.anthropic.com/settings/keys");
    console.error("     2. Agrega a .env.local:  ANTHROPIC_API_KEY=sk-ant-...");
    console.error("     3. Vuelve a correr:  npm run claude -- \"hola\"\n");
    console.error("  B) Claude Code CLI:");
    console.error("     npm install -g @anthropic-ai/claude-code");
    console.error("     claude   # inicia sesión una vez\n");
    process.exit(1);
}

// ── Backend 1: API de Anthropic (REST con fetch nativo, sin dependencias) ──
async function viaApi(): Promise<string> {
    const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": String(process.env.ANTHROPIC_API_KEY),
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
        const detalle = data?.error?.message || `${res.status} ${res.statusText}`;
        throw new Error(`La API respondió ${res.status}: ${detalle}`);
    }
    const texto = (data?.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
    return texto || "(respuesta sin texto)";
}

// ── Backend 2: Claude Code CLI en modo no interactivo ──
function viaCli(): string {
    const bin = CLI_PATH as string;
    const args = ["-p"];
    if (systemPrompt) args.push("--append-system-prompt", systemPrompt);
    const res = spawnSync(bin, args, {
        // Un .exe se lanza directo; los shims .cmd/.bat de npm sí necesitan shell.
        shell: /\.(cmd|bat)$/i.test(bin),
        input: prompt,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
    });
    if (res.error) throw new Error(`No se pudo ejecutar el CLI: ${res.error.message}`);
    if (res.status !== 0) {
        throw new Error(`El CLI salió con código ${res.status}: ${String(res.stderr || "").trim()}`);
    }
    return String(res.stdout || "").trim() || "(respuesta vacía)";
}

async function main() {
    const inicio = Date.now();
    const respuesta = backend === "api" ? await viaApi() : viaCli();
    const ms = Date.now() - inicio;

    if (outPath) {
        const abs = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, respuesta + "\n", "utf8");
        console.log(`▸ Guardado en: ${abs}\n`);
    }

    if (asJson) {
        console.log(JSON.stringify({ backend, model, ms, prompt, respuesta }, null, 2));
    } else {
        console.log("───── Respuesta de Claude ─────\n");
        console.log(respuesta);
    }
    console.log(`\n✅ Listo en ${ms} ms.`);
}

main().catch((err) => {
    console.error("\nError:", err?.message || err);
    const msg = String(err?.message || "");
    if (msg.includes("401")) {
        console.error("  La ANTHROPIC_API_KEY no es válida o fue revocada.");
    } else if (msg.includes("404") && msg.toLowerCase().includes("model")) {
        console.error(`  El modelo "${model}" no existe para tu cuenta. Prueba otro con --model.`);
    } else if (msg.includes("429")) {
        console.error("  Límite de peticiones alcanzado. Espera un momento.");
    }
    process.exit(1);
});
