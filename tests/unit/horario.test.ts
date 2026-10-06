/**
 * Horario de pedidos: lo mueve el admin y decide si un pedido entra o no, asi
 * que un error de zona horaria o de borde (justo a la hora de cierre) le cuesta
 * ventas o deja entrar pedidos que ya no se alcanzan a entregar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
    dentroDeHorario,
    hhmmAMinutos,
    horaLegible,
    horarioValido,
    minutosAHHMM,
    minutosDelNegocio,
} from "../../src/lib/horario";

const NORMAL = { aperturaMin: 8 * 60, cierreMin: 16 * 60 };
// Mazatlan es UTC-7 todo el año: 15:00 UTC = 8:00 am local.
const utc = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00Z`);

test("minutosDelNegocio usa la hora de Baja California Sur, no la del servidor", () => {
    assert.equal(minutosDelNegocio(utc("15:00")), 8 * 60);
    assert.equal(minutosDelNegocio(utc("23:30")), 16 * 60 + 30);
    // Medianoche local no debe salir como "24".
    assert.equal(minutosDelNegocio(utc("07:05")), 5);
});

test("dentroDeHorario: abre a la hora exacta y cierra a la hora exacta", () => {
    assert.equal(dentroDeHorario(NORMAL, utc("14:59")), false);
    assert.equal(dentroDeHorario(NORMAL, utc("15:00")), true);
    assert.equal(dentroDeHorario(NORMAL, utc("22:59")), true);
    assert.equal(dentroDeHorario(NORMAL, utc("23:00")), false);
});

test("mover el cierre mas tarde deja entrar pedidos que antes no", () => {
    const tarde = { aperturaMin: 8 * 60, cierreMin: 18 * 60 + 30 };
    // 5:45 pm local
    assert.equal(dentroDeHorario(NORMAL, new Date("2026-10-06T00:45:00Z")), false);
    assert.equal(dentroDeHorario(tarde, new Date("2026-10-06T00:45:00Z")), true);
    // 6:30 pm local: ya cerro tambien el horario extendido
    assert.equal(dentroDeHorario(tarde, new Date("2026-10-06T01:30:00Z")), false);
});

test("horarioValido rechaza cierres antes de abrir y valores fuera del dia", () => {
    assert.equal(horarioValido(480, 960), true);
    assert.equal(horarioValido(0, 23 * 60 + 59), true);
    assert.equal(horarioValido(960, 480), false);
    assert.equal(horarioValido(480, 480), false);
    assert.equal(horarioValido(-1, 960), false);
    assert.equal(horarioValido(480, 24 * 60), false);
    assert.equal(horarioValido(480.5, 960), false);
    assert.equal(horarioValido("480", 960), false);
    assert.equal(horarioValido(undefined, 960), false);
});

test("conversiones de hora: ida y vuelta con el input de tipo time", () => {
    assert.equal(minutosAHHMM(480), "08:00");
    assert.equal(minutosAHHMM(990), "16:30");
    assert.equal(hhmmAMinutos("16:30"), 990);
    assert.equal(hhmmAMinutos("8:05"), 485);
    assert.equal(hhmmAMinutos("24:00"), null);
    assert.equal(hhmmAMinutos("12:60"), null);
    assert.equal(hhmmAMinutos(""), null);
    assert.equal(hhmmAMinutos("abc"), null);
});

test("horaLegible habla como el cliente", () => {
    assert.equal(horaLegible(480), "8:00 am");
    assert.equal(horaLegible(960), "4:00 pm");
    assert.equal(horaLegible(990), "4:30 pm");
    assert.equal(horaLegible(0), "12:00 am");
    assert.equal(horaLegible(12 * 60), "12:00 pm");
});
