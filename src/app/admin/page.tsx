import { prisma } from "@/lib/prisma";
import { SingleScreenAdmin } from "@/components/admin/single-screen-admin";

export default async function AdminDashboardPage() {
    // Inventario: todos los productos (incluye inactivos/sin stock)
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });

    // Pedidos completos (para la pestaña de Pedidos)
    const orders = await prisma.order.findMany({
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
    });

    // Historial de ventas: solo COMPLETED / CANCELLED con items y delivery
    const salesRows = await prisma.order.findMany({
        where: { status: { in: ["COMPLETED", "CANCELLED"] } },
        include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            delivery: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    // Clientes: todos los usuarios con conteo de pedidos
    const customers = await prisma.user.findMany({
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: "desc" },
    });

    // Repartidores
    const drivers = await prisma.user.findMany({
        where: { role: "DELIVERY" },
        include: { _count: { select: { deliveryOrders: true } } },
        orderBy: { createdAt: "desc" },
    });

    return (
        <SingleScreenAdmin
            products={products}
            orders={orders}
            salesOrders={salesRows}
            customers={customers}
            drivers={drivers}
        />
    );
}


