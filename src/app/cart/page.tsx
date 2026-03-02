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

    const handleCheckout = () => {
        if (items.length === 0) return;

        if (user?.role === "GUEST") {
            router.push("/login");
            return;
        }

        router.push("/checkout");
    };

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

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

            {/* Unified card: Products + Order Summary */}
            <div className="pt-20 px-4">
                {items.length === 0 ? (
                    <div className="text-center mt-16 text-gray-500">Tu carrito está vacío.</div>
                ) : (
                    <div className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm overflow-hidden">
                        {/* Products */}
                        <div className="flex flex-col divide-y divide-white/5">
                            {items.map((item) => (
                                <div key={item.productId} className="flex gap-4 p-4">
                                    <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />

                                    <div className="flex flex-col flex-1 justify-between py-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-semibold text-[15px] leading-tight line-clamp-2 pr-2">{item.name}</h3>
                                            <button onClick={() => removeItem(item.productId)} className="text-gray-500 hover:text-red-500 transition-colors cursor-pointer shrink-0">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-end mt-2">
                                            <p className="text-primary font-bold">
                                                ${(item.price * item.quantity).toFixed(2)}
                                                {item.quantity > 1 && <span className="text-xs text-gray-400 font-normal ml-1">(${item.price.toFixed(2)} c/u)</span>}
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
                            ))}
                        </div>

                        {/* Order Summary — same card, below products */}
                        <div className="px-5 py-4 border-t border-white/10 bg-white/5">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-foreground text-base">Total</span>
                                <span className="font-black text-xl text-primary">${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Checkout Button */}
            <div className="fixed bottom-16 left-0 right-0 max-w-[480px] mx-auto p-4 bg-gradient-to-t from-background via-background/90 to-transparent">
                <button
                    onClick={handleCheckout}
                    disabled={isSubmitting || items.length === 0}
                    className="flex items-center disabled:opacity-50 justify-center w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg transition-all"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (user?.role === "GUEST" ? "Iniciar sesión para ordenar" : "Continuar")}
                </button>
            </div>

            <BottomNav />
        </main>
    );
}
