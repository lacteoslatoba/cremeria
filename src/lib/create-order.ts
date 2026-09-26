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

// Horario de pedidos (25/09, instruccion directa de Mike): de 9am a 4pm --
// fuera de ese rango no se acepta un pedido nuevo porque no se alcanza a
// entregar el mismo dia. Hora de Baja California Sur (America/Mazatlan,
// UTC-7 todo el año desde que Mexico quito el horario de verano en 2022 --
// NO es la hora del servidor, que en Vercel corre en UTC).
const ZONA_HORARIA_NEGOCIO = "America/Mazatlan";
const HORA_APERTURA = 9;
const HORA_CIERRE = 16;

function horaActualDelNegocio(): number {
    const formateador = new Intl.DateTimeFormat("en-US", {
        timeZone: ZONA_HORARIA_NEGOCIO,
        hour: "numeric",
        hour12: false,
    });
    return Number(formateador.format(new Date()));
}

export function dentroDeHorario(): boolean {
    const hora = horaActualDelNegocio();
    return hora >= HORA_APERTURA && hora < HORA_CIERRE;
}

export async function createOrderWithStockCheck(params: {
    customerName?: string;
    // Ya no es obligatorio: la orden puede crearse sin ubicacion y
    // confirmarse despues del pago (ver /direccion/[orderId]).
    address?: string;
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

    if (!dentroDeHorario()) {
        throw new OrderCreationError(
            `Solo recibimos pedidos de ${HORA_APERTURA}:00 am a ${HORA_CIERRE - 12}:00 pm -- fuera de ese horario no alcanzamos a entregar el mismo día. Intenta de nuevo mañana.`,
            400
        );
    }

    // Un carrito vacío llegaba hasta aquí y creaba una orden REAL con total 0
    // y sin renglones: Stripe después la rechazaba (el monto no llega al
    // mínimo de la moneda) y quedaba basura PENDING en la base de datos, con
    // el checkout mostrando un error crudo de Stripe en vez de algo que el
    // cliente entienda. Se corta de raíz, ANTES de la transacción (no se crea
    // la orden ni se aparta stock), para los dos caminos que pasan por aquí:
    // efectivo (/api/orders) y tarjeta (/api/payments/stripe/create-intent).
    if (items.length === 0) {
        throw new OrderCreationError("Tu carrito está vacío. Agrega productos antes de continuar.", 400);
    }

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

    // Suma de precios reales en 0 (o menos) no es un pedido pagable: ninguna
    // pasarela puede cobrar eso y en efectivo tampoco significa nada (es el
    // mismo tipo de orden basura que la del carrito vacío, pero con renglones
    // creados a partir de productos a $0). Se valida aquí, con el precio de
    // la base de datos, no con el total que manda el navegador.
    if (totalServer <= 0) {
        throw new OrderCreationError("El total del pedido no es válido. Revisa los precios de tu carrito.", 400);
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

        // Reserva/descuenta stock con OPTIMISTIC LOCKING para evitar la race
        // condition clásica (TOCTOU): en lugar de verificar stock y luego
        // decrementar en dos pasos separados, hacemos un UPDATE condicional
        // atómico. Si el UPDATE afecta 0 filas, significa que otro request
        // compró el último item entre nuestra verificación y este write — la
        // transacción hace rollback automáticamente con un 409 limpio.
        if (params.paymentStatus !== "REJECTED") {
            await Promise.all(
                items.map(async (item) => {
                    const updated: number = await tx.$executeRaw`
                        UPDATE "Product"
                        SET stock = stock - ${item.quantity}
                        WHERE id = ${item.productId}
                          AND stock >= ${item.quantity}
                    `;
                    if (updated === 0) {
                        throw new OrderCreationError(
                            `Sin stock suficiente para "${productById.get(item.productId)?.name ?? item.productId}". Intenta de nuevo.`,
                            409
                        );
                    }
                })
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
