"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Store, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { LocationPicker } from "@/components/checkout/location-picker";
import type { Business } from "@prisma/client";

// Formulario de "Perfil" del negocio: nombre, teléfono, dirección y la
// ubicación precisa que el admin fija arrastrando un pin (Leaflet/OSM). Se
// reutiliza el LocationPicker del flujo de entrega del cliente, con la
// ubicación ya guardada como punto inicial (prop `initial`).
export function ProfileForm({ business }: { business: Business | null }) {
    const router = useRouter();

    const [name, setName] = useState(business?.name ?? "");
    const [phone, setPhone] = useState(business?.phone ?? "");
    const [address, setAddress] = useState(business?.address ?? "");
    const [lat, setLat] = useState<number | null>(business?.addressLat ?? null);
    const [lng, setLng] = useState<number | null>(business?.addressLng ?? null);

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState("");

    // Al confirmar el pin, se llena el cuadro de "Dirección" con el texto
    // real del lugar (reverse geocoding via Nominatim, en el servidor porque
    // ese endpoint exige un User-Agent que fetch() del navegador no puede
    // fijar). Mejor esfuerzo: las coordenadas (lo que de verdad importa) ya
    // quedaron guardadas aunque esto falle -- pero SÍ se avisa (antes fallaba
    // en silencio, p. ej. con la sesión vencida, y parecía que el botón
    // simplemente no hacía nada).
    async function handleConfirmLocation(newLat: number, newLng: number) {
        setLat(newLat);
        setLng(newLng);
        setGeocoding(true);
        setGeocodeError("");
        try {
            const res = await fetch("/api/business/reverse-geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat: newLat, lng: newLng }),
            });
            const data = await res.json();
            if (res.ok && typeof data?.address === "string" && data.address.trim()) {
                setAddress(data.address);
            } else if (res.status === 401) {
                setGeocodeError("Tu sesión venció -- vuelve a iniciar sesión y confirma de nuevo para llenar la dirección.");
            } else {
                setGeocodeError("No se pudo obtener la dirección automáticamente. Escríbela manualmente.");
            }
        } catch {
            setGeocodeError("No se pudo obtener la dirección automáticamente. Escríbela manualmente.");
        } finally {
            setGeocoding(false);
        }
    }

    async function handleSave() {
        if (!name.trim()) {
            setError("El nombre del negocio es obligatorio.");
            return;
        }
        setSaving(true);
        setSaved(false);
        setError("");
        try {
            const res = await fetch("/api/business", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone, address, addressLat: lat, addressLng: lng }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "No se pudo guardar el perfil");
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            // Refresca los datos del servidor (admin) sin recargar la página.
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al guardar");
        } finally {
            setSaving(false);
        }
    }

    const inputClass =
        "w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white text-gray-900";

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Datos del negocio */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-5">Datos del negocio</h3>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Nombre del negocio
                        </label>
                        <div className="relative">
                            <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Cremería del Rancho"
                                className={`${inputClass} pl-10`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Teléfono
                        </label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="613 111 4801"
                                className={`${inputClass} pl-10`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Dirección
                        </label>
                        <div className="relative">
                            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Av. Reforma 245, Col. Centro"
                                className={`${inputClass} pl-10 pr-10`}
                            />
                            {geocoding && (
                                <Loader2
                                    size={18}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                                />
                            )}
                        </div>
                        {geocodeError && (
                            <p className="text-xs text-amber-600 font-semibold mt-1.5">{geocodeError}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ubicación precisa */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-1.5">Ubicación en el mapa</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Arrastra el pin (o toca el mapa) hasta la ubicación exacta y toca “Confirmar ubicación aquí”.
                </p>
                <div className="h-72 rounded-2xl overflow-hidden border border-gray-100">
                    <LocationPicker
                        initial={lat !== null && lng !== null ? [lat, lng] : undefined}
                        onConfirm={handleConfirmLocation}
                    />
                </div>
                {lat !== null && lng !== null && (
                    <p className="text-xs text-gray-500 mt-2 tabular-nums">
                        Ubicación: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                )}
            </div>

            {/* Guardar */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {saving ? "Guardando…" : "Guardar perfil"}
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
