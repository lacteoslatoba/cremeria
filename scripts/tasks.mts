/**
 * Cola de trabajo entre agentes — Cremería del Rancho.
 *
 * Permite que un Claude (Claude Code, otra sesión, o tú a mano) ASIGNE tareas,
 * y que el agente que trabaja en el repo (Cline) las reclame y las cierre.
 * Cada tarea es un archivo en docs/tasks/, así que todo pasa por git y queda
 * historial sin gastar tokens repitiendo contexto.
 *
 * Uso:
 *   npm run tasks -- list                    # todas, con estado
 *   npm run tasks -- list --estado pendiente
 *   npm run tasks -- assign "Título" --files src/x.ts --criterio "compila y lint pasa"
 *   npm run tasks -- next                    # la siguiente pendiente (para el worker)
 *   npm run tasks -- next --json
 *   npm run tasks -- take                    # claim + expediente, en un solo paso
 *   npm run tasks -- take T-0001             # igual, pero de una tarea concreta
 *   npm run tasks -- claim T-0001            # la marca en_proceso
 *   npm run tasks -- note T-0001 --notas "hallazgo parcial"   # sin cerrar la tarea
 *   npm run tasks -- reopen T-0001 --motivo "se cortó a medias" # vuelve a pendiente
 *   npm run tasks -- done T-0001 --notas "listo, tests OK"
 *   npm run tasks -- block T-0001 --motivo "falta la API key de Stripe"
 *   npm run tasks -- show T-0001
 *
 * Banderas de assign: --files, --criterio, --prioridad (alta|media|baja),
 *                     --by (quién asigna), --to (quién ejecuta), --contexto
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_DIR = path.join(ROOT, "docs", "tasks");
const ESTADOS = ["pendiente", "en_proceso", "bloqueada", "hecho"] as const;
const ORDEN_PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

type Task = {
    id: string;
    archivo: string;
    titulo: string;
    estado: string;
    prioridad: string;
    asignadoPor: string;
    asignadoA: string;
    creado: string;
    actualizado: string;
    archivos: string;
    criterio: string;
    contexto: string;
    cuerpo: string;
};

// ── Utilidades de archivo ──
function slugify(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}

function archivosDeTarea(): string[] {
    if (!fs.existsSync(TASKS_DIR)) return [];
    return fs
        .readdirSync(TASKS_DIR)
        .filter((f) => /^T-\d{4,}-.*\.md$/.test(f))
        .sort();
}

function parsear(abs: string): Task {
    const raw = fs.readFileSync(abs, "utf8");
    const lineas = raw.split(/\r?\n/);
    const head: Record<string, string> = {};
    let i = 0;
    let j = -1;
    // Buscar el bloque de cabecera delimitado por ---
    for (; i < lineas.length; i++) {
        if (lineas[i].trim() === "---") {
            for (j = i + 1; j < lineas.length; j++) {
                if (lineas[j].trim() === "---") break;
                const eq = lineas[j].indexOf(":");
                if (eq === -1) continue;
                head[lineas[j].slice(0, eq).trim()] = lineas[j].slice(eq + 1).trim();
            }
            break;
        }
    }
    const cuerpo = j !== -1 ? lineas.slice(j + 1).join("\n").trim() : raw.trim();
    return {
        id: head.id ?? "?",
        archivo: path.basename(abs),
        titulo: head.titulo ?? "(sin título)",
        estado: head.estado ?? "pendiente",
        prioridad: head.prioridad ?? "media",
        asignadoPor: head["asignado-por"] ?? "desconocido",
        asignadoA: head["asignado-a"] ?? "cline",
        creado: head.creado ?? "",
        actualizado: head.actualizado ?? "",
        archivos: head.archivos ?? "",
        criterio: head.criterio ?? "",
        contexto: head.contexto ?? "",
        cuerpo,
    };
}

function todas(): Task[] {
    return archivosDeTarea().map((f) => parsear(path.join(TASKS_DIR, f)));
}

/** Actualiza solo las claves indicadas dentro de la cabecera, sin tocar el cuerpo. */
function actualizarCabecera(t: Task, patch: Record<string, string>) {
    const abs = path.join(TASKS_DIR, t.archivo);
    const lineas = fs.readFileSync(abs, "utf8").split(/\r?\n/);
    const inicio = lineas.findIndex((l) => l.trim() === "---");
    if (inicio === -1) throw new Error(`La tarea ${t.id} no tiene cabecera válida.`);
    const fin = lineas.findIndex((l, k) => k > inicio && l.trim() === "---");
    if (fin === -1) throw new Error(`La tarea ${t.id} no cierra la cabecera con ---.`);

    const usadas = new Set<string>();
    for (let k = inicio + 1; k < fin; k++) {
        const eq = lineas[k].indexOf(":");
        if (eq === -1) continue;
        const clave = lineas[k].slice(0, eq).trim();
        if (clave in patch) {
            lineas[k] = `${clave}: ${patch[clave]}`;
            usadas.add(clave);
        }
    }
    for (const [clave, valor] of Object.entries(patch)) {
        if (!usadas.has(clave)) lineas.splice(fin, 0, `${clave}: ${valor}`);
    }
    fs.writeFileSync(abs, lineas.join("\n"), "utf8");
}

