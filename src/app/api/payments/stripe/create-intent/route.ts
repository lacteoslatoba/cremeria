import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
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

        const order = await createOrderWithStockCheck({
            customerName: body.customerName,
            address: body.address,
            total: body.total,
            items,
            userId: body.userId,
            paymentMethod: "STRIPE",
            paymentStatus: "PENDING",
        });

        // Envía por SMS el código de verificación de entrega al cliente cuando
        // levanta su compra. Fire-and-forget: un fallo de SMS no bloquea el pago.
        if (body.userId) {
            try {
                const u = await prisma.user.findUnique({
                    where: { id: body.userId },
                    select: { phone: true },
                });
                if (u?.phone) notifyDeliveryCode(order, u.phone).catch(() => { });
            } catch {
                // no bloquear el flujo si falla la consulta del teléfono
            }
        }

        const stripe = getStripe();
        const amountInCents = Math.round(Number(body.total) * 100);

        const intent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "mxn",
            description: `Pedido Cremería del Rancho #${order.id.slice(-6).toUpperCase()}`,
            metadata: { orderId: order.id },
            receipt_email: body.payerEmail || undefined,
            // Antes "automatic_payment_methods: { enabled: true }" -- eso
            // agregaba automaticamente cualquier metodo activo en el
            // Dashboard de Stripe, incluido "Link" (la caja de "Opcional:
            // guardar mis datos..." con correo/celular/nombre que aparecia
            // arriba del boton de Pagar). Fijar el tipo a solo tarjeta la
            // quita de raiz sin tocar nada del lado de Stripe.
            payment_method_types: ["card"],
        });

        await prisma.order.update({
            where: { id: order.id },
            data: { stripePaymentIntentId: intent.id },
        });

        return NextResponse.json({
            orderId: order.id,
            clientSecret: intent.client_secret,
        });
    } catch (error: any) {
        if (error instanceof OrderCreationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[STRIPE_CREATE_INTENT_ERROR]", error);
        return NextResponse.json({ error: error?.message || "No se pudo iniciar el pago con Stripe" }, { status: 500 });
    }
}
