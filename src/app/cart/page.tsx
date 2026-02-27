"use client"

import { ChevronLeft, Minus, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
};

export default function CartPage() {
    const router = useRouter();
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Fetch some products to simulate an active cart
        async function fetchInitialProducts() {
            try {
                const res = await fetch("/api/products");
                const products = await res.json();

                // Take top 2 products for demo purposes
                if (products && products.length >= 2) {
                    setItems([
                        {
                            productId: products[0].id,
                            name: products[0].name,
                            price: products[0].price,
                            quantity: 1,
                            image: products[0].image || "https://images.unsplash.com/photo-1542838132-92c53300491e"
                        },
                        {
                            productId: products[1].id,
                            name: products[1].name,
                            price: products[1].price,
                            quantity: 2,
                            image: products[1].image || "https://images.unsplash.com/photo-1542838132-92c53300491e"
                        }
                    ]);
                }
            } catch (error) {
                console.error("Failed to fetch initial products", error);
            } finally {
                setLoading(false);
            }
        }

        fetchInitialProducts();
    }, []);

    const updateQuantity = (productId: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (item.productId === productId) {
                const newQuantity = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeItem = (productId: string) => {
        setItems(prev => prev.filter(item => item.productId !== productId));
    };

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
                    customerName: "Invitado Móvil",
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
                router.push("/tracking");
            }
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = items.length > 0 ? 35.00 : 0;
    const total = subtotal + delivery;

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
                {loading ? (
                    <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-primary" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center mt-10 text-gray-500">Tu carrito está vacío.</div>
                ) : (
                    items.map((item) => (
                        <div key={item.productId} className="flex gap-4 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                            <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />

                            <div className="flex flex-col flex-1 justify-between py-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-[15px] leading-tight line-clamp-2 pr-2">{item.name}</h3>
                                    <button onClick={() => removeItem(item.productId)} className="text-gray-500 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex justify-between items-end">
                                    <p className="text-primary font-bold drop-shadow-[0_0_2px_rgba(238,43,52,0.4)]">
                                        ${item.price.toFixed(2)}
                                    </p>

                                    {/* Quantity Selector */}
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-1 py-1">
                                        <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 rounded-full text-foreground hover:bg-white/10 transition-colors">
                                            <Minus size={14} />
                                        </button>
                                        <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 rounded-full text-primary hover:bg-primary-hover transition-colors drop-shadow-[0_0_4px_rgba(238,43,52,0.6)]">
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
                        <span className="font-black text-xl text-primary drop-shadow-[0_0_8px_rgba(238,43,52,0.6)]">
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
                    className="flex items-center disabled:opacity-50 justify-center w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-[0_4px_20px_rgba(238,43,52,0.5)] hover:shadow-[0_4px_30px_rgba(238,43,52,0.8)] hover:-translate-y-1 transition-all"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Deslizar para Ordenar →"}
                </button>
            </div>

            <BottomNav />
        </main>
    );
}
