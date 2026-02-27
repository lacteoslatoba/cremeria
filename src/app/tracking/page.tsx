import { PhoneCall, CheckCircle2, ChevronLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function TrackingPage() {
    return (
        <main className="min-h-screen pb-safe bg-background text-foreground relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-40 bg-transparent py-4 px-4 flex justify-between items-center max-w-[480px] mx-auto">
                <Link href="/cart" className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/90 hover:bg-black/60 transition-colors">
                    <ChevronLeft size={24} />
                </Link>
            </header>

            {/* Map Area */}
            <div className="absolute inset-0 top-0 h-[55%] w-full bg-[#121212] flex items-center justify-center">
                {/* Fake stylized map background */}
                <div
                    className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center grayscale"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />

                {/* Route Line & Driver Marker */}
                <div className="relative z-20 w-full h-full flex flex-col justify-center items-center">
                    <div className="h-32 w-1 border-l-2 border-dashed border-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.8)] relative animate-pulse">
                        <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(238,43,52,1)]">
                            <MapPin size={14} className="text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sheet Card */}
            <div className="absolute bottom-16 left-0 right-0 max-w-[480px] mx-auto z-30 pt-6 px-6 pb-8 bg-background/80 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">

                {/* Grabber */}
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

                <div className="text-center mb-8">
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Llegada Estimada</p>
                    <h2 className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                        15:20
                    </h2>
                </div>

                {/* Progress Tracker */}
                <div className="flex justify-between items-center mb-10 px-2">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_12px_rgba(238,43,52,0.6)]">
                            <CheckCircle2 size={18} />
                        </div>
                        <span className="text-[10px] font-semibold text-white">Preparando</span>
                    </div>

                    <div className="flex-1 h-0.5 bg-primary drop-shadow-[0_0_4px_rgba(238,43,52,0.5)] mx-2" />

                    {/* Step 2 */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_12px_rgba(238,43,52,0.8)] animate-pulse">
                            <MapPin size={18} />
                        </div>
                        <span className="text-[10px] font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]">En Camino</span>
                    </div>

                    <div className="flex-1 h-0.5 bg-white/20 mx-2" />

                    {/* Step 3 */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-white/20 text-white/40 flex items-center justify-center">
                            <CheckCircle2 size={18} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500">Entregado</span>
                    </div>
                </div>

                {/* Driver Info */}
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl shadow-inner">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_8px_rgba(238,43,52,0.5)]">
                            <img
                                src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80"
                                alt="Repartidor"
                                className="w-full h-full object-cover"
                            />
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

            <BottomNav />
        </main>
    );
}
