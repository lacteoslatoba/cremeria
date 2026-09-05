"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";

// Para cuando se reparte el link a muchos clientes: en vez de que cada quien
// tenga que encontrar solo "Agregar a pantalla de inicio" escondido en el
// menú del navegador, se les muestra un banner claro apenas entran, con un
// botón de "Instalar" que dispara el instalador nativo directo (Android) o
// las instrucciones de 2 pasos que en iOS sí o sí hay que hacer a mano
// (Safari no deja instalar por código, solo Compartir → Agregar a inicio).
function isStandalone() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS() {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
    const pathname = usePathname();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState<"android" | "ios" | null>(null);

    useEffect(() => {
        // El panel /admin tiene su propio manifiesto (Cremería Admin, ver
        // admin-manifest.json) y se instala en PC desde el propio ícono del
        // navegador -- este banner es para el cliente en el celular, aquí
        // mostraría el mensaje equivocado ("Pide más rápido...").
        if (pathname?.startsWith("/admin")) return;
        if (isStandalone()) return; // ya la tiene instalada -- no molestar
        let dismissed = false;
        try { dismissed = !!window.localStorage.getItem("installPromptDismissed"); } catch { /* modo privado, etc. */ }
        if (dismissed) return;

        if (isIOS()) {
            // Safari nunca dispara "beforeinstallprompt" -- ahí solo queda
            // mostrar las instrucciones, no hay instalación con un solo toque.
            setPlatform("ios");
            setShow(true);
            return;
        }

        const handler = (e: any) => {
            e.preventDefault(); // evita el mini-banner nativo del navegador -- se usa el propio
            setDeferredPrompt(e);
            setPlatform("android");
            setShow(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        // Se acepte o no, no se vuelve a interrumpir en esta sesión con el
        // mismo aviso -- si lo rechazó, no tiene caso insistir de inmediato.
        setDeferredPrompt(null);
        setShow(false);
    };

    const handleDismiss = () => {
        setShow(false);
        try { window.localStorage.setItem("installPromptDismissed", "1"); } catch { /* no pasa nada */ }
    };

    // Chequeo también al renderizar (no solo en el efecto): si ya se había
    // mostrado el banner en otra ruta y de ahí se navega a /admin sin
    // recargar, no debe quedarse pegado en pantalla.
    if (pathname?.startsWith("/admin")) return null;
    if (!show || !platform) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[60] max-w-[448px] mx-auto rounded-2xl bg-white border border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.25)] p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                <img src="/icon.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Instala Cremería del Rancho</p>
                {platform === "ios" ? (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                        Toca <Share size={12} className="inline shrink-0" /> y luego <span className="font-semibold">&quot;Agregar a inicio&quot;</span>
                    </p>
                ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Pide más rápido, como una app de verdad</p>
                )}
            </div>
            {platform === "android" && (
                <button
                    onClick={handleInstall}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
                >
                    <Download size={16} /> Instalar
                </button>
            )}
            <button onClick={handleDismiss} aria-label="Cerrar" className="shrink-0 p-1.5 -mr-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
            </button>
        </div>
    );
}
