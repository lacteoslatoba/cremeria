/**
 * Vigilante autónomo de Claude Code — Cremería del Rancho.
 *
 * Cline solo existe mientras hay un turno abierto, así que este script hace el
 * trabajo de vigilancia que él no puede: se queda corriendo, detecta cada commit
 * NUEVO de Claude Code y le aplica la verificación automática del repo.
 *
 * Qué revisa de cada commit:
 *   1. `npx tsc --noEmit`             → debe salir sin errores
 *   2. `npx eslint <archivos tocados>` → debe dar 0 errores (y reporta los warnings)
 *   3. `npm run prisma -- validate`   → solo si el commit tocó prisma/schema.prisma
 *
 * Si algo falla, deja el reporte en `docs/verifications/` y ADEMÁS crea una tarea
 * de corrección en la cola (asignada a cline) para que no se pierda.
 *
 * Uso:
 *   npm run watch:claude                     # vigila para siempre (Ctrl+C para salir)
 *   npm run watch:claude -- --once           # revisa el último commit de Claude y sale
 *   npm run watch:claude -- --interval 20    # cada 20 s en vez de 30
 *   npm run watch:claude -- --minutos 45     # se apaga solo a los 45 minutos
 *   npm run watch:claude -- --from <sha>     # arranca desde un commit concreto
 *   npm run watch:claude -- --incluir-propios # verifica también commits sin Co-Authored-By de Claude
 *
 * Solo verifica commits que traen el trailer `Co-Authored-By: Claude ...`, es decir
 * los que hizo Claude Code. Los commits propios (de Cline o del usuario) se saltan
 * para no gastar tiempo verificándose a sí mismo.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "verifications");
const ESTADO = path.join(OUT_DIR, ".ultimo-verificado");

// ── Argumentos ──
const argv = process.argv.slice(2);
function flagValue(name: string): string | undefined {
    const i = argv.indexOf(name);
    return i !== -1 ? argv[i + 1] : undefined;
}
const INTERVALO_MS = Math.max(5, Number(flagValue("--interval") ?? 30)) * 1000;
const MINUTOS = Number(flagValue("--minutos") ?? 0);
const DESDE = flagValue("--from");
const INCLUIR_PROPIOS = argv.includes("--incluir-propios");
const UNA_VEZ = argv.includes("--once");

// ── Helpers de git y shell ──
function git(args: string[]): string {
    const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    return String(r.stdout || "").trim();
}

/** Corre un comando del proyecto y devuelve código de salida + salida combinada. */
function correr(cmd: string, args: string[]): { codigo: number; salida: string } {
    const r = spawnSync(cmd, args, {
        cwd: ROOT,
        shell: true, // los .cmd de npm/npx lo necesitan en Windows
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
    });
    const salida = `${r.stdout || ""}${r.stderr || ""}`.trim();
    return { codigo: r.status ?? 1, salida };
}

function sello(): string {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function log(...partes: string[]) {
    console.log(`[${new Date().toLocaleTimeString("es-MX", { hour12: false })}]`, ...partes);
}

// ── Detección de commits ──
type Commit = { sha: string; corto: string; hora: string; asunto: string; autor: string; archivos: string[] };

function leerEstado(): string | null {
    if (!fs.existsSync(ESTADO)) return null;
    const s = fs.readFileSync(ESTADO, "utf8").trim();
    return s || null;
}

function guardarEstado(sha: string) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(ESTADO, `${sha}\n`, "utf8");
}

function cuerpo(sha: string): string {
    return git(["log", "-1", "--format=%B", sha]);
}

/** ¿El commit lo hizo Claude Code? Se detecta por su trailer Co-Authored-By. */
function esDeClaude(sha: string): boolean {
    return /Co-Authored-By:\s*Claude/i.test(cuerpo(sha));
}

