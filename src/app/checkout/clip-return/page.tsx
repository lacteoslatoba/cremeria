"use client"

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type OrderStatus = { id: string; paymentStatus: string; total: number } | null;

function ClipReturnContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orderId = searchParams.get("orderId");

    const [order, setOrder] = useState<OrderStatus>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!orderId) {
            setError("No se encontró el pedido.");
            return;
        }

        let cancelled = false;
        let attempts = 0;

        const check = async () => {
            try {
                const res = await fetch(`/api/payments/clip/status?orderId=${orderId}`);
                const data = await res.json();
                if (cancelled) return;

                if (!res.ok) {
                    setError(data.error || "No se pudo verificar tu pago.");
                    return;
                }

                if (data.paymentStatus === "APPROVED") {
                    router.push(`/tracking?orderId=${orderId}`);
                    return;
                }

                if (data.paymentStatus === "REJECTED") {
                    setOrder(data);
                    return;
                }

                // Still PENDING — Clip hasn't settled yet, keep polling briefly.
                attempts++;
                if (attempts < 8) setTimeout(check, 1500);
                else setOrder(data);
            } catch {
                if (!cancelled) setError("No se pudo verificar tu pago.");
            }
        };

        check();
        return () => { cancelled = true; };
    }, [orderId, router]);

    if (error) {
        return (
            <div className="flex flex-col items-center gap-4 text-center px-8">
                <XCircle size={56} className="text-red-400" />
                <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
                <p className="text-gray-400 text-sm">{error}</p>
                <button onClick={() => router.push("/cart")} className="mt-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl">
                    Volver al carrito
                </button>
            </div>
        );
    }

    if (order?.paymentStatus === "REJECTED") {
        return (
            <div className="flex flex-col items-center gap-4 text-center px-8">
                <div className="flex items-center justify-center w-24 h-24 rounded-full bg-red-500/15 border-2 border-red-500">
                    <XCircle size={48} className="text-red-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Pago no completado</h2>
                <p className="text-gray-400 text-sm">Tu pago con Clip no se pudo procesar. No se hizo ningún cargo.</p>
                <button onClick={() => router.push("/cart")} className="mt-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30">
                    Volver al carrito
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 text-center px-8">
            <Loader2 size={48} className="text-primary animate-spin" />
            <h2 className="text-xl font-bold text-white">Confirmando tu pago...</h2>
            <p className="text-gray-400 text-sm">Esto solo toma un momento.</p>
        </div>
    );
}

export default function ClipReturnPage() {
    return (
        <main className="min-h-[100dvh] bg-background flex items-center justify-center">
            <Suspense fallback={<Loader2 size={48} className="text-primary animate-spin" />}>
                <ClipReturnContent />
            </Suspense>
        </main>
    );
}
