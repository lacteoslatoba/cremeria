// Los pedidos PENDING que nadie llega a pagar (cierran la app a medio
// checkout, se les acaba el internet, cambian de opinión, etc.) se quedaban
// PENDING para siempre: nunca expiraban solas. Eso hacía dos cosas malas:
//  1. Mis pedidos mostraba "Pedido actual" con decenas de pedidos viejos
//     (el cliente los ve como si siguieran en curso, para siempre).
//  2. El stock que se apartó al crear la orden nunca se devolvía -- se
//     quedaba "fantasma" restado del inventario real aunque la venta nunca
//     se completó.
//
// Esta función se llama de forma oportunista (no depende de un cron): cada
// vez que alguien carga Mis pedidos o el admin carga el panel de pedidos,
// se hace un barrido acotado de los pedidos PENDING más viejos que el
// umbral. Para Stripe primero se reverifica contra la API real (nunca se
// asume que está muerto solo por su edad -- podría estar genuinamente en
// proceso), y si de verdad sigue sin resolverse, se cancela el
// PaymentIntent para que ya no se pueda completar más tarde con un cobro
// fantasma sobre stock que ya se devolvió.

import { prisma } from "@/lib/prisma";

// Qué tan viejo debe ser un PENDING para considerarse abandonado. Un
// checkout real (incluida 3DS) toma minutos, no horas -- 2h es generoso.
const STALE_PENDING_MS = 2 * 60 * 60 * 1000;
const BATCH_LIMIT = 100;

export async function expireStalePendingOrders(opts?: { userId?: string }): Promise<{ checked: number; expired: number }> {
    const cutoff = new Date(Date.now() - STALE_PENDING_MS);

    const stale = await prisma.order.findMany({
        where: {
            paymentStatus: "PENDING",
            createdAt: { lt: cutoff },
            ...(opts?.userId ? { userId: opts.userId } : {}),
        },
        select: { id: true, paymentMethod: true, stripePaymentIntentId: true },
        orderBy: { createdAt: "asc" },
        take: BATCH_LIMIT,
    });

    let expired = 0;
    for (const order of stale) {
        try {
            const didExpire = await expireOne(order);
            if (didExpire) expired++;
        } catch (err) {
            // Un pedido con problemas (p. ej. Stripe caído un instante) no
            // debe tumbar el barrido de los demás.
            console.error("[ORDER_EXPIRY] Error al expirar", order.id, err);
        }
    }

    return { checked: stale.length, expired };
}

async function expireOne(order: { id: string; paymentMethod: string; stripePaymentIntentId: string | null }): Promise<boolean> {
    if (order.paymentMethod === "STRIPE" && order.stripePaymentIntentId) {
        // Primero la verdad real de Stripe -- si de milagro sí se completó
        // (webhook perdido, reconciliación que nunca corrió), esto lo deja
        // como APPROVED en vez de tirarlo.
        const { reconcileStripeOrder, getStripe } = await import("@/lib/stripe");
        const reconciled = await reconcileStripeOrder(order.id);
        if (!reconciled || reconciled.paymentStatus !== "PENDING") return false; // ya se resolvió solo

        // Sigue sin resolverse después de 2h: se cancela el PaymentIntent
        // para que nadie pueda completarlo más tarde sobre stock que ya
        // devolvimos (evita un cobro fantasma).
        try {
            await getStripe().paymentIntents.cancel(order.stripePaymentIntentId);
        } catch {
            // Ya cancelado/no cancelable (p. ej. "processing") -- no bloquea
            // que rechacemos nuestra orden de todos modos.
        }
    }
    // CONEKTA/CLIP/MERCADOPAGO: pasarelas ya eliminadas, imposible que se
    // resuelvan solas. CASH viejo en PENDING: artefacto de versiones
    // anteriores (hoy Efectivo siempre se crea ya APROBADO). En ambos casos
    // no hay nada más que verificar -- se rechaza directo.
    const { cancelPendingOrderAndRestoreStock } = await import("@/lib/create-order");
    return cancelPendingOrderAndRestoreStock(order.id);
}
