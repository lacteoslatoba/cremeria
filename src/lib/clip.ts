// Clip "Checkout Redireccionado" — https://developer.clip.mx/reference/introduccion-a-clip-checkout
// The customer is sent to Clip's own hosted page to enter their card, then
// comes back to our site. We never touch card data ourselves.
//
// IMPORTANT: Clip does not document a webhook signature. We never trust the
// webhook body's status by itself — every confirmation re-checks the real
// status against Clip's API with our own credentials (GET /v2/checkout/:id).

const CLIP_API_BASE = "https://api.payclip.com/v2";

function authHeader(): string {
    const apiKey = process.env.CLIP_API_KEY;
    const secretKey = process.env.CLIP_SECRET_KEY;
    if (!apiKey || !secretKey) {
        throw new Error("Clip no está configurado (faltan CLIP_API_KEY / CLIP_SECRET_KEY)");
    }
    const token = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
    return `Basic ${token}`;
}

export type ClipCheckout = {
    payment_request_id: string;
    payment_request_url: string;
    status: string;
    [key: string]: unknown;
};

export async function createClipCheckout(params: {
    amount: number;
    description: string;
    externalReference: string;
    successUrl: string;
    errorUrl: string;
    defaultUrl: string;
    webhookUrl: string;
    customer?: { name?: string; email?: string; phone?: string };
}): Promise<ClipCheckout> {
    const res = await fetch(`${CLIP_API_BASE}/checkout`, {
        method: "POST",
        headers: {
            Authorization: authHeader(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            amount: Number(params.amount.toFixed(2)),
            currency: "MXN",
            purchase_description: params.description.slice(0, 250),
            redirection_url: {
                success: params.successUrl,
                error: params.errorUrl,
                default: params.defaultUrl,
            },
            webhook_url: params.webhookUrl,
            metadata: {
                external_reference: params.externalReference,
                ...(params.customer ? { customer_info: params.customer } : {}),
            },
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || "No se pudo crear el checkout de Clip");
    }
    return data;
}

export async function getClipCheckoutStatus(paymentRequestId: string): Promise<ClipCheckout> {
    const res = await fetch(`${CLIP_API_BASE}/checkout/${paymentRequestId}`, {
        headers: { Authorization: authHeader() },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || "No se pudo consultar el estado del pago en Clip");
    }
    return data;
}

// Clip statuses -> our internal Order.paymentStatus values
export function mapClipStatus(clipStatus: string): "APPROVED" | "REJECTED" | "PENDING" {
    if (clipStatus === "CHECKOUT_COMPLETED") return "APPROVED";
    if (clipStatus === "CHECKOUT_CANCELLED" || clipStatus === "CHECKOUT_EXPIRED") return "REJECTED";
    return "PENDING"; // CHECKOUT_CREATED, CHECKOUT_PENDING
}

// Re-verifies an order's real payment status directly against Clip's API
// (never trusts a webhook body or a return-URL query param by itself) and
// updates our Order accordingly. Safe to call more than once — idempotent.
export async function reconcileClipOrder(orderId: string) {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    return reconcileOrderRecord(order);
}

// Same as above, but looked up by Clip's own payment_request_id — used by
// the webhook, which reliably includes that field but not always our
// order id (as external_reference/me_reference_id).
export async function reconcileClipOrderByPaymentRequestId(paymentRequestId: string) {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findFirst({ where: { clipPaymentId: paymentRequestId } });
    return reconcileOrderRecord(order);
}

async function reconcileOrderRecord(order: { id: string; clipPaymentId: string | null; paymentStatus: string } | null) {
    if (!order || !order.clipPaymentId) return null;

    // Already resolved — nothing to do (also avoids double stock restores).
    if (order.paymentStatus !== "PENDING") return order;

    const { prisma } = await import("@/lib/prisma");
    const orderId = order.id;
    const checkout = await getClipCheckoutStatus(order.clipPaymentId);
    const newStatus = mapClipStatus(checkout.status);
    if (newStatus === "PENDING") return order; // still waiting on the customer

    return prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: newStatus },
        });

        // Payment failed/expired after we'd already reserved stock — give it back.
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
