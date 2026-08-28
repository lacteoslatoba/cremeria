import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClipCheckout } from "@/lib/clip";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";

// Creates our Order first (PENDING/PENDING, stock reserved — same pattern as
// a CARD payment "in_process"), then asks Clip for a hosted checkout page to
// send the customer to. The order is only marked APPROVED once we've
// re-verified the real status with Clip (webhook or the return page).
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address,
            total: body.total,
            items,
            userId: body.userId,
            paymentMethod: "CLIP",
            paymentStatus: "PENDING",
        });

        const origin = new URL(request.url).origin;

        const checkout = await createClipCheckout({
            amount: body.total,
            description: `Pedido Cremería del Rancho #${order.id.slice(-6).toUpperCase()}`,
            externalReference: order.id,
            successUrl: `${origin}/checkout/clip-return?orderId=${order.id}&result=success`,
            errorUrl: `${origin}/checkout/clip-return?orderId=${order.id}&result=error`,
            defaultUrl: `${origin}/checkout/clip-return?orderId=${order.id}&result=default`,
            webhookUrl: `${origin}/api/payments/clip/webhook`,
            customer: body.payerEmail ? { email: body.payerEmail, name: body.customerName } : undefined,
        });

        // Keep the Clip payment_request_id so the return page / webhook can
        // re-verify the real status with Clip's API later.
        await prisma.order.update({
            where: { id: order.id },
            data: { clipPaymentId: checkout.payment_request_id },
        });

        return NextResponse.json({
            orderId: order.id,
            redirectUrl: checkout.payment_request_url,
            paymentRequestId: checkout.payment_request_id,
        });
    } catch (error: any) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[CLIP_CREATE_CHECKOUT_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo iniciar el pago con Clip" }, { status: 500 });
    }
}
