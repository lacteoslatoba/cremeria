/**
 * Carril rápido de la cola de trabajo — Cremería del Rancho.
 *
 * Por qué existe: el ciclo completo (Claude asigna → Cline reclama → Cline edita →
 * Cline valida → Cline cierra) necesita un turno de chat humano en medio, y ahí se
 * pierden los minutos. Este script deja que la MÁQUINA avance la cola: reclama la
 * tarea, invoca a Claude Code headless para que la implemente (ya tiene los permisos
 * preaprobados de `.claude/settings.json`), corre `npm run check` y **solo si el
 * check PASA** commitea y cierra la tarea con la evidencia. Si el check falla, deja
 * la nota del fallo y NO la marca hecha: queda en_proceso para que alguien la vea.
 *
 * Reglas de seguridad, a propósito:
 *   - Nunca hace push ni despliega (eso es decisión del usuario).
 *   - Nunca cierra una tarea en la que no cambió ni un archivo: eso sería un falso
 *     "listo". Lo reporta como nota y sigue.
 *   - Solo commitea los archivos que quedaron sucios DURANTE la tarea, así no se
 *     lleva por delante el trabajo sin commitear del otro agente.
 *
 * Uso:
 *   npm run queue:auto                        # muestra el plan y no toca nada
 *   npm run queue:auto -- --yes               # ejecuta de verdad
 *   npm run queue:auto -- --yes --limite 2    # máximo 2 tareas (por defecto 1)
 *   npm run queue:auto -- --yes --para claude-code
 *   npm run queue:auto -- --yes --seguir      # no se detiene en el primer fallo
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_DIR = path.join(ROOT, "docs", "tasks");
const ORDEN_PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

// ── Argumentos ──
const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
    const i = argv.indexOf(name);
    return i !== -1 ? argv[i + 1] : undefined;
}
const EJECUTAR = argv.includes("--yes");
const SEGUIR = argv.includes("--seguir");
const LIMITE = Math.max(1, Number(flag("--limite") ?? 1));
const PARA = (flag("--para") ?? "cline").toLowerCase();
const MINUTOS_MAX = Math.max(1, Number(flag("--minutos") ?? 15));

// ── Shell ──
/**
 * Con `shell: true` (necesario para los .cmd de npm/npx en Windows) Node NO escapa
 * los argumentos: los pega con espacios y cmd.exe los vuelve a partir. Eso rompió
 * de verdad el 20/09/2026: el mensaje del commit se partió y git leyó "T-0008:" como
 * pathspec, y una nota con paréntesis ni llegó a ejecutarse. Por eso todo texto libre
 * pasa por aquí antes de salir a la línea de comandos.
 */
