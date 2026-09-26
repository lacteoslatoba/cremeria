"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { consumePrefetchedStripeIntent } from "@/lib/stripe-prefetch";

// Errores como { message } que devuelve Stripe.js (tipos del navegador no
// están incluidos en el paquete `stripe` del servidor; se modela aquí solo la
// superficie que el checkout usa, sin recurrir a `any`).
type StripeErrorLike = { message?: string; code?: string };
type StripeErrorEventPayload = { error?: StripeErrorLike };
type StripeChangeEventPayload = { complete?: boolean; empty?: boolean };
type StripePaymentElement = {
    mount(el: HTMLElement | null): void;
    on(event: "ready", handler: () => void): StripePaymentElement;
    on(event: "error", handler: (payload: StripeErrorEventPayload) => void): StripePaymentElement;
    on(event: "change", handler: (payload: StripeChangeEventPayload) => void): StripePaymentElement;
};
type StripeElementsApi = {
    create(type: "payment", options: object): StripePaymentElement;
};
type StripeApi = {
    elements(options: object): StripeElementsApi;
    confirmPayment(options: {
        elements: StripeElementsApi;
        confirmParams: { return_url: string; payment_method_data?: object };
        redirect?: "if_required";
    }): Promise<{ error?: StripeErrorLike }>;
};

declare global {
    interface Window { Stripe?: (publicKey: string) => StripeApi; }
}

