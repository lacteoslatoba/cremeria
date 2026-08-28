import { prisma } from "@/lib/prisma";
import { SalesHistory } from "@/components/admin/sales-history";

type SalesOrder = {
    id: string;
    customerName: string | null;
    address: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
    delivery: { id: string; name: string | null } | null;
    items: {
        id: string;
        productId: string;
        quantity: number;
        price: number;
        product: { id: string; name: string } | null;
    }[];
};

export default async function AdminSalesHistoryPage() {
    // Fetch only completed or cancelled orders for the history
    const rows = await prisma.order.findMany({
        where: {
            status: {
                in: ["COMPLETED", "CANCELLED"]
            }
        },
        include: {
            items: {
                include: { product: { select: { id: true, name: true } } },
            },
            delivery: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const orders: SalesOrder[] = rows.map((row) => ({
        id: row.id,
        customerName: row.customerName,
        address: row.address,
        total: row.total,
        status: row.status,
        paymentMethod: row.paymentMethod,
        createdAt: row.createdAt.toISOString(),
        delivery: row.delivery ? { id: row.delivery.id, name: row.delivery.name } : null,
        items: row.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            product: item.product ? { id: item.product.id, name: item.product.name } : null,
        })),
    }));

    return <SalesHistory orders={orders} />;
}

