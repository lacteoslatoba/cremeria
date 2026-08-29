import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileConektaOrder } from "@/lib/conekta";
import { notifyOrderStatus } from "@/lib/notify";

// Conekta manda un webhook cuando el estado de una orden cambia (order.paid,
// order.declined, order.pending_payment, etc.). No confiamos en el payload
// del webhook por sí solo -- volvemos a consultar la orden directo contra
// la API de Conekta (reconcileConektaOrder) antes de actualizar la nuestra.
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const eventType = body?.type as string | undefined;
        const conektaOrderId = body?.data?.object?.id as string | undefined;

        if (!eventType?.startsWith("order.") || !conektaOrderId) {
            return NextResponse.json({ ok: true }); // notificación irrelevante
        }

        const order = await prisma.order.findFirst({
            where: { conektaOrderId },
            select: { id: true },
        });
        if (!order) return NextResponse.json({ ok: true });

        const updated = await reconcileConektaOrder(order.id);
        if (updated && updated.paymentStatus !== "PENDING") {
            const full = await prisma.order.findUnique({ where: { id: order.id }, include: { user: { select: { phone: true } } } });
            if (full) notifyOrderStatus(full, full.user?.phone).catch(() => { });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[CONEKTA_WEBHOOK_ERROR]", error);
        // Responder 200 igual: si devolvemos error Conekta reintenta, y no
        // queremos reintentos infinitos por un payload raro.
        return NextResponse.json({ ok: true });
    }
}
