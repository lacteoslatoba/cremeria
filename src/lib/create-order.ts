import { prisma } from "@/lib/prisma";

export class OrderCreationError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

type OrderItemInput = { productId: string; quantity: number; price: number; name?: string };

// Código numérico aleatorio de 6 dígitos para verificar la entrega.
export function generateDeliveryCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOrderWithStockCheck(params: {
    customerName?: string;
    address: string;
    total: number;
    items: OrderItemInput[];
    userId?: string;
    paymentMethod: string; // CASH | CONEKTA (STRIPE en pausa; CARD/CLIP/MERCADOPAGO quedan solo por historial)
    paymentStatus: string; // PENDING | APPROVED | REJECTED
    mpPaymentId?: string | null; // solo por compatibilidad con ordenes historicas de Mercado Pago
    clipPaymentId?: string | null; // solo por compatibilidad con ordenes historicas de Clip
}) {
    const { items } = params;

    // ── Validar stock disponible antes de crear la orden ──
    // Antes era un findUnique por producto EN SERIE (un viaje a la base de
    // datos tras otro) -- con un solo findMany se trae todo en una sola
    // ida y vuelta, y se valida en memoria. Con 4-5 productos en el
    // carrito esto solía ser el tramo más lento de todo el checkout.
    const products = await prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, stock: true, status: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
        const product = productById.get(item.productId);
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
                deliveryCode: generateDeliveryCode(),
                deliveryCodeStatus: "GENERATED",
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
        // En paralelo -- son productos distintos, no hay fila compartida
        // entre ellos que se puedan pisar, así que no hace falta esperarlos
        // uno por uno.
        if (params.paymentStatus !== "REJECTED") {
            await Promise.all(
                items.map((item) =>
                    tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } },
                    })
                )
            );
        }

        return newOrder;
    });
}
