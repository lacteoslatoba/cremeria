import { prisma } from "@/lib/prisma";

export class OrderCreationError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

type OrderItemInput = { productId: string; quantity: number; price: number; name?: string };

export async function createOrderWithStockCheck(params: {
    customerName?: string;
    address: string;
    total: number;
    items: OrderItemInput[];
    userId?: string;
    paymentMethod: string; // CASH | STRIPE (CARD/CLIP quedan solo por historial)
    paymentStatus: string; // PENDING | APPROVED | REJECTED
    mpPaymentId?: string | null; // solo por compatibilidad con ordenes historicas de Mercado Pago
    clipPaymentId?: string | null; // solo por compatibilidad con ordenes historicas de Clip
}) {
    const { items } = params;

    // ── Validar stock disponible antes de crear la orden ──
    for (const item of items) {
        const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { id: true, stock: true, status: true },
        });

        if (!product) {
            throw new OrderCreationError(`El producto ${item.productId} ya no existe`, 400);
        }
        if (product.status !== "ACTIVE" || product.stock < item.quantity) {
            throw new OrderCreationError(
                `No hay suficiente stock para "${item.name || item.productId}"`,
                409
            );
        }
    }

    return prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                customerName: params.customerName,
                address: params.address,
                total: params.total,
                status: "PENDING",
                paymentMethod: params.paymentMethod,
                paymentStatus: params.paymentStatus,
                mpPaymentId: params.mpPaymentId || null,
                clipPaymentId: params.clipPaymentId || null,
                ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
                items: {
                    create: items.map((item) => ({
                        product: { connect: { id: item.productId } },
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: { items: true },
        });

        // Reserve/deduct stock unless the payment already failed outright.
        if (params.paymentStatus !== "REJECTED") {
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }
        }

        return newOrder;
    });
}
