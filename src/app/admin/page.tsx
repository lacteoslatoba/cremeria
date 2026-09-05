import { prisma } from "@/lib/prisma";
import { SingleScreenAdmin } from "@/components/admin/single-screen-admin";

// Esta página no lee cookies/headers ni nada que Next detecte como
// "dinámico" por sí solo -- sin esto, la trata como estática y la sirve
// desde caché (edge de Vercel + el router cache del navegador) hasta 5
// minutos, aunque revalidatePath() ya haya corrido. Por eso después de
// Guardar en un producto el panel no se actualizaba solo (router.refresh()
// podía reusar esa copia en caché) y hacía falta un F5 a mano para
// forzarlo. Un panel que existe para ver pedidos/ventas EN VIVO no puede
// quedarse con datos de hace rato -- se marca explícitamente dinámica.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
    // Las 5 consultas son independientes entre sí (no hay ninguna que
    // necesite el resultado de otra) -- antes se pedían una tras otra en
    // serie, sumando su tiempo; en paralelo el panel carga (y cada
    // router.refresh() después de guardar algo) en lo que tarda la más
    // lenta de las 5, no en la suma de las 5.
    const [products, orders, salesRows, customers, drivers] = await Promise.all([
        // Inventario: todos los productos (incluye inactivos/sin stock)
        prisma.product.findMany({ orderBy: { createdAt: "desc" } }),

        // Pedidos completos (para la pestaña de Pedidos)
        prisma.order.findMany({
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
        }),

        // Historial de ventas: solo COMPLETED / CANCELLED con items y delivery
        prisma.order.findMany({
            where: { status: { in: ["COMPLETED", "CANCELLED"] } },
            include: {
                items: { include: { product: { select: { id: true, name: true } } } },
                delivery: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        }),

        // Clientes: todos los usuarios con conteo de pedidos
        prisma.user.findMany({
            include: { _count: { select: { orders: true } } },
            orderBy: { createdAt: "desc" },
        }),

        // Repartidores
        prisma.user.findMany({
            where: { role: "DELIVERY" },
            include: { _count: { select: { deliveryOrders: true } } },
            orderBy: { createdAt: "desc" },
        }),
    ]);

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


