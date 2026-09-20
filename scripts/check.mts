/**
 * Verificación de un cambio en UN comando — Cremería del Rancho.
 *
 * Existe porque el ciclo "cambio -> tres comandos -> leer tres salidas" era el
 * cuello de botella de los dos agentes: Claude Code validaba con varias llamadas
 * y Cline repetía lo mismo a mano, con dos turnos de chat en medio. Aquí se corre
 * todo junto y se imprime UN veredicto (PASA / FALLA) con lo mínimo para arreglarlo.
 *
 * Qué corre:
 *   1. npx.cmd tsc --noEmit -p tsconfig.json   (siempre, salvo --rapido)
 *   2. npm.cmd run prisma -- validate          (solo si cambió prisma/ o con --todo)
 *   3. npx.cmd eslint <archivos tocados>       (solo lo tocado, o todo con --todo)
 *
 * Uso:
 *   npm run check              # valida lo que cambió vs HEAD (incluye sin commitear)
 *   npm run check -- --todo    # valida todo el repo aunque no haya cambios
 *   npm run check -- --rapido  # sin tsc (para iterar rápido sobre lint)
 *
 * Sale con código 1 si algún check falla: sirve como candado antes de commitear.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const TODO = argv.includes("--todo");
const RAPIDO = argv.includes("--rapido");

type Resultado = { nombre: string; ok: boolean; salida: string; ms: number; omitido?: string };

/** Corre un comando del proyecto y devuelve código de salida y salida combinada. */
function correr(cmd: string, args: string[]): { codigo: number; salida: string } {
    const r = spawnSync(cmd, args, {
        cwd: ROOT,
        shell: true, // los .cmd de npm/npx lo necesitan en Windows
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    return { codigo: r.status ?? 1, salida: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

function git(args: string[]): string[] {
    const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    return String(r.stdout || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Archivos tocados: lo que cambió vs HEAD más lo nuevo sin commitear. Se incluyen
 * los sin commitear a propósito, porque es justo el momento en que se valida.
 */
function archivosTocados(): string[] {
    const lista = [...git(["diff", "--name-only", "HEAD"]), ...git(["ls-files", "--others", "--exclude-standard"])];
    return [...new Set(lista)].filter((f) => fs.existsSync(path.join(ROOT, f)));
}

const EXTENSION_TS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function medir(nombre: string, cmd: string, args: string[]): Resultado {
    const t0 = Date.now();
    const r = correr(cmd, args);
    return { nombre, ok: r.codigo === 0, salida: r.salida, ms: Date.now() - t0 };
}

function muestra(salida: string, maxLineas = 40): string {
    const lineas = salida.split(/\r?\n/);
    if (lineas.length <= maxLineas) return lineas.join("\n");
    return [...lineas.slice(0, maxLineas), `… [${lineas.length - maxLineas} líneas más]`].join("\n");
}

// ── Plan de checks ──
const tocados = TODO ? [] : archivosTocados();
const paraLint = TODO ? [] : tocados.filter((f) => EXTENSION_TS.test(f));
const tocaPrisma = TODO || tocados.some((f) => f.startsWith("prisma/"));

console.log("════════════════════════════════════════════════════════");
console.log("  Verificación del cambio — Cremería del Rancho");
console.log("════════════════════════════════════════════════════════");
console.log(`▸ Modo:      ${TODO ? "--todo (repo completo)" : "--cambio (vs HEAD)"}${RAPIDO ? " · sin tsc" : ""}`);
console.log(`▸ Tocados:   ${tocados.length === 0 ? "ninguno" : `${tocados.length} archivo(s)`}`);
if (!TODO && tocados.length > 0 && tocados.length <= 12) for (const f of tocados) console.log(`             ${f}`);
console.log("");

const resultados: Resultado[] = [];

if (RAPIDO) {
    resultados.push({ nombre: "Tipos (tsc --noEmit)", ok: true, salida: "", ms: 0, omitido: "--rapido" });
} else {
    console.log("▸ Corriendo tipos (tsc)…");
    resultados.push(medir("Tipos (tsc --noEmit)", "npx.cmd", ["tsc", "--noEmit", "-p", "tsconfig.json"]));
}

if (tocaPrisma) {
    console.log("▸ Corriendo schema de Prisma…");
    resultados.push(medir("Schema (prisma validate)", "npm.cmd", ["run", "prisma", "--", "validate"]));
}

if (TODO) {
    console.log("▸ Corriendo lint de todo el repo…");
    resultados.push(medir("Lint (eslint .)", "npx.cmd", ["eslint", "."]));
} else if (paraLint.length > 0) {
    console.log(`▸ Corriendo lint de ${paraLint.length} archivo(s)…`);
    resultados.push(medir(`Lint (${paraLint.length} archivo(s))`, "npx.cmd", ["eslint", ...paraLint]));
} else {
    resultados.push({
        nombre: "Lint (eslint)",
        ok: true,
        salida: "",
        ms: 0,
        omitido: tocados.length === 0 ? "no hay archivos tocados" : "ningún archivo TS/JS tocado",
    });
}

// ── Veredicto ──
console.log("");
for (const r of resultados) {
    const quien = r.omitido ? "·   " : r.ok ? "[OK]  " : "[FALLA]";
    const seg = r.omitido ? `— omitido (${r.omitido})` : `— ${(r.ms / 1000).toFixed(1)} s`;
    console.log(`${quien} ${r.nombre} ${seg}`);
}
const fallidos = resultados.filter((r) => !r.ok);
for (const r of fallidos) {
    console.log("────────────────────────────────────────────────────────");
    console.log(`▼ ${r.nombre}`);
    console.log(muestra(r.salida));
}
const veredicto = fallidos.length === 0 ? "PASA" : "FALLA";
console.log("════════════════════════════════════════════════════════");
console.log(`  VEREDICTO: ${veredicto}  (${resultados.length - fallidos.length}/${resultados.length} checks)`);
console.log("════════════════════════════════════════════════════════");
if (fallidos.length > 0) {
    console.log("  Arregla lo de arriba y vuelve a correr: npm run check");
    process.exit(1);
}
