// Adelanta la creación de la orden + PaymentIntent de Stripe -- para cuando
// el cliente de verdad llega a la pantalla de pago, la orden ya está lista
// (o a punto) en vez de recién empezar a pedirse ahí, que es lo que hacía
// sentir el formulario lento.
//
// Se dispara solo (debounced) en cuanto el cliente entra al carrito con
// productos, no hasta que toca "Continuar" -- así el campo de tarjeta puede
// estar listo desde antes de que decida pagar, como en apps de primer nivel
// (DiDi Food, etc. precargan igual la interfaz de pago). La diferencia real
// con esas apps: aquí crear el intento también aparta stock de inventario
// (van en el mismo paso), así que si el cliente cambia el carrito antes de
// pagar, el pedido adelantado anterior se cancela solo para no dejar
// productos apartados de más -- ver cancelOrder() abajo.
//
// Vive en un módulo aparte (no en el store de Zustand) porque es estado
// efímero de un solo uso: se consume y se descarta, no algo persistente ni
// que deba notificar a componentes.
type PrefetchPayload = {
    userId?: string;
    customerName: string;
    address: string;
    total: number;
    payerEmail?: string;
    items: { productId: string; quantity: number; price: number }[];
};

type PendingPrefetch = {
    promise: Promise<{ ok: boolean; data: any }>;
    total: number;
    userId?: string;
    orderIdPromise: Promise<string | null>;
};

let pending: PendingPrefetch | null = null;

function cancelOrder(orderId: string, userId?: string) {
    if (!orderId || !userId) return;
    fetch("/api/payments/stripe/cancel-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, userId }),
    }).catch(() => { /* si falla, la orden vieja se queda PENDING -- no rompe nada, solo desperdicia el apartado */ });
}

export function prefetchStripeIntent(payload: PrefetchPayload) {
    // Si ya había un pedido adelantado sin consumir (el carrito cambió antes
    // de que el checkout lo tomara), se cancela antes de crear el nuevo --
    // para no ir dejando stock apartado a cada cambio de carrito.
    if (pending) {
        const prev = pending;
        prev.orderIdPromise.then((orderId) => { if (orderId) cancelOrder(orderId, prev.userId); });
    }

    const promise = fetch("/api/payments/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).then(async (res) => ({ ok: res.ok, data: await res.json() }));

    const orderIdPromise = promise.then((r) => (r.ok && r.data?.orderId) ? r.data.orderId : null);

    pending = { promise, total: payload.total, userId: payload.userId, orderIdPromise };
    return promise;
}

// Se consume una sola vez. Si el total ya no coincide con el carrito actual
// (el cliente alcanzó a cambiar algo entre que se adelantó y llegar aquí --
// poco probable pero posible), se cancela esa orden en vez de dejarla
// apartando stock sin dueño, y el checkout simplemente pide una fresca.
export function consumePrefetchedStripeIntent(currentTotal: number) {
    if (!pending) return null;
    const found = pending;
    pending = null;

    if (Math.abs(found.total - currentTotal) > 0.01) {
        found.orderIdPromise.then((orderId) => { if (orderId) cancelOrder(orderId, found.userId); });
        return null;
    }
    return found.promise;
}
