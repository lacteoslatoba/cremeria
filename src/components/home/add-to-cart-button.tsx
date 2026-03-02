"use client"

import { Plus } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useState, useEffect } from "react";

export function AddToCartButton({ product }: { product: any }) {
    const { addItem, items } = useCartStore();
    const [added, setAdded] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const cartItem = items.find((i) => i.productId === product.id);
    const quantity = cartItem?.quantity || 0;

    // Auto-collapse after 3.5s of inactivity
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        if (isExpanded && quantity > 0) {
            timeoutId = setTimeout(() => {
                setIsExpanded(false);
            }, 3500);
        }
        return () => clearTimeout(timeoutId);
    }, [isExpanded, quantity]);

    const handleAdd = () => {
        addItem({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image || "https://images.unsplash.com/photo-1542838132-92c53300491e",
        });

        setIsExpanded(true);
        setAdded(true);
        setTimeout(() => setAdded(false), 200);
    };

    const handleRemove = () => {
        const { updateQuantity, removeItem } = useCartStore.getState();
        setIsExpanded(true);
        if (quantity > 1) {
            updateQuantity(product.id, quantity - 1);
        } else if (quantity === 1) {
            removeItem(product.id);
            setIsExpanded(false);
        }
    };

    const handleExpand = () => {
        setIsExpanded(true);
    };

    if (mounted && quantity > 0) {
        if (isExpanded) {
            return (
                <div className="flex flex-row items-center justify-between min-w-[100px] h-[36px] bg-[#ee2b34] rounded-full text-white shadow-md animate-in zoom-in-95 duration-200">
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
        } else {
            // Contracted green circle mode
            return (
                <button
                    onClick={handleExpand}
                    className="flex flex-row items-center justify-center w-[36px] h-[36px] bg-green-500 rounded-full text-white shadow-md animate-in zoom-in duration-200 active:scale-95 transition-all"
                >
                    <span className="font-bold text-sm leading-none select-none">{quantity}</span>
                </button>
            );
        }
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
