"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { LocationPicker } from "@/components/checkout/location-picker";

type OrderLookup = {
    id: string;
    userId: string | null;
    paymentStatus: string;
    paymentMethod: string;
    addressConfirmedAt: string | null;
};

export default function ConfirmAddressPage() {
    const params = useParams<{ orderId: string }>();
    const router = useRouter();
    const { user } = useAuthStore();

    const [order, setOrder] = useState<OrderLookup | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch(`/api/orders/${params.orderId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data: OrderLookup | null) => {
                // Cualquiera de estas condiciones -- orden inexistente, de otro
                // usuario, no pagada, o que ya tiene ubicación confirmada -- no
                // debe mostrar el mapa: se manda derecho a Mis Pedidos sin
                // dejar ver nada intermedio (igual que describe el spec).
                if (
                    !data ||
                    data.paymentStatus !== "APPROVED" ||
                    data.addressConfirmedAt ||
                    (data.userId && data.userId !== user?.id)
                ) {
                    router.replace("/mis-pedidos");
                    return;
                }
                setOrder(data);
                setLoading(false);
            })
            .catch(() => router.replace("/mis-pedidos"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.orderId]);

    const handleConfirm = async (lat: number, lng: number) => {
        if (!order) return;
        setConfirming(true);
        setError("");
        try {
            const res = await fetch(`/api/orders/${params.orderId}/address`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "No se pudo guardar tu ubicación.");
                setConfirming(false);
                return;
            }
            if (!order.userId) {
                router.push(`/tracking?orderId=${params.orderId}`);
            } else {
                router.push(`/mis-pedidos?paid=${order.paymentMethod === "CASH" ? "cash" : "1"}`);
            }
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
            setConfirming(false);
        }
    };

    if (loading || !order) {
        return (
            <main className="min-h-[100dvh] flex items-center justify-center bg-white">
                <Loader2 className="animate-spin text-primary" size={32} />
            </main>
        );
    }

    return (
        <main className="min-h-[100dvh] flex flex-col bg-white">
            <header className="px-4 py-4 border-b border-gray-100 text-center">
                <h1 className="font-bold text-lg text-gray-900">¿A dónde te lo llevamos?</h1>
                <p className="text-xs text-gray-500 mt-0.5">Ajusta el pin a tu ubicación exacta</p>
            </header>

            {error && (
                <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center">
                    {error}
                </div>
            )}

            <div className="relative flex-1">
                <LocationPicker onConfirm={handleConfirm} confirming={confirming} />
            </div>
        </main>
    );
}