/** Commits desde `desde` (exclusivo) hasta HEAD, del más viejo al más nuevo. */
function commitsDesde(desde: string | null): Commit[] {
    const args = desde
        ? ["log", "--reverse", "--format=%H|%h|%ad|%s|%an", "--date=format:%H:%M:%S", `${desde}..HEAD`]
        : ["log", "-n", "1", "--format=%H|%h|%ad|%s|%an", "--date=format:%H:%M:%S"];
    return git(args)
        .split(/\r?\n/)
        .filter(Boolean)
        .map((linea) => commitPorSha(linea.split("|")[0]));
}

// ── Verificación ──
type Check = { nombre: string; ok: boolean; detalle: string };

function verificar(c: Commit): Check[] {
    const checks: Check[] = [];

    // Tipos: siempre, porque los tipos de Next y Prisma son globales del proyecto.
    const tsc = correr("npx.cmd", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
    checks.push({
        nombre: "tsc --noEmit",
        ok: tsc.codigo === 0 && tsc.salida.length === 0,
        detalle: tsc.salida || "sin salida",
    });

    // Lint solo de los archivos tocados: el resto del repo ya está limpio y
    // lint-ear todo cada vez sería lento para nada.
    const linteables = c.archivos.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f));
    if (linteables.length > 0) {
        const eslint = correr("npx.cmd", ["eslint", ...linteables.map((f) => `"${f}"`)]);
        const warnings = (eslint.salida.match(/\s+warning\s+/g) ?? []).length;
        checks.push({
            nombre: `eslint (${linteables.length} archivo(s) tocado(s))`,
            ok: eslint.codigo === 0,
            detalle: eslint.codigo === 0 ? `0 errores, ${warnings} warning(s)` : eslint.salida,
        });
    }

    // Schema: solo si el commit lo tocó.
    if (c.archivos.includes("prisma/schema.prisma")) {
        const prisma = correr("npm.cmd", ["run", "prisma", "--", "validate"]);
        checks.push({
            nombre: "prisma validate",
            ok: prisma.codigo === 0,
            detalle: prisma.codigo === 0 ? "schema valido" : prisma.salida,
        });
    }
    return checks;
}

// ── Reporte y escalado ──
function escribirReporte(c: Commit, checks: Check[]): { archivo: string; todoOk: boolean } {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const todoOk = checks.every((x) => x.ok);
    const archivo = path.join(OUT_DIR, `${c.corto}.md`);

    const filas = checks
        .map((x) => `| ${x.ok ? "OK" : "FALLA"} | \`${x.nombre}\` | ${x.detalle.split(/\r?\n/)[0].slice(0, 160)} |`)
        .join("\n");

    const partes = [
        `# Verificacion automatica del commit ${c.corto}`,
        "",
        `- **Commit:** \`${c.sha}\``,
        `- **Asunto:** ${c.asunto}`,
        `- **Hora:** ${c.hora} · **Autor:** ${c.autor}`,
        `- **Verificado:** ${sello()} por \`npm run watch:claude\``,
        `- **Veredicto:** ${todoOk ? "PASA" : "FALLA"}`,
        "",
        "## Archivos tocados",
        "",
        c.archivos.map((f) => `- \`${f}\``).join("\n") || "- (ninguno)",
        "",
        "## Checks automaticos",
        "",
        "| Resultado | Check | Detalle |",
        "|---|---|---|",
        filas,
        "",
        "## Pendiente (no verificable sin humano)",
        "",
        "Los pasos manuales del plan que este commit cierra NO se comprueban aqui:",
        "requieren navegador, un pedido real o credenciales. Revisar el plan en",
        "`docs/superpowers/plans/` y correrlos a mano.",
        "",
    ];
    if (!todoOk) {
        partes.push("## Salida de lo que fallo", "", "```");
        for (const x of checks.filter((y) => !y.ok)) partes.push(`--- ${x.nombre} ---`, x.detalle);
        partes.push("```", "");
    }
    fs.writeFileSync(archivo, partes.join("\n"), "utf8");
    return { archivo, todoOk };
}

