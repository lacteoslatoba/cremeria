"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function OrderDeleteButton({ orderId }: { orderId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm(`¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                router.refresh();
            } else {
                alert("Ocurrió un error al eliminar el pedido.");
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al eliminar el pedido.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Eliminar pedido"
        >
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
        </button>
    );
}
