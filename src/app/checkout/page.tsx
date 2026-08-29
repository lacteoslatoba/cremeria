"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronLeft, Loader2, CreditCard, CheckCircle2, AlertCircle, Banknote } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";

declare global {
    interface Window { Stripe: any; Conekta: any; }
}

// Proveedor de tarjeta activo. Stripe queda "en pausa" -- todo su código
// sigue aquí intacto y funcional (por si hace falta volver a activarlo)
// pero no se ejecuta ni un solo fetch/script mientras esta constante diga
// "conekta". Se cambió porque Stripe se topaba con bloqueos en algunos
// celulares que no se pueden resolver desde el servidor.
//
// Conekta usa su tokenizer directo (Conekta.Token.create), NO su "Checkout
// Component" (iframe) -- ese tiene un bug real confirmado: todos sus
// recursos cargan bien pero el iframe nunca recibe la señal para mostrarse.
// Con el tokenizer, los campos de tarjeta viven en esta misma página (no
// en un iframe), pero el número/cvc nunca se manda a nuestro servidor: se
// tokenizan en el navegador y solo el token_id resultante llega al backend.
const CARD_PROVIDER: "stripe" | "conekta" = "conekta";

/* ─────────────────────────────────────────────────────────────
   Dos métodos de pago: tarjeta (Conekta) y efectivo contra entrega.
   Efectivo existe como respaldo: no depende de ningún script de
   terceros, así que si el celular de un cliente bloquea la pasarela
   de tarjeta por lo que sea, siempre puede pagar en efectivo en vez
   de quedarse sin poder completar su pedido.
   ───────────────────────────────────────────────────────────── */
