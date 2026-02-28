"use client"

import { Plus } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useState, useEffect } from "react";

export function AddToCartButton({ product }: { product: any }) {
    const { addItem, items } = useCartStore();
    const [added, setAdded] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const cartItem = items.find((i) => i.productId === product.id);
    const quantity = cartItem?.quantity || 0;

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
            className={`relative flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full transition-all active:scale-95 text-white mr-1 outline-none ${added
                ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] scale-110"
                : "bg-primary hover:bg-primary-hover shadow-[0_0_12px_rgba(238,43,52,0.6)]"
                }`}
        >
            <Plus size={20} strokeWidth={3} className={`transition-transform duration-300 ${added ? "rotate-90" : ""}`} />

            {mounted && quantity > 0 && (
                <div className="absolute -top-2 -right-2 bg-foreground text-background text-[11px] font-black min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full shadow-lg border-2 border-[#1e1e1e] animate-in zoom-in duration-300">
                    {quantity}
                </div>
            )}
        </button>
    );
}