function buscar(id: string): Task {
    const t = todas().find((x) => x.id.toLowerCase() === id.toLowerCase());
    if (!t) throw new Error(`No existe la tarea "${id}". Corre: npm run tasks -- list`);
    return t;
}

// ── Argumentos ──
const argv = process.argv.slice(2);
const comando = (argv[0] ?? "list").toLowerCase();
const args = argv.slice(1);
function flag(name: string): string | undefined {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
}
const CON_VALOR = new Set(["--estado", "--files", "--criterio", "--prioridad", "--by", "--to", "--para", "--notas", "--motivo", "--contexto"]);
/** `--forzar` salta el aviso de "ya la está trabajando otro agente". */
const FORZAR = args.includes("--forzar");
function posicional(): string {
    const out: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (CON_VALOR.has(args[i])) {
            i++;
            continue;
        }
        if (args[i].startsWith("--")) continue;
        out.push(args[i]);
    }
    return out.join(" ").trim();
}

const iconoEstado = (e: string) => (e === "hecho" ? "✅" : e === "en_proceso" ? "🔄" : e === "bloqueada" ? "🚧" : "⬜");
const ahora = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function imprimirTabla(lista: Task[]) {
    if (lista.length === 0) {
        console.log("  (sin tareas)");
        return;
    }
    for (const t of lista) {
        const prio = t.prioridad === "alta" ? "!!" : t.prioridad === "baja" ? " ·" : "  ";
        console.log(`  ${iconoEstado(t.estado)} ${prio} ${t.id}  ${t.titulo}`);
        console.log(`         estado=${t.estado} · prioridad=${t.prioridad} · ${t.asignadoPor} → ${t.asignadoA}`);
        if (t.archivos) console.log(`         archivos: ${t.archivos}`);
    }
}

function imprimirDetalle(t: Task) {
    console.log("════════════════════════════════════════════════════════");
    console.log(`  ${t.id} — ${t.titulo}`);
    console.log("════════════════════════════════════════════════════════");
    console.log(`▸ Estado:     ${iconoEstado(t.estado)} ${t.estado}`);
    console.log(`▸ Prioridad:  ${t.prioridad}`);
    console.log(`▸ Asignada:   ${t.asignadoPor} → ${t.asignadoA}`);
    console.log(`▸ Creada:     ${t.creado}   (actualizada: ${t.actualizado})`);
    if (t.archivos) console.log(`▸ Archivos:   ${t.archivos}`);
    if (t.criterio) console.log(`▸ Criterio:   ${t.criterio}`);
    if (t.contexto) console.log(`▸ Contexto:   ${t.contexto}`);
    console.log(`▸ Expediente: docs/tasks/${t.archivo}`);
    if (t.cuerpo) console.log(`\n${t.cuerpo}`);
}

function cmdList() {
    const filtro = flag("--estado");
    let lista = todas();
    if (filtro) lista = lista.filter((t) => t.estado === filtro);
    lista.sort((a, b) => (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) || a.id.localeCompare(b.id));
    console.log("════════════════════════════════════════════════════════");
    console.log(`  Cola de trabajo — ${lista.length} tarea(s)${filtro ? ` · estado=${filtro}` : ""}`);
    console.log("════════════════════════════════════════════════════════");
    imprimirTabla(lista);
    const conteo = ESTADOS.map((e) => `${e}: ${todas().filter((t) => t.estado === e).length}`).join(" · ");
    console.log(`\n  ${conteo}`);
}

