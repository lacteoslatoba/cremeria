import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { requireAuth } from "@/lib/auth";

// Solo ADMIN puede listar todos los pedidos: incluye datos de clientes
// (nombre, dirección) y el código de verificación de entrega de cada uno.
export async function GET(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    try {
        const orders = await prisma.order.findMany({
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        // paymentMethod: CASH | CARD
        // mpPaymentId: MP payment ID (only for card payments)
        // mpPaymentStatus: approved | in_process | rejected (from MP)
        const paymentMethod = body.paymentMethod || "CASH";
        const mpPaymentId = body.mpPaymentId || null;
        const mpPaymentStatus = body.mpPaymentStatus || null;

        // Determine paymentStatus to store
        let paymentStatus = "APPROVED"; // cash is always "approved" immediately
        if (paymentMethod === "CARD") {
            if (mpPaymentStatus === "approved") paymentStatus = "APPROVED";
            else if (mpPaymentStatus === "rejected" || mpPaymentStatus === "cancelled") paymentStatus = "REJECTED";
            else paymentStatus = "PENDING"; // in_process, pending → waiting for webhook
        }

        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address,
            total: body.total,
            items,
            userId: body.userId,
            paymentMethod,
            paymentStatus,
            mpPaymentId,
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
