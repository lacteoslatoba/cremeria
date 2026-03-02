"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronLeft, CreditCard, Banknote, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart } = useCartStore();
    const { user } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Card details (mock)
    const [cardNumber, setCardNumber] = useState("");
    const [cardExpiry, setCardExpiry] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [cardName, setCardName] = useState("");

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
        if (items.length === 0) {
            router.push("/cart");
        }
    }, [items.length, router]);

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) return;

        if (paymentMethod === "CARD") {
            if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
                alert("Por favor completa los datos de tu tarjeta.");
                return;
            }
        }

        setIsSubmitting(true);

        try {
            const delivery = 35.00;
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const total = subtotal + delivery;

            // In a real app, this is where Mercado Pago tokenization would happen
            // before sending the order to the backend.

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
            } else {
                alert("Ocurrió un error al procesar tu orden.");
                setIsSubmitting(false);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión al procesar el pago.");
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = 35.00;
    const total = subtotal + delivery;

    return (
        <main className="min-h-screen pb-[120px] bg-background text-foreground relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/10 max-w-[480px] mx-auto hidden-scroll">
                <div className="flex items-center h-16 px-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="flex-1 text-center font-bold text-lg mr-6">Método de Pago</h1>
                </div>
            </header>

            <form onSubmit={handleCheckout} className="pt-20 px-4 flex flex-col gap-6">

                {/* Method Selection */}
                <div className="flex flex-col gap-3">
                    <h2 className="font-bold text-lg px-2">¿Cómo prefieres pagar?</h2>

                    <label className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === "CARD"
                            ? "bg-[#009EE3]/10 border-[#009EE3]"
                            : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                        }`}>
                        <div className="flex-1 flex items-center gap-3">
                            <div className={`p-2 rounded-full ${paymentMethod === "CARD" ? "bg-[#009EE3] text-white" : "bg-gray-700 text-gray-300"}`}>
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold">Mercado Pago (Tarjeta)</h3>
                                <p className="text-sm text-gray-400">Débito o Crédito</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === "CARD" ? "border-[#009EE3]" : "border-gray-500"
                            }`}>
                            {paymentMethod === "CARD" && <div className="w-3 h-3 bg-[#009EE3] rounded-full" />}
                        </div>
                        <input type="radio" name="paymentMethod" value="CARD" className="hidden" checked={paymentMethod === "CARD"} onChange={() => setPaymentMethod("CARD")} />
                    </label>

                    <label className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === "CASH"
                            ? "bg-primary/10 border-primary"
                            : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                        }`}>
                        <div className="flex-1 flex items-center gap-3">
                            <div className={`p-2 rounded-full ${paymentMethod === "CASH" ? "bg-primary text-white" : "bg-gray-700 text-gray-300"}`}>
                                <Banknote size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold">Efectivo al recibir</h3>
                                <p className="text-sm text-gray-400">Paga en tu domicilio</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === "CASH" ? "border-primary" : "border-gray-500"
                            }`}>
                            {paymentMethod === "CASH" && <div className="w-3 h-3 bg-primary rounded-full" />}
                        </div>
                        <input type="radio" name="paymentMethod" value="CASH" className="hidden" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} />
                    </label>
                </div>

                {/* Card Elements (Conditional) */}
                {paymentMethod === "CARD" && (
                    <div className="p-5 rounded-3xl bg-white/5 border border-white/10 shadow-sm flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <img src="https://logotipoz.com/wp-content/uploads/2021/10/logo-mercado-pago-2.svg" alt="Mercado Pago" className="h-6" style={{ filter: 'brightness(0) invert(1)' }} />
                            <span className="text-xs text-gray-400 font-medium">Pago Seguro</span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Número de Tarjeta</label>
                            <input
                                type="text"
                                placeholder="0000 0000 0000 0000"
                                maxLength={19}
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value)}
                                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#009EE3]/50 focus:border-[#009EE3] transition-all font-mono"
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="space-y-1 flex-1">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Vencimiento</label>
                                <input
                                    type="text"
                                    placeholder="MM/AA"
                                    maxLength={5}
                                    value={cardExpiry}
                                    onChange={(e) => setCardExpiry(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#009EE3]/50 focus:border-[#009EE3] transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-1 flex-1">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">CVV</label>
                                <input
                                    type="password"
                                    placeholder="123"
                                    maxLength={4}
                                    value={cardCvv}
                                    onChange={(e) => setCardCvv(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#009EE3]/50 focus:border-[#009EE3] transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Titular de la Tarjeta</label>
                            <input
                                type="text"
                                placeholder="Nombre como aparece en la tarjeta"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#009EE3]/50 focus:border-[#009EE3] transition-all font-medium"
                            />
                        </div>
                    </div>
                )}

                <div className="h-px w-full bg-border/10 my-2" />

                {/* Final Total */}
                <div className="flex justify-between items-center text-xl px-2">
                    <span className="font-bold text-foreground">Total a pagar:</span>
                    <span className="font-black text-primary">
                        ${total.toFixed(2)}
                    </span>
                </div>

                <div className="h-20" /> {/* Spacer */}

                {/* Confirm Button */}
                <div className="fixed bottom-16 left-0 right-0 max-w-[480px] mx-auto p-4 bg-gradient-to-t from-background via-background/90 to-transparent">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex items-center disabled:opacity-50 justify-center w-full py-4 rounded-2xl text-white font-bold text-lg transition-all shadow-lg ${paymentMethod === "CARD" ? "bg-[#009EE3] shadow-[#009EE3]/30" : "bg-primary shadow-primary/30"
                            }`}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar y Pagar →"}
                    </button>
                </div>
            </form>

            <BottomNav />
        </main>
    );
}