function cmdNext() {
    // `--para` (por defecto "cline", el agente que ejecuta): sin este filtro
    // `next` devolvía también las tareas asignadas a una persona, y el agente
    // las tomaba sin ser suyas. Las ajenas se listan aparte, nunca se reclaman.
    const para = (flag("--para") ?? "cline").toLowerCase();
    const pendientes = todas()
        .filter((t) => t.estado === "pendiente")
        .sort((a, b) => (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) || a.id.localeCompare(b.id));
    const mias = pendientes.filter((t) => t.asignadoA.toLowerCase() === para);
    const t = mias[0];

    if (!t) {
        console.log(`✅ No hay tareas pendientes para "${para}". Nada que hacer.`);
        const ajenas = pendientes.filter((x) => x.asignadoA.toLowerCase() !== para);
        if (ajenas.length > 0) {
            console.log(`\n  Hay ${ajenas.length} pendiente(s) para otro responsable (NO se toman):`);
            for (const x of ajenas) console.log(`  ⬜ ${x.id}  ${x.titulo}  → ${x.asignadoA}`);
        }
        return;
    }
    if (args.includes("--json")) {
        console.log(JSON.stringify(t, null, 2));
        return;
    }
    imprimirDetalle(t);
    console.log(`\n  ▶ Para tomarla:  npm run tasks -- claim ${t.id}`);
}

function cmdAssign() {
    const titulo = posicional();
    if (!titulo) throw new Error('Falta el título. Ej: npm run tasks -- assign "Arreglar checkout" --files src/app/checkout/page.tsx');
    if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });

    const existentes = archivosDeTarea().map((f) => Number(/^T-(\d+)/.exec(f)?.[1] ?? 0));
    const siguiente = String((existentes.length ? Math.max(...existentes) : 0) + 1).padStart(4, "0");
    const id = `T-${siguiente}`;
    const prioridad = (flag("--prioridad") ?? "media").toLowerCase();
    if (!(prioridad in ORDEN_PRIORIDAD)) throw new Error(`Prioridad inválida "${prioridad}". Usa alta, media o baja.`);
    const sello = ahora();

    const cabecera = [
        "---",
        `id: ${id}`,
        `titulo: ${titulo}`,
        "estado: pendiente",
        `prioridad: ${prioridad}`,
        `asignado-por: ${flag("--by") ?? "claude"}`,
        `asignado-a: ${flag("--to") ?? "cline"}`,
        `creado: ${sello}`,
        `actualizado: ${sello}`,
        `archivos: ${flag("--files") ?? ""}`,
        `criterio: ${flag("--criterio") ?? ""}`,
        `contexto: ${flag("--contexto") ?? ""}`,
        "---",
    ].join("\n");

    const archivo = `${id}-${slugify(titulo) || "tarea"}.md`;
    fs.writeFileSync(path.join(TASKS_DIR, archivo), `${cabecera}\n\n## Notas de ejecución\n\n_(el worker escribe aquí qué hizo, qué verificó y qué quedó pendiente)_\n`, "utf8");
    console.log(`✅ Tarea creada: ${id}`);
    console.log(`   Archivo:   docs/tasks/${archivo}`);
    console.log(`   Prioridad: ${prioridad} · ${flag("--by") ?? "claude"} → ${flag("--to") ?? "cline"}`);
    console.log("   El worker la toma con: npm run tasks -- next");
}

function anexarNota(t: Task, titulo: string, texto: string) {
    const abs = path.join(TASKS_DIR, t.archivo);
    const previo = fs.readFileSync(abs, "utf8").replace(/\s*$/, "");
    fs.writeFileSync(abs, `${previo}\n\n### ${ahora()} — ${titulo}\n\n${texto}\n`, "utf8");
}

// Compartida por claim y take: marcar en_proceso con los avisos de rigor.
function tomar(t: Task, quien: string) {
    if (t.estado === "hecho") throw new Error(`La tarea ${t.id} ya está marcada como hecha.`);
    // Dos agentes trabajan este repo a la vez: si la tarea ya la tiene otro en las
    // manos, no se pisa. Pasó de verdad el 20/09/2026 con T-0008, que la tomaron al
    // mismo tiempo el carril rápido (queue:auto) y la sesión del IDE.
    if (t.estado === "en_proceso" && t.asignadoA.toLowerCase() !== quien.toLowerCase() && !FORZAR) {
        throw new Error(`${t.id} ya la está trabajando "${t.asignadoA}". Si de verdad la quieres, repite con --forzar.`);
    }
    // Aviso, no bloqueo: a veces uno toma una tarea ajena a propósito.
    if (t.asignadoA.toLowerCase() !== quien.toLowerCase()) {
        console.log(`⚠ ${t.id} estaba asignada a "${t.asignadoA}" y la estás tomando como "${quien}".`);
    }
    actualizarCabecera(t, { estado: "en_proceso", "asignado-a": quien, actualizado: ahora() });
    console.log(`🔄 ${t.id} en_proceso (${quien}).`);
}

