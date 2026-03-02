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

/* ─────────────────────────────────────────────────────────────
   Simple hand-rolled card form (no SDK iframes needed).
   We collect raw fields here, tokenise them with the MP JS SDK
   CardForm helper, then send only the token to our backend.
   ───────────────────────────────────────────────────────────── */
export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart } = useCartStore();
    const { user } = useAuthStore();

    const [mounted, setMounted] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"CARD" | "CASH">("CASH");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [mpLoaded, setMpLoaded] = useState(false);
    const mpPublicKeyRef = useRef("");

    // Card fields (plain inputs — MP tokenises them client-side)
    const [cardNumber, setCardNumber] = useState("");
    const [expMonth, setExpMonth] = useState("");
    const [expYear, setExpYear] = useState("");
    const [cvv, setCvv] = useState("");
    const [holderName, setHolderName] = useState("");
    const [docNumber, setDocNumber] = useState("");

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal;

    useEffect(() => {
        setMounted(true);
        if (items.length === 0) router.push("/cart");

        // Load public key
        fetch("/api/payments/config")
            .then(r => r.json())
            .then(({ publicKey }) => {
                mpPublicKeyRef.current = publicKey;
                loadSDK(publicKey);
            })
            .catch(console.error);
    }, []);

    const loadSDK = (publicKey: string) => {
        if (document.getElementById("mp-sdk-v2")) { setMpLoaded(true); return; }
        const s = document.createElement("script");
        s.id = "mp-sdk-v2";
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.onload = () => setMpLoaded(true);
        document.body.appendChild(s);
    };

    /* ── Tokenise card data via MP then pay ── */
    const handleCardPay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mpLoaded || !window.MercadoPago) {
            setError("El SDK de pago aún está cargando, espera un momento.");
            return;
        }
        setError("");
        setIsSubmitting(true);
        try {
            const mp = new window.MercadoPago(mpPublicKeyRef.current);

            // Build card data object matching MP createCardToken spec
            const tokenResponse = await mp.createCardToken({
                cardNumber: cardNumber.replace(/\s/g, ""),
                cardholderName: holderName,
                cardExpirationMonth: expMonth.padStart(2, "0"),
                cardExpirationYear: expYear.length === 2 ? `20${expYear}` : expYear,
                securityCode: cvv,
                identificationType: "CURP",
                identificationNumber: docNumber,
            });

            if (!tokenResponse?.id) {
                setError("No se pudo generar el token de la tarjeta. Revisa tus datos.");
                setIsSubmitting(false);
                return;
            }

            // Determine paymentMethodId from the card number (MP returns it in the token response)
            const paymentMethodId = tokenResponse.payment_method_id || "visa";

            // Call backend
            const payRes = await fetch("/api/payments/create-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: tokenResponse.id,
                    amount: total,
                    paymentMethodId,
                    installments: 1,
                    payerEmail: user?.email || "cliente@cremeria.com",
                    payerName: holderName || user?.name || "Cliente",
                    description: `Pedido Cremería del Rancho`,
                }),
            });

            const payData = await payRes.json();

            if (!payRes.ok || !payData.success) {
                const msgs: Record<string, string> = {
                    cc_rejected_insufficient_amount: "Fondos insuficientes.",
                    cc_rejected_bad_filled_security_code: "CVV incorrecto.",
                    cc_rejected_bad_filled_date: "Fecha de vencimiento incorrecta.",
                    cc_rejected_bad_filled_card_number: "Número de tarjeta incorrecto.",
                    cc_rejected_card_disabled: "Tarjeta deshabilitada. Contacta tu banco.",
                };
                setError(msgs[payData.detail] || "Pago rechazado. Verifica tus datos.");
                setIsSubmitting(false);
                return;
            }

            await createOrder(String(payData.paymentId));
        } catch (err: any) {
            console.error("MP pay error:", err);
            setError(err?.message || "Error inesperado al procesar el pago.");
            setIsSubmitting(false);
        }
    };

    const processCash = async () => {
        setIsSubmitting(true);
        setError("");
        try { await createOrder(null); }
        catch { setError("Error al crear el pedido."); setIsSubmitting(false); }
    };

    const createOrder = async (mpId: string | null) => {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user?.id,
                customerName: user?.name || user?.email || "Cliente",
                address: "Ubicación GPS (Actual)",
                total,
                mpPaymentId: mpId,
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

    // Format card number with spaces
    const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

    if (!mounted) return null;

    const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-foreground font-medium outline-none focus:ring-2 focus:ring-[#009EE3]/50 focus:border-[#009EE3] transition-all placeholder:text-gray-600";

    return (
        <main className="min-h-screen pb-[140px] bg-background text-foreground">
            <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/10 max-w-[480px] mx-auto">
                <div className="flex items-center h-16 px-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="flex-1 text-center font-bold text-lg mr-6">Método de Pago</h1>
                </div>
            </header>

            <div className="pt-20 px-4 flex flex-col gap-5">

                {error && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium animate-in slide-in-from-top-2">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Selector */}
                <div className="flex flex-col gap-3">
                    <p className="font-bold text-lg px-1">¿Cómo prefieres pagar?</p>

                    <button onClick={() => { setPaymentMethod("CASH"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CASH" ? "bg-primary/10 border-primary" : "bg-white/5 border-white/10"}`}>
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CASH" ? "bg-primary text-white" : "bg-gray-700 text-gray-300"}`}><Banknote size={22} /></div>
                        <div className="flex-1">
                            <p className="font-bold">Efectivo al recibir</p>
                            <p className="text-sm text-gray-400">Paga cuando llegue tu pedido</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CASH" ? "border-primary" : "border-gray-500"}`}>
                            {paymentMethod === "CASH" && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                    </button>

                    <button onClick={() => { setPaymentMethod("CARD"); setError(""); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === "CARD" ? "bg-[#009EE3]/10 border-[#009EE3]" : "bg-white/5 border-white/10"}`}>
                        <div className={`p-2.5 rounded-xl mr-4 ${paymentMethod === "CARD" ? "bg-[#009EE3] text-white" : "bg-gray-700 text-gray-300"}`}><CreditCard size={22} /></div>
                        <div className="flex-1">
                            <p className="font-bold">Tarjeta débito / crédito</p>
                            <p className="text-sm text-gray-400">Visa, Mastercard, Amex · Pago seguro</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === "CARD" ? "border-[#009EE3]" : "border-gray-500"}`}>
                            {paymentMethod === "CARD" && <div className="w-2.5 h-2.5 bg-[#009EE3] rounded-full" />}
                        </div>
                    </button>
                </div>

                {/* ────── CARD FORM ────── */}
                {paymentMethod === "CARD" && (
                    <form onSubmit={handleCardPay} className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">

                        <div className="flex items-center gap-2 px-1">
                            <span className="font-black text-[#009EE3] text-base">Mercado Pago</span>
                            <span className="text-xs text-gray-500">· 🔒 Pago encriptado</span>
                        </div>

                        {/* Número */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Número de tarjeta</label>
                            <input required value={cardNumber} onChange={e => setCardNumber(fmtCard(e.target.value))}
                                placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19}
                                className={inputClass} />
                        </div>

                        {/* Fecha + CVV */}
                        <div className="flex gap-3">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Mes</label>
                                <input required value={expMonth} onChange={e => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                                    placeholder="MM" inputMode="numeric" maxLength={2} className={inputClass} />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Año</label>
                                <input required value={expYear} onChange={e => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="AA" inputMode="numeric" maxLength={4} className={inputClass} />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">CVV</label>
                                <input required value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="•••" inputMode="numeric" maxLength={4} type="password" className={inputClass} />
                            </div>
                        </div>

                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nombre del titular</label>
                            <input required value={holderName} onChange={e => setHolderName(e.target.value.toUpperCase())}
                                placeholder="Como aparece en tu tarjeta" className={inputClass} />
                        </div>

                        {/* CURP/RFC */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">CURP / RFC (sin guiones)</label>
                            <input required value={docNumber} onChange={e => setDocNumber(e.target.value)}
                                placeholder="Ej: AAAA800101HDFXXX01" className={inputClass} />
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center px-1 py-1">
                            <span className="font-bold text-lg">Total:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        <button type="submit" disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-[#009EE3] text-white font-bold text-lg shadow-lg shadow-[#009EE3]/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                            {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Pagar ${total.toFixed(2)}</>}
                        </button>

                        <p className="text-center text-xs text-gray-500 pb-2">
                            🔒 Tus datos se procesan de forma segura por Mercado Pago. Nunca los guardamos.
                        </p>
                    </form>
                )}

                {/* ────── CASH ────── */}
                {paymentMethod === "CASH" && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-gray-400">Pagarás en efectivo cuando el repartidor llegue a tu domicilio.</p>
                        <button onClick={processCash} disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-1">
                            {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Confirmar Pedido</>}
                        </button>
                    </div>
                )}
            </div>
            <BottomNav />
        </main>
    );
}
