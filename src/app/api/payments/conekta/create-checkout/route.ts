import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { createConektaCheckoutOrder } from "@/lib/conekta";
import { notifyDeliveryCode } from "@/lib/notify";

// Crea la orden (PENDING/PENDING, stock reservado -- igual que Stripe) y una
// Order de Conekta con checkout embebido. El navegador usa el
// checkoutRequestId para montar el formulario de tarjeta real (iframe de
// Conekta); la orden solo se aprueba tras reverificar el estado real contra
// la API de Conekta (ver /confirm y /webhook), nunca por lo que diga el
// navegador solo.
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
            paymentMethod: "CONEKTA",
            paymentStatus: "PENDING",
        });

        // Envía por SMS el código de verificación de entrega al cliente cuando
        // levanta su compra. Fire-and-forget: un fallo de SMS no bloquea el pago.
        if (body.userId) {
            try {
                const u = await prisma.user.findUnique({ where: { id: body.userId }, select: { phone: true } });
                if (u?.phone) notifyDeliveryCode(order, u.phone).catch(() => { });
            } catch {
                // no bloquear el flujo si falla la consulta del teléfono
            }
        }

        const { conektaOrderId, checkoutRequestId } = await createConektaCheckoutOrder({
            amount: Number(body.total),
            customerName: body.customerName || "Cliente",
            email: body.payerEmail || "cliente@cremeriadelrancho.com",
            phone: body.payerPhone,
            orderId: order.id,
        });

        await prisma.order.update({
            where: { id: order.id },
            data: { conektaOrderId },
        });

        return NextResponse.json({ orderId: order.id, checkoutRequestId });
    } catch (error: any) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[CONEKTA_CREATE_CHECKOUT_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo iniciar el pago con Conekta" }, { status: 500 });
    }
}
