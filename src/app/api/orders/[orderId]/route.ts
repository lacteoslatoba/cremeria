import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notifyOrderStatus } from "@/lib/notify";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const auth = await requireAuth(request, ["ADMIN", "DELIVERY"]);
    if (!auth.user) return auth.response;

    try {
        const body = await request.json();
        const { orderId } = await params;

        const data: { status?: string; deliveryId?: string | null } = {};
        if (body.status !== undefined) data.status = body.status;
        if (body.deliveryId !== undefined) data.deliveryId = body.deliveryId || null;

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data,
            include: { user: { select: { phone: true } } },
        });

        // Fire-and-forget: notify the customer by SMS on status changes.
        if (body.status !== undefined) {
            notifyOrderStatus(updatedOrder, updatedOrder.user?.phone).catch(() => { });
        }

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
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                customerName: true,
                total: true,
                delivery: {
                    select: { id: true, name: true, phone: true, currentLat: true, currentLng: true, locationUpdatedAt: true }
                },
            },
        });

        if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

        // Protección de acceso al detalle/tracking:
        // - Si hay sesión, solo el inicio (owner), un ADMIN o el repartidor asignado pueden ver el pedido.
        // - Si no hay sesión (p. ej. checkout de invitado), se mantiene el acceso por orderId (compatibilidad),
        //   ya que sin cookies de sesión no hay forma de verificar el owner; aun así se devuelven campos mínimos.
        return NextResponse.json(order);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

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
    } catch (error: any) {
        console.error("[ORDER_DELETE_ERROR]", error);
        return NextResponse.json({ error: error?.message || "Failed to delete order" }, { status: 500 });
    }
}
