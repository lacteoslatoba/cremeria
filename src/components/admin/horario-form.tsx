"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Clock, CheckCircle2 } from "lucide-react";
import { APERTURA_POR_DEFECTO, CIERRE_POR_DEFECTO, hhmmAMinutos, horaLegible, minutosAHHMM } from "@/lib/horario";
import type { Business } from "@prisma/client";

// Horario de pedidos: tiene su propio boton de guardar (PATCH /api/business)
// para poder moverlo rapido -- p. ej. cerrar mas tarde un dia de mucha venta --
// sin tener que guardar el resto del perfil. El cambio aplica al instante: el
// servidor lee el horario cada vez que alguien intenta hacer un pedido.
export function HorarioForm({ business }: { business: Business | null }) {
    const router = useRouter();

    const [guardadoApertura, setGuardadoApertura] = useState(business?.aperturaMin ?? APERTURA_POR_DEFECTO);
    const [guardadoCierre, setGuardadoCierre] = useState(business?.cierreMin ?? CIERRE_POR_DEFECTO);
    const [apertura, setApertura] = useState(minutosAHHMM(guardadoApertura));
    const [cierre, setCierre] = useState(minutosAHHMM(guardadoCierre));

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    async function handleSave() {
        const aperturaMin = hhmmAMinutos(apertura);
        const cierreMin = hhmmAMinutos(cierre);
        if (aperturaMin === null || cierreMin === null) {
            setError("Escribe las dos horas.");
            return;
        }
        if (aperturaMin >= cierreMin) {
            setError("La hora de cierre debe ser después de la de apertura.");
            return;
        }
        setSaving(true);
        setSaved(false);
        setError("");
        try {
            const res = await fetch("/api/business", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aperturaMin, cierreMin }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "No se pudo guardar el horario");
            setGuardadoApertura(aperturaMin);
            setGuardadoCierre(cierreMin);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al guardar");
        } finally {
            setSaving(false);
        }
    }

    const inputClass =
        "w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white text-gray-900 tabular-nums";
    const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-1.5">Horario de pedidos</h3>
            <p className="text-sm text-gray-500 mb-5">
                Ahora se reciben pedidos de <span className="font-semibold text-gray-900">{horaLegible(guardadoApertura)}</span> a{" "}
                <span className="font-semibold text-gray-900">{horaLegible(guardadoCierre)}</span>. Fuera de ese horario la tienda no
                deja pagar. El cambio aplica al momento de guardar y se queda así hasta que lo vuelvas a mover.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                    <label htmlFor="horario-apertura" className={labelClass}>Abre a las</label>
                    <div className="relative">
                        <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            id="horario-apertura"
                            type="time"
                            value={apertura}
                            onChange={(e) => setApertura(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="horario-cierre" className={labelClass}>Cierra a las</label>
                    <div className="relative">
                        <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            id="horario-cierre"
                            type="time"
                            value={cierre}
                            onChange={(e) => setCierre(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-5">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? "Guardando…" : "Guardar horario"}
                </button>
                {saved && (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                        <CheckCircle2 size={16} /> Guardado
                    </span>
                )}
                {error && <span className="text-red-600 text-sm font-semibold">{error}</span>}
            </div>
        </div>
    );
}
