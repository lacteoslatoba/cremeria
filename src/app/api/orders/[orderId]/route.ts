import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        const body = await request.json();
        const { orderId } = await params;

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: body.status },
        });

        revalidatePath("/admin/orders");
        return NextResponse.json(updatedOrder);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        const { orderId } = await params;
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        return NextResponse.json(order);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        const { orderId } = await params;

        // Primero eliminar los OrderItems asociados (para evitar errores de foreign key)
        await prisma.orderItem.deleteMany({
            where: { orderId: orderId }
        });

        const deletedOrder = await prisma.order.delete({
            where: { id: orderId }
        });

        revalidatePath("/admin/orders");
        return NextResponse.json(deletedOrder);
    } catch (error) {
        console.error("[ORDER_DELETE_ERROR]", error);
        return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
    }
}
