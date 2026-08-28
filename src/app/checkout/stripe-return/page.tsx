"use client"

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

// Con redirect:"if_required" casi nunca se llega aquí (el pago se confirma
// sin salir de /checkout) — esta página solo existe como red de seguridad
// para el raro caso de un banco que exige una redirección (p. ej. 3DS
// que Stripe no puede resolver en un iframe).
function StripeReturnContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orderId = searchParams.get("orderId");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!orderId) { setError("No se encontró el pedido."); return; }

        let cancelled = false;
        let attempts = 0;

        const check = async () => {
            try {
                const res = await fetch("/api/payments/stripe/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId }),
                });
                const data = await res.json();
                if (cancelled) return;

                if (!res.ok) { setError(data.error || "No se pudo verificar tu pago."); return; }
                if (data.paymentStatus === "APPROVED") { router.push(`/tracking?orderId=${orderId}`); return; }
                if (data.paymentStatus === "REJECTED") { setError("Tu pago con Stripe no se completó. No se hizo ningún cargo."); return; }

                attempts++;
                if (attempts < 8) setTimeout(check, 1500);
                else setError("Tu pago sigue en proceso. Revisa tu pedido en unos momentos.");
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
                <h2 className="text-xl font-bold text-white">{error}</h2>
                <button onClick={() => router.push("/cart")} className="mt-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl">
                    Volver al carrito
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 text-center px-8">
            <Loader2 size={48} className="text-primary animate-spin" />
            <h2 className="text-xl font-bold text-white">Confirmando tu pago...</h2>
        </div>
    );
}

export default function StripeReturnPage() {
    return (
        <main className="min-h-[100dvh] bg-background flex items-center justify-center">
            <Suspense fallback={<Loader2 size={48} className="text-primary animate-spin" />}>
                <StripeReturnContent />
            </Suspense>
        </main>
    );
}
