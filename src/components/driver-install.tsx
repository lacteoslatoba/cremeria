"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Share, X } from "lucide-react";

// Instalacion de la app de Repartidor desde /driver (a donde manda el QR de
// Admin > Repartidores). El banner general (install-prompt.tsx) es solo de
// Cliente y aqui no sale, asi que el repartidor dependia del aviso que Chrome
// quisiera mostrar. Este componente pone el boton "Instalar" y, cuando la
// instalacion termina, tapa la pestaña del navegador con un "ya quedo": una
// pagina web NO puede cerrar Chrome ni abrir la app instalada (el navegador
// lo bloquea), asi que lo que se puede hacer es dejar claro que el siguiente
// paso es abrirla desde el icono, para que nadie siga trabajando en la
// version del navegador por error.
type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function DriverInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [estado, setEstado] = useState<"oculto" | "android" | "ios" | "instalando" | "instalada">("oculto");

    useEffect(() => {
        if (isStandalone()) return; // ya esta dentro de la app instalada

        const onPrompt = (e: Event) => {
            e.preventDefault(); // se usa el boton propio en vez del mini-aviso de Chrome
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setEstado((actual) => (actual === "oculto" ? "android" : actual));
        };
        const onInstalled = () => setEstado("instalada");
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);

        // Safari no dispara "beforeinstallprompt": en iPhone solo quedan las
        // instrucciones a mano. Diferido un tick (regla set-state-in-effect).
        const id = /iphone|ipad|ipod/i.test(navigator.userAgent) ? window.setTimeout(() => setEstado("ios"), 0) : undefined;

        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            if (id) window.clearTimeout(id);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        // En Android el celular tarda unos segundos en terminar de crear la
        // app; "appinstalled" avisa cuando ya esta el icono.
        setEstado(outcome === "accepted" ? "instalando" : "oculto");
    };

    if (estado === "oculto") return null;

    if (estado === "instalando" || estado === "instalada") {
        return (
            <div className="fixed inset-0 z-[100] bg-[#0b0f19] text-white flex flex-col items-center justify-center text-center px-8 gap-4">
                {estado === "instalando" ? (
                    <>
                        <Loader2 size={48} className="animate-spin text-white/70" />
                        <h2 className="text-xl font-bold">Instalando la app…</h2>
                        <p className="text-sm text-white/70 max-w-xs">Tarda unos segundos. No cierres esta ventana todavía.</p>
                    </>
                ) : (
                    <>
                        <CheckCircle2 size={56} className="text-green-400" />
                        <h2 className="text-xl font-bold">¡Listo! Ya quedó instalada</h2>
                        <p className="text-sm text-white/80 max-w-xs">
                            Cierra esta ventana y abre <span className="font-bold">Cremería Repartidor</span> desde el icono en la
                            pantalla de inicio de tu celular.
                        </p>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[60] max-w-[448px] mx-auto rounded-2xl bg-white border border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.45)] p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                <img src="/icon-driver.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Instala Cremería Repartidor</p>
                {estado === "ios" ? (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                        Toca <Share size={12} className="inline shrink-0" /> y luego <span className="font-semibold">&quot;Agregar a inicio&quot;</span>
                    </p>
                ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Para recibir y entregar pedidos desde tu celular</p>
                )}
            </div>
            {estado === "android" && (
                <button
                    onClick={handleInstall}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
                >
                    <Download size={16} /> Instalar
                </button>
            )}
            <button onClick={() => setEstado("oculto")} aria-label="Cerrar" className="shrink-0 p-1.5 -mr-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
            </button>
        </div>
    );
}
