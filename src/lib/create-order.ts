import { prisma } from "@/lib/prisma";

export class OrderCreationError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

// "price" del cliente ya NO se usa para cobrar ni para guardar en la orden --
// solo queda por compatibilidad de tipo con quien todavía lo mande; el precio
// real siempre sale de la base de datos (ver nota de seguridad abajo).
type OrderItemInput = { productId: string; quantity: number; price?: number; name?: string };

// Código numérico aleatorio de 6 dígitos para verificar la entrega.
export function generateDeliveryCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOrderWithStockCheck(params: {
    customerName?: string;
    address: string;
    // "total" del cliente queda solo como referencia/compatibilidad -- NUNCA
    // se usa para cobrar. El monto real que se guarda en la orden (y que
    // cada pasarela debe leer para saber cuánto cobrar) es totalServer,
    // calculado abajo con los precios reales de la base de datos. Antes esto
    // venía directo del navegador: cualquiera con las herramientas de
    // desarrollador podía cambiar el precio antes de que llegara al
    // servidor y pagar lo que quisiera.
    total?: number;
    items: OrderItemInput[];
    userId?: string;
    paymentMethod: string; // CASH | STRIPE (CONEKTA/CLIP/MERCADOPAGO solo quedan por historial de ordenes viejas)
    paymentStatus: string; // PENDING | APPROVED | REJECTED
}) {
    const { items } = params;

    // ── Validar stock disponible Y traer el precio real antes de crear la
    // orden ── Antes era un findUnique por producto EN SERIE (un viaje a la
    // base de datos tras otro) -- con un solo findMany se trae todo en una
    // sola ida y vuelta, y se valida en memoria.
    const products = await prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, stock: true, status: true, price: true, name: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    let totalServer = 0;
    for (const item of items) {
        const product = productById.get(item.productId);
        if (!product) {
            throw new OrderCreationError(`El producto ${item.productId} ya no existe`, 400);
        }
        if (product.status !== "ACTIVE" || product.stock < item.quantity) {
            throw new OrderCreationError(
                `No hay suficiente stock para "${item.name || product.name}"`,
                409
            );
        }
        totalServer += product.price * item.quantity;
    }

    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                customerName: params.customerName,
                address: params.address,
                total: totalServer,
                status: "PENDING",
                paymentMethod: params.paymentMethod,
                paymentStatus: params.paymentStatus,
                deliveryCode: generateDeliveryCode(),
                deliveryCodeStatus: "GENERATED",
                ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
                items: {
                    // El precio que se guarda en cada renglón es el real de la
                    // base de datos en el momento de la compra (product.price),
                    // nunca el que mandó el cliente.
                    create: items.map((item) => ({
                        product: { connect: { id: item.productId } },
                        quantity: item.quantity,
                        price: productById.get(item.productId)!.price,
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

    return order;
}

// Cancela una orden PENDING y devuelve el stock que había apartado -- se usa
// cuando se adelantó la creación de un intento de pago (ver prefetch en
// cart/page.tsx) pero el cliente cambió el carrito antes de llegar a pagar:
// el pedido viejo ya no sirve y no debe quedarse con stock apartado para
// siempre. `ownerUserId`, si se pasa, exige que coincida con el dueño real
// de la orden -- así nadie puede cancelar (y liberar stock de) el pedido
// pendiente de otra persona mandando un id ajeno.
export async function cancelPendingOrderAndRestoreStock(orderId: string, ownerUserId?: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { paymentStatus: true, userId: true },
    });
    if (!order || order.paymentStatus !== "PENDING") return false;
    if (ownerUserId && order.userId !== ownerUserId) return false;

    await prisma.$transaction(async (tx) => {
        // status (entrega) también se cierra a CANCELLED -- si solo se toca
        // paymentStatus, la orden se queda con status "PENDING" para
        // siempre y "Mis pedidos" la sigue mostrando como "en curso" (esa
        // sección filtra por status, no por paymentStatus).
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REJECTED", status: "CANCELLED" } });
        const items = await tx.orderItem.findMany({ where: { orderId } });
        await Promise.all(
            items.map((item) =>
                tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                })
            )
        );
    });
    return true;
}
