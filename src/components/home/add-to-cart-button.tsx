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
        setTimeout(() => setAdded(false), 200);
    };

    const handleRemove = () => {
        // We need to import removeItem from useCartStore or use updateQuantity
        const { updateQuantity, removeItem } = useCartStore.getState();
        if (quantity > 1) {
            updateQuantity(product.id, quantity - 1);
        } else if (quantity === 1) {
            removeItem(product.id);
        }
    };

    if (mounted && quantity > 0) {
        return (
            <div className="flex flex-row items-center justify-between min-w-[100px] h-[36px] bg-[#ee2b34] rounded-full text-white shadow-md animate-in slide-in-from-right-2 duration-300">
                <button
                    onClick={handleRemove}
                    className="flex items-center justify-center w-[36px] h-full rounded-l-full active:bg-black/20 transition-colors"
                >
                    <span className="text-xl font-bold leading-none select-none mb-0.5">-</span>
                </button>

                <div className="flex-1 flex items-center justify-center font-bold text-sm bg-black/10 h-full select-none">
                    {quantity}
                </div>

                <button
                    onClick={handleAdd}
                    className="flex items-center justify-center w-[36px] h-full rounded-r-full active:bg-black/20 transition-colors"
                >
                    <span className="text-xl font-bold leading-none select-none mb-0.5">+</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleAdd}
            className={`relative flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full transition-all active:scale-95 text-white mr-1 outline-none ${added
                ? "bg-[#ee2b34]/80 scale-110"
                : "bg-primary hover:bg-primary-hover"
                }`}
        >
            <Plus size={20} strokeWidth={3} className={`transition-transform duration-300 ${added ? "rotate-90" : ""}`} />
        </button>
    );
}
