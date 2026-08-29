// Cliente de Conekta via su API REST directa (sin el SDK oficial -- así
// controlamos exactamente qué se manda). Doc: https://developers.conekta.com/reference
//
// Se probó primero el "Checkout Component" (iframe propio de Conekta, como
// Stripe Elements) pero tiene un bug real confirmado: todos sus recursos
// cargan bien (JS, CSS, device collector, todo 200) pero el iframe nunca
// recibe la señal para mostrarse -- se queda en 0px de alto sin importar
// cuánto se espere. No es algo arreglable desde este lado.
//
// Se usa en su lugar el tokenizer directo (conekta.js + Conekta.Token.create)
// -- el otro método oficial que documentan. Los campos de tarjeta viven en
// nuestra propia página (no en un iframe de Conekta), pero el número/cvc
// nunca se manda a nuestro servidor: se tokenizan en el navegador y solo el
// token_id resultante llega al backend.

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
};

// Crea la Order + el cargo en un solo paso, usando el token de tarjeta que
// ya generó Conekta.js en el navegador (los datos crudos de la tarjeta
// nunca tocan nuestro servidor).
export async function createConektaCardOrder(params: {
    tokenId: string;
    amount: number; // pesos, se convierte a centavos abajo
    customerName: string;
    email: string;
    phone?: string;
    orderId: string; // nuestro id de Order, para referencia
}): Promise<ConektaOrderResult> {
    return conektaFetch("/orders", {
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
            charges: [
                {
                    amount: Math.round(params.amount * 100),
                    payment_method: {
                        type: "card",
                        token_id: params.tokenId,
                    },
                },
            ],
        }),
    });
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
