"use client"

import { PhoneCall, CheckCircle2, ChevronLeft, MapPin, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

function TrackingContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get("orderId");

    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        let interval: NodeJS.Timeout;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/orders/${orderId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data.status);

                    if (data.status === "COMPLETED" || data.status === "CANCELLED") {
                        clearInterval(interval);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        interval = setInterval(fetchStatus, 3000);

        return () => clearInterval(interval);
    }, [orderId]);

    if (loading) {
        return <div className="absolute inset-0 flex justify-center items-center bg-[#121212] z-20"><Loader2 className="animate-spin text-primary" size={40} /></div>;
    }

    if (!orderId || !status) {
        return (
            <div className="absolute inset-0 flex flex-col gap-3 justify-center items-center bg-[#121212] z-20 text-white">
                <Info size={40} className="text-gray-400" />
                <p>Orden no encontrada o no seleccionada.</p>
            </div>
        );
    }

    // Logic for Step Progress: PENDING/PREPARING -> OUT_FOR_DELIVERY -> COMPLETED
    const step1Active = status === "PENDING" || status === "PREPARING" || status === "OUT_FOR_DELIVERY" || status === "COMPLETED";
    const step2Active = status === "OUT_FOR_DELIVERY" || status === "COMPLETED";
    const step3Active = status === "COMPLETED";

    const isCancelled = status === "CANCELLED";

    return (
        <>
            {/* Map Area */}
            <div className="absolute inset-0 top-0 h-[55%] w-full bg-[#121212] flex items-center justify-center">
                <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center grayscale" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />

                {/* Route Line & Driver Marker (Mueve la animación si ya salió) */}
                <div className="relative z-20 w-full h-full flex flex-col justify-center items-center">
                    <div className={`h-32 w-1 border-l-2 border-dashed relative transition-all duration-1000 ${step2Active && !step3Active ? "border-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.8)] animate-pulse" : "border-white/20"}`}>
                        <div className={`absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-1000 ${step3Active ? "top-32 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,1)]" :
                                step2Active ? "-top-3 bg-primary shadow-[0_0_15px_rgba(238,43,52,1)]" : "top-0 bg-gray-500"
                            }`}>
                            <MapPin size={14} className="text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sheet Card */}
            <div className="absolute bottom-16 left-0 right-0 max-w-[480px] mx-auto z-30 pt-6 px-6 pb-8 bg-background/80 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

                {isCancelled ? (
                    <div className="text-center mb-8">
                        <p className="text-red-400 text-sm font-bold uppercase tracking-wider mb-2">Pedido Cancelado</p>
                        <h2 className="text-2xl font-black text-white">Contacta soporte</h2>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">
                                {step3Active ? "Pedido Entregado" : "Llegada Estimada"}
                            </p>
                            <h2 className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                {step3Active ? "¡Disfruta!" : "15:20"}
                            </h2>
                            <p className="text-xs text-gray-500 mt-2">Folio: #{orderId.slice(-6).toUpperCase()}</p>
                        </div>

                        {/* Progress Tracker */}
                        <div className="flex justify-between items-center mb-10 px-2 transition-all">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step1Active ? "bg-primary text-white shadow-[0_0_12px_rgba(238,43,52,0.6)]" : "border-2 border-white/20 text-white/40"}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step1Active ? "text-white" : "text-gray-500"}`}>Preparando</span>
                            </div>

                            <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step2Active ? "bg-primary drop-shadow-[0_0_4px_rgba(238,43,52,0.5)]" : "bg-white/20"}`} />

                            {/* Step 2 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step2Active ? "bg-primary text-white shadow-[0_0_12px_rgba(238,43,52,0.8)] animate-pulse" : "border-2 border-white/20 text-white/40"}`}>
                                    <MapPin size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step2Active ? "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" : "text-gray-500"}`}>En Camino</span>
                            </div>

                            <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step3Active ? "bg-primary drop-shadow-[0_0_4px_rgba(238,43,52,0.5)]" : "bg-white/20"}`} />

                            {/* Step 3 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${step3Active ? "bg-green-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "border-2 border-white/20 text-white/40"}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${step3Active ? "text-green-400 font-bold" : "text-gray-500"}`}>Entregado</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Driver Info */}
                <div className={`flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl shadow-inner transition-opacity duration-1000 ${(!step2Active || step3Active || isCancelled) ? "opacity-50 grayscale" : "opacity-100"}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_8px_rgba(238,43,52,0.5)] bg-slate-800">
                            <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80" alt="Repartidor" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium mb-1">Tu Repartidor</p>
                            <h4 className="text-white font-bold">Carlos M.</h4>
                        </div>
                    </div>
                    <button className="flex items-center justify-center w-12 h-12 bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-white rounded-full transition-colors drop-shadow-[0_0_8px_rgba(238,43,52,0.4)]">
                        <PhoneCall size={20} />
                    </button>
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
