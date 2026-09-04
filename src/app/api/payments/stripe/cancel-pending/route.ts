import { NextResponse } from "next/server";
import { cancelPendingOrderAndRestoreStock } from "@/lib/create-order";

// Cancela un pedido PENDING adelantado por prefetchStripeIntent (ver
// cart/page.tsx) cuando el cliente cambia el carrito antes de llegar a
// pagar -- devuelve el stock que había apartado. Exige que el userId que
// manda coincida con el dueño de la orden, para que nadie pueda cancelar
// (y liberar stock de) el pedido pendiente de otra persona.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.orderId || !body.userId) {
            return NextResponse.json({ error: "Falta orderId o userId" }, { status: 400 });
        }
        const cancelled = await cancelPendingOrderAndRestoreStock(body.orderId, body.userId);
        return NextResponse.json({ cancelled });
    } catch (error: any) {
        console.error("[STRIPE_CANCEL_PENDING_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo cancelar" }, { status: 500 });
    }
}
