"use client"

import { useEffect, useState } from "react";
import { Loader2, Bike } from "lucide-react";

type Driver = { id: string; name: string | null };

type AssignDriverProps = {
    orderId: string;
    currentDeliveryId: string | null;
};

export function AssignDriver({ orderId, currentDeliveryId }: AssignDriverProps) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [value, setValue] = useState(currentDeliveryId || "");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        fetch("/api/users?role=DELIVERY")
            .then(r => r.json())
            .then(data => setDrivers(Array.isArray(data) ? data : []))
            .catch(() => { });
    }, []);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deliveryId = e.target.value;
        setValue(deliveryId);
        setIsUpdating(true);

        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deliveryId: deliveryId || null }),
            });
            if (!res.ok) {
                alert("Error al asignar repartidor");
                setValue(currentDeliveryId || "");
            }
        } catch {
            setValue(currentDeliveryId || "");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="relative">
            <select
                value={value}
                onChange={handleChange}
                disabled={isUpdating}
                className="appearance-none bg-white border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 min-w-[140px]"
            >
                <option value="">Sin asignar</option>
                {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name || "Repartidor"}</option>
                ))}
            </select>
            <Bike size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            {isUpdating && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
        </div>
    );
}
