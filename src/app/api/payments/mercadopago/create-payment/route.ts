import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { createMercadoPagoPayment } from "@/lib/mercadopago";
import { notifyDeliveryCode } from "@/lib/notify";

// Pago con tarjeta por Mercado Pago (Card Form embedido en el checkout).
//
// Orden de operaciones (igual que el flujo de tarjeta actual):
//  1. Se crea la orden como PENDING y se reserva stock (createOrderWithStockCheck).
//  2. Se cobra contra la API de Mercado Pago con el token que generó el Card
//     Form en el navegador (el número/CVC nunca viaja aquí).
//  3. Según el resultado (approved/rejected/in_process) se actualiza la orden.
//     - approved  -> APPROVED (y se manda el SMS del código de entrega).
//     - rejected  -> REJECTED y se devuelve el stock.
//     - in_process/pending -> se deja PENDING; el webhook lo culmina.
//
// Nunca se confía solo en lo que dice el cliente: el estado final se resuelve
// contra la API de MP, no en lo que reportó el navegador.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address || "Ubicación GPS (Actual)",
            total: body.total,
            items,
            userId: body.userId,
            paymentMethod: "MERCADOPAGO",
            paymentStatus: "PENDING",
        });

        // IP real del cliente (la manda Vercel) y sesión de dispositivo para el
        // antifraude de MP -- sin señal de dispositivo es fácil que MP rechace
        // pagos legítimos como alto riesgo (nos pasó antes).
        const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

        let payment;
        try {
            payment = await createMercadoPagoPayment({
                token: body.token,
                transactionAmount: Number(body.total),
                description: `Pedido Cremería del Rancho #${order.id.slice(-6).toUpperCase()}`,
                installments: body.installments,
                paymentMethodId: body.paymentMethodId,
                payerEmail: body.payerEmail,
                payerFirstName: body.customerName?.split?.(" ")?.[0] || "Cliente",
                payerLastName: body.customerName?.split?.(" ")?.slice(1)?.join(" ") || "Cremeria",
                deviceSessionId: body.deviceId,
                ipAddress,
            });
        } catch (err: any) {
            // El cargo NO se completó (MP devolvió un rechazo o un error): no
            // tiene sentido dejar la orden ni el stock apartados. Se cancela la
            // orden PENDING y se devuelve el stock para que el cliente reintente.
            console.error("[MP_CREATE_PAYMENT_FAILED]", err?.message);
            await cancelPendingOrderAndRestoreStock(order.id);
            return NextResponse.json(
                {
                    error: friendlyMpError(err?.message),
                    detail: err?.message || undefined,
                    paymentStatus: "REJECTED",
                },
                { status: 402 }
            );
        }

        // Guardamos el id de pago de MP para poder reverificar/webhookear luego.
        await prisma.order.update({
            where: { id: order.id },
            data: { mpPaymentId: String(payment.id) },
        });

        // El Card Form normalmente resuelve approved/rejected al momento; si
        // queda in_process/pending, el webhook lo culmina más tarde (ver
        // /api/payments/mercadopago/webhook).
        let paymentStatus: "APPROVED" | "REJECTED" | "PENDING" = "PENDING";
        if (payment.status === "approved") paymentStatus = "APPROVED";
        else if (payment.status === "rejected" || payment.status === "cancelled") paymentStatus = "REJECTED";

        if (paymentStatus === "REJECTED") {
            await cancelPendingOrderAndRestoreStock(order.id);
            return NextResponse.json(
                {
                    error: friendlyMpError(payment.status_detail),
                    detail: payment.status_detail,
                    orderId: order.id,
                    paymentStatus,
                },
                { status: 402 }
            );
        }

        await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus },
        });

        // Fire-and-forget: un fallo de SMS no bloquea el pago.
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
        console.error("[MP_CREATE_PAYMENT_ROUTE_ERROR]", error?.message || error);
        return NextResponse.json({ error: error?.message || "No se pudo procesar el pago" }, { status: 500 });
    }
}

// Cuando el cargo de MP falla o se rechaza, la orden PENDING que ya reservó
// stock al crearse no debe quedarse así -- se marca REJECTED y se devuelve
// el stock, igual que con Stripe/Conekta.
async function cancelPendingOrderAndRestoreStock(orderId: string) {
    await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REJECTED" } });
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
            await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
            });
        }
    });
}

// Traduce los status_detail de MP a mensajes que un cliente real entiende.
// Si no reconocemos el código, se manda tal cual (createMercadoPagoPayment ya
// intenta usar la descripción en español que da MP -- cause[0].description --
// antes de caer en el código crudo).
function friendlyMpError(detail: string | undefined): string {
    const map: Record<string, string> = {
        cc_rejected_insufficient_amount: "Tu tarjeta no tiene fondos suficientes.",
        cc_rejected_bad_filled_card_number: "Revisa el número de tarjeta.",
        cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento.",
        cc_rejected_bad_filled_security_code: "Revisa el código de seguridad (CVC).",
        cc_rejected_bad_filled_other: "Revisa los datos de tu tarjeta.",
        cc_rejected_call_for_authorize: "Debes autorizar este pago con tu banco antes de intentar de nuevo.",
        cc_rejected_card_disabled: "Tu tarjeta está desactivada. Llama a tu banco para activarla.",
        cc_rejected_duplicated_payment: "Ya hiciste un pago por ese monto. Revisa tu historial antes de reintentar.",
        cc_rejected_high_risk: "Tu pago fue bloqueado por seguridad. Intenta con otra tarjeta.",
        cc_rejected_max_attempts: "Llegaste al límite de intentos permitidos con esta tarjeta.",
        cc_rejected_other_reason: "Tu banco rechazó el pago. Intenta con otra tarjeta.",
    };
    if (!detail) return "Tu pago no pudo procesarse. Verifica los datos de tu tarjeta.";
    return map[detail] || detail;
}
