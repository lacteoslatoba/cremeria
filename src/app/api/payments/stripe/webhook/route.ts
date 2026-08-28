import { NextResponse } from "next/server";
import { getStripe, reconcileStripeOrder } from "@/lib/stripe";

// A diferencia de Clip, Stripe SÍ firma sus webhooks (header stripe-signature +
// STRIPE_WEBHOOK_SECRET) — se verifica esa firma antes de confiar en nada,
// mismo criterio que ya usamos en el webhook de Mercado Pago.
export async function POST(request: Request) {
    try {
        const signature = request.headers.get("stripe-signature");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const rawBody = await request.text();

        if (!signature || !webhookSecret) {
            console.error("[STRIPE_WEBHOOK] Falta firma o STRIPE_WEBHOOK_SECRET");
            return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 });
        }

        let event;
        try {
            event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err: any) {
            console.error("[STRIPE_WEBHOOK] Firma inválida:", err?.message);
            return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
        }

        if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
            const intent = event.data.object as { metadata?: { orderId?: string } };
            const orderId = intent.metadata?.orderId;
            if (orderId) await reconcileStripeOrder(orderId);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[STRIPE_WEBHOOK_ERROR]", error);
        return NextResponse.json({ error: "Webhook error" }, { status: 500 });
    }
}
