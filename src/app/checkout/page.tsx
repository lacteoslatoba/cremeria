"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronLeft, Banknote, Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";

declare global {
    interface Window { MercadoPago: any; }
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
    const mpRef = useRef<any>(null);
    const cardFormRef = useRef<any>(null);
    const initializingRef = useRef(false);

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    useEffect(() => {
        setMounted(true);
        if (items.length === 0) router.push("/cart");
    }, []);

    // Step 1: Load Public Key then inject MP SDK
    useEffect(() => {
        fetch("/api/payments/config")
            .then(r => r.json())
            .then(({ publicKey }) => loadMPScript(publicKey))
            .catch(console.error);
    }, []);

    const loadMPScript = (publicKey: string) => {
        if (!publicKey) return;
        const existing = document.getElementById("mp-sdk");
        if (existing) {
            initializeMP(publicKey);
            return;
        }
        const script = document.createElement("script");
        script.id = "mp-sdk";
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.onload = () => initializeMP(publicKey);
        document.body.appendChild(script);
    };

    const initializeMP = (publicKey: string) => {
        if (!window.MercadoPago) return;
        mpRef.current = new window.MercadoPago(publicKey, { locale: "es-MX" });
        setMpReady(true);
    };

    // Step 2: Mount CardForm ONLY after DOM elements exist AND mp is ready
    useEffect(() => {
        if (paymentMethod !== "CARD" || !mpReady || initializingRef.current) return;

        // Wait a tick for the form HTML to render
        const timer = setTimeout(() => {
            // Double-check DOM elements exist
            const cardNumberEl = document.getElementById("mp-card-number");
            if (!cardNumberEl) {
                console.warn("MP: card number element not found yet");
                return;
            }

            initializingRef.current = true;

            try {
                const cf = mpRef.current.cardForm({
                    amount: String(total.toFixed(2)),
                    iframe: true,
                    form: {
                        id: "mp-card-form",
                        cardNumber: { id: "mp-card-number", placeholder: "0000 0000 0000 0000" },
                        expirationDate: { id: "mp-expiration-date", placeholder: "MM/AA" },
                        securityCode: { id: "mp-security-code", placeholder: "CVV" },
                        cardholderName: { id: "mp-cardholder-name", placeholder: "Nombre en la tarjeta" },
                        identificationNumber: { id: "mp-identification-number", placeholder: "CURP / RFC (sin guiones)" },
                        installments: { id: "mp-installments" },
                    },
                    callbacks: {
                        onFormMounted: (err: any) => {
                            if (err) { console.warn("CardForm mount error:", err); }
                            else { console.log("✅ Mercado Pago CardForm montado correctamente"); }
                        },
                        onSubmit: async (event: any) => {
                            event.preventDefault();
                            const { token, paymentMethodId, installments } = cf.getCardFormData();
                            await processCardPayment({ token, paymentMethodId, installments });
                        },
                        onFetching: () => {
                            setIsSubmitting(true);
                            return () => setIsSubmitting(false);
                        },
                        onError: (err: any, field: string) => {
                            console.error("MP Error on field:", field, err);
                        },
                    },
                });
                cardFormRef.current = cf;
            } catch (e) {
                console.error("CardForm init error:", e);
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            if (cardFormRef.current) {
                try { cardFormRef.current.unmount(); } catch (_) { }
                cardFormRef.current = null;
                initializingRef.current = false;
            }
        };
    }, [paymentMethod, mpReady]);

    const processCardPayment = async ({ token, paymentMethodId, installments }: any) => {
        setIsSubmitting(true);
        setError("");
        try {
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
                    description: `Pedido Cremería del Rancho (${items.length} producto${items.length !== 1 ? "s" : ""})`,
                }),
            });

            const payData = await payRes.json();

            if (!payRes.ok || !payData.success) {
                const msgs: Record<string, string> = {
                    cc_rejected_insufficient_amount: "Fondos insuficientes en la tarjeta.",
                    cc_rejected_bad_filled_security_code: "CVV incorrecto.",
                    cc_rejected_bad_filled_date: "Fecha de vencimiento incorrecta.",
                    cc_rejected_bad_filled_card_number: "Número de tarjeta incorrecto.",
                    cc_rejected_card_disabled: "Tarjeta deshabilitada. Contacta tu banco.",
                };
                setError(msgs[payData.detail] || "Pago rechazado. Verifica tus datos e inténtalo de nuevo.");
                setIsSubmitting(false);
                return;
            }

            await createOrder(String(payData.paymentId));
        } catch (err: any) {
            setError("Error de conexión. Inténtalo de nuevo.");
            setIsSubmitting(false);
        }
    };

    const processCashPayment = async () => {
        setIsSubmitting(true);
        setError("");
        try { await createOrder(null); }
        catch { setError("Error al crear el pedido."); setIsSubmitting(false); }
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
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
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
        <main className="min-h-screen pb-[140px] bg-background text-foreground">
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

                {/* Error Banner */}
                {error && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Method Selector */}
                <div className="flex flex-col gap-3">
                    <p className="font-bold text-lg px-1">¿Cómo prefieres pagar?</p>

                    {/* Efectivo */}
                    <button onClick={() => { setPaymentMethod("CASH"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CASH" ? "bg-primary/10 border-primary" : "bg-white/5 border-white/10"}`}>
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CASH" ? "bg-primary text-white" : "bg-gray-700 text-gray-300"}`}>
                            <Banknote size={22} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold">Efectivo al recibir</p>
                            <p className="text-sm text-gray-400">Paga cuando llegue tu pedido</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CASH" ? "border-primary" : "border-gray-500"}`}>
                            {paymentMethod === "CASH" && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                    </button>

                    {/* Tarjeta */}
                    <button onClick={() => { setPaymentMethod("CARD"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CARD" ? "bg-[#009EE3]/10 border-[#009EE3]" : "bg-white/5 border-white/10"}`}>
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CARD" ? "bg-[#009EE3] text-white" : "bg-gray-700 text-gray-300"}`}>
                            <CreditCard size={22} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold">Tarjeta débito / crédito</p>
                            <p className="text-sm text-gray-400">Visa, Mastercard, Amex · Pagos seguros</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CARD" ? "border-[#009EE3]" : "border-gray-500"}`}>
                            {paymentMethod === "CARD" && <div className="w-2.5 h-2.5 bg-[#009EE3] rounded-full" />}
                        </div>
                    </button>
                </div>

                {/* ── CARD FORM  (always in DOM when CARD is selected) ── */}
                {paymentMethod === "CARD" && (
                    <form id="mp-card-form" className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">

                        {/* Logo MP */}
                        <div className="flex items-center gap-2 px-1">
                            <span className="font-black text-[#009EE3] text-base">Mercado Pago</span>
                            <span className="text-xs text-gray-500">· Pago 100% seguro 🔒</span>
                        </div>

                        {/* Card fields container */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/10">
                            {/* Número */}
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                    Número de tarjeta
                                </label>
                                <div id="mp-card-number" className="min-h-[40px]" />
                            </div>

                            {/* Vencimiento + CVV */}
                            <div className="flex divide-x divide-white/10">
                                <div className="flex-1 p-4">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                        Vencimiento
                                    </label>
                                    <div id="mp-expiration-date" className="min-h-[40px]" />
                                </div>
                                <div className="flex-1 p-4">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                        CVV
                                    </label>
                                    <div id="mp-security-code" className="min-h-[40px]" />
                                </div>
                            </div>

                            {/* Nombre */}
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                    Nombre del titular
                                </label>
                                <div id="mp-cardholder-name" className="min-h-[40px]" />
                            </div>

                            {/* Identificación */}
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                    CURP / RFC / ID
                                </label>
                                <div id="mp-identification-number" className="min-h-[40px]" />
                            </div>
                        </div>

                        {/* Meses */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">
                                Meses sin intereses
                            </label>
                            <select id="mp-installments"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-foreground font-medium outline-none focus:ring-2 focus:ring-[#009EE3]/40" />
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center px-1">
                            <span className="font-bold text-lg">Total:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        {/* Loading state when MP not ready */}
                        {!mpReady && (
                            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2">
                                <Loader2 size={16} className="animate-spin" />
                                Cargando formulario seguro...
                            </div>
                        )}

                        <button type="submit" disabled={isSubmitting || !mpReady}
                            className="w-full py-4 rounded-2xl bg-[#009EE3] text-white font-bold text-lg shadow-lg shadow-[#009EE3]/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                            {isSubmitting
                                ? <Loader2 className="animate-spin" size={22} />
                                : <><CheckCircle2 size={20} /> Pagar ${total.toFixed(2)}</>}
                        </button>
                    </form>
                )}

                {/* ── CASH FORM ── */}
                {paymentMethod === "CASH" && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-gray-400">Pagarás en efectivo cuando el repartidor llegue a tu domicilio.</p>
                        <button onClick={processCashPayment} disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all mt-1">
                            {isSubmitting
                                ? <Loader2 className="animate-spin" size={22} />
                                : <><CheckCircle2 size={20} /> Confirmar Pedido</>}
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </main>
    );
}
