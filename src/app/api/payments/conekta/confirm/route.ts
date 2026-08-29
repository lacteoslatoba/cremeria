import { NextResponse } from "next/server";
import { reconcileConektaOrder } from "@/lib/conekta";
import { prisma } from "@/lib/prisma";

// El navegador llama esto después de que el Checkout Component de Conekta
// "termina" -- pero no confiamos en ese callback solo (la doc de Conekta
// también lo advierte). Reverificamos directo contra su API antes de decir
// que el pedido está aprobado.
export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();
        if (!orderId) return NextResponse.json({ error: "Falta orderId" }, { status: 400 });

        const updated = await reconcileConektaOrder(orderId);
        if (!updated) {
            const existing = await prisma.order.findUnique({ where: { id: orderId } });
            if (!existing) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
            return NextResponse.json(existing);
        }
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("[CONEKTA_CONFIRM_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo confirmar el pago" }, { status: 500 });
    }
}
