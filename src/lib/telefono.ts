/**
 * Variantes de un identificador de acceso (teléfono) para poder encontrarlo en la BD.
 *
 * Por qué existe: el teléfono se guarda tal como cada quien lo escribió —el registro lo
 * formatea con guiones ("613-111-4801"), otros caminos lo guardan pelado ("6131114801")—
 * y el campo de login NO formatea. Comparar en crudo deja fuera a quien entra sin
 * guiones aunque su cuenta exista, y eso se ve como "mi cuenta no existe". Peor: llegaron
 * a quedar DOS cuentas del mismo número, cada una con un formato distinto.
 *
 * Devuelve el texto original más las formas equivalentes del número mexicano de 10
 * dígitos (con guiones, con espacios, con lada +52/+521). Para un usuario o correo que no
 * parece teléfono devuelve solo el original, así no cambia nada.
 */
export function variantesIdentificador(identificador: string): string[] {
    const base = identificador.trim().toLowerCase();
    const variantes = new Set<string>([base]);

    const digitos = base.replace(/\D/g, "");
    // Núcleo de 10 dígitos: quita la lada si viene (52 / 521, con o sin "+").
    let diez = digitos;
    if (digitos.length === 11 && digitos.startsWith("52")) diez = digitos.slice(2);
    else if (digitos.length === 12 && digitos.startsWith("52")) diez = digitos.slice(2);
    else if (digitos.length === 13 && digitos.startsWith("521")) diez = digitos.slice(3);

    if (diez.length === 10) {
        const [a, b, c] = [diez.slice(0, 3), diez.slice(3, 6), diez.slice(6, 10)];
        for (const v of [
            diez,
            `${a}-${b}-${c}`, // como lo guarda el registro
            `${a} ${b} ${c}`, // como lo escribe la gente
            `+52${diez}`,
            `52${diez}`,
            `+521${diez}`,
            `521${diez}`,
        ]) {
            variantes.add(v);
        }
    }

    return [...variantes];
}
