import { NextResponse } from "next/server";
import { reconcileClipOrder } from "@/lib/clip";
import { prisma } from "@/lib/prisma";

// Called by /checkout/clip-return when the customer comes back from Clip.
// Always re-verifies against Clip's API before answering — the "result"
// query param on the redirect URL is only a UX hint, never trusted alone.
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");
        if (!orderId) return NextResponse.json({ error: "orderId es requerido" }, { status: 400 });

        await reconcileClipOrder(orderId);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, status: true, paymentStatus: true, total: true },
        });
        if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

        return NextResponse.json(order);
    } catch (error) {
        console.error("[CLIP_STATUS_ERROR]", error);
        return NextResponse.json({ error: "No se pudo verificar el pago" }, { status: 500 });
    }
}
