"use client"

import { Plus } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useState } from "react";

export function AddToCartButton({ product }: { product: any }) {
    const addItem = useCartStore((state) => state.addItem);
    const [added, setAdded] = useState(false);

    const handleAdd = () => {
        addItem({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image || "https://images.unsplash.com/photo-1542838132-92c53300491e",
        });

        setAdded(true);
        setTimeout(() => setAdded(false), 800);
    };

    return (
        <button
            onClick={handleAdd}
            className={`flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full transition-all active:scale-95 text-white mr-1 outline-none ${added
                    ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] scale-110"
                    : "bg-primary hover:bg-primary-hover shadow-[0_0_12px_rgba(238,43,52,0.6)]"
                }`}
        >
            <Plus size={20} strokeWidth={3} className={`transition-transform duration-300 ${added ? "rotate-90" : ""}`} />
        </button>
    );
}
