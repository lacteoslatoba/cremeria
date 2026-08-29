// Cliente de Conekta via su API REST directa (sin el SDK oficial -- así
// controlamos exactamente qué se manda, igual que ya hacíamos con
// Mercado Pago). Doc: https://developers.conekta.com/reference
//
// Usamos el "Checkout Component" (iframe propio de Conekta, como Stripe
// Elements) en vez del tokenizer de campos crudos -- los datos de la
// tarjeta nunca tocan el JS de nuestra página, solo el iframe de Conekta.
// Flujo: 1) creamos una Order con checkout.type=Integration -> nos da un
// checkoutRequestId. 2) el cliente monta el componente con ese id y paga
// ahí mismo. 3) confirmamos el estado real vía webhook + reconcile (nunca
// confiamos solo en el callback del navegador).

const CONEKTA_API = "https://api.conekta.io";
const API_VERSION = "2.1.0";

function authHeader(): string {
    const key = process.env.CONEKTA_PRIVATE_KEY;
    if (!key) throw new Error("Conekta no está configurado (falta CONEKTA_PRIVATE_KEY)");
    return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

async function conektaFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${CONEKTA_API}${path}`, {
        ...options,
        headers: {
            "Authorization": authHeader(),
            "Accept": `application/vnd.conekta-v${API_VERSION}+json`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.details?.[0]?.message || data?.message || "Error al conectar con Conekta";
        const err: any = new Error(msg);
        err.status = res.status;
        err.details = data;
        throw err;
    }
    return data;
}

export type ConektaOrderResult = {
    id: string;
    payment_status: string; // pending_payment | paid | declined | expired | ...
    checkout?: { id: string };
};

// Crea la Order en Conekta con checkout.type="Integration" -- devuelve el
// checkoutRequestId que el navegador usa para montar el formulario de
// tarjeta embebido (iframe propio de Conekta).
export async function createConektaCheckoutOrder(params: {
    amount: number; // pesos, se convierte a centavos abajo
    customerName: string;
    email: string;
    phone?: string;
    orderId: string; // nuestro id de Order, para referencia
}): Promise<{ conektaOrderId: string; checkoutRequestId: string }> {
    const order: ConektaOrderResult = await conektaFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
            currency: "MXN",
            reference_id: params.orderId,
            customer_info: {
                name: params.customerName,
                email: params.email,
                phone: params.phone || undefined,
            },
            line_items: [
                {
                    name: `Pedido Cremería del Rancho #${params.orderId.slice(-6).toUpperCase()}`,
                    unit_price: Math.round(params.amount * 100),
                    quantity: 1,
                },
            ],
            checkout: {
                type: "Integration",
                allowed_payment_methods: ["card"],
            },
        }),
    });

    if (!order.checkout?.id) {
        throw new Error("Conekta no devolvió un checkout válido");
    }
    return { conektaOrderId: order.id, checkoutRequestId: order.checkout.id };
}

export async function getConektaOrder(orderId: string): Promise<ConektaOrderResult> {
    return conektaFetch(`/orders/${orderId}`);
}

export function mapConektaStatus(status: string | undefined): "APPROVED" | "REJECTED" | "PENDING" {
    if (status === "paid") return "APPROVED";
    if (status === "declined" || status === "expired" || status === "canceled") return "REJECTED";
    return "PENDING"; // pending_payment, partially_paid, etc.
}

// Reverifica el estado real de una orden pagada con Conekta directamente
// contra su API (nunca confía solo en lo que dice el cliente ni el webhook)
// y actualiza nuestra Order. Idempotente.
export async function reconcileConektaOrder(orderId: string) {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.conektaOrderId) return null;
    if (order.paymentStatus !== "PENDING") return order; // ya resuelto

    const conektaOrder = await getConektaOrder(order.conektaOrderId);
    const newStatus = mapConektaStatus(conektaOrder.payment_status);
    if (newStatus === "PENDING") return order;

    return prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: newStatus },
        });

        if (newStatus === "REJECTED") {
            const items = await tx.orderItem.findMany({ where: { orderId } });
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }
        }

        return updated;
    });
}
