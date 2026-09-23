import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession, loadAuthUser } from "@/lib/auth";
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
    // El AuthGuard del cliente (src/components/auth/auth-guard.tsx) deja
    // navegar /admin libremente para no encerrar a un admin fuera de ahí --
    // pero eso significaba que ESTE Server Component, al no revisar sesión,
    // le mandaba pedidos/clientes/ventas reales a CUALQUIERA que entrara a
    // /admin sin cuenta (confirmado con curl sin cookie: la respuesta traía
    // nombres de clientes reales). El filtro tiene que vivir aquí, del lado
    // del servidor, antes de consultar.
    //
    // OJO: esto va ANTES del Promise.all de las 5 consultas a propósito (no
    // junto, como un intento anterior) -- corrí las 5 en paralelo con el
    // check de sesión para no sumarle una vuelta más al admin ya logueado,
    // pero eso hacía que alguien SIN sesión (p. ej. al picar "Control Panel"
    // en el menú sin estar logueado) esperara las 5 consultas completas
    // (pedidos, clientes, ventas...) antes de mandarlo al login -- ~1-1.5s
    // de nada, reproducido en vivo: el usuario picaba Control Panel y el
    // login tardaba en aparecer. El camino sin sesión debe ser el más
    // rápido de los dos, no el más lento.
    const authUser = await loadAuthUser(await readSession({ headers: await headers() } as unknown as Request));
    if (!authUser || authUser.role !== "ADMIN") {
        redirect("/login?portal=admin");
    }

    const [products, orders, salesRows, customers, drivers, business] = await Promise.all([
        // Inventario: todos los productos (incluye inactivos/sin stock)
        prisma.product.findMany({ orderBy: { createdAt: "desc" } }),

        // Pedidos completos (para la pestaña de Pedidos). El usuario se incluye solo
        // con lo necesario para buscar por teléfono en el panel: el teléfono vive en
        // User, no en Order, y sin esto "buscar por número" no encontraba nada.
        prisma.order.findMany({
            include: {
                items: { include: { product: true } },
                user: { select: { id: true, name: true, phone: true } },
            },
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

        // Clientes: solo cuentas CUSTOMER -- un repartidor o el admin no son
        // clientes, aunque compartan la misma tabla User. Sin este filtro
        // aparecían mezclados en el directorio de clientes.
        prisma.user.findMany({
            where: { role: "CUSTOMER" },
            include: { _count: { select: { orders: true } } },
            orderBy: { createdAt: "desc" },
        }),

        // Repartidores
        prisma.user.findMany({
            where: { role: "DELIVERY" },
            include: { _count: { select: { deliveryOrders: true } } },
            orderBy: { createdAt: "desc" },
        }),

        // Perfil del negocio (fila única, id fijo "default")
        prisma.business.findUnique({ where: { id: "default" } }),
    ]);

    // SalesHistory (cliente) espera ISO strings; los pedidos en Prisma llegan
    // como objeto Date -- Next las serializa a ISO en el cable igual, pero la
    // firma TS lo pide explícito.
    const salesFeed = salesRows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));

    return (
        <SingleScreenAdmin
            products={products}
            orders={orders}
            salesOrders={salesFeed}
            customers={customers}
            drivers={drivers}
            business={business}
        />
    );
}


