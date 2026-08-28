import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns two lists for the DELIVERY app:
//  - available: PREPARING orders nobody has claimed yet
//  - mine: orders claimed by this driver that are not finished
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "userId es requerido" }, { status: 400 });

        const include = { items: { include: { product: true } } };

        const [available, mine] = await Promise.all([
            prisma.order.findMany({
                where: { status: "PREPARING", deliveryId: null },
                include,
                orderBy: { createdAt: "asc" },
            }),
            prisma.order.findMany({
                where: { deliveryId: userId, status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] } },
                include,
                orderBy: { createdAt: "asc" },
            }),
        ]);

        return NextResponse.json({ available, mine });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch driver orders" }, { status: 500 });
    }
}
