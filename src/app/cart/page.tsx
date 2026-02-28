"use client"

import { ChevronLeft, Minus, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";

export default function CartPage() {
    const router = useRouter();
    const { items, removeItem, updateQuantity, clearCart } = useCartStore();
    const { user } = useAuthStore();

    // Prevent hydration mismatch since zustand uses localStorage
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCheckout = async () => {
        if (items.length === 0) return;
        setIsSubmitting(true);

        try {
            const delivery = 35.00;
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const total = subtotal + delivery;

            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.id,
                    customerName: user?.name || user?.email || "Invitado Móvil",
                    address: "Ubicación GPS (Actual)",
                    total: total,
                    items: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        price: i.price
                    }))
                })
            });

            if (res.ok) {
                const data = await res.json();
                clearCart();
                router.push(`/tracking?orderId=${data.id}`);
            }
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = items.length > 0 ? 35.00 : 0;
    const total = subtotal + delivery;

    if (!mounted) return null; // Avoid SSR hydration mismatch flashes

    return (
        <main className="min-h-screen pb-safe bg-background text-foreground relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/10 max-w-[480px] mx-auto hidden-scroll">
                <div className="flex items-center h-16 px-4">
                    <Link href="/" className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </Link>
                    <h1 className="flex-1 text-center font-bold text-lg mr-6">Mi Carrito</h1>
                </div>
            </header>

            {/* Cart Items */}
            <div className="pt-20 px-4 flex flex-col gap-4">
                {items.length === 0 ? (
                    <div className="text-center mt-10 text-gray-500">Tu carrito está vacío.</div>
                ) : (
                    items.map((item) => (
                        <div key={item.productId} className="flex gap-4 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                            <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />

                            <div className="flex flex-col flex-1 justify-between py-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-[15px] leading-tight line-clamp-2 pr-2">{item.name}</h3>
                                    <button onClick={() => removeItem(item.productId)} className="text-gray-500 hover:text-red-500 transition-colors cursor-pointer">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex justify-between items-end">
                                    <p className="text-primary font-bold">
                                        ${item.price.toFixed(2)}
                                    </p>

                                    {/* Quantity Selector */}
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-1 py-1">
                                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 rounded-full text-foreground hover:bg-white/10 transition-colors">
                                            <Minus size={14} />
                                        </button>
                                        <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 rounded-full text-primary hover:bg-primary-hover transition-colors">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Order Summary */}
            <div className="mt-6 mx-4 p-5 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <h2 className="font-bold text-lg mb-4">Resumen de Orden</h2>

                <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-medium text-foreground">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Envío</span>
                        <span className="font-medium text-foreground">${delivery.toFixed(2)}</span>
                    </div>
                    <div className="h-px w-full bg-border/20 my-2" />
                    <div className="flex justify-between items-center text-base">
                        <span className="font-bold text-foreground">Total</span>
                        <span className="font-black text-xl text-primary">
                            ${total.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Checkout Button */}
            <div className="fixed bottom-16 left-0 right-0 max-w-[480px] mx-auto p-4 bg-gradient-to-t from-background via-background/90 to-transparent">
                <button
                    onClick={handleCheckout}
                    disabled={isSubmitting || items.length === 0}
                    className="flex items-center disabled:opacity-50 justify-center w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg transition-all"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Deslizar para Ordenar →"}
                </button>
            </div>

            <BottomNav />
        </main>
    );
}
