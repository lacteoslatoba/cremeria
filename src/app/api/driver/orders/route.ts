import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Returns two lists for the DELIVERY app:
//  - available: unclaimed orders with a confirmed address (PENDING o
//    PREPARING -- 25/09, instruccion directa de Mike: ya no hace falta que
//    el admin "suelte" el pedido a mano, queda disponible para cualquier
//    repartidor libre desde que se hace la compra)
//  - mine: orders claimed by this driver that are not finished
// Solo un usuario con rol DELIVERY autenticado puede consultar pedidos de repartidor.
export async function GET(request: Request) {
    const auth = await requireAuth(request, ["DELIVERY"]);
    if (!auth.user) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        // El repartidor solo puede consultar SUS pedidos, nunca el de otro usuario.
        if (!userId) return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
        if (userId !== auth.user.id) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
        }

        const include = { items: { include: { product: true } } };

        const [available, mine] = await Promise.all([
            prisma.order.findMany({
                where: { status: { in: ["PENDING", "PREPARING"] }, deliveryId: null, addressConfirmedAt: { not: null } },
                include,
                orderBy: { createdAt: "asc" },
            }),
            prisma.order.findMany({
                where: { deliveryId: auth.user.id, status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] } },
                include,
                orderBy: { createdAt: "asc" },
            }),
        ]);

        return NextResponse.json({ available, mine });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch driver orders" }, { status: 500 });
    }
}
