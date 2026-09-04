// Adelanta la creación de la orden + PaymentIntent de Stripe desde el botón
// "Continuar" del carrito -- para cuando el cliente llega de verdad a la
// pantalla de pago, la orden ya está lista (o a punto) en vez de recién
// empezar a pedirse ahí, que es lo que hacía sentir el formulario lento.
//
// Vive en un módulo aparte (no en el store de Zustand) porque es estado
// efímero de un solo uso: se consume y se descarta, no algo persistente
// ni que deba notificar a componentes.
type PrefetchPayload = {
    userId?: string;
    customerName: string;
    address: string;
    total: number;
    payerEmail?: string;
    items: { productId: string; quantity: number; price: number }[];
};

let pending: { promise: Promise<{ ok: boolean; data: any }>; total: number } | null = null;

export function prefetchStripeIntent(payload: PrefetchPayload) {
    const promise = fetch("/api/payments/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).then(async (res) => ({ ok: res.ok, data: await res.json() }));
    pending = { promise, total: payload.total };
    return promise;
}

// Se consume una sola vez. Si el total ya no coincide con el carrito actual
// (el cliente alcanzó a cambiar algo entre el clic en "Continuar" y llegar
// aquí -- poco probable pero posible), se descarta: el checkout simplemente
// pide una orden nueva como si no hubiera adelantado nada.
export function consumePrefetchedStripeIntent(currentTotal: number) {
    if (!pending) return null;
    const found = pending;
    pending = null;
    if (Math.abs(found.total - currentTotal) > 0.01) return null;
    return found.promise;
}
