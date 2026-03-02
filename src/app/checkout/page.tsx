"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronLeft, Banknote, Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart } = useCartStore();
    const { user } = useAuthStore();

    const [mounted, setMounted] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"CARD" | "CASH">("CASH");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [mpReady, setMpReady] = useState(false);
    const [mpPublicKey, setMpPublicKey] = useState("");
    const cardFormRef = useRef<any>(null);
    const mpRef = useRef<any>(null);
    const formMountedRef = useRef(false);

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    useEffect(() => {
        setMounted(true);
        if (items.length === 0) {
            router.push("/cart");
        }
    }, []);

    // Load MP Public Key from server
    useEffect(() => {
        fetch("/api/payments/config")
            .then(r => r.json())
            .then(d => setMpPublicKey(d.publicKey))
            .catch(console.error);
    }, []);

    // Load Mercado Pago SDK script
    useEffect(() => {
        if (!mpPublicKey) return;
        const existingScript = document.getElementById("mp-sdk");
        if (existingScript) {
            initMP();
            return;
        }
        const script = document.createElement("script");
        script.id = "mp-sdk";
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.onload = () => initMP();
        document.body.appendChild(script);
    }, [mpPublicKey]);

    const initMP = () => {
        if (!window.MercadoPago || !mpPublicKey) return;
        mpRef.current = new window.MercadoPago(mpPublicKey, { locale: "es-MX" });
        setMpReady(true);
    };

    // Mount CardForm when card method is selected
    useEffect(() => {
        if (paymentMethod !== "CARD" || !mpReady || formMountedRef.current) return;
        formMountedRef.current = true;

        setTimeout(() => {
            const cardForm = mpRef.current.cardForm({
                amount: String(total.toFixed(2)),
                iframe: true,
                form: {
                    id: "mp-card-form",
                    cardNumber: { id: "mp-card-number", placeholder: "0000 0000 0000 0000" },
                    expirationDate: { id: "mp-expiration-date", placeholder: "MM/AA" },
                    securityCode: { id: "mp-security-code", placeholder: "CVV" },
                    cardholderName: { id: "mp-cardholder-name", placeholder: "Nombre como aparece en tu tarjeta" },
                    identificationNumber: { id: "mp-identification-number", placeholder: "Sin guiones" },
                    installments: { id: "mp-installments" },
                },
                callbacks: {
                    onFormMounted: (error: any) => {
                        if (error) console.warn("CardForm Mount Error:", error);
                    },
                    onSubmit: async (event: any) => {
                        event.preventDefault();
                        const {
                            paymentMethodId,
                            issuerId,
                            cardholderEmail: email,
                            amount,
                            token,
                            installments,
                            identificationNumber,
                            identificationType,
                        } = cardForm.getCardFormData();

                        await processCardPayment({ token, paymentMethodId, installments, amount });
                    },
                    onFetching: (resource: any) => {
                        setIsSubmitting(true);
                        return () => setIsSubmitting(false);
                    },
                },
            });
            cardFormRef.current = cardForm;
        }, 300);

        return () => {
            if (cardFormRef.current) {
                try { cardFormRef.current.unmount(); } catch (e) { }
                cardFormRef.current = null;
                formMountedRef.current = false;
            }
        };
    }, [paymentMethod, mpReady]);

    const processCardPayment = async ({ token, paymentMethodId, installments, amount }: any) => {
        setIsSubmitting(true);
        setError("");
        try {
            // 1. Process payment with Mercado Pago
            const payRes = await fetch("/api/payments/create-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    amount: total,
                    paymentMethodId,
                    installments,
                    payerEmail: user?.email || "cliente@cremeria.com",
                    payerName: user?.name || "Cliente",
                    description: `Pedido Cremería del Rancho (${items.length} productos)`,
                }),
            });

            const payData = await payRes.json();

            if (!payRes.ok || !payData.success) {
                setError(payData.detail === "cc_rejected_insufficient_amount"
                    ? "Tarjeta con fondos insuficientes."
                    : payData.detail === "cc_rejected_bad_filled_security_code"
                        ? "CVV incorrecto."
                        : payData.detail === "cc_rejected_bad_filled_date"
                            ? "Fecha de vencimiento incorrecta."
                            : "Pago rechazado. Verifica tus datos.");
                setIsSubmitting(false);
                return;
            }

            // 2. Create order in database
            await createOrder(payData.paymentId);
        } catch (err: any) {
            setError("Error de conexión. Inténtalo de nuevo.");
            setIsSubmitting(false);
        }
    };

    const processCashPayment = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            await createOrder(null);
        } catch (err) {
            setError("Error al crear el pedido.");
            setIsSubmitting(false);
        }
    };

    const createOrder = async (mpPaymentId: string | null) => {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user?.id,
                customerName: user?.name || user?.email || "Cliente",
                address: "Ubicación GPS (Actual)",
                total,
                mpPaymentId,
                items: items.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    price: i.price,
                })),
            }),
        });

        if (res.ok) {
            const data = await res.json();
            clearCart();
            router.push(`/tracking?orderId=${data.id}`);
        } else {
            setError("Error al registrar el pedido.");
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    return (
        <main className="min-h-screen pb-[140px] bg-background text-foreground relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/10 max-w-[480px] mx-auto">
                <div className="flex items-center h-16 px-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="flex-1 text-center font-bold text-lg mr-6">Método de Pago</h1>
                </div>
            </header>

            <div className="pt-20 px-4 flex flex-col gap-5">

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                        <AlertCircle size={20} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Payment method selector */}
                <div className="flex flex-col gap-3">
                    <p className="font-bold text-lg px-1">¿Cómo prefieres pagar?</p>

                    {/* Cash */}
                    <button
                        onClick={() => { setPaymentMethod("CASH"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CASH"
                            ? "bg-primary/10 border-primary"
                            : "bg-white/5 border-white/10"
                            }`}
                    >
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CASH" ? "bg-primary text-white" : "bg-gray-700 text-gray-300"}`}>
                            <Banknote size={22} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-base">Efectivo al recibir</p>
                            <p className="text-sm text-gray-400">Paga en efectivo cuando llegue tu pedido</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CASH" ? "border-primary" : "border-gray-500"}`}>
                            {paymentMethod === "CASH" && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                    </button>

                    {/* Card via Mercado Pago */}
                    <button
                        onClick={() => { setPaymentMethod("CARD"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CARD"
                            ? "bg-[#009EE3]/10 border-[#009EE3]"
                            : "bg-white/5 border-white/10"
                            }`}
                    >
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CARD" ? "bg-[#009EE3] text-white" : "bg-gray-700 text-gray-300"}`}>
                            <CreditCard size={22} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-base">Tarjeta de débito o crédito</p>
                            <p className="text-sm text-gray-400">Visa, Mastercard, Amex · Pago seguro</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CARD" ? "border-[#009EE3]" : "border-gray-500"}`}>
                            {paymentMethod === "CARD" && <div className="w-2.5 h-2.5 bg-[#009EE3] rounded-full" />}
                        </div>
                    </button>
                </div>

                {/* Mercado Pago Card Form */}
                {paymentMethod === "CARD" && (
                    <form id="mp-card-form" className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
                        {/* MP Logo */}
                        <div className="flex items-center gap-2 px-1">
                            <svg viewBox="0 0 90 24" fill="none" height="20" className="text-[#009EE3]">
                                <text fill="#009EE3" fontFamily="sans-serif" fontWeight="bold" fontSize="14" y="18">Mercado Pago</text>
                            </svg>
                            <span className="text-xs text-gray-400 font-medium">· Pago 100% seguro</span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex flex-col divide-y divide-white/10">
                            <div className="p-4 space-y-1">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Número de tarjeta</label>
                                <div id="mp-card-number" className="h-10" />
                            </div>
                            <div className="flex divide-x divide-white/10">
                                <div className="flex-1 p-4 space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Vencimiento</label>
                                    <div id="mp-expiration-date" className="h-10" />
                                </div>
                                <div className="flex-1 p-4 space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">CVV</label>
                                    <div id="mp-security-code" className="h-10" />
                                </div>
                            </div>
                            <div className="p-4 space-y-1">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Nombre del titular</label>
                                <div id="mp-cardholder-name" className="h-10" />
                            </div>
                            <div className="p-4 space-y-1">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">CURP / RFC / Pasaporte</label>
                                <div id="mp-identification-number" className="h-10" />
                            </div>
                        </div>

                        {/* Installments select */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block px-1">Meses sin intereses</label>
                            <select id="mp-installments" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none text-foreground font-medium focus:ring-2 focus:ring-[#009EE3]/50" />
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center px-2">
                            <span className="font-bold text-foreground">Total:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !mpReady}
                            className="w-full py-4 rounded-2xl bg-[#009EE3] text-white font-bold text-lg shadow-lg shadow-[#009EE3]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Pagar ${total.toFixed(2)}
                                </>
                            )}
                        </button>

                        <p className="text-center text-xs text-gray-500">
                            🔒 Pago procesado de forma segura por Mercado Pago
                        </p>
                    </form>
                )}

                {/* Cash Summary */}
                {paymentMethod === "CASH" && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground text-base">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        <button
                            onClick={processCashPayment}
                            disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Confirmar Pedido
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </main>
    );
}
