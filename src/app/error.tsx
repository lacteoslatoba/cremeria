"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

// Red de seguridad para cualquier ruta que no tenga su propio error.tsx: si
// algo truena renderizando (no un 404, no un error de red manejado a mano --
// una excepción real de React), esto se muestra en vez de la pantalla en
// blanco que deja el error boundary por defecto de Next.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[APP_ERROR]", error);
    }, [error]);

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <AlertCircle className="text-primary" size={40} />
            <div>
                <h1 className="font-bold text-lg text-foreground">Algo salió mal</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Intenta de nuevo en un momento. Si sigue pasando, avísanos.
                </p>
            </div>
            <button
                onClick={reset}
                className="flex items-center gap-2 bg-primary text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
            >
                <RotateCw size={16} />
                Reintentar
            </button>
        </div>
    );
}
