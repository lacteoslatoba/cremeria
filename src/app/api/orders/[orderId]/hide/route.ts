import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";

// "Elimina" un pedido de la lista personal del cliente (Mis pedidos) --
// no lo borra de verdad: solo se marca hiddenFromUser para que ya no
// aparezca en su historial. El admin lo sigue viendo completo. Exige que
// el pedido sea del usuario que hace la petición -- nadie puede ocultar
// (ni mucho menos alterar) el pedido de otra persona.
//
// Vive bajo [orderId] (no [id]) para coincidir con el otro segmento
// dinámico que ya existía en esta misma ruta -- Next.js no permite dos
// nombres de slug distintos en el mismo nivel de la URL.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const session = await readSession(request);
    if (!session?.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { orderId } = await params;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
    if (!order || order.userId !== session.id) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    await prisma.order.update({ where: { id: orderId }, data: { hiddenFromUser: true } });
    return NextResponse.json({ ok: true });
}