function cmdClaim() {
    tomar(buscar(posicional()), flag("--to") ?? "cline");
}

/**
 * `take` = claim + expediente en UN solo paso. Antes el worker gastaba tres comandos
 * (next, show, claim) y con ellos tres turnos de chat; aquí toma la suya (o la que le
 * toca por prioridad si no se pasa id) y ya sale con todo lo necesario para trabajar.
 */
function cmdTake() {
    const quien = flag("--to") ?? "cline";
    const id = posicional();
    let t: Task | undefined;

    if (id) {
        t = buscar(id);
    } else {
        const para = (flag("--para") ?? quien).toLowerCase();
        t = todas()
            .filter((x) => x.estado === "pendiente" && x.asignadoA.toLowerCase() === para)
            .sort((a, b) => (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9) || a.id.localeCompare(b.id))[0];
        if (!t) {
            console.log(`✅ No hay tareas pendientes para "${para}". Nada que tomar.`);
            return;
        }
    }

    tomar(t, quien);
    imprimirDetalle(t);
    console.log(`\n  ▶ Al terminar:  npm run tasks -- done ${t.id} --notas "qué hice y cómo lo verifiqué"`);
    console.log("  ▶ Si es un hallazgo a medias:  npm run tasks -- note " + t.id + ' --notas "lo que encontré"');
}

/**
 * `note` deja un hallazgo en el expediente SIN cambiar el estado ni cerrar la tarea:
 * es el canal barato para que un agente le deje contexto al otro (o al usuario) sobre
 * una tarea que sigue pendiente.
 */
function cmdNote() {
    const t = buscar(posicional());
    const notas = flag("--notas");
    if (!notas) throw new Error('Falta --notas "qué encontraste". Ej: npm run tasks -- note T-0006 --notas "el fix es config"');
    anexarNota(t, `nota de ${flag("--by") ?? "cline"}`, notas);
    actualizarCabecera(t, { actualizado: ahora() });
    console.log(`📝 Nota agregada a ${t.id} (sigue en estado ${t.estado}).`);
}


function cmdDone() {
    const t = buscar(posicional());
    actualizarCabecera(t, { estado: "hecho", actualizado: ahora() });
    const notas = flag("--notas");
    if (notas) anexarNota(t, `cerrada por ${flag("--by") ?? "cline"}`, notas);
    console.log(`✅ ${t.id} marcada como hecha.`);
}

function cmdBlock() {
    const t = buscar(posicional());
    const motivo = flag("--motivo") ?? "(sin motivo indicado)";
    actualizarCabecera(t, { estado: "bloqueada", actualizado: ahora() });
    anexarNota(t, "bloqueada", motivo);
    console.log(`🚧 ${t.id} bloqueada: ${motivo}`);
}

/**
 * `reopen` devuelve una tarea a pendiente. Existe porque una corrida del carril
 * rápido puede cortarse a medias (o alguien puede reclamar por error) y sin esto la
 * tarea quedaba atorada en en_proceso sin que nadie la pudiera volver a tomar.
 */
function cmdReopen() {
    const t = buscar(posicional());
    const motivo = flag("--motivo") ?? "(sin motivo)";
    actualizarCabecera(t, { estado: "pendiente", actualizado: ahora() });
    anexarNota(t, "reabierta", motivo);
    console.log(`↩ ${t.id} vuelve a pendiente: ${motivo}`);
}

function cmdShow() {
    imprimirDetalle(buscar(posicional()));
}

// ── Despacho ──
const COMANDOS: Record<string, () => void> = {
    list: cmdList,
    ls: cmdList,
    next: cmdNext,
    assign: cmdAssign,
    add: cmdAssign,
    claim: cmdClaim,
    take: cmdTake,
    reopen: cmdReopen,
    done: cmdDone,
    block: cmdBlock,
    note: cmdNote,
    show: cmdShow,
};

function main() {
    const fn = COMANDOS[comando];
    if (!fn) {
        console.error(`\n⚠ Comando desconocido: "${comando}"`);
        console.error("  Disponibles: list, next, assign, take, claim, reopen, note, done, block, show");
        process.exit(1);
    }
    fn();
}

try {
    main();
} catch (err: any) {
    console.error(`\nError: ${err?.message || err}`);
    process.exit(1);
}
