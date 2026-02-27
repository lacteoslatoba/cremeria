import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { orderId: string } }) {
    try {
        const body = await request.json();

        const updatedOrder = await prisma.order.update({
            where: { id: params.orderId },
            data: { status: body.status },
        });

        return NextResponse.json(updatedOrder);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}
