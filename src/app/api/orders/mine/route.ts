import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";

// Devuelve SOLO los pedidos del usuario autenticado (historial personal).
// Incluye los items, el estado, el código de entrega (cuando corresponde) y la
// confirmación de entrega, para que el cliente siga su compra.
export async function GET(request: Request) {
    const session = await readSession(request);
    if (!session?.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
        // hiddenFromUser: el cliente los "eliminó" de su lista -- siguen
        // existiendo de verdad (el admin los ve completos), solo no se
        // le vuelven a mostrar a él.
        where: { userId: session.id, hiddenFromUser: false },
        orderBy: { createdAt: "desc" },
        include: {
            items: { include: { product: { select: { id: true, name: true, image: true } } } },
            delivery: { select: { id: true, name: true } },
        },
    });

    return NextResponse.json(orders);
}
