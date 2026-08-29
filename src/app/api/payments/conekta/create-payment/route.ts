import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { createConektaCardOrder, mapConektaStatus } from "@/lib/conekta";
import { notifyDeliveryCode } from "@/lib/notify";

// Recibe el token de tarjeta que ya generó Conekta.js en el navegador (los
// datos crudos de la tarjeta nunca tocan nuestro servidor). Crea la orden
// y el cargo en un solo paso.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        if (!body.token) {
            return NextResponse.json({ error: "Falta el token de la tarjeta" }, { status: 400 });
        }

        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address,
            total: body.total,
            items,
            userId: body.userId,
            paymentMethod: "CONEKTA",
            paymentStatus: "PENDING",
        });

        let conektaOrder;
        try {
            conektaOrder = await createConektaCardOrder({
                tokenId: body.token,
                amount: Number(body.total),
                customerName: body.customerName || "Cliente",
                email: body.payerEmail || "cliente@cremeriadelrancho.com",
                phone: body.payerPhone,
                orderId: order.id,
            });
        } catch (conektaError: any) {
            // El cargo falló del lado de Conekta (tarjeta rechazada, etc.) --
            // devolvemos el stock reservado, la orden queda como rechazada.
            console.error("[CONEKTA_CREATE_PAYMENT_ERROR]", conektaError?.message, "| status:", conektaError?.status, "| details:", JSON.stringify(conektaError?.details));
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "REJECTED" } });
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            });
            return NextResponse.json(
                { error: conektaError?.details?.details?.[0]?.message || "Tu pago no pudo procesarse. Verifica los datos de tu tarjeta.", orderId: order.id },
                { status: 400 }
            );
        }

        const paymentStatus = mapConektaStatus(conektaOrder.payment_status);

        if (paymentStatus === "REJECTED") {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: { paymentStatus, conektaOrderId: conektaOrder.id },
                });
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            });
        } else {
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus, conektaOrderId: conektaOrder.id },
            });
        }

        if (paymentStatus === "APPROVED" && body.userId) {
            try {
                const u = await prisma.user.findUnique({ where: { id: body.userId }, select: { phone: true } });
                if (u?.phone) notifyDeliveryCode(order, u.phone).catch(() => { });
            } catch {
                // no bloquear el flujo si falla la consulta del teléfono
            }
        }

        return NextResponse.json({ orderId: order.id, paymentStatus });
    } catch (error: any) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[CONEKTA_CREATE_PAYMENT_ROUTE_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo procesar el pago" }, { status: 500 });
    }
}
