"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

// POR QUE la confirmacion paso a ser parte de la pantalla (y no window.confirm):
// 1. Chrome permite marcar "no volver a mostrar mas dialogos". Desde ahi
//    confirm() devuelve false SIEMPRE y el boton parecia no hacer nada -- ni
//    error, ni confirmacion, ni borrado (reportado por el usuario: "en pedidos
//    no me permite eliminar un pedido y soy admin").
// 2. alert() tiene el mismo problema: con los dialogos suprimidos el error
//    se perdia en silencio. Por eso el motivo ahora se pinta debajo del boton.
// Se usa el mismo patron "¿Eliminar? Si / No" que ya existe en Mis pedidos
// (src/app/mis-pedidos/page.tsx, OrderCard).
export function OrderDeleteButton({ orderId }: { orderId: string }) {
    const [confirming, setConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    // Traduce la respuesta del API a algo que el admin pueda resolver solo.
    // El caso mas comun en produccion es el 401: el panel se ve aunque la
    // cookie de sesion ya vencio, y antes eso se mostraba como un error
    // generico sin pista de que habia que volver a entrar.
    const mensajeDeError = (status: number, serverError?: string): string => {
        if (status === 401) return "Tu sesión ya no es válida. Vuelve a entrar al Control Panel.";
        if (status === 403) return "Solo una cuenta de administrador puede eliminar pedidos.";
        if (status === 429) return serverError || "Demasiados intentos seguidos. Espera unos segundos e intenta de nuevo.";
        return serverError || `No se pudo eliminar el pedido (código ${status}).`;
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setError("");
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setConfirming(false);
                router.refresh();
            } else {
                const data = await res.json().catch(() => ({} as { error?: string }));
                console.error("[ORDER_DELETE_HTTP]", res.status, data.error);
                setError(mensajeDeError(res.status, data.error));
            }
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Error de red desconocido.";
            setError(`Error de red: ${message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    if (confirming) {
        return (
            <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                    <span className="text-gray-500">¿Eliminar?</span>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
                        title="Sí, eliminar el pedido"
                    >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : "Sí"}
                    </button>
                    <button
                        onClick={() => { setConfirming(false); setError(""); }}
                        disabled={isDeleting}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Cancelar"
                    >
                        No
                    </button>
                </div>
                {error && <span className="text-[11px] font-semibold text-red-500 text-center max-w-[170px]">{error}</span>}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <button
                onClick={() => { setConfirming(true); setError(""); }}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Eliminar pedido"
            >
                <Trash2 size={18} />
            </button>
            {error && <span className="text-[11px] font-semibold text-red-500 text-center max-w-[170px]">{error}</span>}
        </div>
    );
}
