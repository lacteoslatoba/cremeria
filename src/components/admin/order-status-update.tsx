"use client"

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type OrderStatusUpdateProps = {
    orderId: string;
    currentStatus: string;
};

export function OrderStatusUpdate({ orderId, currentStatus }: OrderStatusUpdateProps) {
    const router = useRouter();
    const [status, setStatus] = useState(currentStatus);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        setStatus(newStatus);
        setIsUpdating(true);

        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                router.refresh();
            } else {
                alert("Error al actualizar el estado");
                setStatus(currentStatus);
            }
        } catch (error) {
            console.error(error);
            setStatus(currentStatus);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="relative">
            <select
                value={status}
                onChange={handleStatusChange}
                disabled={isUpdating}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 pr-8"
            >
                <option value="PENDING">Pendiente</option>
                <option value="PREPARING">Preparando</option>
                <option value="OUT_FOR_DELIVERY">En Camino</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
            </select>
            {isUpdating ? (
                <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            ) : (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            )}
        </div>
    );
}