function tareaDeCorreccion(c: Commit, checks: Check[]) {
    const fallos = checks.filter((x) => !x.ok);
    const notas = fallos.map((f) => `${f.nombre}: ${f.detalle.split(/\r?\n/)[0].slice(0, 160)}`).join(" | ");
    log(`   creando tarea de correccion por ${fallos.length} check(s) fallido(s)...`);
    const r = correr("npm.cmd", [
        "run", "tasks", "--", "assign", `"Corregir verificacion fallida del commit ${c.corto}"`,
        "--prioridad", "alta",
        "--files", `"${c.archivos.join(",")}"`,
        "--criterio", `"los checks de docs/verifications/${c.corto}.md vuelven a pasar"`,
        "--contexto", `"Vigilante automatico: el commit ${c.corto} (${c.asunto}) fallo. ${notas}"`,
        "--by", "watch-claude", "--to", "cline",
    ]);
    log(r.codigo === 0 ? "   tarea creada en la cola" : `   no se pudo crear la tarea: ${r.salida.slice(0, 200)}`);
}

// ── Un commit: verificar, reportar, escalar ──
function commitPorSha(sha: string): Commit {
    const [s, corto, hora, asunto, autor] = git([
        "log", "-1", "--format=%H|%h|%ad|%s|%an", "--date=format:%H:%M:%S", sha,
    ]).split("|");
    const archivos = git(["show", "--name-only", "--format=", sha]).split(/\r?\n/).filter(Boolean);
    return { sha: s, corto, hora, asunto, autor, archivos };
}

function procesar(c: Commit) {
    log(`commit de Claude: ${c.corto} — ${c.asunto}`);
    const checks = verificar(c);
    const { archivo, todoOk } = escribirReporte(c, checks);
    for (const x of checks) {
        log(`   ${x.ok ? "[OK]  " : "[FALLA]"} ${x.nombre}: ${x.detalle.split(/\r?\n/)[0].slice(0, 90)}`);
    }
    log(`   ${todoOk ? "PASA" : "FALLA"} -> ${path.relative(ROOT, archivo).replace(/\\/g, "/")}`);
    if (!todoOk) tareaDeCorreccion(c, checks);
    guardarEstado(c.sha);
}

function dormir(ms: number) {
    // Atomics.wait es la forma sincrona de dormir sin busy-wait.
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

// ── Bucle principal ──
function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    let ultimo = DESDE ?? leerEstado();

    if (!ultimo) {
        // Primera corrida sin estado: se verifica el commit mas reciente que
        // SI sea de Claude (no el HEAD a ciegas, que puede ser mio o tuyo).
        const recientes = git(["log", "-n", "12", "--format=%H"]).split(/\r?\n/).filter(Boolean);
        const deClaude = recientes.find((s) => esDeClaude(s));
        if (deClaude) {
            procesar(commitPorSha(deClaude));
            ultimo = deClaude;
        } else {
            log("no encontre ningun commit reciente de Claude; solo vigilo de aqui en adelante");
            ultimo = git(["rev-parse", "HEAD"]);
            guardarEstado(ultimo);
        }
    }

    if (UNA_VEZ) return;

    log(`vigilando cada ${INTERVALO_MS / 1000}s${MINUTOS > 0 ? ` por ${MINUTOS} minuto(s)` : " (Ctrl+C para salir)"}`);
    const arranque = Date.now();
    for (;;) {
        dormir(INTERVALO_MS);
        for (const c of commitsDesde(ultimo)) {
            if (!INCLUIR_PROPIOS && !esDeClaude(c.sha)) {
                ultimo = c.sha; // commit propio: se marca visto sin verificar
                guardarEstado(c.sha);
                continue;
            }
            procesar(c);
            ultimo = c.sha;
        }
        if (MINUTOS > 0 && Date.now() - arranque > MINUTOS * 60 * 1000) {
            log(`se cumplieron ${MINUTOS} minuto(s) de vigilancia; me apago solo`);
            return;
        }
    }
}

try {
    main();
} catch (err: any) {
    console.error(`\nError del vigilante: ${err?.message || err}`);
    process.exit(1);
}


