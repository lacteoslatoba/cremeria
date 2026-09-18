"use client"

import { PhoneCall, CheckCircle2, ChevronLeft, MapPin, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LiveMap } from "@/components/tracking/live-map";

type Delivery = {
    id: string;
    name: string | null;
    phone: string | null;
    currentLat: number | null;
    currentLng: number | null;
    locationUpdatedAt: string | null;
};

// Distancia en línea recta (fórmula haversine) -- no es la ruta real por
// calles (eso pediría un servicio de ruteo aparte), pero es lo que de
// verdad se necesita para saber "qué tan lejos" sin agregar una
// dependencia externa nueva.
function straightLineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}

function TrackingContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get("orderId");
    const paid = searchParams.get("paid"); // "1" = pago con tarjeta aprobado, "cash" = pedido a pagar en efectivo

    const [status, setStatus] = useState<string | null>(null);
    const [delivery, setDelivery] = useState<Delivery | null>(null);
    const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
    const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(true);
    // Aviso de confirmación que se ve justo al llegar aquí recién pagado --
    // se retira solo después de unos segundos, no hace falta que el cliente
    // lo cierre a mano.
    const [showPaidBanner, setShowPaidBanner] = useState(!!paid);

    useEffect(() => {
        if (!paid) return;
        const t = setTimeout(() => setShowPaidBanner(false), 5000);
        return () => clearTimeout(t);
    }, [paid]);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        // Polling cada 3s. `handle.id` cambia de valor (la regla prefer-const
        // no aplica a mutación de propiedad) y siempre está definido al
        // dispararse cada tick, para poder auto-detener el intervalo cuando
        // el pedido llega a un estado terminal.
        const handle: { id?: ReturnType<typeof setInterval> } = {};
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/orders/${orderId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data.status);
                    setDelivery(data.delivery || null);
                    setDeliveryCode(data.deliveryCode || null);
                    setDestination(
                        typeof data.addressLat === "number" && typeof data.addressLng === "number"
                            ? { lat: data.addressLat, lng: data.addressLng }
                            : null
                    );

                    if (data.status === "COMPLETED" || data.status === "CANCELLED") {
                        if (handle.id) clearInterval(handle.id);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        handle.id = setInterval(() => { void fetchStatus(); }, 3000);

        return () => { if (handle.id) clearInterval(handle.id); };
    }, [orderId]);

    const hasLiveLocation = !!(delivery?.currentLat && delivery?.currentLng && destination);

    // Aviso de "pago realizado con éxito" (o "pedido confirmado" si es
    // efectivo) -- flota arriba de todo, se ve en cualquiera de las 3
    // pantallas de abajo (cargando, error, o el seguimiento normal).
    const paidBanner = showPaidBanner && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] px-5 py-4 rounded-2xl bg-green-500 text-white shadow-[0_10px_30px_rgba(34,197,94,0.4)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 size={24} className="shrink-0" />
            <p className="font-bold text-sm leading-snug">
                {paid === "cash" ? "¡Pedido confirmado! Pagas en efectivo al recibir." : "¡Tu pago fue realizado con éxito!"}
            </p>
        </div>
    );

    if (loading) {
        return (
            <>
                {paidBanner}
                <div className="absolute inset-0 flex justify-center items-center bg-[#121212] z-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
            </>
        );
    }

    if (!orderId || !status) {
        return (
            <>
                {paidBanner}
                <div className="absolute inset-0 flex flex-col gap-3 justify-center items-center bg-[#121212] z-20 text-white">
                    <Info size={40} className="text-gray-400" />
                    <p>Orden no encontrada o no seleccionada.</p>
                </div>
            </>
        );
    }

    // Logic for Step Progress: PENDING/PREPARING -> OUT_FOR_DELIVERY -> COMPLETED
    const step1Active = status === "PENDING" || status === "PREPARING" || status === "OUT_FOR_DELIVERY" || status === "COMPLETED";
    const step2Active = status === "OUT_FOR_DELIVERY" || status === "COMPLETED";
    const step3Active = status === "COMPLETED";

    const isCancelled = status === "CANCELLED";

    // Repartidor en camino con GPS real -- estilo DiDi Food: mapa real (no
    // el placeholder) y toda la pantalla pasa a tema claro en vez del
    // oscuro de siempre (antes se veía todo negro y no se distinguía nada
    // en el mapa). Fuera de este estado (preparando, o ya entregado) se
    // queda exactamente como estaba.
    const isLive = step2Active && !step3Active && hasLiveLocation;
    const distanceLabel =
        isLive && delivery?.currentLat && delivery?.currentLng && destination
            ? formatDistance(straightLineDistanceKm(delivery.currentLat, delivery.currentLng, destination.lat, destination.lng))
            : null;

    return (
        <>
            {/* Fondo de toda la pantalla -- cubre el hueco entre el mapa y la
                tarjeta inferior, así el cambio oscuro/claro no deja restos del
                tema contrario a la vista. */}
            <div className={`absolute inset-0 z-0 ${isLive ? "bg-white" : "bg-[#121212]"}`} />

            {paidBanner}

            {/* Map Area */}
            <div className={`absolute inset-0 top-0 h-[55%] w-full flex items-center justify-center ${isLive ? "bg-white" : "bg-[#121212]"}`}>
                {isLive ? (
                    <LiveMap
                        lat={delivery!.currentLat!}
                        lng={delivery!.currentLng!}
                        destLat={destination!.lat}
                        destLng={destination!.lng}
                    />
                ) : (
                    <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center grayscale" />
                )}
                {!isLive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
                )}

                {/* Route Line & Driver Marker fallback (sin ubicación GPS real todavía) */}
                {!isLive && (
                    <div className="relative z-20 w-full h-full flex flex-col justify-center items-center">
                        <div className={`h-32 w-1 border-l-2 border-dashed relative transition-all duration-1000 ${step2Active && !step3Active ? "border-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.8)] animate-pulse" : "border-white/20"}`}>
                            <div className={`absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-1000 ${step3Active ? "top-32 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,1)]" :
                                    step2Active ? "-top-3 bg-primary shadow-[0_0_15px_rgba(238,43,52,1)]" : "top-0 bg-gray-500"
                                }`}>
                                <MapPin size={14} className="text-white" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Sheet Card -- max-h + overflow-y-auto: en pantallas bajas
                (o con el código de entrega + todo el tracker visibles a la
                vez) el contenido puede ser más alto que el espacio libre
                sobre el mapa; sin esto se salía por arriba de la pantalla y
                quedaba invisible en vez de solo scrollable.
                backdrop-blur-2xl SOLO en modo oscuro: sobre el mapa real
                (Leaflet, con sus propias capas transformadas) ese blur hacía
                que Chrome dejara de pintar el fondo blanco por completo en
                la franja donde se monta el mapa -- se veía "hueco", como si
                la tarjeta no existiera ahí. En modo oscuro (foto estática de
                fondo, sin ese problema) se conserva el efecto original. */}
            <div className={`absolute bottom-16 left-0 right-0 max-w-[480px] mx-auto z-30 pt-6 px-6 pb-8 border-t rounded-t-3xl max-h-[calc(100dvh-5.5rem)] overflow-y-auto ${isLive
                ? "bg-white border-black/5 shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
                : "bg-background/80 backdrop-blur-2xl border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
                }`}>
                <div className={`w-12 h-1.5 rounded-full mx-auto mb-6 ${isLive ? "bg-black/10" : "bg-white/20"}`} />

                {isCancelled ? (
                    <div className="text-center mb-8">
                        <p className="text-red-400 text-sm font-bold uppercase tracking-wider mb-2">Pedido Cancelado</p>
                        <h2 className="text-2xl font-black text-white">Contacta soporte</h2>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <p className={`text-sm font-medium uppercase tracking-wider mb-2 ${isLive ? "text-gray-500" : "text-gray-400"}`}>
                                {step3Active ? "Pedido Entregado" : isLive ? "Distancia" : "Llegada Estimada"}
                            </p>
                            <h2 className={`text-5xl font-black ${isLive ? "text-gray-900" : "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"}`}>
                                {step3Active ? "¡Disfruta!" : isLive && distanceLabel ? distanceLabel : "15:20"}
                            </h2>
                            <p className={`text-xs mt-2 ${isLive ? "text-gray-400" : "text-gray-500"}`}>Folio: #{orderId.slice(-6).toUpperCase()}</p>
                        </div>

                        {/* Código de verificación de entrega: el cliente se lo da al repartidor */}
                        {deliveryCode && !step3Active && !isCancelled && (
                            <div className={`mb-8 p-4 rounded-2xl border text-center ${isLive ? "bg-primary/10 border-primary/30" : "bg-primary/15 border-primary/40"}`}>
                                <p className={`text-[11px] font-medium uppercase tracking-wider mb-2 ${isLive ? "text-gray-500" : "text-gray-300"}`}>
                                    Tu código de entrega
                                </p>
                                <p className={`text-3xl font-black tracking-[0.35em] ${isLive ? "text-gray-900" : "text-white drop-shadow-[0_0_10px_rgba(238,43,52,0.6)]"}`}>
                                    {deliveryCode}
                                </p>
                                <p className={`text-xs mt-3 leading-relaxed ${isLive ? "text-gray-500" : "text-gray-300"}`}>
                                    Compártelo con tu repartidor al recibir tu pedido para confirmar la entrega.
                                </p>
                            </div>
                        )}

                        {/* Progress Tracker */}
                        <div className="flex justify-between items-center mb-10 px-2 transition-all">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step1Active ? "bg-primary text-white shadow-[0_0_12px_rgba(238,43,52,0.6)]" : isLive ? "border-2 border-gray-300 text-gray-400" : "border-2 border-white/20 text-white/40"}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step1Active ? (isLive ? "text-gray-900" : "text-white") : "text-gray-500"}`}>Preparando</span>
                            </div>

                            <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step2Active ? "bg-primary drop-shadow-[0_0_4px_rgba(238,43,52,0.5)]" : isLive ? "bg-gray-200" : "bg-white/20"}`} />

                            {/* Step 2 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step2Active ? "bg-primary text-white shadow-[0_0_12px_rgba(238,43,52,0.8)] animate-pulse" : isLive ? "border-2 border-gray-300 text-gray-400" : "border-2 border-white/20 text-white/40"}`}>
                                    <MapPin size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step2Active ? (isLive ? "text-gray-900" : "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]") : "text-gray-500"}`}>En Camino</span>
                            </div>

                            <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step3Active ? "bg-primary drop-shadow-[0_0_4px_rgba(238,43,52,0.5)]" : isLive ? "bg-gray-200" : "bg-white/20"}`} />

                            {/* Step 3 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step3Active ? "bg-green-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.6)]" : isLive ? "border-2 border-gray-300 text-gray-400" : "border-2 border-white/20 text-white/40"}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step3Active ? "text-green-400 font-bold" : "text-gray-500"}`}>Entregado</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Driver Info */}
                <div className={`flex items-center justify-between p-4 border rounded-2xl shadow-inner transition-opacity duration-1000 ${isLive ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/10"} ${(!step2Active || step3Active || isCancelled) ? "opacity-50 grayscale" : "opacity-100"}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_8px_rgba(238,43,52,0.5)] bg-slate-800 flex items-center justify-center text-white font-bold">
                            {delivery?.name ? delivery.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                            <p className={`text-xs font-medium mb-1 ${isLive ? "text-gray-500" : "text-gray-400"}`}>Tu Repartidor</p>
                            <h4 className={`font-bold ${isLive ? "text-gray-900" : "text-white"}`}>{delivery?.name || "Por asignar"}</h4>
                        </div>
                    </div>
                    {delivery?.phone ? (
                        <a
                            href={`tel:${delivery.phone}`}
                            className="flex items-center justify-center w-12 h-12 bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-white rounded-full transition-colors drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]"
                        >
                            <PhoneCall size={20} />
                        </a>
                    ) : (
                        <button disabled className={`flex items-center justify-center w-12 h-12 rounded-full cursor-not-allowed ${isLive ? "bg-gray-100 text-gray-400 border border-gray-200" : "bg-white/5 text-gray-500 border border-white/10"}`}>
                            <PhoneCall size={20} />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

export default function TrackingPage() {
    return (
        <main className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-40 bg-transparent py-4 px-4 flex justify-between items-center max-w-[480px] mx-auto">
                <Link href="/" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/90 hover:bg-black/60 transition-colors">
                    <ChevronLeft size={24} />
                </Link>
            </header>

            <Suspense fallback={<div className="absolute inset-0 flex justify-center items-center bg-[#121212] z-20"><Loader2 className="animate-spin text-primary" size={40} /></div>}>
                <TrackingContent />
            </Suspense>

            <BottomNav />
        </main>
    );
}