export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart } = useCartStore();
    const { user } = useAuthStore();

    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState("");
    const [method, setMethod] = useState<"CARD" | "CASH">("CARD");
    const [cashSubmitting, setCashSubmitting] = useState(false);

    // Stripe (Payment Element)
    const [stripeSdkLoaded, setStripeSdkLoaded] = useState(false);
    const [stripeReady, setStripeReady] = useState(false);
    const [stripeSubmitting, setStripeSubmitting] = useState(false);
    const stripePublicKeyRef = useRef("");
    const stripeRef = useRef<any>(null); // instancia de window.Stripe(pk)
    const stripeElementsRef = useRef<any>(null);
    const stripeOrderIdRef = useRef("");
    const stripeMountRef = useRef<HTMLDivElement>(null);
    const stripeReadyRef = useRef(false);
    const mountPaymentAttemptRef = useRef(0);

    // Conekta (Checkout Component)
    const [conektaSdkLoaded, setConektaSdkLoaded] = useState(false);
    const [conektaMounted, setConektaMounted] = useState(false); // el iframe ya se mandó a pintar
    const [conektaSubmitting, setConektaSubmitting] = useState(false);
    const conektaPublicKeyRef = useRef("");
    const conektaSetupStartedRef = useRef(false);

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal;

    useEffect(() => {
        setMounted(true);
        if (items.length === 0) router.push("/cart");
        if (CARD_PROVIDER === "stripe") loadStripeSDK();
        if (CARD_PROVIDER === "conekta") loadConektaSDK();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Un cliente real nunca va a leer "desactiva tu bloqueador" ni sabría
    // cómo -- si la carga del SDK falla o tarda, reintentamos solos varias
    // veces antes de mostrarle cualquier error. Solo si de plano no jala
    // después de reintentar le pedimos recargar la página.
    const stripeSdkAttemptsRef = useRef(0);
    const SDK_TIMEOUTS_MS = [12000, 8000, 10000]; // margen amplio; el SDK necesita tiempo para terminar, no reinicios

    const loadStripeSDK = () => {
        if (window.Stripe) { setStripeSdkLoaded(true); return; }

        const attempt = stripeSdkAttemptsRef.current;
        stripeSdkAttemptsRef.current += 1;

        // El <script> del SDK ya pudo haber empezado a cargar desde antes
        // (ver StripePreloader, lo arranca apenas se abre la app). SIEMPRE
        // nos enganchamos al que ya esté en el DOM y lo dejamos terminar:
        // quitarlo a media carga anula la descarga y es justo lo que hacía
        // que el refresh fallara (el preloader y este checkout arrancaban a
        // la vez y entre ambos reiniciaban el script una y otra vez, así que
        // el SDK nunca terminaba de cargar aunque la red estuviera bien).
        let s = document.getElementById("stripe-sdk-v3") as HTMLScriptElement | null;
        if (!s) {
            s = document.createElement("script");
            s.id = "stripe-sdk-v3";
            s.src = "https://js.stripe.com/v3/";
            s.async = true;
            document.body.appendChild(s);
        }
        s.onload = () => setStripeSdkLoaded(true);
        s.onerror = () => retryOrGiveUp(attempt, true);

        // Si tras un margen amplio no llegó ni "onload" ni "onerror"
        // (lento o bloqueado en silencio), reintentamos -- solo después de
        // darle tiempo de sobra, no a los pocos segundos de empezar.
        window.setTimeout(() => {
            if (!window.Stripe && stripeSdkAttemptsRef.current === attempt + 1) {
                retryOrGiveUp(attempt, false);
            }
        }, SDK_TIMEOUTS_MS[attempt] ?? 12000);
    };

    const retryOrGiveUp = (attempt: number, hardFailure: boolean) => {
        if (window.Stripe) return; // ya cargó a través de otra vía justo a tiempo
        if (attempt < SDK_TIMEOUTS_MS.length - 1) {
            // Solo si el script falló de verdad (bloqueado) quitamos el tag
            // roto para que el siguiente reintento use uno limpio. Por
            // "tardar" no descartamos el script que sigue en camino.
            if (hardFailure) {
                document.getElementById("stripe-sdk-v3")?.remove();
            }
            loadStripeSDK();
        } else {
            setError("No se pudo conectar con el sistema de pago. Verifica tu conexión a internet e intenta de nuevo.");
        }
    };

    // Crea la orden + PaymentIntent en el servidor, y monta el formulario de
    // tarjeta de Stripe (Payment Element) directo en esta pantalla.
    const setupStripeCheckout = async () => {
        if (stripeElementsRef.current) return; // ya montado
        setStripeSubmitting(true);
        setError("");
        try {
            if (!stripePublicKeyRef.current) {
                const cfg = await fetch("/api/payments/stripe/config").then(r => r.json());
                if (!cfg.publicKey) throw new Error("El pago con tarjeta no está disponible todavía.");
                stripePublicKeyRef.current = cfg.publicKey;
            }

            const res = await fetch("/api/payments/stripe/create-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.id,
                    customerName: user?.name || user?.email || "Cliente",
                    address: "Ubicación GPS (Actual)",
                    total,
                    payerEmail: user?.email,
                    items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.clientSecret) {
                setError(data.error || "No se pudo iniciar el pago.");
                setStripeSubmitting(false);
                return;
            }
            stripeOrderIdRef.current = data.orderId;

            if (!stripeRef.current) stripeRef.current = window.Stripe(stripePublicKeyRef.current);
            const elements = stripeRef.current.elements({ clientSecret: data.clientSecret });
            const paymentElement = elements.create("payment");
            stripeElementsRef.current = elements;

            // Escuchar el ciclo de vida del Payment Element para no dejar al
            // usuario en "Preparando…" infinito: si Stripe no logra montar el
            // formulario (bloqueo de iframe, SDK, etc.), mostramos el motivo.
            paymentElement.on("ready", () => {
                stripeReadyRef.current = true;
                setStripeReady(true);
            });
            paymentElement.on("error", (event: any) => {
                console.error("[STRIPE_ELEMENT_ERROR]", event?.error);
                setStripeReady(false);
                setError(event?.error?.message || "El formulario de pago no pudo cargar. Revisa tu conexión y reintenta.");
            });

            mountPaymentAttemptRef.current = 1;
            try {
                paymentElement.mount(stripeMountRef.current);
            } catch (mountErr: any) {
                throw mountErr;
            }

            // Resguardo: si Stripe no confirma "ready" en tiempo, mostrar aviso
            // en vez de dejar el spinner infinito.
            window.setTimeout(() => {
                if (!stripeReadyRef.current) {
                    setError("El formulario de pago tarda en cargar. Si el problema continúa, recarga la página.");
                }
            }, 12000);
        } catch (err: any) {
            setError(err?.message || "Error al conectar con el sistema de pago.");
        } finally {
            setStripeSubmitting(false);
        }
    };

    const handleStripePay = async () => {
        if (!stripeRef.current || !stripeElementsRef.current) return;
        setStripeSubmitting(true);
        setError("");
        try {
            const { error: confirmError } = await stripeRef.current.confirmPayment({
                elements: stripeElementsRef.current,
                confirmParams: {
                    return_url: `${window.location.origin}/checkout/stripe-return?orderId=${stripeOrderIdRef.current}`,
                },
                redirect: "if_required", // se queda en la página cuando no hace falta 3DS
            });

            if (confirmError) {
                setError(confirmError.message || "Tu pago no pudo procesarse.");
                setStripeSubmitting(false);
                return;
            }

            // No confiamos solo en lo que dice el navegador: reverificamos
            // contra la API de Stripe antes de dar el pedido por aprobado.
            const res = await fetch("/api/payments/stripe/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: stripeOrderIdRef.current }),
            });
            const order = await res.json();

            if (order.paymentStatus === "APPROVED") {
                clearCart();
                router.push(`/tracking?orderId=${stripeOrderIdRef.current}`);
            } else if (order.paymentStatus === "REJECTED") {
                setError("Tu pago no se completó. No se hizo ningún cargo.");
                setStripeSubmitting(false);
            } else {
                // paymentIntent en proceso (raro con redirect:if_required, pero por si acaso)
                setError("Tu pago sigue en proceso. Consulta tu pedido en unos momentos.");
                setStripeSubmitting(false);
            }
        } catch {
            setError("Error al confirmar el pago.");
            setStripeSubmitting(false);
        }
    };

    // Botón "Reintentar": si el SDK de Stripe nunca llegó a cargar (bloqueado,
    // red lenta, etc.) hay que reintentar desde ahí, no solo el mount del
    // formulario -- si no, truena porque window.Stripe todavía no existe.
    const retryStripeCheckout = () => {
        setError("");
        if (!window.Stripe) {
            // El tag que ya está en el DOM a estas alturas ya falló/agotó
            // sus intentos -- lo quitamos para forzar uno de verdad nuevo.
            document.getElementById("stripe-sdk-v3")?.remove();
            stripeSdkAttemptsRef.current = 0;
            loadStripeSDK();
        } else {
            setupStripeCheckout();
        }
    };

    // Monta el formulario de tarjeta en cuanto Stripe.js termina de cargar,
    // solo si el cliente sigue en la pestaña de tarjeta Y Stripe es el
    // proveedor activo (en pausa por ahora -- ver CARD_PROVIDER arriba).
    useEffect(() => {
        if (CARD_PROVIDER === "stripe" && method === "CARD" && stripeSdkLoaded && !stripeElementsRef.current) {
            setupStripeCheckout();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stripeSdkLoaded, method]);

    // ── Conekta (tokenizer directo) ─────────────────────────────────────
    // Mismo patrón resiliente que se usó para Stripe: reintentos con
    // backoff antes de mostrarle cualquier error al cliente.
    const conektaSdkAttemptsRef = useRef(0);
    const CONEKTA_TIMEOUTS_MS = [4000, 6000, 8000];
    const [cardNumber, setCardNumber] = useState("");
    const [cardName, setCardName] = useState("");
    const [cardExpiry, setCardExpiry] = useState(""); // MM/AA
    const [cardCvc, setCardCvc] = useState("");

    const loadConektaSDK = () => {
        if (window.Conekta) { setConektaSdkLoaded(true); return; }

        const attempt = conektaSdkAttemptsRef.current;
        conektaSdkAttemptsRef.current += 1;

        let s = document.getElementById("conekta-tokenizer-sdk") as HTMLScriptElement | null;
        if (!s) {
            s = document.createElement("script");
            s.id = "conekta-tokenizer-sdk";
            s.src = "https://cdn.conekta.io/js/latest/conekta.js";
            s.async = true;
            document.body.appendChild(s);
        }
        s.onload = () => setConektaSdkLoaded(true);
        s.onerror = () => conektaRetryOrGiveUp(attempt, true);

        window.setTimeout(() => {
            if (!window.Conekta && conektaSdkAttemptsRef.current === attempt + 1) {
                conektaRetryOrGiveUp(attempt, false);
            }
        }, CONEKTA_TIMEOUTS_MS[attempt] ?? 8000);
    };

    const conektaRetryOrGiveUp = (attempt: number, hardFailure: boolean) => {
        if (window.Conekta) return;
        if (attempt < CONEKTA_TIMEOUTS_MS.length - 1) {
            if (hardFailure) document.getElementById("conekta-tokenizer-sdk")?.remove();
            loadConektaSDK();
        } else {
            setError("No se pudo conectar con el sistema de pago. Verifica tu conexión a internet e intenta de nuevo.");
        }
    };

    // En cuanto el SDK carga, solo hace falta la llave pública para poder
    // mostrar el formulario -- a diferencia de Stripe/Component, no hace
    // falta crear nada en el servidor todavía (eso pasa hasta que el
    // cliente le da "Pagar", igual que con Efectivo).
    const setupConektaCheckout = async () => {
        if (conektaSetupStartedRef.current) return;
        conektaSetupStartedRef.current = true;
        setError("");
        try {
            if (!conektaPublicKeyRef.current) {
                const cfg = await fetch("/api/payments/conekta/config").then(r => r.json());
                if (!cfg.publicKey) throw new Error("El pago con tarjeta no está disponible todavía.");
                conektaPublicKeyRef.current = cfg.publicKey;
            }
            window.Conekta.setPublicKey(conektaPublicKeyRef.current);
            window.Conekta.setLanguage("es");
            setConektaMounted(true);
        } catch (err: any) {
            setError(err?.message || "Error al conectar con el sistema de pago.");
            conektaSetupStartedRef.current = false;
        }
    };

    const retryConektaCheckout = () => {
        setError("");
        if (!window.Conekta) {
            document.getElementById("conekta-tokenizer-sdk")?.remove();
            conektaSdkAttemptsRef.current = 0;
            loadConektaSDK();
        } else {
            conektaSetupStartedRef.current = false;
            setupConektaCheckout();
        }
    };

    useEffect(() => {
        if (CARD_PROVIDER === "conekta" && method === "CARD" && conektaSdkLoaded && !conektaSetupStartedRef.current) {
            setupConektaCheckout();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conektaSdkLoaded, method]);

    // Tokeniza la tarjeta EN EL NAVEGADOR (el número/cvc nunca se manda a
    // nuestro servidor) y con ese token crea la orden + el cargo. No
    // confiamos solo en el token: el servidor vuelve a consultar el estado
    // real del pago contra la API de Conekta antes de aprobar el pedido.
    const handleConektaPay = () => {
        setError("");
        const [expMonth, expYear] = cardExpiry.split("/").map(s => s.trim());
        if (!cardNumber || !cardName || !expMonth || !expYear || !cardCvc) {
            setError("Completa todos los datos de la tarjeta.");
            return;
        }
        setConektaSubmitting(true);
        window.Conekta.Token.create(
            {
                card: {
                    number: cardNumber.replace(/\s/g, ""),
                    name: cardName,
                    exp_month: expMonth,
                    exp_year: expYear.length === 2 ? `20${expYear}` : expYear,
                    cvc: cardCvc,
                },
            },
            async (token: any) => {
                try {
                    const res = await fetch("/api/payments/conekta/create-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            token: token.id,
                            userId: user?.id,
                            customerName: user?.name || user?.email || "Cliente",
                            address: "Ubicación GPS (Actual)",
                            total,
                            payerEmail: user?.email,
                            items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                        }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        setError(data.error || "Tu pago no pudo procesarse.");
                        setConektaSubmitting(false);
                        return;
                    }
                    if (data.paymentStatus === "APPROVED") {
                        clearCart();
                        router.push(`/tracking?orderId=${data.orderId}`);
                    } else if (data.paymentStatus === "REJECTED") {
                        setError("Tu pago no se completó. No se hizo ningún cargo.");
                        setConektaSubmitting(false);
                    } else {
                        setError("Tu pago sigue en proceso. Consulta tu pedido en unos momentos.");
                        setConektaSubmitting(false);
                    }
                } catch {
                    setError("Error al procesar el pago. Verifica tu conexión e intenta de nuevo.");
                    setConektaSubmitting(false);
                }
            },
            (err: any) => {
                console.error("[CONEKTA_TOKEN_ERROR]", err);
                setError(err?.message_to_purchaser || err?.message || "No se pudo validar tu tarjeta. Revisa los datos.");
                setConektaSubmitting(false);
            }
        );
    };

    // Efectivo: no depende de Stripe ni de ningún script externo -- crea el
    // pedido directo y ya, el repartidor cobra en persona al entregar.
    const handleCashPay = async () => {
        setCashSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.id,
                    customerName: user?.name || user?.email || "Cliente",
                    address: "Ubicación GPS (Actual)",
                    total,
                    paymentMethod: "CASH",
                    items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "No se pudo crear el pedido.");
                setCashSubmitting(false);
                return;
            }
            clearCart();
            router.push(`/tracking?orderId=${data.id}`);
        } catch {
            setError("Error al crear el pedido. Verifica tu conexión e intenta de nuevo.");
            setCashSubmitting(false);
        }
    };

    if (!mounted) return null;

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

            {/* Fixed error toast — always visible regardless of scroll */}
            {error && (
                <div className="fixed top-4 left-4 right-4 z-50 max-w-[448px] mx-auto flex items-start gap-3 p-4 rounded-2xl bg-red-600 text-white text-sm font-medium shadow-2xl animate-in slide-in-from-top-4 duration-300">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="shrink-0 text-white/70 hover:text-white">✕</button>
                </div>
            )}

            <div className="pt-20 px-4 flex flex-col gap-5">

                {/* spacer when error is shown */}
                {error && <div className="h-14" />}

                {/* Selector de método -- efectivo es el respaldo: si el celular
                    del cliente bloquea Stripe por lo que sea, siempre puede
                    cambiar aquí y pagar sin depender de ningún script externo. */}
                <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
                    <button
                        onClick={() => { setMethod("CARD"); setError(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${method === "CARD" ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30" : "text-gray-400"}`}
                    >
                        <CreditCard size={16} /> Tarjeta
                    </button>
                    <button
                        onClick={() => { setMethod("CASH"); setError(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${method === "CASH" ? "bg-green-600 text-white shadow-lg shadow-green-600/30" : "text-gray-400"}`}
                    >
                        <Banknote size={16} /> Efectivo
                    </button>
                </div>

                {/* Los dos bloques quedan SIEMPRE montados (solo se ocultan con
                    CSS) -- si el de tarjeta se desmontara al cambiar de pestaña,
                    el mount() de Stripe truena porque busca un DOM que ya no
                    existe (le puede tocar mientras el cliente ya cambió a
                    Efectivo, ya que la carga del SDK sigue en segundo plano). */}
                <div className={method === "CARD" && CARD_PROVIDER === "stripe" ? "flex flex-col gap-5" : "hidden"}>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        {/* Mientras el formulario real de Stripe termina de montarse, se
                            ve un boceto estático (no una pantalla de "cargando") para
                            que el método de pago se sienta listo desde que se abre esta
                            pantalla. La espera real -- si la hay -- se siente al tocar
                            "Pagar", no antes. */}
                        {!stripeReady && !error && (
                            <div className="flex flex-col gap-3 animate-pulse" aria-hidden>
                                <div className="h-12 rounded-xl bg-white/10 border border-white/10" />
                                <div className="flex gap-3">
                                    <div className="h-12 rounded-xl bg-white/10 border border-white/10 flex-1" />
                                    <div className="h-12 rounded-xl bg-white/10 border border-white/10 flex-1" />
                                </div>
                            </div>
                        )}

                        {!stripeReady && error && (
                            <button onClick={retryStripeCheckout} disabled={stripeSubmitting}
                                className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                                {stripeSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Reintentar"}
                            </button>
                        )}

                        {/* Stripe monta aquí su Payment Element (campos de tarjeta reales) */}
                        <div ref={stripeMountRef} className={stripeReady ? "" : "hidden"} />

                        {/* El botón de pagar siempre está a la vista -- solo se activa
                            (deja de estar atenuado) cuando el formulario ya está listo
                            para recibir el pago. */}
                        {!error && (
                            <button onClick={handleStripePay} disabled={stripeSubmitting || !stripeReady}
                                className="w-full py-4 rounded-2xl bg-violet-500 text-white font-bold text-lg shadow-lg shadow-violet-500/30 disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-1">
                                {stripeSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Pagar ${total.toFixed(2)}</>}
                            </button>
                        )}

                        {method === "CARD" && !stripeReady && error && (
                            <p className="text-center text-xs text-gray-500">
                                ¿Sigue sin cargar? Cambia a <button onClick={() => { setMethod("CASH"); setError(""); }} className="text-green-400 font-bold underline">Efectivo</button> para completar tu pedido de todos modos.
                            </p>
                        )}

                        <p className="text-center text-xs text-gray-500 pb-2">
                            🔒 Tus datos se procesan de forma segura por Stripe. Nunca los guardamos.
                        </p>
                    </div>
                </div>

                {/* Conekta -- proveedor de tarjeta activo. Los campos de tarjeta
                    viven aquí mismo (no en un iframe de Conekta -- su Checkout
                    Component tiene un bug real confirmado que lo deja en 0px de
                    alto). El número/cvc nunca se manda a nuestro servidor: se
                    tokenizan en el navegador con Conekta.Token.create y solo el
                    token resultante viaja al backend. */}
                <div className={method === "CARD" && CARD_PROVIDER === "conekta" ? "flex flex-col gap-5" : "hidden"}>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        {!conektaMounted && !error && (
                            <div className="flex flex-col gap-3 animate-pulse" aria-hidden>
                                <div className="h-12 rounded-xl bg-white/10 border border-white/10" />
                                <div className="flex gap-3">
                                    <div className="h-12 rounded-xl bg-white/10 border border-white/10 flex-1" />
                                    <div className="h-12 rounded-xl bg-white/10 border border-white/10 flex-1" />
                                </div>
                            </div>
                        )}

                        {!conektaMounted && error && (
                            <button onClick={retryConektaCheckout} disabled={conektaSubmitting}
                                className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                                {conektaSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Reintentar"}
                            </button>
                        )}

                        {conektaMounted && (
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text" inputMode="numeric" autoComplete="cc-number" placeholder="Número de tarjeta"
                                    value={cardNumber} onChange={e => setCardNumber(e.target.value)} disabled={conektaSubmitting}
                                    className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-violet-400 disabled:opacity-50"
                                />
                                <input
                                    type="text" autoComplete="cc-name" placeholder="Nombre en la tarjeta"
                                    value={cardName} onChange={e => setCardName(e.target.value)} disabled={conektaSubmitting}
                                    className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-violet-400 disabled:opacity-50"
                                />
                                <div className="flex gap-3">
                                    <input
                                        type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
                                        value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} disabled={conektaSubmitting}
                                        className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-violet-400 disabled:opacity-50 flex-1"
                                    />
                                    <input
                                        type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="CVC"
                                        value={cardCvc} onChange={e => setCardCvc(e.target.value)} disabled={conektaSubmitting}
                                        className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-violet-400 disabled:opacity-50 flex-1"
                                    />
                                </div>
                            </div>
                        )}

                        {conektaMounted && (
                            <button onClick={handleConektaPay} disabled={conektaSubmitting}
                                className="w-full py-4 rounded-2xl bg-violet-500 text-white font-bold text-lg shadow-lg shadow-violet-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-1">
                                {conektaSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Pagar ${total.toFixed(2)}</>}
                            </button>
                        )}

                        {method === "CARD" && !conektaMounted && error && (
                            <p className="text-center text-xs text-gray-500">
                                ¿Sigue sin cargar? Cambia a <button onClick={() => { setMethod("CASH"); setError(""); }} className="text-green-400 font-bold underline">Efectivo</button> para completar tu pedido de todos modos.
                            </p>
                        )}

                        <p className="text-center text-xs text-gray-500 pb-2">
                            🔒 Tus datos se procesan de forma segura por Conekta. Nunca los guardamos.
                        </p>
                    </div>
                </div>

                <div className={method === "CASH" ? "flex flex-col gap-5" : "hidden"}>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Total a pagar:</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-600/10 border border-green-600/20">
                            <Banknote size={20} className="text-green-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-300">
                                Pagas en efectivo directo al repartidor cuando te entregue tu pedido. Ten el monto exacto listo si puedes.
                            </p>
                        </div>

                        <button onClick={handleCashPay} disabled={cashSubmitting}
                            className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-lg shadow-lg shadow-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                            {cashSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Confirmar pedido</>}
                        </button>
                    </div>
                </div>
            </div>
            <BottomNav />
        </main>
    );
}
