/**
 * Validadores de entrada y topes de longitud: la primera línea contra basura,
 * cuerpos gigantes y precios/stock imposibles.
 *
 * Los topes importan de verdad: sin ellos, una "contraseña" de megabytes llega
 * a bcrypt (DoS por CPU) y un nombre de 500 MB intenta entrar a Postgres.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
    MAX_IDENTIFICADOR,
    MAX_PASSWORD,
    MIN_PASSWORD,
    dentroDeLimite,
    identificadorValido,
    parseProduct,
} from "../../src/lib/validators";

test("dentroDeLimite acepta lo normal y corta lo absurdo", () => {
    assert.equal(dentroDeLimite("6131114801", MAX_IDENTIFICADOR), true);
    assert.equal(dentroDeLimite("x".repeat(MAX_IDENTIFICADOR + 1), MAX_IDENTIFICADOR), false);
    // No-string no truena: el llamador decide qué error dar.
    assert.equal(dentroDeLimite(undefined, MAX_PASSWORD), true);
    assert.equal(dentroDeLimite(12345, MAX_PASSWORD), true);
});

test("identificadorValido rechaza vacios, espacios y textos gigantes", () => {
    assert.equal(identificadorValido("6131114801"), true);
    assert.equal(identificadorValido("   "), false);
    assert.equal(identificadorValido(""), false);
    assert.equal(identificadorValido(6131114801), false);
    assert.equal(identificadorValido("x".repeat(MAX_IDENTIFICADOR + 1)), false);
});

test("MIN_PASSWORD no es un detalle: 6 o mas", () => {
    assert.ok(MIN_PASSWORD >= 6, "un minimo menor a 6 seria una puerta abierta");
    assert.ok(MAX_PASSWORD > MIN_PASSWORD);
});

test("parseProduct limpia un producto valido", () => {
    const producto = parseProduct({ name: "  Queso  ", category: "Lácteos", price: "25.50", stock: "3" });
    assert.equal(producto.name, "Queso");
    assert.equal(producto.price, 25.5);
    assert.equal(producto.stock, 3);
    assert.equal(producto.status, "ACTIVE", "sin status explicito queda ACTIVO");
});

test("parseProduct rechaza precio negativo, con demasiados decimales o stock no entero", () => {
    const base = { name: "Queso", category: "Lácteos" };
    assert.throws(() => parseProduct({ ...base, price: -1, stock: 1 }), /Precio inválido/);
    assert.throws(() => parseProduct({ ...base, price: 10.999, stock: 1 }), /Precio inválido/);
    assert.throws(() => parseProduct({ ...base, price: 10, stock: 1.5 }), /Stock inválido/);
    assert.throws(() => parseProduct({ ...base, price: 10, stock: -1 }), /Stock inválido/);
});

test("parseProduct exige nombre y categoria", () => {
    assert.throws(() => parseProduct({ category: "X", price: 1, stock: 1 }), /nombre del producto/);
    assert.throws(() => parseProduct({ name: "X", price: 1, stock: 1 }), /categoría/);
});
