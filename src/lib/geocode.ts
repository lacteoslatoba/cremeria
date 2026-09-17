// Reverse-geocode con Nominatim (OpenStreetMap) -- mejor esfuerzo: nunca
// lanza. Si Nominatim falla, tarda, o está caído, devuelve un texto
// genérico -- lo que de verdad importa para la entrega/ubicación son las
// coordenadas, no el texto.
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            {
                headers: {
                    // Nominatim exige un User-Agent identificable (su politica
                    // de uso lo pide explicitamente) -- sin esto puede rechazar
                    // la peticion. Por eso esto corre en el servidor y no desde
                    // el navegador (fetch() del navegador no deja fijar este
                    // header).
                    "User-Agent": "CremeriaDelRancho/1.0 (pedidos@cremeriadelrancho.com)",
                },
                signal: AbortSignal.timeout(4000),
            }
        );
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = await res.json();
        if (typeof data?.display_name === "string" && data.display_name.trim()) {
            return data.display_name as string;
        }
        throw new Error("sin display_name");
    } catch {
        return "Ubicación seleccionada en el mapa";
    }
}
