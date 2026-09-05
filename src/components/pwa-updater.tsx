"use client"

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

/*
 * El Service Worker (PWA) se queda instalado en el celular/PC y, aunque
 * subamos una versión nueva a Vercel, el navegador no siempre revisa si
 * hay una actualización — sobre todo si la app ya estaba abierta o el
 * ícono se abre desde la pantalla de inicio (no es una "visita nueva").
 * Resultado: el cliente ve la versión vieja hasta que cierra la app
 * por completo.
 *
 * Este componente:
 * 1) Le pide activamente al navegador que revise si hay un SW nuevo
 *    cada vez que la app vuelve a primer plano (o cada 60s mientras
 *    está abierta).
 * 2) Cuando un SW nuevo toma control (esto ya pasa solo gracias a
 *    skipWaiting/clientsClaim en next.config.ts):
 *    - En el resto de la app (cliente): recarga la página sola una vez,
 *      para que se vea el código nuevo de inmediato -- ahí no hay nada
 *      que se pueda perder a medias.
 *    - En /admin: NO recarga solo -- interrumpir a medio "asignar
 *      repartidor" o "editar producto" en un panel que se deja abierto
 *      viendo ventas en vivo es peor que esperar. Solo avisa con un
 *      botón para que el admin decida cuándo.
 *    Además, un enfriamiento mínimo evita que si se suben varias
 *    versiones seguidas (deploys pegados) la pestaña quede
 *    recargándose una tras otra sin asentarse -- eso se veía "trabado".
 * El carrito no se pierde: usa localStorage (zustand persist).
 */
const MIN_RELOAD_INTERVAL_MS = 2 * 60 * 1000; // no recargar más de 1 vez cada 2 min

function canReloadNow(): boolean {
    try {
        const last = Number(sessionStorage.getItem("pwaLastReload") || "0");
        if (Date.now() - last < MIN_RELOAD_INTERVAL_MS) return false;
        sessionStorage.setItem("pwaLastReload", String(Date.now()));
        return true;
    } catch {
        return true; // sin sessionStorage (modo privado, etc.) -- no bloquear
    }
}

export function PwaUpdater() {
    const pathname = usePathname();
    const isAdmin = !!pathname?.startsWith("/admin");
    const [updateReady, setUpdateReady] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        // OJO: "controllerchange" también se dispara la PRIMERA vez que un
        // usuario nuevo visita la página (el SW recién instalado toma control
        // de la pestaña gracias a clientsClaim) -- eso no es una actualización,
        // es la instalación inicial. Si recargamos ahí, la página recarga sola
        // en cada visita nueva (se ve como que el contenido "carga y se quita").
        // Solo actuamos si YA había un SW controlando esta pestaña antes.
        let hadControllerAtStart = !!navigator.serviceWorker.controller;
        let handled = false;
        const onControllerChange = () => {
            if (!hadControllerAtStart) { hadControllerAtStart = true; return; }
            if (handled) return;
            handled = true;

            if (isAdmin) {
                // No interrumpir: solo mostrar el botón de actualizar.
                setUpdateReady(true);
                return;
            }
            if (!canReloadNow()) return; // enfriamiento -- evita recargas en cadena
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        let reg: ServiceWorkerRegistration | null = null;
        navigator.serviceWorker.getRegistration().then((r) => { reg = r || null; });

        const checkForUpdate = () => { reg?.update().catch(() => { }); };

        const onVisible = () => { if (document.visibilityState === "visible") checkForUpdate(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", checkForUpdate);
        const interval = setInterval(checkForUpdate, 60000);

        return () => {
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", checkForUpdate);
            clearInterval(interval);
        };
    }, [isAdmin]);

    if (!updateReady) return null;

    return (
        <button
            onClick={() => window.location.reload()}
            className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-gray-800 transition-colors animate-in fade-in slide-in-from-bottom-4"
        >
            <RefreshCw size={16} />
            Hay una versión nueva -- Actualizar
        </button>
    );
}
