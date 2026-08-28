import { NextResponse } from "next/server";
import { reconcileStripeOrder } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// El checkout llama esto justo después de que stripe.confirmPayment()
// resuelve en el navegador — pero la respuesta real que importa viene de
// reverificar contra la API de Stripe aquí, no de lo que reportó el cliente.
export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();
        if (!orderId) return NextResponse.json({ error: "orderId es requerido" }, { status: 400 });

        await reconcileStripeOrder(orderId);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, status: true, paymentStatus: true, total: true },
        });
        if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

        return NextResponse.json(order);
    } catch (error) {
        console.error("[STRIPE_CONFIRM_ERROR]", error);
        return NextResponse.json({ error: "No se pudo verificar el pago" }, { status: 500 });
    }
}