// Solo pago con TARJETA (via Stripe Payment Element -- los datos de la
// tarjeta nunca tocan nuestra página). Stripe es la única pasarela; Conekta y
// Mercado Pago fueron eliminados del todo (código y backend). Efectivo se
// quitó del checkout (25/09, instruccion directa de Mike: "en esta app todos
// los pedidos son pago con tarjeta") -- ya no hay respaldo si Stripe no
// carga, solo el botón "Reintentar".
export default function CheckoutPage() {
    const router = useRouter();
    const { items, clearCart } = useCartStore();
    const { user } = useAuthStore();

    // Antes se mandaba un correo genérico compartido ("cliente@...") a la
    // pasarela de tarjeta cuando la cuenta no tenía email real -- eso hace
    // que su sistema vea "el mismo cliente" comprando muchas veces seguidas
    // (aunque sean personas distintas), lo cual dispara más fácil el
    // antifraude por riesgo. Si no hay email real, usamos algo único por
    // cliente (su teléfono) en vez de un valor compartido.
    const payerEmail = user?.email || (user?.phone ? `${user.phone}@cremeriadelrancho.com` : undefined);

    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState("");
    // Stripe (Payment Element)
    const [stripeSdkLoaded, setStripeSdkLoaded] = useState(false);
    const [stripeReady, setStripeReady] = useState(false);
    const [stripeSubmitting, setStripeSubmitting] = useState(false);
    // El navegador (autocompletado de tarjeta guardada) a veces rellena el
    // número visualmente sin disparar los eventos que el iframe de Stripe
    // necesita para registrarlo -- se ve lleno pero Stripe lo sigue
    // considerando incompleto. Escuchando el evento "change" (que Stripe sí
    // dispara siempre, venga la entrada de teclado o de autocompletado) se
    // sabe la verdad y se puede bloquear "Pagar" antes de que el cliente
    // choque con un error después de esperar el viaje redondo del pago.
    const [elementComplete, setElementComplete] = useState(false);
    const stripePublicKeyRef = useRef("");
    const stripeRef = useRef<StripeApi | null>(null); // instancia de window.Stripe(pk)
    const stripeElementsRef = useRef<StripeElementsApi | null>(null);
    const stripeOrderIdRef = useRef("");
    const stripeMountRef = useRef<HTMLDivElement>(null);
    const stripeReadyRef = useRef(false);
    const mountPaymentAttemptRef = useRef(0);

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal;

    useEffect(() => {
        setMounted(true);
        if (items.length === 0) router.push("/cart");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Un cliente real nunca va a leer "desactiva tu bloqueador" ni sabría
    // cómo -- si la carga del SDK falla o tarda, reintentamos solos varias
    // veces antes de mostrarle cualquier error. Solo si de plano no jala
    // después de reintentar le pedimos recargar la página.
    const stripeSdkAttemptsRef = useRef(0);
    // Antes 12s/8s/10s (30s en total) -- confirmado en un caso real que
    // cuando este script de verdad no puede cargar en la red del cliente,
    // falla al instante (no lento): no tiene caso hacerlo esperar medio
    // minuto antes de caer al respaldo de Mercado Pago.
    const SDK_TIMEOUTS_MS = [4000, 3000, 3000]; // 10s en total

    // El SDK solo sirve si de verdad quedó como función. Caso real: el
    // <script> dispara onload pero lo que llegó viene vacío/a medias (red
    // móvil, caché del navegador o del Service Worker, operador que bloquea
    // js.stripe.com) y window.Stripe queda como cualquier cosa menos algo que
    // se pueda llamar. Antes bastaba con que EXISTIERA para darlo por bueno,
    // así que el checkout seguía, pedía una orden real y reventaba más
    // adelante con "window.Stripe is not a function".
    const stripeSdkUsable = () => typeof window.Stripe === "function";

    const loadStripeSDK = () => {
        if (stripeSdkUsable()) { setStripeSdkLoaded(true); return; }

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
            if (!stripeSdkUsable() && stripeSdkAttemptsRef.current === attempt + 1) {
                retryOrGiveUp(attempt, false);
            }
        }, SDK_TIMEOUTS_MS[attempt] ?? 12000);
    };

    const retryOrGiveUp = (attempt: number, hardFailure: boolean) => {
        if (stripeSdkUsable()) return; // ya cargó a través de otra vía justo a tiempo
        if (attempt < SDK_TIMEOUTS_MS.length - 1) {
            // Solo si el script falló de verdad (bloqueado) quitamos el tag
            // roto para que el siguiente reintento use uno limpio. Por
            // "tardar" no descartamos el script que sigue en camino.
            if (hardFailure) {
                document.getElementById("stripe-sdk-v3")?.remove();
            }
            loadStripeSDK();
        } else {
            // Se agotaron los reintentos: js.stripe.com de verdad no carga en
            // esta conexión (confirmado en un caso real: algunos operadores
            // móviles -- ej. Telcel -- bloquean ese dominio puntual aunque el
            // resto de internet funcione bien, incluido api.stripe.com). El
            // enlace "¿Sigue sin cargar? -> Efectivo" que aparece con este
            // error es el respaldo para no dejar al cliente varado.
            setError("No se pudo conectar con el sistema de pago. Verifica tu conexión a internet e intenta de nuevo.");
        }
    };

    // El intento (orden + PaymentIntent) se pide UNA sola vez por total. Si el
    // montaje del formulario falla y el cliente toca "Reintentar", se reutiliza
    // ese mismo -- sigue siendo pagable -- en vez de crear otra orden real y
    // volver a apartar stock. Caso real: en un celular el SDK de Stripe no
    // cargó, el cliente tocó "Reintentar" 4 veces y se crearon 4 órdenes
    // idénticas de $10 en 33s (4 PaymentIntents, ningún cobro intentado y 4
    // unidades de stock apartadas) -- una por cada toque.
    const cachedIntentRef = useRef<{
        total: number;
        promise: Promise<{ ok: boolean; data: { orderId?: string; clientSecret?: string; customerSessionClientSecret?: string } }>;
    } | null>(null);

    const requestStripeIntent = () => {
        if (cachedIntentRef.current && Math.abs(cachedIntentRef.current.total - total) < 0.01) {
            return cachedIntentRef.current.promise;
        }

        // Si el carrito ya adelantó esta misma orden al tocar "Continuar"
        // (ver prefetchStripeIntent en cart/page.tsx), se usa esa promesa en
        // vez de pedir una nueva -- para cuando el cliente llega aquí, la
        // orden ya está lista o a punto, no recién empezando a pedirse.
        const promise = consumePrefetchedStripeIntent(total) || fetch("/api/payments/stripe/create-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user?.id,
                customerName: user?.name || user?.email || "Cliente",
                total,
                payerEmail,
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
            }),
        }).then(async (res) => ({ ok: res.ok, data: await res.json() }));

        cachedIntentRef.current = { total, promise };
        return promise;
    };

    // Crea la orden + PaymentIntent en el servidor, y monta el formulario de
    // tarjeta de Stripe (Payment Element) directo en esta pantalla.
    const setupStripeCheckout = async () => {
        if (stripeElementsRef.current) return; // ya montado

        // Carrito vacío: el efecto de montaje ya manda a /cart, pero este
        // montaje del formulario de pago alcanzaba a dispararse antes de que
        // esa redirección pasara -- y con items vacíos el servidor creaba una
        // orden real de $0 que Stripe rechazaba, dejando la pantalla de pago
        // sin formulario y con un error crudo de Stripe. Sin productos no se
        // pide nada.
        if (items.length === 0) return;

        setStripeSubmitting(true);
        setError("");
        setElementComplete(false);
        try {
            // La llave pública no cambia -- se guarda en localStorage para no
            // volver a pedirla en la próxima visita (ahorra una ida y vuelta
            // completa al servidor). No es sensible, por eso se llama "pública".
            if (!stripePublicKeyRef.current) {
                const cached = typeof window !== "undefined" ? window.localStorage.getItem("stripe_pk") : null;
                if (cached) stripePublicKeyRef.current = cached;
            }

            // La llave pública primero (casi siempre ya está en localStorage,
            // o sea sin ida y vuelta al servidor) y, una vez que el SDK de
            // Stripe SÍ está disponible, recién se pide la orden + el
            // PaymentIntent.
            //
            // Antes iban en paralelo y la revisión del SDK venía al final:
            // cuando el SDK no cargaba, el intento ya había creado una orden
            // real con stock apartado, el cliente solo veía el error y el botón
            // "Reintentar", y CADA toque de ese botón creaba OTRA orden. Sin SDK
            // usable no se pide nada: ese intento no se va a poder pagar desde
            // este aparato, así que no tiene caso apartar inventario por él.
            const cfg = stripePublicKeyRef.current
                ? { publicKey: stripePublicKeyRef.current }
                : await fetch("/api/payments/stripe/config").then(r => r.json());
            if (!cfg.publicKey) throw new Error("El pago con tarjeta no está disponible todavía.");
            stripePublicKeyRef.current = cfg.publicKey;
            try { window.localStorage.setItem("stripe_pk", cfg.publicKey); } catch { /* modo privado, etc. -- no pasa nada */ }

            // Caso real confirmado: a veces el <script> "termina de cargar"
            // (onload dispara) pero el contenido que en verdad llegó viene
            // vacío/incompleto por la red -- window.Stripe se queda sin
            // definir (o como algo que no se puede llamar) aunque
            // stripeSdkLoaded ya diga que sí.
            const stripeFactory = window.Stripe;
            if (typeof stripeFactory !== "function") {
                setError("No se pudo conectar con el sistema de pago. Verifica tu conexión a internet e intenta de nuevo.");
                setStripeSubmitting(false);
                return;
            }
            if (!stripeRef.current) stripeRef.current = stripeFactory(stripePublicKeyRef.current);

            const intentResult = await requestStripeIntent();
            const { ok, data } = intentResult;
            if (!ok || !data.clientSecret) {
                setError(data.error || "No se pudo iniciar el pago.");
                setStripeSubmitting(false);
                return;
            }
            stripeOrderIdRef.current = data.orderId;

            // El Payment Element traía el look genérico de Stripe (recuadros
            // blancos, tipografía default) que no pegaba nada con el resto de
            // la app. Se lee la paleta real de globals.css en el momento (así
            // sigue el tema claro/oscuro del sistema solo, sin duplicar los
            // valores a mano) y se le pasa a Stripe como "appearance", más la
            // misma tipografía (Plus Jakarta Sans) que ya usa toda la app.
            const rootStyle = getComputedStyle(document.documentElement);
            const cssVar = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback;
            const primary = cssVar("--primary", "#ee2b34");
            const bgCard = cssVar("--bg-card", "#ffffff");
            const foreground = cssVar("--foreground", "#212529");
            const border = cssVar("--border", "#e0e0e0");

            const appearance = {
                theme: "flat" as const,
                variables: {
                    colorPrimary: primary,
                    colorBackground: bgCard,
                    colorText: foreground,
                    colorTextSecondary: foreground,
                    colorDanger: "#ef4444",
                    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
                    fontSizeBase: "15px",
                    borderRadius: "14px",
                    spacingUnit: "4px",
                },
                rules: {
                    ".Input": {
                        border: `1px solid ${border}`,
                        boxShadow: "none",
                        padding: "14px",
                        backgroundColor: bgCard,
                    },
                    ".Input:focus": {
                        border: `1px solid ${primary}`,
                        boxShadow: `0 0 0 1px ${primary}`,
                    },
                    ".Label": {
                        fontWeight: "600",
                        fontSize: "13px",
                        marginBottom: "6px",
                    },
                    ".Tab": {
                        border: `1px solid ${border}`,
                        borderRadius: "14px",
                        padding: "12px 14px",
                    },
                    ".Tab:hover": {
                        border: `1px solid ${primary}`,
                    },
                    ".Tab--selected": {
                        border: `1px solid ${primary}`,
                        boxShadow: `0 0 0 1px ${primary}`,
                    },
                    ".CheckboxInput": {
                        borderRadius: "6px",
                        border: `1px solid ${border}`,
                    },
                    ".CheckboxInput--checked": {
                        backgroundColor: primary,
                        border: `1px solid ${primary}`,
                    },
                },
            };

            // customerSessionClientSecret solo llega si el cliente tiene sesión
            // iniciada (invitados no pueden guardar tarjeta) -- con esto el
            // Payment Element muestra el check "Guardar esta tarjeta" y, si ya
            // tenía una guardada de antes, la vuelve a mostrar lista para usar.
            const elements = stripeRef.current.elements({
                clientSecret: data.clientSecret,
                appearance,
                fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" }],
                ...(data.customerSessionClientSecret ? { customerSessionClientSecret: data.customerSessionClientSecret } : {}),
            });
            // El Payment Element pedía de nuevo correo, celular y nombre
            // completo (billing details) aunque ya los tenemos guardados del
            // cliente -- se ocultan esos campos y se mandan directo en
            // confirmPayment() (ver handleStripePay), sin que el cliente
            // tenga que volver a escribirlos.
            //
            // paymentMethodTypes: ["card"] -- Al agregar la Customer Session
            // (para el check de "Guardar esta tarjeta") volvió a aparecer todo
            // el bloque de Stripe Link (correo/celular/nombre + "acepto crear
            // una cuenta..."), aunque el PaymentIntent ya estaba fijado a solo
            // "card" del lado del servidor. Fijarlo también aquí, del lado del
            // Payment Element, es lo que de verdad lo quita -- la Customer
            // Session ofrece Link como su propio mecanismo de guardado sin
            // importar el payment_method_types del intent.
            const paymentElement = elements.create("payment", {
                paymentMethodTypes: ["card"],
                fields: {
                    billingDetails: { name: "never", email: "never", phone: "never" },
                },
            });
            stripeElementsRef.current = elements;

            // Escuchar el ciclo de vida del Payment Element para no dejar al
            // usuario en "Preparando…" infinito: si Stripe no logra montar el
            // formulario (bloqueo de iframe, SDK, etc.), mostramos el motivo.
            paymentElement.on("ready", () => {
                stripeReadyRef.current = true;
                setStripeReady(true);
            });
            paymentElement.on("error", (event) => {
                console.error("[STRIPE_ELEMENT_ERROR]", event?.error?.message);
                setStripeReady(false);
                setError(event?.error?.message || "El formulario de pago no pudo cargar. Revisa tu conexión y reintenta.");
            });
            paymentElement.on("change", (event) => {
                setElementComplete(!!event?.complete);
            });

            mountPaymentAttemptRef.current = 1;
            try {
                paymentElement.mount(stripeMountRef.current);
            } catch (mountErr) {
                throw mountErr;
            }

            // Resguardo: si Stripe no confirma "ready" en tiempo, mostrar aviso
            // en vez de dejar el spinner infinito.
            window.setTimeout(() => {
                if (!stripeReadyRef.current) {
                    setError("El formulario de pago tarda en cargar. Si el problema continúa, recarga la página.");
                }
            }, 12000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al conectar con el sistema de pago.");
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
                    // Ya que se ocultaron esos campos del formulario (arriba en
                    // setupStripeCheckout), se mandan aquí con lo que ya
                    // tenemos del cliente en vez de dejarlos vacíos.
                    payment_method_data: {
                        billing_details: {
                            name: user?.name || undefined,
                            email: payerEmail || user?.email || undefined,
                            phone: user?.phone || undefined,
                        },
                    },
                },
                redirect: "if_required", // se queda en la página cuando no hace falta 3DS
            });

            if (confirmError) {
                // "incomplete_*" es Stripe diciendo que ese campo se ve lleno
                // pero no registró la entrada completa -- el caso típico es el
                // autocompletado del navegador/teléfono, que no siempre
                // sincroniza con el iframe de Stripe. El mensaje default de
                // Stripe no deja claro qué hacer; aquí sí.
                const autofillHint = confirmError.code?.startsWith("incomplete_")
                    ? " Borra ese campo y escribe los datos de la tarjeta a mano -- el autocompletado a veces no lo registra bien."
                    : "";
                setError((confirmError.message || "Tu pago no pudo procesarse.") + autofillHint);
                setElementComplete(false);
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
                router.push(`/direccion/${order.id}`);
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
        if (!stripeSdkUsable()) {
            // El tag que ya está en el DOM a estas alturas ya falló/agotó
            // sus intentos -- lo quitamos para forzar uno de verdad nuevo.
            document.getElementById("stripe-sdk-v3")?.remove();
            stripeSdkAttemptsRef.current = 0;
            loadStripeSDK();
        } else {
            setupStripeCheckout();
        }
    };

    // Monta el formulario de tarjeta de Stripe en cuanto Stripe.js termina de
    // cargar, solo si el cliente sigue en la pestaña de tarjeta.
    useEffect(() => {
        if (stripeSdkLoaded && !stripeElementsRef.current) {
            setupStripeCheckout();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stripeSdkLoaded]);

    // Carga el SDK de Stripe (única pasarela de tarjeta) al entrar al checkout.
    useEffect(() => {
        loadStripeSDK();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

                <div className="flex flex-col gap-5">
                    <div className="rounded-2xl bg-foreground/5 border border-foreground/10 p-5 flex flex-col gap-5">
                        <div className="flex justify-between items-center pb-4 border-b border-foreground/10">
                            <span className="font-semibold text-sm text-foreground/60 uppercase tracking-wide">Total a pagar</span>
                            <span className="font-black text-2xl text-primary">${total.toFixed(2)}</span>
                        </div>

                        {/* Mientras el formulario real de Stripe termina de montarse, se
                            ve un boceto estático (no una pantalla de "cargando") para
                            que el método de pago se sienta listo desde que se abre esta
                            pantalla. La espera real -- si la hay -- se siente al tocar
                            "Pagar", no antes. */}
                        {!stripeReady && !error && (
                            <div className="flex flex-col gap-3 animate-pulse" aria-hidden>
                                <div className="h-12 rounded-xl bg-foreground/5 border border-foreground/15" />
                                <div className="flex gap-3">
                                    <div className="h-12 rounded-xl bg-foreground/5 border border-foreground/15 flex-1" />
                                    <div className="h-12 rounded-xl bg-foreground/5 border border-foreground/15 flex-1" />
                                </div>
                            </div>
                        )}

                        {!stripeReady && error && (
                            <button onClick={retryStripeCheckout} disabled={stripeSubmitting}
                                className="w-full py-4 rounded-2xl bg-foreground/5 border border-foreground/20 text-foreground font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                                {stripeSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Reintentar"}
                            </button>
                        )}

                        {/* Stripe monta aquí su Payment Element (campos de tarjeta reales) */}
                        <div ref={stripeMountRef} className={stripeReady ? "" : "hidden"} />

                        {/* El botón de pagar siempre está a la vista -- solo se activa
                            (deja de estar atenuado) cuando el formulario ya está listo
                            para recibir el pago. */}
                        {!error && (
                            <button onClick={handleStripePay} disabled={stripeSubmitting || !stripeReady || !elementComplete}
                                className="w-full py-4 rounded-2xl bg-violet-500 text-white font-bold text-lg shadow-lg shadow-violet-500/30 disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-1">
                                {stripeSubmitting ? <Loader2 className="animate-spin" size={22} /> : <><CheckCircle2 size={20} /> Pagar ${total.toFixed(2)}</>}
                            </button>
                        )}
                        {/* Pistas de que el autocompletado del cel/navegador llenó el
                            número visualmente pero Stripe todavía no lo registra --
                            pasa seguido con el autocompletado de tarjetas guardadas en
                            Android/Chrome, que no siempre dispara lo que el iframe de
                            Stripe necesita para contarlo como escrito de verdad. */}
                        {!error && stripeReady && !elementComplete && !stripeSubmitting && (
                            <p className="text-center text-xs text-gray-500">
                                Si tu teléfono llenó la tarjeta con autocompletado y no se activa &quot;Pagar&quot;, borra el campo y escribe los datos a mano.
                            </p>
                        )}

                        <p className="text-center text-xs text-gray-500 pb-2">
                            🔒 Tus datos se procesan de forma segura por Stripe. Nunca los guardamos.
                        </p>
                    </div>
                </div>

            </div>
            <BottomNav />
        </main>
    );
}

