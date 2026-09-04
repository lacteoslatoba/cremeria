import { NextResponse } from "next/server";
import { getStripe, getOrCreateStripeCustomer, createStripeCustomerSession } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createOrderWithStockCheck, OrderCreationError } from "@/lib/create-order";
import { notifyDeliveryCode } from "@/lib/notify";

// Crea la orden (PENDING/PENDING, stock reservado — igual que un pago con
// tarjeta "in_process" de MP) y una PaymentIntent de Stripe para ese monto.
// El PaymentElement del checkout usa el clientSecret para cobrar sin salir
// de la página; la orden solo se aprueba tras reverificar el estado real
// contra la API de Stripe (ver /confirm y /webhook).
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = body.items || [];

        // La orden (valida stock, etc.) y el Customer de Stripe no dependen
        // uno del otro -- antes se esperaban en serie. El Customer solo
        // necesita el userId, no la orden ya creada, así que corren en
        // paralelo. Invitados no pueden guardar tarjeta (no hay a quién
        // ligarla) -- "guest" es el id fijo que usa el botón de Invitado
        // (no existe en la base de datos), se descarta antes de intentar
        // siquiera la consulta.
        const [order, stripeCustomerId] = await Promise.all([
            createOrderWithStockCheck({
                customerName: body.customerName,
                address: body.address,
                total: body.total,
                items,
                userId: body.userId,
                paymentMethod: "STRIPE",
                paymentStatus: "PENDING",
            }),
            (body.userId && body.userId !== "guest") ? getOrCreateStripeCustomer(body.userId) : Promise.resolve(null),
        ]);

        // Envía por SMS el código de verificación de entrega al cliente cuando
        // levanta su compra. Fire-and-forget de verdad -- antes el lookup del
        // teléfono sí se esperaba (await) antes de seguir, aunque el envío en
        // sí ya no bloqueara nada. Sin ese await, esta ida a la base de datos
        // ya no suma a la espera del clientSecret.
        if (body.userId) {
            prisma.user.findUnique({ where: { id: body.userId }, select: { phone: true } })
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
