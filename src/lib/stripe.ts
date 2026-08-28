import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Cliente perezoso: si STRIPE_SECRET_KEY no está configurada (p. ej. en
// desarrollo antes de tener las claves), esto no truena hasta que de
// verdad se intente usar Stripe.
export function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error("Stripe no está configurado (falta STRIPE_SECRET_KEY)");
        _stripe = new Stripe(key);
    }
    return _stripe;
}

function mapStripeStatus(status: Stripe.PaymentIntent.Status): "APPROVED" | "REJECTED" | "PENDING" {
    if (status === "succeeded") return "APPROVED";
    if (status === "canceled") return "REJECTED";
    return "PENDING"; // requires_payment_method, requires_action, processing, etc.
}

// Reverifica el estado real de una orden pagada con Stripe directamente
// contra su API (nunca confía solo en lo que dice el cliente ni el webhook
// por sí solo) y actualiza nuestra Order. Idempotente — se puede llamar
// varias veces sin duplicar efectos.
export async function reconcileStripeOrder(orderId: string) {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.stripePaymentIntentId) return null;
    if (order.paymentStatus !== "PENDING") return order; // ya resuelto

    const intent = await getStripe().paymentIntents.retrieve(order.stripePaymentIntentId);
    const newStatus = mapStripeStatus(intent.status);
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
