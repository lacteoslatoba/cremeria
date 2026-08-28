import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notifyOrderStatus } from "@/lib/notify";
import { requireAuth, readSession } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const auth = await requireAuth(request, ["ADMIN", "DELIVERY"]);
    if (!auth.user) return auth.response;

    try {
        const body = await request.json();
        const { orderId } = await params;

        // ── Verificación de entrega con código ──
        // El repartidor (DELIVERY) debe capturar el código que el cliente le da
        // para marcar COMPLETED (entrega final). Esto confirma que se entregó a
        // la persona correcta. El ADMIN (dueño del negocio) puede completar
        // directamente por tener acceso administrativo total.
        if (body.status === "COMPLETED") {
            const current = await prisma.order.findUnique({ where: { id: orderId } });
            if (!current) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

            let deliveryCodeStatus = "GENERATED";

            if (auth.user.role === "DELIVERY") {
                if (!current.deliveryCode) {
                    return NextResponse.json({ error: "Este pedido no tiene código de entrega" }, { status: 400 });
                }
                const provided = String(body.deliveryCode || "").trim();
                if (provided !== current.deliveryCode) {
                    return NextResponse.json({ error: "Código de entrega incorrecto. No se completó la entrega." }, { status: 403 });
                }
                deliveryCodeStatus = "VERIFIED";
            }

            const completed = await prisma.order.update({
                where: { id: orderId },
                data: {
                    status: "COMPLETED",
                    deliveryCodeStatus,
                    deliveryConfirmedAt: new Date(),
                },
                include: { user: { select: { phone: true } } },
            });

            // Avisa al cliente que su pedido fue entregado.
            notifyOrderStatus(completed, completed.user?.phone).catch(() => { });
            revalidatePath("/admin/orders");
            return NextResponse.json(completed);
        }

        // ── Otros cambios de estado (PREPARING, OUT_FOR_DELIVERY, CANCELLED) ──
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
                paymentStatus: true,
                deliveryCode: true,
                userId: true,
                delivery: {
                    select: { id: true, name: true, phone: true, currentLat: true, currentLng: true, locationUpdatedAt: true }
                },
            },
        });

        if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

        // Mostrar o no el código de verificación de entrega.
        // Solo se entrega al cliente que levanta (compra aprobada) mientras la
        // orden NO ha sido entregada. Se oculta el código si hay sesión de admin
        // o repartidor (que no deben verlo) y, por defecto (invitado), solo se
        // muestra si aún no está COMPLETED/CANCELLED.
        const session = await readSession(request);
        const isOwner = order.userId && session?.id === order.userId;
        // Para invitados (sin sesión) mostramos el código mientras el pedido esté
        // en curso, para que el cliente pueda dárselo al repartidor.
        const orderActive = !["COMPLETED", "CANCELLED"].includes(order.status);
        const shouldHideCode =
            (session && !isOwner) // sesión de otro usuario (admin/repartidor/cliente ajeno)
            || (order.paymentStatus !== "APPROVED") // aún no pagado
            || !orderActive; // ya entregado o cancelado

        const result = {
            ...order,
            deliveryCode: shouldHideCode ? undefined : (order.deliveryCode as string | undefined),
        };
        return NextResponse.json(result);
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
