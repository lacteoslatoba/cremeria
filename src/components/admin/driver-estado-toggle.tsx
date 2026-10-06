"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Columna "Estado" de Repartidores: Activo / Desactivado, y lo decide el admin
// (06/10, pedido de Mike). Antes mostraba "En linea / Desconectado" calculado
// con la ultima ubicacion, que el admin no podia mover. Un repartidor
// desactivado no puede iniciar sesion ni usar el portal (ver loadAuthUser).
export function DriverEstadoToggle({ driverId, nombre, activo }: { driverId: string; nombre: string | null; activo: boolean }) {
    const router = useRouter();
    const [valor, setValor] = useState(activo);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const cambiar = async () => {
        const nuevo = !valor;
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/users/${driverId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: nuevo }),
            });
            const data = await res.json().catch(() => ({} as { error?: string }));
            if (!res.ok) throw new Error(data.error || `No se pudo cambiar (código ${res.status})`);
            setValor(nuevo);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo cambiar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <button
                type="button"
                role="switch"
                aria-checked={valor}
                aria-label={`${valor ? "Desactivar" : "Activar"} a ${nombre || "este repartidor"}`}
                title={valor ? "Toca para desactivarlo" : "Toca para activarlo"}
                onClick={cambiar}
                disabled={saving}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[124px] px-3 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-60 ${
                    valor ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
            >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <span className={`w-2 h-2 rounded-full ${valor ? "bg-green-600" : "bg-gray-500"}`} />}
                {valor ? "ACTIVO" : "DESACTIVADO"}
            </button>
            {error && <span className="text-[11px] font-semibold text-red-600 max-w-[160px] text-center">{error}</span>}
        </div>
    );
}
