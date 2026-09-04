import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { requireAuth, readSession } from "@/lib/auth";
import { notifyDeliveryCode } from "@/lib/notify";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";
import { expireStalePendingOrders } from "@/lib/order-expiry";

// Solo ADMIN puede listar todos los pedidos: incluye datos de clientes
// (nombre, dirección) y el código de verificación de entrega de cada uno.
export async function GET(request: Request) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if (!auth.user) return auth.response;

    // Limpieza oportunista: el admin revisa este panel seguido, así que es
    // un buen punto para barrer PENDING abandonados de CUALQUIER usuario
    // (incluidos invitados, que no tienen sesión propia para disparar la
    // limpieza de /api/orders/mine). Acotado a un lote por llamada.
    await expireStalePendingOrders().catch(() => { });

    try {
        const orders = await prisma.order.findMany({
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Crea una orden real + reserva stock -- este endpoint también
        // admite invitados (sin cookie de sesión), así que el límite va por
        // IP en vez de por usuario.
        cleanupRateLimitBuckets();
        const throttled = rateLimit(`orders-post:${clientIp(request)}`, 20, 10 * 60 * 1000); // 20 / 10 min
        if (!throttled.allowed) {
            return NextResponse.json(
                { error: `Demasiados intentos. Intenta en ${throttled.retryAfterSeconds}s.` },
                { status: 429 }
            );
        }

        // El dueño de la orden sale de la sesión verificada (cookie firmada),
        // NUNCA de body.userId -- Efectivo sí admite invitados (userId queda
        // undefined para ellos, igual que siempre), pero un cliente con
        // sesión ya no puede mandar el id de otra persona para atribuirle
        // el pedido (y su SMS de código de entrega).
        const session = await readSession(request);
        const userId = session?.id;

        const body = await request.json();
        const items = body.items || [];

        // Esta ruta ya solo maneja Efectivo -- Stripe tiene su propia ruta
        // dedicada (/api/payments/stripe/create-intent). Antes aceptaba un
        // paymentMethod "CARD" genérico con estado que venía de Mercado Pago
        // (mpPaymentStatus), de cuando esta misma ruta manejaba varias
        // pasarelas -- ya no aplica, se quita esa rama muerta.
        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address,
            total: body.total,
            items,
            userId,
            paymentMethod: "CASH",
            paymentStatus: "APPROVED", // efectivo siempre queda aprobado de inmediato
        });

        // Igual que en el flujo de tarjeta: avisamos por SMS el código de
        // verificación de entrega (efectivo siempre queda aprobado de inmediato).
        if (userId) {
            try {
                const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
                if (u?.phone) notifyDeliveryCode(order, u.phone).catch(() => { });
            } catch {
                // no bloquear el flujo si falla la consulta del teléfono
            }
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
