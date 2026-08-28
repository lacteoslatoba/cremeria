import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A driver self-claims an unassigned order. Uses updateMany with the
// deliveryId:null guard so two drivers tapping "Aceptar" at the same time
// can't both win the same order.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        const { orderId } = await params;
        const { userId } = await request.json();
        if (!userId) return NextResponse.json({ error: "userId es requerido" }, { status: 400 });

        const result = await prisma.order.updateMany({
            where: { id: orderId, deliveryId: null },
            data: { deliveryId: userId },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: "Este pedido ya fue tomado por otro repartidor" }, { status: 409 });
        }

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        return NextResponse.json(order);
    } catch (error) {
        return NextResponse.json({ error: "Failed to accept order" }, { status: 500 });
    }
}
