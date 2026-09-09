"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Devuelve `false` durante el render del servidor / la primera pasada y
 * `true` una vez el navegador ya montó el componente.
 *
 * Reemplaza el patrón clásico `useState(false)` + `useEffect(() => setMounted(true), [])`
 * que usaban varios componentes para evitar errores de hidratación (zustand
 * se persiste en localStorage, que no existe en el servidor). Hacer setState
 * de forma síncrona dentro de un efecto provoca renders en cascada y la regla
 * `react-hooks/set-state-in-effect` lo marca como error; con
 * `useSyncExternalStore` conseguimos el mismo resultado (SSR seguro) sin
 * tocar setState en un efecto.
 */
export function useMounted(): boolean {
    return useSyncExternalStore(
        emptySubscribe,
        () => true, // getSnapshot (cliente): ya estamos montados
        () => false // getServerSnapshot: servidor → false para coincidir con la 1ª hidratación
    );
}
