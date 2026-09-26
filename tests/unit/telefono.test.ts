/**
 * Variantes del identificador de login: la pieza que evita que "mi cuenta no
 * existe" sea en realidad "escribí el teléfono sin guiones".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { variantesIdentificador } from "../../src/lib/telefono";

test("un movil mexicano de 10 digitos genera sus formas equivalentes", () => {
    const variantes = variantesIdentificador("6131114801");
    for (const esperada of ["6131114801", "613-111-4801", "613 111 4801", "+526131114801", "5216131114801"]) {
        assert.ok(variantes.includes(esperada), `falta la variante ${esperada}`);
    }
});

test("con guiones o con lada devuelve lo mismo (el formato no cambia la cuenta)", () => {
    const conGuiones = variantesIdentificador("613-111-4801");
    const sinGuiones = variantesIdentificador("6131114801");
    assert.ok(sinGuiones.every((v) => conGuiones.includes(v)));
});

test("un correo o usuario que no parece telefono devuelve solo el original en minusculas", () => {
    assert.deepEqual(variantesIdentificador("Juan.Perez@Ejemplo.com"), ["juan.perez@ejemplo.com"]);
    assert.deepEqual(variantesIdentificador("  mike  "), ["mike"]);
});

test("no duplica variantes", () => {
    const variantes = variantesIdentificador("6131114801");
    assert.equal(new Set(variantes).size, variantes.length);
});