function cita(arg: string): string {
    return /[\s"()&|<>^%]/.test(arg) ? `"${arg.replace(/"/g, " ")}"` : arg;
}

function correr(cmd: string, args: string[], shell = true): { codigo: number; salida: string } {
    const r = spawnSync(cmd, shell ? args.map(cita) : args, {
        cwd: ROOT,
        shell, // los .cmd de npm/npx lo necesitan en Windows; git NO (es .exe)
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: MINUTOS_MAX * 60 * 1000, // sin esto una llamada colgada detiene todo
    });
    const salida = `${r.stdout || ""}${r.stderr || ""}`.trim();
    if (r.error) return { codigo: 1, salida: `${salida}\n${r.error.message}`.trim() };
    return { codigo: r.status ?? 1, salida };
}

function git(args: string[]): string {
    const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return String(r.stdout || "").trim();
}

function dormir(ms: number) {
    // Atomics.wait es la forma sincrona de dormir sin busy-wait (mismo patrón que watch-claude).
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

// ── Cola ──
type Tarea = { id: string; archivo: string; titulo: string; prioridad: string; asignadoA: string };

function leerTareas(): Tarea[] {
    if (!fs.existsSync(TASKS_DIR)) return [];
    return fs
        .readdirSync(TASKS_DIR)
        .filter((f) => /^T-\d{4,}-.*\.md$/.test(f))
        .map((f) => {
            const raw = fs.readFileSync(path.join(TASKS_DIR, f), "utf8");
            const cab = raw.split(/^---\s*$/m)[1] ?? "";
            const campo = (k: string) => (new RegExp(`^${k}:\\s*(.*)$`, "m").exec(cab)?.[1] ?? "").trim();
            return {
                id: campo("id"),
                archivo: f,
                titulo: campo("titulo"),
                prioridad: campo("prioridad") || "media",
                asignadoA: (campo("asignado-a") || "cline").toLowerCase(),
            };
        });
}

function pendientes(para: string): Tarea[] {
    // El estado se relee del disco en cada llamada: así una tarea que se cerró en
    // medio de la corrida no se vuelve a tomar.
    return leerTareas()
        .filter((t) => {
            const raw = fs.readFileSync(path.join(TASKS_DIR, t.archivo), "utf8");
            return /^estado:\s*pendiente\s*$/m.test(raw) && t.asignadoA === para;
        })
        .sort((a, b) => (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) || a.id.localeCompare(b.id));
}

/** Archivos sucios del repo (incluye nuevos), para saber qué tocó la tarea. */
function sucios(): Set<string> {
    const lineas = git(["status", "--porcelain", "-uall"]).split(/\r?\n/).filter(Boolean);
    return new Set(lineas.map((l) => l.slice(3).trim().replace(/^"|"$/g, "").replace(/\\/g, "/")));
}

function commitConReintento(archivos: string[], mensaje: string, cuerpo: string): string | null {
    // El otro agente commitea en el mismo repo: si choca el index.lock, se reintenta
    // en vez de perder el trabajo (pasó de verdad el 20/09/2026).
    for (let intento = 1; intento <= 6; intento++) {
        // git va sin shell: es un .exe, y así Node cita los argumentos por su cuenta
        // (con shell el mensaje con espacios se partía en pathspecs).
        correr("git", ["add", "--", ...archivos], false);
        const r = correr("git", ["commit", "-m", mensaje, "-m", cuerpo], false);
        if (r.codigo === 0) return git(["rev-parse", "--short", "HEAD"]);
        if (!/index\.lock|another git process/i.test(r.salida)) {
            log(`   no se pudo commitear: ${r.salida.split(/\r?\n/)[0]}`);
            return null;
        }
        log(`   index.lock ocupado (intento ${intento}/6); espero 5 s…`);
        dormir(5000);
    }
    return null;
}

/** La tarea sigue en pendiente en el disco? Si otro agente ya la tomó, no la pisamos. */
function siguePendiente(t: Tarea): boolean {
    const raw = fs.readFileSync(path.join(TASKS_DIR, t.archivo), "utf8");
    if (/^estado:\s*pendiente\s*$/m.test(raw)) return true;
    const estado = /^estado:\s*(.*)$/m.exec(raw)?.[1]?.trim() ?? "?";
    const quien = /^asignado-a:\s*(.*)$/m.exec(raw)?.[1]?.trim() ?? "?";
    log(`   ⏭ ${t.id} ya no está pendiente (estado=${estado}, asignada a ${quien}): la salto.`);
    log("      (dos agentes en el mismo repo: si la tomó el otro, no la atropello)");
    return false;
}

/**
 * Las notas viajan como argumento de `npm run tasks -- note|done --notas "…"`, o sea
 * por la línea de comando de Windows: saltos de línea y comillas dobles ahí rompen el
 * parseo de npm. Se aplanan a una sola línea y se recortan.
 */
function unaLinea(texto: string, max = 900): string {
    return texto.replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, max);
}

// ── Una tarea ──
type Resultado = "cerrada" | "fallida" | "sin-cambios" | "saltada";

function procesar(t: Tarea): Resultado {
    log(`▶ ${t.id} — ${t.titulo}`);
    // Antes de tocar nada: si el otro agente ya la tomó, se salta (pasó el 20/09/2026
    // con T-0008: las dos sesiones la trabajaron a la vez).
    if (!siguePendiente(t)) return "saltada";
    const antes = sucios();

    const claim = correr("npm.cmd", ["run", "tasks", "--", "claim", t.id, "--to", PARA]);
    if (claim.codigo !== 0) {
        log(`   ✗ no pude reclamarla: ${claim.salida.split(/\r?\n/)[0]}`);
        return "saltada";
    }

    const encargo = [
        `Lee docs/tasks/${t.archivo} y haz exactamente lo que pide esa tarea del repo Cremeria.`,
        'Implementala en el codigo y corre "npm.cmd run check" hasta que diga PASA.',
        "No hagas push ni despliegues. Si la tarea necesita algo que no puedes hacer",
        "(navegador, credenciales, decidir un despliegue), dilo claro en vez de inventarlo.",
        "Al final responde en 12 lineas maximo con: Hice / Evidencia / Abierto.",
    ].join(" ");

    const tmp = path.join(os.tmpdir(), `queue-auto-${t.id}-${Date.now()}.md`);
    log(`   Claude Code trabajando (máx ${MINUTOS_MAX} min)…`);
    const claude = correr("npm.cmd", ["run", "claude", "--", encargo, "--max-tokens", "3000", "--out", tmp]);
    if (claude.codigo !== 0) log(`   el puente falló: ${claude.salida.split(/\r?\n/).slice(-3).join(" ")}`);
    const respuesta = fs.existsSync(tmp) ? fs.readFileSync(tmp, "utf8").trim() : claude.salida.trim();
    fs.rmSync(tmp, { force: true });
    log(`   respuesta de Claude: ${unaLinea(respuesta, 110)}`);

    log("   verificando con npm run check…");
    const check = correr("npm.cmd", ["run", "check"]);
    const veredicto = check.salida.split(/\r?\n/).filter((l) => /VEREDICTO|\[FALLA\]/.test(l)).map((l) => l.trim()).join(" | ");
    const despues = sucios();
    const nuevos = [...despues].filter((f) => !antes.has(f));

    const nota = unaLinea(
        `Carril rapido (queue:auto) ${new Date().toISOString().slice(0, 19).replace("T", " ")} — ` +
        `check: ${check.codigo === 0 ? "PASA" : "FALLA"} (${veredicto || "sin veredicto"}). ` +
        `Archivos tocados: ${nuevos.length === 0 ? "ninguno" : nuevos.join(", ")}. ` +
        `Respuesta de Claude Code: ${respuesta || "(vacia)"}`,
    );

    if (check.codigo !== 0) {
        const rNota = correr("npm.cmd", ["run", "tasks", "--", "note", t.id, "--notas", nota, "--by", "queue-auto"]);
        if (rNota.codigo !== 0) log("   ⚠ tampoco pude guardar la nota en el expediente");
        log(`   ✗ ${t.id} queda en_proceso: el check falló.`);
        return "fallida";
    }
    if (nuevos.length === 0) {
        // Sin cambios no se cierra: marcarla hecha sería un falso "listo".
        const rNota = correr("npm.cmd", ["run", "tasks", "--", "note", t.id, "--notas", `${nota} NO se cerro: no hubo cambios en el repo.`, "--by", "queue-auto"]);
        if (rNota.codigo !== 0) log("   ⚠ tampoco pude guardar la nota en el expediente");
        log(`   ⚠ ${t.id} no tocó archivos; queda en_proceso con la nota.`);
        return "sin-cambios";
    }

    // El expediente de la tarea viaja en el commit: es la evidencia de por qué se hizo
    // así, y si no se commitea queda fuera del historial (pasó con T-0008 y T-0009).
    const aCommitear = [...new Set([...nuevos, `docs/tasks/${t.archivo}`])].filter((f) => fs.existsSync(path.join(ROOT, f)));
    const sha = commitConReintento(aCommitear, `task ${t.id}: ${sinAcentos(t.titulo).slice(0, 60)}`, sinAcentos(unaLinea(respuesta, 1200)));
    if (!sha) {
        // Sin commit NO se cierra: cerrar con el commit fallido fue justo el bug del 20/09/2026.
        const rNota = correr("npm.cmd", ["run", "tasks", "--", "note", t.id, "--notas", `${nota} NO se cerro: el commit fallo.`, "--by", "queue-auto"]);
        if (rNota.codigo !== 0) log("   ⚠ tampoco pude guardar la nota en el expediente");
        log(`   ✗ ${t.id} queda en_proceso: no se pudo commitear.`);
        return "fallida";
    }
    const cierre = unaLinea(`${nota} Commit local ${sha} (sin push).`);
    const done = correr("npm.cmd", ["run", "tasks", "--", "done", t.id, "--notas", cierre, "--by", "queue-auto"]);
    if (done.codigo !== 0) {
        log(`   ⚠ el commit quedó (${sha}) pero no pude cerrar la tarea: ${done.salida.split(/\r?\n/)[0]}`);
        return "fallida";
    }
    log(`   ✅ ${t.id} cerrada en ${sha}.`);
    // El `done` anexa las notas de cierre DESPUÉS del commit, así que el expediente
    // vuelve a quedar sucio: si eso pasa, se commitea también, para que la evidencia
    // no se quede fuera del historial (visto con T-0010).
    if (sucios().has(`docs/tasks/${t.archivo}`)) {
        const shaNotas = commitConReintento([`docs/tasks/${t.archivo}`], `task ${t.id}: notas de cierre`, "");
        log(shaNotas ? `   📝 notas de cierre en ${shaNotas}.` : "   ⚠ las notas de cierre quedaron sin commitear.");
    }
    return "cerrada";
}

// ── Principal ──
function main() {
    const lista = pendientes(PARA).slice(0, LIMITE);
    console.log("════════════════════════════════════════════════════════");
    console.log("  Carril rápido de la cola — Cremería del Rancho");
    console.log("════════════════════════════════════════════════════════");
    console.log(`▸ Responsable: ${PARA} · límite ${LIMITE} tarea(s) · ${EJECUTAR ? "EJECUTA" : "dry-run (no se toca nada)"}`);
    if (lista.length === 0) {
        console.log(`\n✅ No hay pendientes para "${PARA}". Nada que hacer.`);
        return;
    }
    console.log("\n  Plan:");
    for (const t of lista) console.log(`  ⬜ ${t.id} [${t.prioridad}] ${t.titulo}`);
    if (!EJECUTAR) {
        console.log("\n  Para ejecutarlo de verdad:  npm run queue:auto -- --yes");
        return;
    }

    console.log("");
    const cuenta: Record<Resultado, number> = { cerrada: 0, fallida: 0, "sin-cambios": 0, saltada: 0 };
    for (const t of lista) {
        const r = procesar(t);
        cuenta[r]++;
        // Solo un fallo detiene la corrida: una tarea saltada o sin cambios no es un
        // error (el otro agente la tomó, o la tarea no necesitaba tocar código).
        if (r === "fallida" && !SEGUIR) {
            log("me detengo aqui (usa --seguir para continuar con las demas)");
            break;
        }
    }
    console.log("\n════════════════════════════════════════════════════════");
    console.log(
        `  Cerradas: ${cuenta.cerrada} · fallidas: ${cuenta.fallida} · sin cambios: ${cuenta["sin-cambios"]} · saltadas: ${cuenta.saltada}`,
    );
    console.log("  Recuerda: nada se subió al remoto; el push sigue siendo decisión del usuario.");
    console.log("════════════════════════════════════════════════════════");
}

try {
    main();
} catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nError del carril rápido: ${msg}`);
    process.exit(1);
}


function log(...partes: string[]) {
    console.log(`[${new Date().toLocaleTimeString("es-MX", { hour12: false })}]`, ...partes);
}

function sinAcentos(texto: string): string {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
