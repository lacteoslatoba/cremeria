/**
 * Búsqueda tolerante para los buscadores del panel.
 *
 * Por qué existe: el teléfono se guarda con guiones ("613-111-4801") y la gente lo
 * escribe como le sale ("613 111 4801", "6131114801", "+52 613 111 4801"). Comparar
 * el texto tal cual hacía que un cliente que SÍ está en la lista apareciera como
 * inexistente: el buscador de Clientes solo miraba nombre y correo, así que al teclear
 * el teléfono la tabla quedaba vacía y avisaba "No hay clientes registrados aún".
 */
export function coincideBusqueda(campos: (string | null | undefined)[], query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const textos = campos.flatMap((c) => (c ? [String(c).toLowerCase()] : []));
    if (textos.some((t) => t.includes(q))) return true;

    // Segundo intento por dígitos: en teléfonos y folios el formato (espacios,
    // guiones, +52) no debe importar. Se exige un mínimo de 3 dígitos para no
    // volver la búsqueda tan laxa que cualquier tecla muestre todo.
    const soloDigitos = (s: string) => s.replace(/\D/g, "");
    const qDigitos = soloDigitos(q);
    if (qDigitos.length < 3) return false;
    // Si vienen con lada (+52) también se prueba con los últimos 10 dígitos: así
    // "+52 613 111 4801" encuentra el "613-111-4801" que hay guardado.
    const variantes = qDigitos.length > 10 ? [qDigitos, qDigitos.slice(-10)] : [qDigitos];
    return textos.some((t) => {
        const digitos = soloDigitos(t);
        return variantes.some((v) => digitos.includes(v));
    });
}
