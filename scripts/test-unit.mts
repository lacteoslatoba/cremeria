/**
 * Unitarios en UN comando — Cremería del Rancho.
 *
 * Existe por una limitación concreta y comprobada: el runner de Node
 * (`node --test`) descubre archivos de prueba solo con extensiones .js/.mjs/.cjs
 * — con `tests/unit/*.test.ts` responde "0 tests" — y nuestros archivos son TS.
 * Aquí se listan explícitamente y se pasan a tsx, que sí los carga.
 *
 * Uso:
 *   npm run test:unit
 *
 * Sale con código 1 si alguna prueba falla, así sirve de candado.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_UNITARIOS = path.join(ROOT, "tests", "unit");

const archivos = fs
    .readdirSync(DIR_UNITARIOS)
    .filter((nombre) => nombre.endsWith(".test.ts"))
    .sort()
    .map((nombre) => path.join("tests", "unit", nombre));

if (archivos.length === 0) {
    console.error("No hay archivos tests/unit/*.test.ts — ¿se borraron las pruebas?");
    process.exit(1);
}

console.log("════════════════════════════════════════════════════════");
console.log("  Pruebas unitarias — Cremería del Rancho");
console.log("════════════════════════════════════════════════════════");
for (const archivo of archivos) console.log(`▸ ${archivo}`);
console.log("");

const resultado = spawnSync("npx.cmd", ["tsx", "--test", ...archivos], {
    cwd: ROOT,
    shell: true, // los .cmd de npm/npx lo necesitan en Windows
    stdio: "inherit",
});

console.log("");
if (resultado.status === 0) {
    console.log("  VEREDICTO: PASA");
} else {
    console.log("  VEREDICTO: FALLA — revisa lo de arriba");
}
process.exit(resultado.status ?? 1);
