"use client"

import { useEffect } from "react";

/*
 * El Service Worker (PWA) se queda instalado en el celular y, aunque
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
 *    skipWaiting/clientsClaim en next.config.ts), recarga la página
 *    una sola vez para que se vea el código nuevo de inmediato.
 * El carrito no se pierde: usa localStorage (zustand persist).
 */
export function PwaUpdater() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        let reloaded = false;
        const onControllerChange = () => {
            if (reloaded) return;
            reloaded = true;
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
    }, []);

    return null;
}
