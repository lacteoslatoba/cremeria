import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// MP sends a POST here when payment status changes
// Configure this URL in your MP account:
//   https://www.mercadopago.com.mx/developers/panel/app → Webhooks
//   URL: https://your-app.vercel.app/api/payments/webhook

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("[MP Webhook] Recibido:", JSON.stringify(body));

        // MP sends: { action, type, data: { id } }
        const { type, data } = body;

        if (type !== "payment" || !data?.id) {
            // Other event types (merchant_orders, etc.) — acknowledge and ignore
            return NextResponse.json({ received: true });
        }

        const mpPaymentId = String(data.id);

        // Verify with MP API (never trust the webhook body alone)
        const mpRes = await fetch(
            `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
            {
                headers: {
                    "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                },
            }
        );
        const payment = await mpRes.json();
        console.log("[MP Webhook] Payment verificado:", {
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
        });

        const mpStatus = payment.status; // approved | rejected | in_process | cancelled

        // Map MP status to our paymentStatus
        let paymentStatus: string;
        if (mpStatus === "approved") {
            paymentStatus = "APPROVED";
        } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
            paymentStatus = "REJECTED";
        } else {
            paymentStatus = "PENDING"; // in_process, pending
        }

        // Find the order with this mpPaymentId
        const order = await prisma.order.findFirst({
            where: { mpPaymentId },
        });

        if (!order) {
            console.warn("[MP Webhook] No se encontró orden con mpPaymentId:", mpPaymentId);
            return NextResponse.json({ received: true });
        }

        // Update order status based on payment result
        const updateData: any = { paymentStatus };

        if (paymentStatus === "APPROVED") {
            // Only move to PENDING delivery queue when payment is confirmed
            if (order.status === "PENDING") {
                updateData.status = "PENDING"; // stay PENDING for admin to pick up
            }
        } else if (paymentStatus === "REJECTED") {
            // If rejected, cancel the order and restore stock
            updateData.status = "CANCELLED";

            // Restore inventory for cancelled order
            const orderItems = await prisma.orderItem.findMany({
                where: { orderId: order.id },
            });
            for (const item of orderItems) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }
        }

        await prisma.order.update({
            where: { id: order.id },
            data: updateData,
        });

        console.log(`[MP Webhook] Orden ${order.id} actualizada: paymentStatus=${paymentStatus}`);
        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("[MP Webhook] Error:", error?.message);
        // Always return 200 to MP even on error so they don't retry forever
        return NextResponse.json({ received: true });
    }
}

// MP also does a GET to verify the webhook URL exists
export async function GET() {
    return NextResponse.json({ ok: true });
}
