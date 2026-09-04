import { NextResponse } from "next/server";
import { getStripe, getOrCreateStripeCustomer, createStripeCustomerSession } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { notifyDeliveryCode } from "@/lib/notify";
import { readSession } from "@/lib/auth";
import { rateLimit, cleanupRateLimitBuckets, clientIp } from "@/lib/rate-limit";

// Crea la orden (PENDING/PENDING, stock reservado — igual que un pago con
// tarjeta "in_process" de MP) y una PaymentIntent de Stripe para ese monto.
// El PaymentElement del checkout usa el clientSecret para cobrar sin salir
// de la página; la orden solo se aprueba tras reverificar el estado real
// contra la API de Stripe (ver /confirm y /webhook).
export async function POST(request: Request) {
    try {
        // Cada llamada crea una orden real + reserva stock + llama a la API
        // de Stripe -- sin límite, alguien podría martillar este endpoint
        // para agotar inventario o generar carga real de facturación.
        // Límite generoso a propósito: el carrito adelanta un pedido nuevo
        // cada vez que cambian las cantidades (ver stripe-prefetch.ts), así
        // que alguien comprando de verdad y ajustando su carrito varias
        // veces puede disparar bastantes llamadas legítimas en pocos minutos.
        cleanupRateLimitBuckets();
        const throttled = rateLimit(`stripe-intent:${clientIp(request)}`, 30, 10 * 60 * 1000); // 30 / 10 min
        if (!throttled.allowed) {
            return NextResponse.json(
                { error: `Demasiados intentos. Intenta en ${throttled.retryAfterSeconds}s.` },
                { status: 429 }
            );
        }

        const body = await request.json();
        const items = body.items || [];

        // El dueño de la orden sale de la sesión verificada (cookie firmada),
        // NUNCA de body.userId -- antes se confiaba directo en lo que mandaba
        // el navegador, así que cualquiera podía mandar el id de otra
        // persona y la orden (y el correo/SMS del código de entrega) le
        // quedaba atribuida a ella. Invitados no tienen cookie de sesión, así
        // que userId queda undefined para ellos (mismo comportamiento de
        // siempre: sin guardar tarjeta, sin SMS).
        const session = await readSession(request);
        const userId = session?.id;

        // La orden (valida stock, etc.) y el Customer de Stripe no dependen
        // uno del otro -- antes se esperaban en serie. El Customer solo
        // necesita el userId, no la orden ya creada, así que corren en
        // paralelo.
        const [order, stripeCustomerId] = await Promise.all([
            createOrderWithStockCheck({
                customerName: body.customerName,
                address: body.address,
                total: body.total,
                items,
                userId,
                paymentMethod: "STRIPE",
                paymentStatus: "PENDING",
            }),
            userId ? getOrCreateStripeCustomer(userId) : Promise.resolve(null),
        ]);

        // Envía por SMS el código de verificación de entrega al cliente cuando
        // levanta su compra. Fire-and-forget de verdad -- antes el lookup del
        // teléfono sí se esperaba (await) antes de seguir, aunque el envío en
        // sí ya no bloqueara nada. Sin ese await, esta ida a la base de datos
        // ya no suma a la espera del clientSecret.
        if (userId) {
            prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
                .then((u) => { if (u?.phone) notifyDeliveryCode(order, u.phone).catch(() => { }); })
                .catch(() => { /* no bloquear el flujo si falla la consulta del teléfono */ });
        }

        const stripe = getStripe();
        // El monto que se cobra sale de order.total (calculado en el
        // servidor con los precios reales de la base de datos, ver
        // create-order.ts) -- NUNCA de body.total. Antes se usaba
        // body.total directo: cualquiera con las herramientas de
        // desarrollador podía cambiar el precio antes de que llegara al
        // servidor y pagar lo que quisiera.
        const amountInCents = Math.round(order.total * 100);

        const [intent, customerSessionClientSecret] = await Promise.all([
            stripe.paymentIntents.create({
                amount: amountInCents,
                currency: "mxn",
                description: `Pedido Cremería del Rancho #${order.id.slice(-6).toUpperCase()}`,
                metadata: { orderId: order.id },
                receipt_email: body.payerEmail || undefined,
                customer: stripeCustomerId || undefined,
                // Antes "automatic_payment_methods: { enabled: true }" -- eso
                // agregaba automaticamente cualquier metodo activo en el
                // Dashboard de Stripe, incluido "Link" (la caja de "Opcional:
                // guardar mis datos..." con correo/celular/nombre que aparecia
                // arriba del boton de Pagar). Fijar el tipo a solo tarjeta la
                // quita de raiz sin tocar nada del lado de Stripe.
                payment_method_types: ["card"],
            }),
            stripeCustomerId ? createStripeCustomerSession(stripeCustomerId) : Promise.resolve(null),
        ]);

        await prisma.order.update({
            where: { id: order.id },
            data: { stripePaymentIntentId: intent.id },
        });

        return NextResponse.json({
            orderId: order.id,
            clientSecret: intent.client_secret,
            customerSessionClientSecret,
        });
    } catch (error: any) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[STRIPE_CREATE_INTENT_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo iniciar el pago con Stripe" }, { status: 500 });
    }
}
