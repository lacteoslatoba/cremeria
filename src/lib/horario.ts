// Horario de pedidos. Vive en la fila unica de Business (aperturaMin/cierreMin,
// minutos desde medianoche) y el admin lo mueve desde Perfil -- p. ej. cerrar
// mas tarde un dia de mucha venta. Aqui solo hay funciones puras (sin Prisma)
// para poder probarlas y usarlas tambien desde componentes de cliente.
//
// Hora de Baja California Sur (America/Mazatlan, UTC-7 todo el año desde que
// Mexico quito el horario de verano en 2022 -- NO es la hora del servidor, que
// en Vercel corre en UTC).
export const ZONA_HORARIA_NEGOCIO = "America/Mazatlan";

export const APERTURA_POR_DEFECTO = 8 * 60;
export const CIERRE_POR_DEFECTO = 16 * 60;

export type Horario = { aperturaMin: number; cierreMin: number };

/** Minutos desde medianoche, en la hora del negocio. */
export function minutosDelNegocio(fecha: Date = new Date()): number {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: ZONA_HORARIA_NEGOCIO,
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
    }).formatToParts(fecha);
    const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
    return valor("hour") * 60 + valor("minute");
}

export function dentroDeHorario(horario: Horario, fecha: Date = new Date()): boolean {
    const ahora = minutosDelNegocio(fecha);
    return ahora >= horario.aperturaMin && ahora < horario.cierreMin;
}

/** Apertura antes del cierre, los dos dentro del mismo dia (0:00 a 23:59). */
export function horarioValido(aperturaMin: unknown, cierreMin: unknown): boolean {
    return (
        Number.isInteger(aperturaMin) &&
        Number.isInteger(cierreMin) &&
        (aperturaMin as number) >= 0 &&
        (cierreMin as number) <= 23 * 60 + 59 &&
        (aperturaMin as number) < (cierreMin as number)
    );
}

/** 480 -> "08:00" (el formato de <input type="time">). */
export function minutosAHHMM(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "16:30" -> 990; null si no es una hora valida. */
export function hhmmAMinutos(texto: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

/** 960 -> "4:00 pm" (como se le dice al cliente). */
export function horaLegible(min: number): string {
    const h = Math.floor(min / 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
